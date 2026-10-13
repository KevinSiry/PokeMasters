export type CardImageQuality = "low" | "high";

/**
 * Construit l'URL d'une image de carte à partir du champ `image` stocké (URL de base
 * sans extension). CDN TCGdex en général ; `images.pokemontcg.io` pour les quelques
 * cartes que TCGdex n'a pas scannées. Les images ne sont jamais re-hébergées.
 */
export function cardImageUrl(base: string | null | undefined, quality: CardImageQuality): string | null {
  if (!base) return null;
  const clean = base.replace(/\/+$/, "");
  if (clean.startsWith("https://images.pokemontcg.io/")) return `${clean}${quality === "high" ? "_hires" : ""}.png`;
  return `${clean}/${quality}.webp`;
}
