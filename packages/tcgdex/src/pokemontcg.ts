/**
 * Images de repli pour les cartes que TCGdex ne scanne ni en français ni en anglais.
 *
 * Source : le jeu de données public de Pokémon TCG API (dépôt GitHub
 * PokemonTCG/pokemon-tcg-data), dont les images vivent sur `images.pokemontcg.io`.
 * Comme pour TCGdex, on ne stocke que l'URL : l'image est affichée depuis ce CDN,
 * jamais re-hébergée. Les images sont en anglais (`imageLang = en`).
 */
import type { PrismaClient } from "@pokeflex/db";
import { z } from "zod";

export const PTCG_DATA_URL = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en";
export const PTCG_IMAGE_HOST = "images.pokemontcg.io";

/**
 * Correspondance set TCGdex → set Pokémon TCG API, limitée aux sets où TCGdex a des
 * cartes sans image. `byName` : le set est renuméroté d'une base à l'autre (collections
 * classiques), on rapproche alors les cartes par leur nom.
 */
export const PTCG_SETS: Readonly<Record<string, { id: string; byName?: boolean }>> = {
  "swsh4.5sv": { id: "swsh45sv" },
  "sm7.5": { id: "sm75" },
  "sm3.5": { id: "sm35" },
  "swsh12.5gg": { id: "swsh12pt5gg" },
  smp: { id: "smp" },
  swshp: { id: "swshp" },
  svp: { id: "svp" },
  hgssp: { id: "hsp" },
  swsh9tg: { id: "swsh9tg" },
  swsh10tg: { id: "swsh10tg" },
  swsh11tg: { id: "swsh11tg" },
  swsh12tg: { id: "swsh12tg" },
  ecard2: { id: "ecard2" },
  ecard3: { id: "ecard3" },
  sve: { id: "sve" },
  bog: { id: "bp" },
  pop6: { id: "pop6" },
  cel25: { id: "cel25" },
  cel25cc: { id: "cel25c", byName: true },
  "2011bw": { id: "mcd11" },
  "2012bw": { id: "mcd12" },
  "2014xy": { id: "mcd14" },
  "2015xy": { id: "mcd15" },
  "2016xy": { id: "mcd16" },
  "2017sm": { id: "mcd17" },
  "2018sm": { id: "mcd18" },
  "2019sm": { id: "mcd19" },
  "2021swsh": { id: "mcd21" },
  "2022swsh": { id: "mcd22" },
  "tk-ex-latia": { id: "tk1a" },
  "tk-ex-latio": { id: "tk1b" },
  "tk-ex-p": { id: "tk2a" },
  "tk-ex-m": { id: "tk2b" },
};

export const ptcgCardSchema = z.object({
  number: z.string(),
  name: z.string(),
  images: z.object({ large: z.string().optional(), small: z.string().optional() }).optional(),
});
export type PtcgCard = z.infer<typeof ptcgCardSchema>;

/** « 004 » et « 4 », « SM01 » et « sm1 » désignent le même numéro. */
export function normalizeNumber(n: string): string {
  return n.trim().toUpperCase().replace(/^([A-Z-]*?)0+(\d)/, "$1$2");
}

/** Nom comparable entre les deux bases (« Mewtwo EX » = « Mewtwo-EX », « Palkia » = « Palkia LV.X »…). */
export function normalizeCardName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[★☆]/g, " star ")
    .replace(/δ/g, "")
    .replace(/\blv\.?\s*x\b/g, "")
    .replace(/^basic\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** URL de base sans suffixe : `…/smp/SM01` (voir `cardImageUrl` côté site pour la qualité). */
export function ptcgImageBase(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== PTCG_IMAGE_HOST) return null;
  return `https://${PTCG_IMAGE_HOST}${u.pathname.replace(/(_hires)?\.png$/i, "")}`;
}

export interface MissingCard {
  id: string;
  localId: string;
  nameEn: string | null;
}

/**
 * Rapproche les cartes sans image des cartes Pokémon TCG API du même set (pur).
 * Par numéro, en vérifiant le nom pour ne jamais afficher la mauvaise carte ;
 * par nom seulement pour les sets renumérotés. Renvoie id TCGdex → URL de base.
 */
export function matchFallbackImages(
  missing: MissingCard[],
  ptcgCards: PtcgCard[],
  opts: { byName?: boolean } = {},
): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<PtcgCard>();
  const imageOf = (c: PtcgCard) => {
    const url = c.images?.large ?? c.images?.small;
    return url ? ptcgImageBase(url) : null;
  };
  const sameName = (card: MissingCard, c: PtcgCard) =>
    card.nameEn !== null && normalizeCardName(card.nameEn) === normalizeCardName(c.name);

  const rest: MissingCard[] = [];
  for (const card of missing) {
    const n = normalizeNumber(card.localId);
    const hit = ptcgCards.find((c) => !used.has(c) && normalizeNumber(c.number) === n && sameName(card, c));
    const base = hit && imageOf(hit);
    if (hit && base) {
      used.add(hit);
      out.set(card.id, base);
    } else rest.push(card);
  }
  if (opts.byName) {
    for (const card of rest) {
      const hit = ptcgCards.find((c) => !used.has(c) && sameName(card, c) && imageOf(c));
      if (!hit) continue;
      used.add(hit);
      out.set(card.id, imageOf(hit)!);
    }
  }
  return out;
}

export interface FallbackImageOptions {
  fetch?: typeof fetch;
  log?: (line: string) => void;
}

/**
 * Donne une image de repli aux cartes du catalogue qui n'en ont aucune, et les rend
 * tirables. Une carte qui reçoit plus tard un scan TCGdex le reprend à la synchro
 * suivante. Renvoie le nombre de cartes complétées.
 */
export async function fillFallbackImages(prisma: PrismaClient, opts: FallbackImageOptions = {}): Promise<number> {
  const doFetch = opts.fetch ?? fetch;
  const log = opts.log ?? (() => {});
  const missing = await prisma.card.findMany({
    where: { image: null, setId: { in: Object.keys(PTCG_SETS) } },
    select: { id: true, localId: true, setId: true, nameEn: true },
    orderBy: { sortKey: "asc" },
  });
  const bySet = new Map<string, MissingCard[]>();
  for (const c of missing) bySet.set(c.setId, [...(bySet.get(c.setId) ?? []), c]);

  let filled = 0;
  for (const [setId, cards] of bySet) {
    const target = PTCG_SETS[setId]!;
    let ptcgCards: PtcgCard[];
    try {
      const res = await doFetch(`${PTCG_DATA_URL}/${target.id}.json`, {
        headers: { "user-agent": "PokeFlex fan game (catalog sync)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ptcgCards = z.array(ptcgCardSchema).parse(await res.json());
    } catch (err) {
      log(`  ! images de repli indisponibles pour ${setId} (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    const found = matchFallbackImages(cards, ptcgCards, { byName: target.byName });
    for (const [id, image] of found) {
      await prisma.card.update({ where: { id }, data: { image, imageLang: "en", droppable: true } });
    }
    filled += found.size;
  }
  return filled;
}
