/**
 * Scans français de Poképédia pour les cartes françaises que TCGdex n'a pas scannées
 * (tout Diamant & Perle, L'appel des Légendes, Promos SM…).
 *
 * Source : l'API MediaWiki de Poképédia (https://www.pokepedia.fr), où chaque scan est un
 * fichier `Carte <Extension> <numéro>.png`. Comme pour TCGdex, on ne stocke que l'URL :
 * l'image est affichée depuis Poképédia (miniature générée par le wiki), jamais
 * re-hébergée. Contenu sous licence CC BY-NC-SA 3.0 : crédit affiché sur la fiche carte.
 */
import type { PrismaClient } from "@pokeflex/db";
import { z } from "zod";

export const POKEPEDIA_API_URL = "https://www.pokepedia.fr/api.php";
export const POKEPEDIA_IMAGE_HOST = "www.pokepedia.fr";

/**
 * Préfixe des fichiers de scan chez Poképédia, quand il diffère du nom français TCGdex du set
 * (les sous-extensions sont souvent rangées sous leur extension mère). Plusieurs préfixes
 * possibles : le premier qui donne un scan pour un numéro l'emporte. Un set absent de cette
 * table est cherché sous son nom TCGdex.
 */
export const POKEPEDIA_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  dp1: ["Diamant & Perle"],
  dp2: ["Diamant & Perle Trésors Mystérieux"],
  dp3: ["Diamant & Perle Merveilles Secrètes"],
  dp4: ["Diamant & Perle Duels au Sommet", "Diamant & Perle Duels au Sommets"],
  dp5: ["Diamant & Perle Aube Majestueuse"],
  dp6: ["Diamant & Perle Éveil des Légendes"],
  dp7: ["Diamant & Perle Tempête"],
  dpp: ["Promo DP"],
  col1: ["L'Appel des Légendes"],
  hgssp: ["Promo HGSS"],
  xyp: ["Promo XY"],
  smp: ["Promo SM"],
  "sm3.5": ["Légendes Brillantes"],
  "sm7.5": ["Majesté des Dragons"],
  sm10: ["Soleil et Lune Alliance Infaillible"],
  sm11: ["Soleil et Lune Harmonie des Esprits"],
  sm115: ["Destinées Occultes"],
  sma: ["Destinées Occultes"],
  swshp: ["Promo SWSH"],
  "swsh4.5sv": ["Destinées Radieuses"],
  swsh9tg: ["Stars Étincelantes", "Stars Étincelantes Galerie de Dresseurs"],
  swsh10tg: ["Astres Radieux", "Astres Radieux Galerie de Dresseurs"],
  swsh11tg: ["Origine Perdue", "Origine Perdue Galerie de Dresseurs"],
  swsh12tg: ["Tempête Argentée", "Tempête Argentée Galerie de Dresseurs"],
  "swsh12.5gg": ["Zénith Suprême", "Zénith Suprême Galerie Galaroise"],
  cel25cc: ["Célébrations", "Célébrations Collection Classique"],
  svp: ["Promo SV", "Promo EV", "Promo Écarlate et Violet"],
  mep: ["Promo MEG", "Promo ME", "Promo Méga-Évolution"],
  ecard2: ["Aquapolis"],
  det1: ["Détective Pikachu"],
};

/**
 * Numéro comparable d'une carte : majuscules, zéros de tête retirés de chaque nombre
 * (« SV001 » et « SV1 », « H01 » et « H1 », « 007 » et « 7 » se rejoignent).
 */
export function normalizeCardNumber(n: string): string {
  return n.toUpperCase().replace(/\d+/g, (d) => String(Number(d)));
}

/** Numéro de carte à la fin d'un nom de fichier `Carte_<préfixe>_<numéro>.png`, sinon null (variantes, calendriers…). */
export function numberFromFileName(fileName: string, prefix: string): string | null {
  const head = `Carte_${prefix.replace(/ /g, "_")}_`;
  const name = fileName.replace(/ /g, "_");
  if (!name.startsWith(head)) return null;
  const m = /^([A-Za-z]{0,6}\d+[a-z]?)\.(png|jpe?g|webp)$/i.exec(name.slice(head.length));
  return m ? normalizeCardNumber(m[1]!) : null;
}

/** Largeur au-delà de laquelle on affiche une miniature plutôt que l'original (vieux scans de 1,4 Mo). */
export const POKEPEDIA_HIGH_WIDTH = 600;
/** Largeur de la miniature des grilles. */
export const POKEPEDIA_LOW_WIDTH = 245;

const IMAGE_URL = /^https:\/\/www\.pokepedia\.fr\/images\/(?:thumb\/)?([0-9a-f])\/([0-9a-f]{2})\/([^/]+)/;

