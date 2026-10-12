import { describe, expect, it } from "vitest";
import { FINISHES, TIERS, gameConfig, tierRank } from "./game";

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

  it("garde le booster de set plus cher que la valeur moyenne de recyclage d'un booster gratuit", () => {
    const { tierWeights, size, setBoosterPrice } = gameConfig.boosters;
    const total = TIERS.reduce((s, t) => s + tierWeights[t], 0);
    const expectedPerCard = TIERS.reduce(
      (s, t) => s + (tierWeights[t] / total) * gameConfig.economy.recycleValue[t],
      0,
    );
    expect(setBoosterPrice).toBeGreaterThan(expectedPerCard * size * 2);
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
