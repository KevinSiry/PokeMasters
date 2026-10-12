import { RARITY_TIERS, gameConfig } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { computeTier } from "./rarity";

const bump = gameConfig.rarity.priceBumpEur;

describe("computeTier", () => {
  it("applique la correspondance FR et EN", () => {
    expect(computeTier({ rarityRaw: "Peu Commune" }, RARITY_TIERS, bump)).toEqual({ tier: "uncommon", reason: "rarity" });
    expect(computeTier({ rarityRaw: "Uncommon" }, RARITY_TIERS, bump).tier).toBe("uncommon");
    expect(computeTier({ rarityRaw: "Illustration spéciale rare" }, RARITY_TIERS, bump).tier).toBe("mythic");
  });

  it("monte d'un seul tier quand le prix dépasse le seuil", () => {
    // Dracaufeu du Set de Base : « Rare », ~300 € → Épique, pas plus.
    expect(computeTier({ rarityRaw: "Rare", priceEur: 318 }, RARITY_TIERS, bump)).toEqual({
      tier: "epic",
      reason: "price_bump",
    });
    expect(computeTier({ rarityRaw: "Rare", priceEur: 14.99 }, RARITY_TIERS, bump).tier).toBe("rare");
  });

  it("ne dépasse jamais Mythique", () => {
    expect(computeTier({ rarityRaw: "Hyper rare", priceEur: 9999 }, RARITY_TIERS, bump).tier).toBe("mythic");
  });

  it("replie une rareté inconnue sur le tier par défaut", () => {
    expect(computeTier({ rarityRaw: "Rareté du futur" }, RARITY_TIERS, bump)).toEqual({
      tier: "common",
      reason: "fallback",
    });
    expect(computeTier({ rarityRaw: null }, RARITY_TIERS, bump).reason).toBe("fallback");
  });
});
