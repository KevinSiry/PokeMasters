import { TIERS, type Tier, boosterSize, gameConfig, tierRank } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { EmptyPoolError, drawBoosterSlots, drawFinish, drawIndex, rollGodPack } from "./booster";
import { seededRng } from "./rng";

const cfg = gameConfig.boosters;
const modern = cfg.layouts.modern;
const classic = cfg.layouts.classic;
const fullPools: Record<Tier, number> = { common: 5000, uncommon: 5000, rare: 4000, epic: 1500, legendary: 2500, mythic: 400 };
const draw = (layout: typeof modern | typeof classic, pools: Record<Tier, number>, rng = seededRng(1)) =>
  drawBoosterSlots(layout, pools, cfg.tierWeights, rng).map((s) => s.tier);

describe("drawBoosterSlots", () => {
  it("compose un booster moderne comme un vrai : 4 Communes, 3 Peu Communes, 2 reverses, la rare à la fin", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 2000; i++) {
      const slots = drawBoosterSlots(modern, fullPools, cfg.tierWeights, rng);
      expect(slots).toHaveLength(boosterSize("modern"));
      expect(slots.slice(0, 4).every((s) => s.tier === "common")).toBe(true);
      expect(slots.slice(4, 7).every((s) => s.tier === "uncommon")).toBe(true);
      expect(slots.slice(7, 9).every((s) => s.finishWeights?.reverse)).toBe(true);
      expect(tierRank(slots[9]!.tier)).toBeGreaterThanOrEqual(tierRank("rare"));
    }
  });

  it("compose un booster de l'époque Wizards : 7 Communes, 3 Peu Communes, une Rare holo une fois sur trois", () => {
    const rng = seededRng(5);
    let holo = 0;
    const n = 30_000;
    for (let i = 0; i < n; i++) {
      const tiers = draw(classic, fullPools, rng);
      expect(tiers).toHaveLength(11);
      expect(tiers.slice(0, 7).every((t) => t === "common")).toBe(true);
      if (tiers[10] === "epic") holo++;
    }
    expect(Math.abs(holo / n - 1 / 3)).toBeLessThan(0.01);
  });

  it("respecte les taux de l'emplacement rare (200 000 boosters)", () => {
    const rng = seededRng(2026);
    const counts = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
    const n = 200_000;
    const rare = modern[modern.length - 1]!.tiers as Partial<Record<Tier, number>>;
    const total = TIERS.reduce((s, t) => s + (rare[t] ?? 0), 0);
    for (let i = 0; i < n; i++) counts[draw(modern, fullPools, rng).at(-1)!]++;
    for (const t of TIERS) expect(Math.abs(counts[t] / n - (rare[t] ?? 0) / total)).toBeLessThan(0.004);
  });

  it("ignore les tiers absents du pool et se rabat sur ceux qui existent", () => {
    const rng = seededRng(7);
    const oldSet = { ...fullPools, legendary: 0, mythic: 0 };
    for (let i = 0; i < 5000; i++) {
      const tiers = draw(modern, oldSet, rng);
      expect(tiers).not.toContain("legendary");
      expect(tiers).not.toContain("mythic");
    }
    const onlyCommons = { common: 10, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
    expect(draw(modern, onlyCommons)).toEqual(Array(10).fill("common"));
  });

  it("échoue sur un pool vide", () => {
    const empty = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
    expect(() => draw(modern, empty)).toThrow(EmptyPoolError);
  });
});

describe("rollGodPack", () => {
  it("sort environ une fois sur oneIn, avec autant de cartes que le paquet, toutes grosses raretés", () => {
    const rng = seededRng(99);
    const n = 200_000;
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const god = rollGodPack(modern, cfg.godPack, fullPools, rng);
      if (!god) continue;
      hits++;
      const tiers = drawBoosterSlots(god, fullPools, cfg.tierWeights, rng).map((s) => s.tier);
      expect(tiers).toHaveLength(10);
      expect(tiers.every((t) => tierRank(t) >= tierRank("epic"))).toBe(true);
    }
    expect(Math.abs(hits / n - 1 / cfg.godPack.oneIn)).toBeLessThan(0.0004);
  });

  it("n'existe pas pour un set sans grosses raretés", () => {
    const rng = { int: () => 0 };
    const noHits = { ...fullPools, epic: 0, legendary: 0, mythic: 0 };
    expect(rollGodPack(modern, cfg.godPack, noHits, rng)).toBeNull();
    expect(rollGodPack(classic, cfg.godPack, fullPools, rng)![0]!.count).toBe(11);
  });
});

describe("drawFinish", () => {
  const w = gameConfig.finishes.weights;
  it("ne tire que des finitions existantes", () => {
    const rng = seededRng(5);
    for (let i = 0; i < 2000; i++) {
      expect(["normal", "reverse"]).toContain(drawFinish({ normal: true, reverse: true }, w, rng));
      expect(drawFinish({ holo: true, firstEdition: false }, w, rng)).toBe("holo");
    }
  });
  it("retombe sur normale sans variante connue", () => {
    expect(drawFinish(null, w, seededRng(1))).toBe("normal");
    expect(drawFinish({}, w, seededRng(1))).toBe("normal");
  });
});

describe("drawIndex", () => {
  it("reste dans le pool", () => {
    const rng = seededRng(9);
    for (let i = 0; i < 1000; i++) {
      const k = drawIndex(17, rng);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(17);
    }
    expect(() => drawIndex(0, rng)).toThrow(EmptyPoolError);
  });
});
