/**
 * Échanges entre joueurs : règles pures (composition d'une offre, expiration, qui peut agir).
 */

export interface TradeRules {
  maxCardsPerSide: number;
  messageMaxLength: number;
}

export interface TradeOfferInput {
  /** Exemplaires donnés par celui qui propose. */
  give: readonly string[];
  /** Exemplaires demandés à l'autre joueur. */
  take: readonly string[];
}

/** Message d'erreur si l'offre est mal formée, null sinon. */
export function tradeOfferError(offer: TradeOfferInput, rules: TradeRules): string | null {
  if (offer.give.length === 0 || offer.take.length === 0) return "Un échange se fait carte contre carte : choisis au moins une carte de chaque côté.";
  if (offer.give.length > rules.maxCardsPerSide || offer.take.length > rules.maxCardsPerSide) {
    return `${rules.maxCardsPerSide} cartes au plus de chaque côté.`;
  }
  const all = [...offer.give, ...offer.take];
  if (new Set(all).size !== all.length) return "Un même exemplaire apparaît deux fois.";
  return null;
}

/** Nettoie le mot joint à une offre : espaces superflus retirés, longueur bornée, null si vide. */
export function cleanTradeMessage(message: string | null | undefined, rules: Pick<TradeRules, "messageMaxLength">): string | null {
  const m = (message ?? "").replace(/\s+/g, " ").trim().slice(0, rules.messageMaxLength);
  return m.length > 0 ? m : null;
}

export type TradeAction = "accept" | "decline" | "counter" | "cancel";

/**
 * Qui peut faire quoi sur une offre en attente : le destinataire accepte, refuse ou contre-propose,
 * celui qui l'a envoyée peut l'annuler. Renvoie un message d'erreur, ou null si l'action est permise.
 */
export function tradeActionError(
  trade: { status: string; proposerId: string; recipientId: string; expiresAt: Date },
  userId: string,
  action: TradeAction,
  now: Date,
): string | null {
  if (userId !== trade.proposerId && userId !== trade.recipientId) return "Échange introuvable.";
  if (trade.status !== "pending" || isTradeExpired(trade.expiresAt, now)) return "Cette proposition n'est plus en attente.";
  if (action === "cancel") return userId === trade.proposerId ? null : "Seul l'auteur de la proposition peut l'annuler.";
  return userId === trade.recipientId ? null : "C'est à l'autre joueur de répondre à ta proposition.";
}

export function isTradeExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
