import { TIERS, type Tier, gameConfig, tierRank } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { EmptyPoolError, drawBoosterTiers, drawFinish, drawIndex } from "./booster";
import { seededRng } from "./rng";

const cfg = gameConfig.boosters;
const fullPools: Record<Tier, number> = { common: 5000, uncommon: 5000, rare: 4000, epic: 1500, legendary: 2500, mythic: 400 };

describe("drawBoosterTiers", () => {
  it("tire 5 cartes triées du moins rare au plus rare", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 1000; i++) {
      const tiers = drawBoosterTiers(cfg, fullPools, rng);
      expect(tiers).toHaveLength(cfg.size);
      for (let j = 1; j < tiers.length; j++) expect(tierRank(tiers[j]!)).toBeGreaterThanOrEqual(tierRank(tiers[j - 1]!));
    }
  });

  it("garantit au moins une Peu commune ou mieux dans chaque booster", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 20_000; i++) {
      const tiers = drawBoosterTiers(cfg, fullPools, rng);
      expect(tiers.some((t) => tierRank(t) >= tierRank("uncommon"))).toBe(true);
    }
  });

  it("respecte la distribution configurée (100 000 boosters, hors emplacement garanti)", () => {
    const rng = seededRng(2026);
    const counts = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      // Les 4 premiers emplacements ne sont jamais touchés par la garantie.
      const tiers = drawBoosterTiers({ ...cfg, guaranteedMinTier: "common" }, fullPools, rng);
      for (const t of tiers) counts[t]++;
    }
    const total = TIERS.reduce((s, t) => s + cfg.tierWeights[t], 0);
    for (const t of TIERS) {
      expect(Math.abs(counts[t] / (n * cfg.size) - cfg.tierWeights[t] / total)).toBeLessThan(0.005);
    }
    // Un Mythique tous les ~100 boosters : ni introuvable, ni banal.
    expect(counts.mythic).toBeGreaterThan(700);
    expect(counts.mythic).toBeLessThan(1300);
  });

  it("redistribue le poids des tiers absents du pool", () => {
    const rng = seededRng(7);
    const oldSet = { ...fullPools, legendary: 0, mythic: 0 };
    for (let i = 0; i < 5000; i++) {
      const tiers = drawBoosterTiers(cfg, oldSet, rng);
      expect(tiers).not.toContain("legendary");
      expect(tiers).not.toContain("mythic");
    }
  });

  it("échoue sur un pool vide", () => {
    const empty = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
    expect(() => drawBoosterTiers(cfg, empty, seededRng(1))).toThrow(EmptyPoolError);
  });

  it("se contente du meilleur disponible si aucun tier garanti n'existe", () => {
    const onlyCommons = { common: 10, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
    expect(drawBoosterTiers(cfg, onlyCommons, seededRng(3))).toEqual(Array(5).fill("common"));
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
