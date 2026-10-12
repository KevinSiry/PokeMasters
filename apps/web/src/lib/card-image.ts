export type CardImageQuality = "low" | "high";

/**
 * Construit l'URL d'une image de carte sur le CDN TCGdex à partir du champ `image`
 * renvoyé par l'API (URL de base sans extension). Les images ne sont jamais re-hébergées.
 */
export function cardImageUrl(base: string | null | undefined, quality: CardImageQuality): string | null {
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${quality}.webp`;
}
