import { FALLBACK_TIER, TIERS, type Tier, tierRank } from "@pokeflex/config";

export interface TierInput {
  rarityRaw: string | null | undefined;
  /** Prix Cardmarket (tendance, EUR) si connu. */
  priceEur?: number | null;
}

export interface TierResult {
  tier: Tier;
  reason: "rarity" | "price_bump" | "fallback";
}

/**
 * Tier de jeu d'une carte : correspondance de la rareté officielle, puis montée
 * d'un seul tier si le prix marché dépasse le seuil du tier (plafond Mythique).
 */
export function computeTier(
  input: TierInput,
  mapping: Readonly<Record<string, Tier>>,
  priceBumpEur: Readonly<Record<Tier, number | null>>,
): TierResult {
  const raw = input.rarityRaw?.trim();
  const mapped = raw ? mapping[raw] : undefined;
  const base = mapped ?? FALLBACK_TIER;
  const threshold = priceBumpEur[base];
  const price = input.priceEur ?? null;
  if (threshold !== null && price !== null && Number.isFinite(price) && price >= threshold) {
    const next = TIERS[Math.min(tierRank(base) + 1, TIERS.length - 1)]!;
    return { tier: next, reason: "price_bump" };
  }
  return { tier: base, reason: mapped ? "rarity" : "fallback" };
}
