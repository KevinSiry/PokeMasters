/**
 * Favoris et wishlist : règles pures (limites, destinataires des alertes du marché).
 */

export type CardListKind = "favorites" | "wishlist";

export interface ListRules {
  favoritesMax: number;
  /** null = sans limite. */
  wishlistMax: number | null;
}

/** Message d'erreur si la liste est pleine, null si on peut encore ajouter une carte. */
export function listFullError(kind: CardListKind, count: number, rules: ListRules): string | null {
  const max = kind === "favorites" ? rules.favoritesMax : rules.wishlistMax;
  if (max === null || count < max) return null;
  return kind === "favorites" ? `Tu as déjà ${max} cartes favorites.` : `Ta wishlist contient déjà ${max} cartes.`;
}

/**
 * Joueurs à prévenir quand une carte de leur wishlist est mise en vente :
 * jamais le vendeur, ni un joueur qui l'a bloqué ou qu'il a bloqué. Sans doublon.
 */
export function wishlistAlertRecipients(
  wisherIds: readonly string[],
  sellerId: string,
  blockedWithSeller: ReadonlySet<string>,
): string[] {
  return [...new Set(wisherIds)].filter((id) => id !== sellerId && !blockedWithSeller.has(id));
}
