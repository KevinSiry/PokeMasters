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

/** Motifs de signalement proposés aux joueurs. */
export const REPORT_REASONS = {
  spam: "Spam ou publicité",
  insult: "Propos insultants ou harcèlement",
  name: "Pseudo ou avatar inapproprié",
  cheat: "Triche",
  other: "Autre",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

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
    /** Les quêtes changent à minuit dans ce fuseau. */
    timeZone: "Europe/Paris",
    /**
     * Modèles de quêtes. Chaque jour, `perDay` quêtes sont choisies parmi celles qui sont actives
     * (tirage déterministe par jour, identique pour tous les joueurs).
     */
    templates: [
      { kind: "open_boosters", target: 5, reward: 30, labelFr: "Ouvrir 5 boosters", enabled: true },
      { kind: "recycle_cards", target: 20, reward: 30, labelFr: "Recycler 20 cartes", enabled: true },
      { kind: "new_cards", target: 3, reward: 40, labelFr: "Découvrir 3 nouvelles cartes", enabled: true },
      { kind: "win_duel", target: 1, reward: 50, labelFr: "Gagner 1 duel", enabled: true },
    ],
  },

  /** Boosters de set : seuls les sets avec assez de cartes tirables sont proposés. */
  setBoosters: {
    minDroppableCards: 10,
  },

  market: {
    /** Frais de mise en vente, en fraction du prix (débités à la mise en vente, non remboursés). */
    listingFeeRate: 0.05,
    listingFeeMin: 1,
    maxActiveListingsPerUser: 20,
    minPrice: 1,
    maxPrice: 1_000_000,
    auctionDurationsMs: [1 * HOUR, 12 * HOUR, 24 * HOUR],
    /** Une enchère placée dans cette fenêtre finale prolonge l'enchère jusqu'à maintenant + cette durée. */
    antiSnipingWindowMs: 60_000,
    /** Surenchère minimale : le plus grand de `minBidIncrement` et de `minBidIncrementRate` × enchère courante. */
    minBidIncrement: 1,
    minBidIncrementRate: 0.05,
    /** Fenêtre du prix moyen affiché sur une carte. */
    averagePriceWindowMs: 30 * 24 * HOUR,
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
    /** Un défi sans réponse expire au bout de ce délai (les cartes misées reviennent). */
    challengeTtlMs: 15 * MINUTE,
    /** Une fois les deux mises posées, délai pour que les deux joueurs entrent dans l'arène. */
    joinWindowMs: 2 * MINUTE,
    /** Défis en attente envoyés par un même joueur. */
    maxPendingChallenges: 5,
    /** Compte à rebours avant la première question. */
    countdownMs: 3_000,
    /** Pause sur la bonne réponse entre deux questions. */
    revealMs: 2_800,
    /** Entraînement contre le Professeur : sans mise, sans Jetons, sans quête. */
    bot: { name: "Professeur Chen", accuracy: 0.65, minAnswerMs: 2_500, maxAnswerMs: 10_000 },
  },

  social: {
    guildCreationCost: 2000,
    guildMaxMembers: 30,
    showcaseSize: 6,
    /** Pseudo public : lettres minuscules, chiffres, tiret et tiret bas. */
    handleMinLength: 3,
    handleMaxLength: 20,
    bioMaxLength: 160,
    messageMaxLength: 500,
    /** Anti-spam des messages (privés et de guilde) : au plus `count` messages par fenêtre glissante. */
    messageRate: { count: 6, windowMs: 10_000 },
    maxFriends: 200,
    /** Classements figés toutes les heures, 100 premiers joueurs. */
    leaderboardSize: 100,
    leaderboardRefreshMs: HOUR,
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

export * from "./rarities";
