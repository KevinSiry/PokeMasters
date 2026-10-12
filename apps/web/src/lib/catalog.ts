import type { Tier } from "@pokeflex/config";
import { type Prisma, prisma } from "@pokeflex/db";
import { cache } from "react";

export interface CardAttack {
  name: string;
  cost: string[];
  damage: string | null;
  effect: string | null;
}
export interface CardAbility {
  name: string;
  type: string | null;
  effect: string | null;
}
export interface TypeValue {
  type: string;
  value: string | null;
}
export interface Finishes {
  normal: boolean;
  reverse: boolean;
  holo: boolean;
  firstEdition: boolean;
}

/** Carte réduite pour les grilles (sérialisable vers un composant client). */
export interface CardTile {
  id: string;
  localId: string;
  name: string;
  image: string | null;
  tier: Tier;
  category: "pokemon" | "trainer" | "energy";
  types: string[];
  lang: "fr" | "en";
  /** Tirable en booster (a une image) : seules ces cartes comptent pour compléter un set. */
  droppable: boolean;
}

export const cardTileSelect = {
  id: true,
  localId: true,
  name: true,
  image: true,
  tier: true,
  category: true,
  types: true,
  lang: true,
  droppable: true,
} satisfies Prisma.CardSelect;

/** Toutes les séries (plus récentes d'abord) et leurs sets. */
export const getCatalogue = cache(async () => {
  const series = await prisma.serie.findMany({
    orderBy: [{ firstReleaseDate: { sort: "desc", nulls: "last" } }],
    include: {
      sets: {
        orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          logo: true,
          symbol: true,
          releaseDate: true,
          cardCountOfficial: true,
          cardCountTotal: true,
          lang: true,
        },
      },
    },
  });
  return series.filter((s) => s.sets.length > 0);
});

export const getCatalogueStats = cache(async () => {
  const [cards, sets, series] = await Promise.all([prisma.card.count(), prisma.set.count(), prisma.serie.count()]);
  return { cards, sets, series };
});

export const getSet = cache(async (id: string) =>
  prisma.set.findUnique({
    where: { id },
    include: { serie: { select: { id: true, name: true } } },
  }),
);

export const getSetCards = cache(
  async (setId: string): Promise<CardTile[]> =>
    prisma.card.findMany({
      where: { setId },
      orderBy: [{ sortKey: "asc" }, { localId: "asc" }],
      select: cardTileSelect,
    }),
);

export const getCard = cache(async (id: string) => {
  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      set: {
        select: { id: true, name: true, logo: true, releaseDate: true, cardCountOfficial: true, serie: { select: { id: true, name: true } } },
      },
    },
  });
  if (!card) return null;
  return {
    ...card,
    priceEurTrend: card.priceEurTrend ? Number(card.priceEurTrend) : null,
    attacks: card.attacks as unknown as CardAttack[],
    abilities: card.abilities as unknown as CardAbility[],
    weaknesses: card.weaknesses as unknown as TypeValue[],
    resistances: card.resistances as unknown as TypeValue[],
    variants: card.variants as unknown as Finishes,
  };
});
export type CardDetail = NonNullable<Awaited<ReturnType<typeof getCard>>>;

/** Cartes voisines dans le set (navigation précédente / suivante). */
export async function getSetNeighbours(setId: string, sortKey: number, id: string) {
  const [prev, next] = await Promise.all([
    prisma.card.findFirst({
      where: { setId, OR: [{ sortKey: { lt: sortKey } }, { sortKey, id: { lt: id } }] },
      orderBy: [{ sortKey: "desc" }, { id: "desc" }],
      select: { id: true, name: true },
    }),
    prisma.card.findFirst({
      where: { setId, OR: [{ sortKey: { gt: sortKey } }, { sortKey, id: { gt: id } }] },
      orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return { prev, next };
}

/** Autres cartes du même Pokémon (numéro de Pokédex commun), toutes époques. */
export async function getSamePokemon(dexIds: number[], excludeId: string, limit = 12): Promise<CardTile[]> {
  if (dexIds.length === 0) return [];
  return prisma.card.findMany({
    where: { dexIds: { hasSome: dexIds }, id: { not: excludeId } },
    orderBy: [{ set: { releaseDate: "desc" } }],
    take: limit,
    select: cardTileSelect,
  });
}

export interface SearchResult extends CardTile {
  setName: string;
  nameEn: string | null;
}

/**
 * Recherche tolérante aux fautes et aux accents sur les noms FR et EN
 * (pg_trgm + unaccent, index GIN créé par la migration du catalogue).
 */
export async function searchCards(
  q: string,
  opts: { illustrator?: string; limit?: number } = {},
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 60;
  if (opts.illustrator) {
    const rows = await prisma.card.findMany({
      where: { illustrator: { equals: opts.illustrator, mode: "insensitive" } },
      orderBy: [{ set: { releaseDate: "desc" } }, { sortKey: "asc" }],
      take: limit,
      select: { ...cardTileSelect, nameEn: true, set: { select: { name: true } } },
    });
    return rows.map(({ set, ...c }) => ({ ...c, setName: set.name }));
  }
  const term = q.trim().toLowerCase().slice(0, 60);
  if (term.length < 2) return [];
  return prisma.$queryRaw<SearchResult[]>`
    WITH q AS (SELECT lower(pf_unaccent(${term})) AS t)
    SELECT c.id, c."localId", c.name, c."nameEn", c.image, c.tier::text AS tier, c.category::text AS category,
           c.types, c.lang::text AS lang, c.droppable, s.name AS "setName"
    FROM "Card" c JOIN "Set" s ON s.id = c."setId", q
    WHERE lower(pf_unaccent(coalesce(c."nameFr", '') || ' ' || coalesce(c."nameEn", ''))) % q.t
       OR lower(pf_unaccent(coalesce(c."nameFr", '') || ' ' || coalesce(c."nameEn", ''))) LIKE '%' || q.t || '%'
    ORDER BY
      (lower(pf_unaccent(coalesce(c."nameFr", ''))) = q.t OR lower(coalesce(c."nameEn", '')) = q.t) DESC,
      greatest(similarity(lower(pf_unaccent(coalesce(c."nameFr", ''))), q.t), similarity(lower(coalesce(c."nameEn", '')), q.t)) DESC,
      s."releaseDate" DESC NULLS LAST
    LIMIT ${limit}`;
}
