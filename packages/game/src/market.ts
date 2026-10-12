/** Règles pures du marché : frais, surenchère minimale, anti-« sniping ». */

export interface MarketRules {
  listingFeeRate: number;
  listingFeeMin: number;
  minPrice: number;
  maxPrice: number;
  minBidIncrement: number;
  minBidIncrementRate: number;
  antiSnipingWindowMs: number;
}

export class MarketRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketRuleError";
  }
}

/** Frais de mise en vente : un pourcentage du prix arrondi au Jeton supérieur, avec un minimum. */
export function listingFee(price: number, rules: Pick<MarketRules, "listingFeeRate" | "listingFeeMin">): number {
  return Math.max(rules.listingFeeMin, Math.ceil(price * rules.listingFeeRate));
}

/** Vérifie qu'un prix est un entier dans les bornes du marché. */
export function assertValidPrice(price: number, rules: Pick<MarketRules, "minPrice" | "maxPrice">): void {
  if (!Number.isSafeInteger(price) || price < rules.minPrice || price > rules.maxPrice) {
    throw new MarketRuleError(`Le prix doit être un nombre entier entre ${rules.minPrice} et ${rules.maxPrice.toLocaleString("fr-FR")} Jetons.`);
  }
}

/** Enchère minimale acceptée : le prix de départ, puis l'enchère courante + l'incrément. */
export function minNextBid(startPrice: number, currentBid: number | null, rules: Pick<MarketRules, "minBidIncrement" | "minBidIncrementRate">): number {
  if (currentBid === null) return startPrice;
  return currentBid + Math.max(rules.minBidIncrement, Math.ceil(currentBid * rules.minBidIncrementRate));
}

/** Nouvelle échéance après une enchère : prolongée si l'enchère tombe dans la fenêtre finale. */
export function extendForSniping(endsAt: Date, now: Date, windowMs: number): Date {
  const floor = now.getTime() + windowMs;
  return endsAt.getTime() < floor ? new Date(floor) : endsAt;
}
