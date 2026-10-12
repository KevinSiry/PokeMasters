/**
 * Correspondance « rareté officielle TCGdex → tier de jeu ».
 *
 * TCGdex renvoie la rareté traduite : on liste les libellés FR et EN.
 * Toute rareté absente de ce tableau tombe sur `fallbackTier` et apparaît dans
 * `reports/rarities.md` (généré par `npm run sync:catalog`) pour être classée ici.
 *
 * Statut : validé par Kevin le 2026-10-12 (voir DECISIONS.md).
 */
import type { Tier } from "./game";

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
  "ACE SPEC Rare": "epic",
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
  "Futuristic Rare": "legendary",
  "HIGH-TECH rare": "legendary",

  // ── Mythique ──
  "Secret Rare": "mythic",
  "Hyper rare": "mythic",
  "Illustration spéciale rare": "mythic",
  "Special illustration rare": "mythic",
  "Chromatique ultra rare": "mythic",
  "Shiny Ultra Rare": "mythic",
  "Méga Hyper Rare": "mythic",
  "Mega Hyper Rare": "mythic",
  "Rare Noir Blanc": "mythic",
  "Black White Rare": "mythic",
};

/** Tier attribué à une rareté inconnue ou absente. */
export const FALLBACK_TIER: Tier = "common";
