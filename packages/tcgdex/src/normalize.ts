/**
 * Conversion des réponses TCGdex vers le modèle local (pur, sans I/O).
 * Types, catégories et raretés arrivent traduits : on garde la valeur brute
 * et on calcule un code canonique indépendant de la langue.
 */
import { gameConfig } from "@pokeflex/config";
import type { CardDetail, SetDetail } from "./schemas";

export const ENERGY_TYPES = [
  "grass",
  "fire",
  "water",
  "lightning",
  "psychic",
  "fighting",
  "darkness",
  "metal",
  "fairy",
  "dragon",
  "colorless",
] as const;
export type EnergyType = (typeof ENERGY_TYPES)[number];

const TYPE_CODES: Record<string, EnergyType> = {
  plante: "grass",
  grass: "grass",
  feu: "fire",
  fire: "fire",
  eau: "water",
  water: "water",
  electrique: "lightning",
  lightning: "lightning",
  psy: "psychic",
  psychic: "psychic",
  combat: "fighting",
  fighting: "fighting",
  obscurite: "darkness",
  darkness: "darkness",
  metal: "metal",
  fee: "fairy",
  fairy: "fairy",
  dragon: "dragon",
  incolore: "colorless",
  colorless: "colorless",
};

export const TYPE_LABELS_FR: Record<EnergyType, string> = {
  grass: "Plante",
  fire: "Feu",
  water: "Eau",
  lightning: "Électrique",
  psychic: "Psy",
  fighting: "Combat",
  darkness: "Obscurité",
  metal: "Métal",
  fairy: "Fée",
  dragon: "Dragon",
  colorless: "Incolore",
};

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

export function typeCode(raw: string): EnergyType | null {
  return TYPE_CODES[strip(raw)] ?? null;
}

export type CategoryCode = "pokemon" | "trainer" | "energy";

export function categoryCode(raw: string): CategoryCode {
  const s = strip(raw);
  if (s === "dresseur" || s === "trainer") return "trainer";
  if (s === "energie" || s === "energy") return "energy";
  return "pokemon";
}

/** Clé de tri d'un numéro de carte (« 4 », « 004 », « TG12 », « SV-P 001 »). */
export function localIdSortKey(localId: string): number {
  const digits = /(\d+)(?!.*\d)/.exec(localId);
  const n = digits ? Number(digits[1]) : 0;
  // Les numéros préfixés (TG, GG, SV…) passent après la série principale.
  return /^\d+$/.test(localId.trim()) ? n : 100_000 + n;
}

