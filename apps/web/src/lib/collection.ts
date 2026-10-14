import type { Finish, Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { cache } from "react";
import { cardTileSelect, type CardTile } from "@/lib/catalog";
import { paginate, type PageInfo } from "@/lib/pagination";

/** Exemplaires possédés par carte (tous statuts confondus : listés et misés restent à toi). */
export const getOwnedCounts = cache(async (userId: string, setId?: string): Promise<Record<string, number>> => {
  const rows = await prisma.cardCopy.groupBy({
    by: ["cardId"],
    where: { ownerId: userId, ...(setId ? { card: { setId } } : {}) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.cardId, r._count._all]));
});

/** Exemplaires possédés parmi une liste de cartes (résultats de recherche, par exemple). */
export async function getOwnedCountsFor(userId: string, cardIds: string[]): Promise<Record<string, number>> {
  if (cardIds.length === 0) return {};
  const rows = await prisma.cardCopy.groupBy({
    by: ["cardId"],
    where: { ownerId: userId, cardId: { in: cardIds } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.cardId, r._count._all]));
}

/** Totaux de la collection. Le catalogue « à collectionner » ne compte que les cartes tirables. */
export const getCollectionTotals = cache(async (userId: string) => {
  const [[row], catalog, setsCompleted] = await Promise.all([
    prisma.$queryRaw<{ unique: bigint; copies: bigint }[]>`
      SELECT (SELECT count(DISTINCT cc."cardId") FROM "CardCopy" cc JOIN "Card" c ON c.id = cc."cardId" AND c.droppable
              WHERE cc."ownerId" = ${userId}) AS unique,
             (SELECT count(*) FROM "CardCopy" WHERE "ownerId" = ${userId}) AS copies`,
    prisma.card.count({ where: { droppable: true } }),
    prisma.setCompletion.count({ where: { userId } }),
  ]);
  const unique = Number(row?.unique ?? 0);
  return {
    unique,
    copies: Number(row?.copies ?? 0),
    setsCompleted,
    catalog,
    percent: catalog ? (unique / catalog) * 100 : 0,
  };
});

export interface SetProgress {
  id: string;
  name: string;
  logo: string | null;
  serieId: string;
  serieName: string;
  releaseDate: Date | null;
  total: number;
  owned: number;
  completed: boolean;
}

/** Avancement par set (cartes tirables uniquement, plus récents d'abord). */
export const getSetProgress = cache(
  async (userId: string): Promise<SetProgress[]> => {
    const rows = await prisma.$queryRaw<(Omit<SetProgress, "total" | "owned"> & { total: bigint; owned: bigint })[]>`
      SELECT s.id, s.name, s.logo, s."serieId", se.name AS "serieName", s."releaseDate",
             count(c.id) AS total,
             count(DISTINCT cc."cardId") AS owned
      FROM "Set" s
      JOIN "Serie" se ON se.id = s."serieId"
      JOIN "Card" c ON c."setId" = s.id AND c.droppable
      LEFT JOIN "CardCopy" cc ON cc."cardId" = c.id AND cc."ownerId" = ${userId}
      GROUP BY s.id, se.name, se."firstReleaseDate"
      ORDER BY se."firstReleaseDate" DESC NULLS LAST, s."releaseDate" DESC NULLS LAST`;
    return rows.map((r) => ({ ...r, total: Number(r.total), owned: Number(r.owned) }));
  },
);

export interface OwnedCard extends CardTile {
  copies: number;
  finishes: Finish[];
  lastObtainedAt: Date;
  setName: string;
}

export type CollectionSort = "recent" | "tier" | "name" | "duplicates";

/** Cartes possédées d'une page de la collection, une ligne par carte avec son nombre d'exemplaires. */
export interface OwnedCardsPage extends PageInfo {
  cards: OwnedCard[];
}

const TIER_ORDER: Tier[] = ["mythic", "legendary", "epic", "rare", "uncommon", "common"];

/**
 * Cartes possédées, triées puis paginées côté serveur : on ne trie que des lignes légères
 * (id, nom, rareté, exemplaires) et on ne charge visuels et finitions que pour la page affichée.
 */
export async function getOwnedCards(userId: string, sort: CollectionSort = "recent", rawPage?: string | number): Promise<OwnedCardsPage> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; tier: Tier; copies: number; last: Date }[]>`
    SELECT cc."cardId" AS id, c.name, c.tier::text AS tier, count(*)::int AS copies, max(cc."obtainedAt") AS last
    FROM "CardCopy" cc JOIN "Card" c ON c.id = cc."cardId"
    WHERE cc."ownerId" = ${userId}
    GROUP BY cc."cardId", c.name, c.tier`;
  rows.sort((a, b) => {
    // Départage final par id : l'ordre reste stable d'une page à l'autre (exemplaires obtenus au même instant).
    const byId = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    switch (sort) {
      case "tier":
        return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.name.localeCompare(b.name, "fr") || byId;
      case "name":
        return a.name.localeCompare(b.name, "fr") || byId;
      case "duplicates":
        return b.copies - a.copies || a.name.localeCompare(b.name, "fr") || byId;
      default:
        return b.last.getTime() - a.last.getTime() || byId;
    }
  });
  const info = paginate(rows.length, rawPage);
  const pageRows = rows.slice(info.start, info.end);
  if (pageRows.length === 0) return { ...info, cards: [] };
  const ids = pageRows.map((r) => r.id);
  const [cards, finishes] = await Promise.all([
    prisma.card.findMany({ where: { id: { in: ids } }, select: { ...cardTileSelect, set: { select: { name: true } } } }),
    prisma.cardCopy.groupBy({ by: ["cardId", "finish"], where: { ownerId: userId, cardId: { in: ids } } }),
  ]);
  const finishMap = new Map<string, Finish[]>();
  for (const f of finishes) finishMap.set(f.cardId, [...(finishMap.get(f.cardId) ?? []), f.finish]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const list = pageRows
    .map((r) => {
      const c = byId.get(r.id);
      if (!c) return null;
      const { set, ...tile } = c;
      return { ...tile, setName: set.name, copies: r.copies, finishes: finishMap.get(r.id) ?? [], lastObtainedAt: r.last } satisfies OwnedCard;
    })
    .filter((x): x is OwnedCard => x !== null);
  return { ...info, cards: list };
}

