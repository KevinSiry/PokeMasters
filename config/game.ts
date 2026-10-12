/**
 * PokeFlex — paramètres d'équilibrage centralisés.
 *
 * Toute valeur de gameplay (minuteur, boosters, probabilités, prix, récompenses)
 * vit ici et nulle part ailleurs. Le code métier lit ce fichier ; les tests
 * vérifient sa cohérence (`config/game.test.ts`).
 *
 * Les durées sont en millisecondes, les montants en Jetons (entiers).
 */

export const TIERS = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS_FR: Record<Tier, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  mythic: "Mythique",
};

/** Finitions physiques d'un exemplaire (tirées parmi les variantes existantes de la carte). */
export const FINISHES = ["normal", "reverse", "holo", "firstEdition"] as const;
export type Finish = (typeof FINISHES)[number];

export const FINISH_LABELS_FR: Record<Finish, string> = {
  normal: "Normale",
  reverse: "Reverse",
  holo: "Holo",
  firstEdition: "1re édition",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const gameConfig = {
  boosters: {
    /** Nombre de cartes par booster. */
    size: 5,
    /** Un booster gratuit est crédité toutes les `refillIntervalMs`. */
    refillIntervalMs: 10 * MINUTE,
    /** Stock maximal de boosters gratuits en attente. */
    maxStock: 6,
    /** Boosters offerts à l'inscription. */
    initialStock: 1,
    /**
     * Poids de tirage par tier (sur 1000). Ils n'ont pas besoin de sommer à 1000,
     * ils sont normalisés au tirage ; on garde 1000 pour la lisibilité.
     */
    tierWeights: {
      common: 550,
      uncommon: 270,
      rare: 120,
      epic: 45,
      legendary: 13,
      mythic: 2,
    } satisfies Record<Tier, number>,
    /** Au moins une carte de ce tier (ou mieux) par booster. */
    guaranteedMinTier: "uncommon" as Tier,
    /** Prix d'un booster d'un set précis. */
    setBoosterPrice: 120,
  },

  /**
   * Finition de chaque exemplaire tiré. Seules les finitions que la carte possède
   * réellement (champ `variants` de TCGdex) sont candidates ; les poids sont
   * renormalisés sur celles-ci.
   */
  finishes: {
    weights: {
      normal: 800,
      reverse: 150,
      holo: 40,
      firstEdition: 10,
    } satisfies Record<Finish, number>,
  },

  rarity: {
    /**
     * Une carte dont le prix Cardmarket (tendance, EUR) dépasse ce seuil monte d'un tier
     * (une seule fois, plafonné à Mythique). `null` = pas de montée possible.
     */
    priceBumpEur: {
      common: 2,
      uncommon: 4,
      rare: 15,
      epic: 40,
      legendary: 120,
      mythic: null,
    } satisfies Record<Tier, number | null>,
  },

  economy: {
    /** Jetons rapportés par le recyclage d'un exemplaire, selon son tier. */
    recycleValue: {
      common: 1,
      uncommon: 3,
      rare: 10,
      epic: 40,
      legendary: 150,
      mythic: 600,
    } satisfies Record<Tier, number>,
    /** Bonus unique de set complété = multiplicateur × nombre officiel de cartes du set. */
    setCompletionBonusPerCard: 5,
    /** Solde de départ d'un nouveau joueur. */
    startingBalance: 0,
  },

  quests: {
    perDay: 3,
    templates: [
      { kind: "open_boosters", target: 5, reward: 30, labelFr: "Ouvrir 5 boosters" },
      { kind: "recycle_cards", target: 20, reward: 30, labelFr: "Recycler 20 cartes" },
      { kind: "win_duel", target: 1, reward: 50, labelFr: "Gagner 1 duel" },
    ],
  },

  market: {
    /** Frais de mise en vente, en fraction du prix (débités à la mise en vente). */
    listingFeeRate: 0.05,
    listingFeeMin: 1,
    maxActiveListingsPerUser: 20,
    auctionDurationsMs: [1 * HOUR, 12 * HOUR, 24 * HOUR],
    /** Une enchère placée dans cette fenêtre finale prolonge l'enchère d'autant. */
    antiSnipingWindowMs: 60_000,
    minBidIncrement: 1,
  },

  duels: {
    stakeSize: 3,
    questionCount: 10,
    choicesPerQuestion: 4,
    questionTimeMs: 15_000,
    reconnectGraceMs: 30_000,
    pointsPerCorrect: 100,
    /** Bonus vitesse maximal (réponse instantanée), décroissant linéairement jusqu'à 0. */
    maxSpeedBonus: 50,
    rewards: { win: 60, draw: 25, loss: 10 },
    rewardedDuelsPerDay: 10,
    /** Le gagnant remporte une carte misée par l'adversaire. Désactivé par défaut. */
    winnerTakesStake: false,
  },

  social: {
    guildCreationCost: 2000,
    guildMaxMembers: 30,
    showcaseSize: 6,
  },

  catalog: {
    primaryLang: "fr",
    fallbackLang: "en",
    /** Séries ignorées à l'import (TCG Pocket). */
    excludedSeries: ["tcgp"],
    sync: {
      concurrency: 4,
      maxRetries: 5,
      retryBaseDelayMs: 500,
      /** Part du catalogue dont les prix sont rafraîchis chaque jour (rotation). */
      dailyPriceRefreshFraction: 1 / 7,
    },
  },
} as const;

export type GameConfig = typeof gameConfig;

/** Rang numérique d'un tier (0 = Commune). */
export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}
