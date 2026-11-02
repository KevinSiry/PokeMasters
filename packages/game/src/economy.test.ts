import { TIERS, type Tier, gameConfig } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { drawBoosterSlots, expectedLayoutValue } from "./booster";
import {
  InsufficientFundsError,
  applyDelta,
  pickDuplicates,
  recyclePayout,
  setCompletionBonus,
  rarityCompletionBonus,
  type RecyclableCopy,
} from "./economy";
import { seededRng } from "./rng";

const values = gameConfig.economy.recycleValue;

describe("applyDelta", () => {
  it("crédite et débite", () => {
    expect(applyDelta(10, 5)).toBe(15);
    expect(applyDelta(10, -10)).toBe(0);
  });
  it("refuse un solde négatif", () => {
    expect(() => applyDelta(10, -11)).toThrow(InsufficientFundsError);
  });
  it("refuse un montant non entier", () => {
    expect(() => applyDelta(10, 1.5)).toThrow(RangeError);
  });
  it("ne passe jamais sous zéro sur une suite aléatoire de mouvements", () => {
    const rng = seededRng(11);
    let balance = 0;
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const delta = rng.int(400) - 200;
      try {
        balance = applyDelta(balance, delta);
        sum += delta;
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientFundsError);
      }
      expect(balance).toBeGreaterThanOrEqual(0);
    }
    expect(balance).toBe(sum);
  });
});

const t0 = new Date("2026-01-01T00:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
function copy(id: string, cardId: string, tier: Tier, finish: RecyclableCopy["finish"] = "normal", min = 0): RecyclableCopy {
  return { id, cardId, tier, finish, obtainedAt: at(min) };
}

describe("pickDuplicates", () => {
  it("garde un exemplaire par carte", () => {
    const copies = [copy("a1", "A", "common", "normal", 0), copy("a2", "A", "common", "normal", 1), copy("a3", "A", "common", "normal", 2), copy("b1", "B", "rare")];
    expect(pickDuplicates(copies).map((c) => c.id)).toEqual(["a2", "a3"]);
  });
  it("garde la plus belle finition, puis le plus ancien", () => {
    const copies = [copy("n", "A", "rare", "normal", 0), copy("h", "A", "rare", "holo", 5), copy("r", "A", "rare", "reverse", 1), copy("h2", "A", "rare", "holo", 9)];
    expect(pickDuplicates(copies).map((c) => c.id).sort()).toEqual(["h2", "n", "r"]);
  });
  it("respecte le filtre de tiers", () => {
    const copies = [copy("a1", "A", "common"), copy("a2", "A", "common", "normal", 1), copy("m1", "M", "mythic"), copy("m2", "M", "mythic", "normal", 1)];
    expect(pickDuplicates(copies, ["common"]).map((c) => c.id)).toEqual(["a2"]);
  });
  it("ne touche pas aux cartes favorites", () => {
    const copies = [copy("a1", "A", "common"), copy("a2", "A", "common", "normal", 1), copy("b1", "B", "rare"), copy("b2", "B", "rare", "normal", 1)];
    expect(pickDuplicates(copies, undefined, new Set(["B"])).map((c) => c.id)).toEqual(["a2"]);
  });
  it("ne touche à rien sans doublon", () => {
    expect(pickDuplicates([copy("a", "A", "common"), copy("b", "B", "common")])).toEqual([]);
  });
});

describe("recyclePayout", () => {
  it("additionne les valeurs par tier", () => {
    const p = recyclePayout([{ tier: "common" }, { tier: "rare" }, { tier: "rare" }, { tier: "mythic" }], values);
    expect(p.total).toBe(1 + 10 + 10 + 600);
    expect(p.count).toBe(4);
    expect(p.byTier.rare).toBe(2);
  });
});

describe("setCompletionBonus", () => {
  it("vaut 5 × le nombre officiel de cartes", () => {
    expect(setCompletionBonus(102, gameConfig.economy.setCompletionBonusPerCard)).toBe(510);
    expect(setCompletionBonus(0, 5)).toBe(5);
  });
});

describe("équilibrage", () => {
  const { layouts, tierWeights, setBoosterPrice } = gameConfig.boosters;

  it("un booster gratuit (10 cartes) vaut ~50 Jetons recyclé", () => {
    const expected = expectedLayoutValue(layouts.modern, values);
    expect(expected).toBeGreaterThan(45);
    expect(expected).toBeLessThan(55);
  });

  it("la simulation de 100 000 boosters confirme l'espérance", () => {
    const rng = seededRng(4);
    const pools = Object.fromEntries(TIERS.map((t) => [t, 100])) as Record<Tier, number>;
    let total = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) for (const s of drawBoosterSlots(layouts.modern, pools, tierWeights, rng)) total += values[s.tier];
    expect(Math.abs(total / n - expectedLayoutValue(layouts.modern, values))).toBeLessThan(1);
  });

  it("le booster de set est un puits : environ 3× la valeur d'un booster gratuit", () => {
    for (const layout of [layouts.modern, layouts.classic]) {
      const ratio = setBoosterPrice / expectedLayoutValue(layout, values);
      expect(ratio).toBeGreaterThan(2.5);
      expect(ratio).toBeLessThan(4.5);
    }
  });
});

describe("rarityCompletionBonus", () => {
  it("vaut perCard × nombre de cartes du tier", () => {
    expect(rarityCompletionBonus(16, 6, 3)).toBe(96);
  });
  it("ne donne rien sous le minimum de cartes", () => {
    expect(rarityCompletionBonus(2, 50, 3)).toBe(0);
    expect(rarityCompletionBonus(3, 50, 3)).toBe(150);
  });
});

describe("pickDuplicates et exemplaires protégés", () => {
  const at = (n: number) => new Date(2026, 0, n);
  it("garde l'exemplaire protégé et ne recycle jamais un protégé", () => {
    const copies = [
      { id: "a", cardId: "x", tier: "common" as const, finish: "holo" as const, obtainedAt: at(1) },
      { id: "b", cardId: "x", tier: "common" as const, finish: "normal" as const, obtainedAt: at(2), locked: true },
      { id: "c", cardId: "x", tier: "common" as const, finish: "normal" as const, obtainedAt: at(3), locked: true },
    ];
    expect(pickDuplicates(copies).map((c) => c.id)).toEqual(["a"]);
  });
});
