import { describe, expect, it } from "vitest";
import { FINISHES, TIERS, boosterLayoutFor, boosterSize, gameConfig, tierRank } from "./game";

describe("gameConfig", () => {
  it("définit un poids de tirage positif pour chaque tier, décroissant avec la rareté", () => {
    const weights = TIERS.map((t) => gameConfig.boosters.tierWeights[t]);
    for (const w of weights) expect(w).toBeGreaterThan(0);
    for (let i = 1; i < weights.length; i++) expect(weights[i]).toBeLessThan(weights[i - 1]!);
  });

  it("donne une valeur de recyclage croissante avec le tier", () => {
    const values = TIERS.map((t) => gameConfig.economy.recycleValue[t]);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);
  });

  it("garde le booster de set plus cher que deux fois la valeur de recyclage d'un booster gratuit", () => {
    const { layouts, setBoosterPrice } = gameConfig.boosters;
    for (const layout of Object.values(layouts)) {
      const value = layout.reduce((sum, slot) => {
        const w = slot.tiers as Partial<Record<(typeof TIERS)[number], number>>;
        const total = TIERS.reduce((s, t) => s + (w[t] ?? 0), 0);
        return sum + slot.count * TIERS.reduce((s, t) => s + ((w[t] ?? 0) / total) * gameConfig.economy.recycleValue[t], 0);
      }, 0);
      expect(setBoosterPrice).toBeGreaterThan(value * 2);
    }
  });

  it("compose des boosters de 10 cartes (moderne) et 11 cartes (Wizards)", () => {
    expect(boosterSize("modern")).toBe(10);
    expect(boosterSize("classic")).toBe(11);
    expect(boosterLayoutFor("base")).toBe("classic");
    expect(boosterLayoutFor("sv")).toBe("modern");
    expect(boosterLayoutFor(null)).toBe("modern");
  });

  it("a un poids de finition pour chaque finition", () => {
    for (const f of FINISHES) expect(gameConfig.finishes.weights[f]).toBeGreaterThan(0);
  });

  it("ordonne les tiers", () => {
    expect(tierRank("common")).toBe(0);
    expect(tierRank("mythic")).toBe(5);
  });

  it("a un stock initial compris dans le plafond", () => {
    expect(gameConfig.boosters.initialStock).toBeLessThanOrEqual(gameConfig.boosters.maxStock);
  });
});

describe("raretés officielles", () => {
  it("chaque rareté connue de TCGdex (FR et EN) a un libellé officiel", async () => {
    const { RARITY_TIERS, officialRarity } = await import("./rarities");
    for (const raw of Object.keys(RARITY_TIERS)) expect(officialRarity(raw), raw).not.toBeNull();
  });
  it("ramène les libellés FR et EN au même nom", async () => {
    const { officialRarity, rarityLabel } = await import("./rarities");
    expect(officialRarity("Double rare")).toBe("Double Rare");
    expect(officialRarity("Special illustration rare")).toBe("Illustration Spéciale Rare");
    expect(officialRarity("Holo Rare")).toBe(officialRarity("Rare Holo"));
    expect(officialRarity("Double Rare")).toBe("Double Rare");
    expect(rarityLabel({ rarityRaw: null, tier: "rare" })).toBe("Rare");
  });
});