export interface DexEntry {
  dex: number;
  name: string;
  image: string | null;
  total: number;
  owned: number;
  /** Carte à afficher : la plus récente possédée, sinon une carte de référence (en silhouette). */
  cardId: string;
}

export const GENERATIONS = [
  { id: 1, label: "Kanto", from: 1, to: 151 },
  { id: 2, label: "Johto", from: 152, to: 251 },
  { id: 3, label: "Hoenn", from: 252, to: 386 },
  { id: 4, label: "Sinnoh", from: 387, to: 493 },
  { id: 5, label: "Unys", from: 494, to: 649 },
  { id: 6, label: "Kalos", from: 650, to: 721 },
  { id: 7, label: "Alola", from: 722, to: 809 },
  { id: 8, label: "Galar", from: 810, to: 905 },
  { id: 9, label: "Paldea", from: 906, to: 1025 },
] as const;

/** Pokédex de cartes : pour chaque numéro de Pokédex d'une génération, cartes possédées / existantes. */
export async function getDex(userId: string, from: number, to: number): Promise<DexEntry[]> {
  const rows = await prisma.$queryRaw<{ dex: number; name: string; image: string | null; card_id: string; total: bigint; owned: bigint }[]>`
    WITH cards AS (
      SELECT c.id, c.name, c.image, c.lang, c."sortKey", s."releaseDate", unnest(c."dexIds") AS dex
      FROM "Card" c JOIN "Set" s ON s.id = c."setId"
      WHERE c.droppable AND c.category = 'pokemon' AND c."dexIds" && (SELECT array_agg(g)::int[] FROM generate_series(${from}::int, ${to}::int) g)
    ),
    owned AS (SELECT DISTINCT "cardId" FROM "CardCopy" WHERE "ownerId" = ${userId}),
    ranked AS (
      SELECT cards.*, (o."cardId" IS NOT NULL) AS is_owned,
             row_number() OVER (PARTITION BY dex ORDER BY (o."cardId" IS NOT NULL) DESC, "releaseDate" DESC NULLS LAST, image IS NULL) AS rn,
             row_number() OVER (PARTITION BY dex ORDER BY (lang = 'fr') DESC, length(name), "releaseDate" ASC NULLS LAST) AS name_rn
      FROM cards LEFT JOIN owned o ON o."cardId" = cards.id
      WHERE dex BETWEEN ${from} AND ${to}
    )
    SELECT dex,
           max(name) FILTER (WHERE name_rn = 1) AS name,
           max(image) FILTER (WHERE rn = 1) AS image,
           max(id) FILTER (WHERE rn = 1) AS card_id,
           count(*) AS total,
           count(*) FILTER (WHERE is_owned) AS owned
    FROM ranked GROUP BY dex ORDER BY dex`;
  return rows.map((r) => ({ dex: r.dex, name: r.name, image: r.image, cardId: r.card_id, total: Number(r.total), owned: Number(r.owned) }));
}

export interface IllustratorProgress {
  name: string;
  total: number;
  owned: number;
}

export async function getIllustratorProgress(userId: string, limit = 60): Promise<IllustratorProgress[]> {
  const rows = await prisma.$queryRaw<{ name: string; total: bigint; owned: bigint }[]>`
    WITH owned AS (SELECT DISTINCT "cardId" FROM "CardCopy" WHERE "ownerId" = ${userId})
    SELECT c.illustrator AS name, count(*) AS total, count(o."cardId") AS owned
    FROM "Card" c LEFT JOIN owned o ON o."cardId" = c.id
    WHERE c.illustrator IS NOT NULL AND c.droppable
    GROUP BY c.illustrator
    ORDER BY count(o."cardId") DESC, count(*) DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, total: Number(r.total), owned: Number(r.owned) }));
}

/** Exemplaires d'une carte possédés par le joueur (fiche carte). */
export async function getMyCopies(userId: string, cardId: string) {
  return prisma.cardCopy.findMany({
    where: { ownerId: userId, cardId },
    orderBy: { obtainedAt: "desc" },
    select: { id: true, finish: true, status: true, obtainedAt: true, obtainedVia: true },
  });
}

/** Derniers exemplaires obtenus (accueil). */
export async function getRecentPulls(userId: string, take = 12) {
  const rows = await prisma.cardCopy.findMany({
    where: { ownerId: userId },
    orderBy: { obtainedAt: "desc" },
    take,
    select: { id: true, finish: true, card: { select: { ...cardTileSelect, set: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ copyId: r.id, finish: r.finish, ...r.card, setName: r.card.set.name }));
}