function parseHp(hp: CardDetail["hp"]): number | null {
  if (hp === null || hp === undefined) return null;
  const n = typeof hp === "number" ? hp : Number.parseInt(hp, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDamage(d: string | number | null | undefined): string | null {
  if (d === null || d === undefined || d === "") return null;
  return String(d);
}

export interface Finishes {
  normal: boolean;
  reverse: boolean;
  holo: boolean;
  firstEdition: boolean;
}

/** Variantes physiques ; si TCGdex n'en indique aucune, on considère la finition normale. */
export function finishesOf(card: Pick<CardDetail, "variants">): Finishes {
  const v = card.variants ?? {};
  const f = {
    normal: Boolean(v.normal),
    reverse: Boolean(v.reverse),
    holo: Boolean(v.holo),
    firstEdition: Boolean(v.firstEdition),
  };
  if (!f.normal && !f.reverse && !f.holo && !f.firstEdition) f.normal = true;
  return f;
}

export function priceEurOf(card: Pick<CardDetail, "pricing">): number | null {
  const cm = card.pricing?.cardmarket;
  if (!cm) return null;
  const candidates = [cm.trend, cm.avg].filter((x): x is number => typeof x === "number" && x > 0);
  return candidates[0] ?? null;
}

export interface CardRecordInput {
  detail: CardDetail;
  lang: "fr" | "en";
  nameFr: string | null;
  nameEn: string | null;
  /** Image de repli (version anglaise) si la française manque. */
  fallbackImage?: string | null;
}

/** Ligne `Card` prête à écrire (hors tier, calculé par `@pokeflex/game`). */
export function toCardRecord({ detail, lang, nameFr, nameEn, fallbackImage }: CardRecordInput) {
  const types = (detail.types ?? []).map(typeCode).filter((t): t is EnergyType => t !== null);
  const image = detail.image ?? fallbackImage ?? null;
  const imageLang = detail.image ? lang : fallbackImage ? ("en" as const) : null;
  return {
    id: detail.id,
    localId: detail.localId,
    sortKey: localIdSortKey(detail.localId),
    setId: detail.set.id,
    nameFr,
    nameEn,
    name: nameFr ?? nameEn ?? detail.name,
    lang,
    image,
    imageLang,
    category: categoryCode(detail.category),
    rarityRaw: detail.rarity?.trim() || null,
    hp: parseHp(detail.hp),
    types: [...new Set(types)],
    typesRaw: detail.types ?? [],
    stage: detail.stage ?? null,
    evolveFrom: detail.evolveFrom ?? null,
    dexIds: detail.dexId ?? [],
    illustrator: detail.illustrator?.trim() || null,
    retreat: detail.retreat ?? null,
    description: detail.description ?? null,
    effect: detail.effect ?? null,
    trainerType: detail.trainerType ?? null,
    energyType: detail.energyType ?? null,
    regulationMark: detail.regulationMark ?? null,
    attacks: (detail.attacks ?? []).filter((a) => a.name || a.effect).map((a) => ({
      name: a.name,
      cost: (a.cost ?? []).map((c) => typeCode(c) ?? c),
      damage: parseDamage(a.damage),
      effect: a.effect ?? null,
    })),
    abilities: (detail.abilities ?? []).filter((a) => a.name || a.effect).map((a) => ({ name: a.name, type: a.type ?? null, effect: a.effect ?? null })),
    weaknesses: (detail.weaknesses ?? []).map((w) => ({ type: typeCode(w.type) ?? w.type, value: w.value != null ? String(w.value) : null })),
    resistances: (detail.resistances ?? []).map((w) => ({ type: typeCode(w.type) ?? w.type, value: w.value != null ? String(w.value) : null })),
    variants: finishesOf(detail),
    priceEur: priceEurOf(detail),
    // Une carte sans image n'est jamais tirée : l'ouverture d'un booster doit rester belle.
    droppable: image !== null,
  };
}
export type CardRecord = ReturnType<typeof toCardRecord>;

export function toSetRecord(set: SetDetail, lang: "fr" | "en", nameEn: string | null) {
  const release = set.releaseDate ? new Date(`${set.releaseDate}T00:00:00Z`) : null;
  return {
    id: set.id,
    serieId: set.serie.id,
    name: set.name,
    nameEn,
    logo: set.logo ?? null,
    symbol: set.symbol ?? null,
    releaseDate: release && !Number.isNaN(release.getTime()) ? release : null,
    cardCountOfficial: set.cardCount.official,
    cardCountTotal: Math.max(set.cardCount.total, set.cards.length),
    lang,
  };
}

/** Séries exclues par configuration (TCG Pocket par défaut). */
export function isExcludedSerie(serieId: string): boolean {
  return (gameConfig.catalog.excludedSeries as readonly string[]).includes(serieId);
}

/**
 * Mode `new-sets` : faut-il réimporter un set déjà en base ?
 * Oui s'il a gagné des cartes, ou si TCGdex propose maintenant plus d'images que ce
 * qu'on a stocké (les scans d'un set récent arrivent souvent après ses données).
 */
export function needsResync(
  stored: { cards: number; withImage: number } | undefined,
  cards: { id: string; image?: string | null }[],
  enCards: ReadonlyMap<string, { image?: string | null }>,
): boolean {
  if (!stored || stored.cards < cards.length) return true;
  const available = cards.filter((c) => c.image ?? enCards.get(c.id)?.image).length;
  return available > stored.withImage;
}
