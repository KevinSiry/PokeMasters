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

/**
 * Nom de chaque tier quand on parle d'un groupe de raretés (filtres, taux, recyclage). Les tiers
 * restent internes : une carte affiche toujours sa rareté officielle (`rarityLabel`). Les noms
 * reprennent la rareté officielle la plus représentative du groupe (choix de Kevin, 2026-11-02).
 */
export const TIER_LABELS_FR: Record<Tier, string> = {
  common: "Commune",
  uncommon: "Peu Commune",
  rare: "Rare",
  epic: "Double Rare",
  legendary: "Ultra Rare",
  mythic: "Rare Secrète",
};

/** Emplacement d'un booster : `count` cartes, tier tiré selon `tiers`. */
export interface BoosterSlot {
  count: number;
  tiers: Partial<Record<Tier, number>>;
  finishWeights?: Partial<Record<Finish, number>>;
}

/** Paliers de médaille (clé enregistrée → libellé). */
export const MEDAL_LEVEL_LABELS_FR: Record<string, string> = { bronze: "Bronze", silver: "Argent", gold: "Or" };

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
    /** Un booster gratuit est crédité toutes les `refillIntervalMs`. */
    refillIntervalMs: 10 * MINUTE,
    /** Stock maximal de boosters gratuits en attente. */
    maxStock: 10,
    /** Boosters offerts à l'inscription. */
    initialStock: 1,
    /**
     * Composition des boosters, fidèle aux vrais paquets (idée reprise d'HoloPocket). Chaque
     * emplacement tire un tier selon ses propres poids, puis une carte de ce tier dans le pool
     * (tout le catalogue, ou le set du booster). Les cartes se révèlent dans l'ordre des
     * emplacements, comme en vrai : communes, peu communes, reverses, puis la rare.
     * Poids entiers, normalisés au tirage. `finishWeights` remplace les poids de finition globaux pour l'emplacement (seules les
     * finitions que la carte possède comptent ; sans aucune, la carte sort normale).
     *
     * - `modern` (Écarlate et Violet et booster gratuit « Toutes époques ») : 4 Communes,
     *   3 Peu Communes, 2 reverses (la seconde peut cacher une Double Rare ou mieux) et une
     *   Rare ou mieux, holo si la carte existe en holo.
     * - `classic` (époque Wizards) : 7 Communes, 3 Peu Communes et une Rare, holo une fois sur trois.
     */
    layouts: {
      modern: [
        { count: 4, tiers: { common: 1 }, finishWeights: { normal: 1 } },
        { count: 3, tiers: { uncommon: 1 }, finishWeights: { normal: 1 } },
        { count: 1, tiers: { common: 50, uncommon: 35, rare: 15 }, finishWeights: { reverse: 1 } },
        { count: 1, tiers: { common: 450, uncommon: 350, rare: 150, epic: 40, legendary: 8, mythic: 2 }, finishWeights: { reverse: 1 } },
        { count: 1, tiers: { rare: 800, epic: 150, legendary: 40, mythic: 10 }, finishWeights: { holo: 1 } },
      ],
      classic: [
        { count: 7, tiers: { common: 1 } },
        { count: 3, tiers: { uncommon: 1 } },
        { count: 1, tiers: { rare: 2, epic: 1 } },
      ],
    } satisfies Record<string, readonly BoosterSlot[]>,
    /** Séries TCGdex dont les boosters suivent la composition `classic` ; les autres suivent `modern`. */
    classicSeries: ["base", "gym", "neo", "lc"] as readonly string[],
    /**
     * Poids de repli (sur 1000) quand aucun tier d'un emplacement n'existe dans le pool
     * (set sans Peu Commune…) : on tire alors parmi les tiers présents.
     */
    tierWeights: {
      common: 550,
      uncommon: 270,
      rare: 120,
      epic: 45,
      legendary: 13,
      mythic: 2,
    } satisfies Record<Tier, number>,
    /** Prix d'un booster d'un set précis. */
    setBoosterPrice: 150,
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
    /**
     * Bonus unique par rareté officielle complétée dans un set (idée reprise d'HoloPocket) :
     * posséder toutes les cartes tirables d'une rareté du set (« toutes les Peu Communes »)
     * rapporte `bonusPerCard[tier de cette rareté]` × nombre de ces cartes. Une rareté qui compte
     * moins de `minCards` cartes dans le set ne donne pas de bonus.
     */
    rarityCompletion: {
      minCards: 3,
      bonusPerCard: {
        common: 2,
        uncommon: 3,
        rare: 6,
        epic: 12,
        legendary: 25,
        mythic: 50,
      } satisfies Record<Tier, number>,
    },
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

  /**
   * Classeurs personnalisés (idée reprise d'HoloPocket) : pages de `pageSize` emplacements.
   * Un exemplaire rangé dans un classeur est protégé (ni vente, ni recyclage, ni échange).
   */
  binders: {
    maxPerUser: 20,
    maxSlots: 360,
    pageSize: 9,
    nameMaxLength: 40,
  },

  /**
   * Médailles (idée reprise d'HoloPocket) : succès permanents affichés sur le profil. Chaque médaille
   * a trois paliers (bronze, argent, or) ; chaque palier atteint verse une fois `rewards[palier]` Jetons.
   * `metric` dit ce qui est compté (voir `packages/server/src/medals.ts`).
   */
  medals: {
    rewards: { bronze: 50, silver: 200, gold: 750 },
    list: [
      { id: "collector", metric: "distinct_cards", labelFr: "Collectionneur", unitFr: "cartes différentes", thresholds: [50, 300, 1500] },
      { id: "opener", metric: "boosters_opened", labelFr: "Ouvreur de boosters", unitFr: "boosters ouverts", thresholds: [25, 250, 1500] },
      { id: "completer", metric: "sets_completed", labelFr: "Maître des sets", unitFr: "sets complétés", thresholds: [1, 5, 20] },
      { id: "rarities", metric: "rarities_completed", labelFr: "Chasseur de raretés", unitFr: "raretés de set complétées", thresholds: [3, 20, 80] },
      { id: "merchant", metric: "sales", labelFr: "Marchand", unitFr: "ventes au marché", thresholds: [5, 50, 250] },
      { id: "trader", metric: "trades", labelFr: "Négociateur", unitFr: "échanges conclus", thresholds: [1, 15, 75] },
      { id: "friendly", metric: "friends", labelFr: "Sociable", unitFr: "amis", thresholds: [1, 10, 30] },
      { id: "archivist", metric: "binder_cards", labelFr: "Archiviste", unitFr: "cartes rangées en classeur", thresholds: [9, 90, 360] },
    ],
  },

  /**
   * Missions de guilde hebdomadaires : objectifs collectifs, remis à zéro le lundi à minuit
   * (fuseau des quêtes). Cible = max(`min`, arrondi supérieur de `perMember` × nombre de membres).
   * Chaque membre réclame `reward` Jetons par mission réussie, une fois par semaine et par mission,
   * même s'il change de guilde.
   */
  guildMissions: {
    list: [
      { kind: "open_boosters", labelFr: "Ouvrir des boosters", perMember: 10, min: 20, reward: 60 },
      { kind: "rarities_completed", labelFr: "Compléter des raretés de set", perMember: 0.5, min: 2, reward: 80 },
      { kind: "sales", labelFr: "Vendre des cartes au marché", perMember: 1, min: 3, reward: 60 },
      { kind: "trades", labelFr: "Conclure des échanges", perMember: 0.5, min: 2, reward: 60 },
    ],
  },

  /** Favoris (cartes possédées mises en avant) et wishlist (cartes recherchées). */
  lists: {
    favoritesMax: 500,
    /** null = wishlist sans limite (la collection et le marché la lisent page par page). */
    wishlistMax: null as number | null,
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
export type BoosterLayoutName = keyof typeof gameConfig.boosters.layouts;

/** Composition d'un booster selon la série du set (booster gratuit : `modern`). */
export function boosterLayoutFor(serieId: string | null | undefined): BoosterLayoutName {
  return serieId && gameConfig.boosters.classicSeries.includes(serieId) ? "classic" : "modern";
}

/** Nombre de cartes d'un booster. */
export function boosterSize(layout: BoosterLayoutName = "modern"): number {
  return gameConfig.boosters.layouts[layout].reduce((n, s) => n + s.count, 0);
}

/** Rang numérique d'un tier (0 = Commune). */
export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export * from "./rarities";
