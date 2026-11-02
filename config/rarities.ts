/**
 * Correspondance « rareté officielle TCGdex → tier de jeu ».
 *
 * TCGdex renvoie la rareté traduite : on liste les libellés FR et EN.
 * Toute rareté absente de ce tableau tombe sur `fallbackTier` et apparaît dans
 * `reports/rarities.md` (généré par `npm run sync:catalog`) pour être classée ici.
 *
 * Statut : validé par Kevin le 2026-10-12 (voir DECISIONS.md).
 */
import { TIER_LABELS_FR, type Tier } from "./game";

export const RARITY_TIERS: Record<string, Tier> = {
  // ── Commune ──
  Commune: "common",
  Common: "common",
  "Sans Rareté": "common",
  None: "common",

  // ── Peu commune ──
  "Peu Commune": "uncommon",
  Uncommon: "uncommon",

  // ── Rare ──
  Rare: "rare",
  "Holo Rare": "rare",
  "Rare Holo": "rare",
  "Collection Classique": "rare",
  "Classic Collection": "rare",
  // Promos : très hétérogènes (McDonald's, kits…), le bonus prix fait monter les plus recherchées.
  Promo: "rare",

  // ── Épique ──
  "Holo Rare V": "epic",
  "Rare Holo LV.X": "epic",
  "Double rare": "epic",
  "Rare Prime": "epic",
  "Rare PRIME": "epic",
  "Radieux Rare": "epic",
  "Radiant Rare": "epic",
  // ACE SPEC (FR « HIGH-TECH ») : une par booster au mieux, comme au plan v1.
  "ACE SPEC Rare": "epic",
  "HIGH-TECH rare": "epic",
  "Pikachu Rare": "epic",

  // ── Légendaire ──
  "Holo Rare VMAX": "legendary",
  "Holo Rare VSTAR": "legendary",
  "Ultra Rare": "legendary",
  "Dresseur Full Art": "legendary",
  "Full Art Trainer": "legendary",
  "Illustration rare": "legendary",
  "Shiny rare": "legendary",
  "Shiny rare V": "legendary",
  "Shiny rare VMAX": "legendary",
  LÉGENDE: "legendary",
  LEGEND: "legendary",
  Magnifique: "legendary",
  "Magnifique rare": "legendary",
  "Amazing Rare": "legendary",

  // ── Mythique ──
  "Secret Rare": "mythic",
  "Hyper rare": "mythic",
  "Illustration spéciale rare": "mythic",
  "Special illustration rare": "mythic",
  "Chromatique ultra rare": "mythic",
  "Shiny Ultra Rare": "mythic",
  "Méga Hyper Rare": "mythic",
  "Mega Hyper Rare": "mythic",
  // 30ᵉ Anniversaire : ~1 booster sur 100, plus rare que les Illustration spéciale (~1 sur 20).
  "Futuristic Rare": "mythic",
  "Rare Noir Blanc": "mythic",
  "Black White Rare": "mythic",
};

/** Tier attribué à une rareté inconnue ou absente. */
export const FALLBACK_TIER: Tier = "common";

/**
 * Raretés officielles affichées aux joueurs (comme HoloPocket et les vraies cartes), dans l'ordre
 * croissant. Chaque libellé TCGdex (FR ou EN) est ramené à un libellé français canonique.
 */
export const OFFICIAL_RARITIES = [
  "Sans rareté",
  "Commune",
  "Peu Commune",
  "Rare",
  "Rare Holo",
  "Promo",
  "Collection Classique",
  "Rare Holo V",
  "Rare Holo LV.X",
  "Rare Prime",
  "Double Rare",
  "Radieux Rare",
  "HIGH-TECH Rare",
  "Pikachu Rare",
  "Rare Holo VMAX",
  "Rare Holo VSTAR",
  "Ultra Rare",
  "Dresseur Full Art",
  "Illustration Rare",
  "Chromatique Rare",
  "Chromatique Rare V",
  "Chromatique Rare VMAX",
  "LÉGENDE",
  "Magnifique Rare",
  "Rare Secrète",
  "Hyper Rare",
  "Illustration Spéciale Rare",
  "Chromatique Ultra Rare",
  "Méga Hyper Rare",
  "Rare Noir Blanc",
  "Futuristic Rare",
] as const;
export type OfficialRarity = (typeof OFFICIAL_RARITIES)[number];