/** URL d'une miniature MediaWiki d'un scan (à partir de l'URL de l'original ou d'une autre miniature). */
export function pokepediaThumb(url: string, width: number): string | null {
  const m = IMAGE_URL.exec(url);
  if (!m) return null;
  const [, a, ab, file] = m;
  return `https://${POKEPEDIA_IMAGE_HOST}/images/thumb/${a}/${ab}/${file}/${width}px-${file}`;
}

/** Image « haute qualité » à stocker : l'original s'il est léger, sinon une miniature. */
export function pokepediaStoredImage(url: string, width: number): string {
  return width > POKEPEDIA_HIGH_WIDTH ? (pokepediaThumb(url, POKEPEDIA_HIGH_WIDTH) ?? url) : url;
}

const allImagesSchema = z.object({
  continue: z.object({ aicontinue: z.string() }).partial().passthrough().optional(),
  query: z
    .object({ allimages: z.array(z.object({ name: z.string(), url: z.string(), width: z.number().optional() })) })
    .optional(),
});

export interface PokepediaScan {
  url: string;
  width: number;
}

/** Tous les scans `Carte_<préfixe>_<numéro>` de Poképédia, indexés par numéro normalisé. */
export async function listPokepediaScans(prefix: string, doFetch: typeof fetch): Promise<Map<string, PokepediaScan>> {
  const out = new Map<string, PokepediaScan>();
  let cont: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      action: "query",
      list: "allimages",
      aiprefix: `Carte_${prefix.replace(/ /g, "_")}_`,
      aiprop: "url|size",
      ailimit: "500",
      format: "json",
      formatversion: "2",
    });
    if (cont) params.set("aicontinue", cont);
    const res = await doFetch(`${POKEPEDIA_API_URL}?${params}`, {
      headers: { "user-agent": "PokeFlex fan game (catalog sync; scans affichés depuis Poképédia, jamais re-hébergés)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = allImagesSchema.parse(await res.json());
    for (const img of body.query?.allimages ?? []) {
      const n = numberFromFileName(img.name, prefix);
      if (n && !out.has(n)) out.set(n, { url: img.url, width: img.width ?? 0 });
    }
    cont = body.continue?.aicontinue;
    if (!cont) break;
  }
  return out;
}

export interface PokepediaOptions {
  fetch?: typeof fetch;
  log?: (line: string) => void;
  /** Limiter à certains sets (tests). */
  onlySets?: string[];
}

/**
 * Donne un scan Poképédia aux cartes françaises sans scan français (aucune image, ou image
 * anglaise de repli), et les rend tirables. Un scan TCGdex publié plus tard le remplace à
 * la synchro suivante. Renvoie le nombre de cartes complétées.
 */
export async function fillPokepediaImages(prisma: PrismaClient, opts: PokepediaOptions = {}): Promise<number> {
  const doFetch = opts.fetch ?? fetch;
  const log = opts.log ?? (() => {});
  const missing = await prisma.card.findMany({
    where: {
      lang: "fr",
      OR: [{ image: null }, { imageLang: "en" }],
      ...(opts.onlySets ? { setId: { in: opts.onlySets } } : {}),
    },
    select: { id: true, localId: true, setId: true, set: { select: { name: true } } },
  });
  const bySet = new Map<string, { name: string; cards: { id: string; localId: string }[] }>();
  for (const c of missing) {
    const entry = bySet.get(c.setId) ?? { name: c.set.name, cards: [] };
    entry.cards.push({ id: c.id, localId: c.localId });
    bySet.set(c.setId, entry);
  }

  let filled = 0;
  for (const [setId, { name, cards }] of bySet) {
    const prefixes = POKEPEDIA_PREFIXES[setId] ?? [name];
    const scans: Map<string, PokepediaScan>[] = [];
    for (const prefix of prefixes) {
      try {
        scans.push(await listPokepediaScans(prefix, doFetch));
      } catch (err) {
        log(`  ! Poképédia indisponible pour ${setId} « ${prefix} » (${err instanceof Error ? err.message : String(err)})`);
      }
    }
    let found = 0;
    for (const card of cards) {
      const n = normalizeCardNumber(card.localId);
      const scan = scans.map((s) => s.get(n)).find(Boolean);
      if (!scan) continue;
      await prisma.card.update({
        where: { id: card.id },
        data: { image: pokepediaStoredImage(scan.url, scan.width), imageLang: "fr", droppable: true },
      });
      found++;
    }
    if (found) log(`  ${setId.padEnd(10)} ${found}/${cards.length} scans Poképédia`);
    filled += found;
  }
  return filled;
}

/** Vrai si l'image stockée vient de Poképédia (crédit à afficher). */
export function isPokepediaImage(url: string | null | undefined): boolean {
  return !!url && url.startsWith(`https://${POKEPEDIA_IMAGE_HOST}/`);
}
