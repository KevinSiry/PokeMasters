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
    maxStock: 10,
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

  /** Favoris (cartes possédées mises en avant) et wishlist (cartes recherchées). */
  lists: {
    favoritesMax: 500,
    wishlistMax: 200,
    /** Cartes de la wishlist montrées sur le profil public (la liste complète est dans la collection). */
    profileWishlistSize: 12,
    /** Qui voit la wishlist d'un joueur : "public" (profil + compteur sur la fiche carte), "friends" ou "private". */
    wishlistVisibility: "public" as "public" | "friends" | "private",
    /** Une alerte wishlist n'est envoyée que pour une annonce publiée il y a moins de ce délai. */
    alertMaxAgeMs: 2 * MINUTE,
  },

  /** Échanges carte contre carte entre joueurs. */
  trades: {
    /** Qui peut proposer un échange : "everyone" (hors blocages) ou "friends" (amis acceptés seulement). */
    audience: "everyone" as "everyone" | "friends",
    /** Exemplaires au plus de chaque côté d'un échange (au moins un de chaque côté). */
    maxCardsPerSide: 6,
    /** Propositions en attente qu'un joueur peut avoir envoyées en même temps. */
    maxPendingOutgoing: 20,
    /** Une proposition sans réponse expire après ce délai. */
    offerTtlMs: 7 * 24 * HOUR,
    messageMaxLength: 200,
    /** Historique (échanges conclus, refusés, annulés…) affiché sur la page Échanges. */
    historySize: 30,
    /** Cartes par page dans le sélecteur d'une offre (multiple de 3, 4 et 6 : colonnes de la grille). */
    pickerPageSize: 60,
  },

  /**
   * Garde-fous contre les scripts : nombre d'actions serveur par joueur et par minute glissante.
   * Bien au-dessus d'un usage humain ; chaque dépassement est refusé et journalisé « [anti-triche] ».
   */
  antiCheat: {
    actionRate: {
      booster: { count: 20, windowMs: MINUTE },
      market: { count: 30, windowMs: MINUTE },
      economy: { count: 30, windowMs: MINUTE },
      social: { count: 40, windowMs: MINUTE },
      /** Ajouts et retraits de favoris ou de wishlist. */
      lists: { count: 60, windowMs: MINUTE },
      /** Propositions, réponses et annulations d'échanges. */
      trades: { count: 30, windowMs: MINUTE },
      /** Recherches à la frappe et chargements de messages anciens : lectures seules, plus fréquentes. */
      search: { count: 120, windowMs: MINUTE },
    },
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
