export type CardImageQuality = "low" | "high";

const POKEPEDIA = /^https:\/\/www\.pokepedia\.fr\/images\/(?:thumb\/)?([0-9a-f])\/([0-9a-f]{2})\/([^/]+)/;
/** Largeur des miniatures Poképédia dans les grilles (voir `@pokeflex/tcgdex` pokepedia.ts). */
const POKEPEDIA_LOW_WIDTH = 245;

/** Page de description du scan sur Poképédia (crédit CC BY-NC-SA), ou null si le scan n'en vient pas. */
export function pokepediaFilePage(base: string | null | undefined): string | null {
  const m = base ? POKEPEDIA.exec(base) : null;
  return m ? `https://www.pokepedia.fr/Fichier:${m[3]}` : null;
}

/**
 * Construit l'URL d'une image de carte à partir du champ `image` stocké. CDN TCGdex en
 * général (URL de base sans extension) ; scan Poképédia (URL complète, miniature générée par
 * le wiki pour les grilles) pour les cartes françaises que TCGdex n'a pas scannées ;
 * `images.pokemontcg.io` pour l'ancien repli anglais. Les images ne sont jamais re-hébergées.
 */
export function cardImageUrl(base: string | null | undefined, quality: CardImageQuality): string | null {
  if (!base) return null;
  const clean = base.replace(/\/+$/, "");
  const pp = POKEPEDIA.exec(clean);
  if (pp) {
    if (quality === "high") return clean;
    const [, a, ab, file] = pp;
    return `https://www.pokepedia.fr/images/thumb/${a}/${ab}/${file}/${POKEPEDIA_LOW_WIDTH}px-${file}`;
  }
  if (clean.startsWith("https://images.pokemontcg.io/")) return `${clean}${quality === "high" ? "_hires" : ""}.png`;
  return `${clean}/${quality}.webp`;
}