const RARITY_ALIASES: Record<string, OfficialRarity> = {
  "Sans Rareté": "Sans rareté",
  None: "Sans rareté",
  Commune: "Commune",
  Common: "Commune",
  "Peu Commune": "Peu Commune",
  Uncommon: "Peu Commune",
  Rare: "Rare",
  "Holo Rare": "Rare Holo",
  "Rare Holo": "Rare Holo",
  Promo: "Promo",
  "Collection Classique": "Collection Classique",
  "Classic Collection": "Collection Classique",
  "Holo Rare V": "Rare Holo V",
  "Rare Holo LV.X": "Rare Holo LV.X",
  "Rare Prime": "Rare Prime",
  "Rare PRIME": "Rare Prime",
  "Double rare": "Double Rare",
  "Radieux Rare": "Radieux Rare",
  "Radiant Rare": "Radieux Rare",
  "HIGH-TECH rare": "HIGH-TECH Rare",
  "ACE SPEC Rare": "HIGH-TECH Rare",
  "Pikachu Rare": "Pikachu Rare",
  "Holo Rare VMAX": "Rare Holo VMAX",
  "Holo Rare VSTAR": "Rare Holo VSTAR",
  "Ultra Rare": "Ultra Rare",
  "Dresseur Full Art": "Dresseur Full Art",
  "Full Art Trainer": "Dresseur Full Art",
  "Illustration rare": "Illustration Rare",
  "Shiny rare": "Chromatique Rare",
  "Shiny rare V": "Chromatique Rare V",
  "Shiny rare VMAX": "Chromatique Rare VMAX",
  LÉGENDE: "LÉGENDE",
  LEGEND: "LÉGENDE",
  Magnifique: "Magnifique Rare",
  "Magnifique rare": "Magnifique Rare",
  "Amazing Rare": "Magnifique Rare",
  "Secret Rare": "Rare Secrète",
  "Hyper rare": "Hyper Rare",
  "Illustration spéciale rare": "Illustration Spéciale Rare",
  "Special illustration rare": "Illustration Spéciale Rare",
  "Chromatique ultra rare": "Chromatique Ultra Rare",
  "Shiny Ultra Rare": "Chromatique Ultra Rare",
  "Méga Hyper Rare": "Méga Hyper Rare",
  "Mega Hyper Rare": "Méga Hyper Rare",
  "Rare Noir Blanc": "Rare Noir Blanc",
  "Black White Rare": "Rare Noir Blanc",
  "Futuristic Rare": "Futuristic Rare",
};

/** Rareté officielle canonique d'une carte (libellé brut TCGdex), ou null si inconnue/absente. */
export function officialRarity(raw: string | null | undefined): OfficialRarity | null {
  if (!raw) return null;
  const key = raw.trim();
  return RARITY_ALIASES[key] ?? ((OFFICIAL_RARITIES as readonly string[]).includes(key) ? (key as OfficialRarity) : null);
}

/** Rang d'une rareté officielle (tri croissant), les inconnues en dernier. */
export function officialRarityRank(rarity: string | null | undefined): number {
  const i = OFFICIAL_RARITIES.indexOf(rarity as OfficialRarity);
  return i === -1 ? OFFICIAL_RARITIES.length : i;
}

/** Libellé de rareté affiché pour une carte : sa rareté officielle, sinon le nom de son tier. */
export function rarityLabel(card: { rarityRaw?: string | null; tier: Tier }): string {
  return officialRarity(card.rarityRaw) ?? TIER_LABELS_FR[card.tier];
}

/** Tier de base d'une rareté officielle (pour le barème des bonus), sans montée liée au prix. */
export function officialRarityTier(rarity: string): Tier {
  const raw = Object.entries(RARITY_ALIASES).find(([, v]) => v === rarity)?.[0];
  return (raw && RARITY_TIERS[raw]) || FALLBACK_TIER;
}

/** Titre d'une complétion annoncée au joueur (« Set complété », « Toutes les Peu Communes »). */
export function completionTitle(c: { kind?: "set" | "rarity"; rarity?: string }): string {
  return c.kind === "rarity" && c.rarity ? `Toutes les ${c.rarity}` : "Set complété";
}

/** Raretés présentées sur l'accueil, de la plus courante à la plus rare. */
export const RARITY_SHOWCASE = [
  "Commune",
  "Peu Commune",
  "Rare",
  "Double Rare",
  "Ultra Rare",
  "Illustration Rare",
  "Illustration Spéciale Rare",
] as const satisfies readonly OfficialRarity[];
