# Plan v1 — Fan game de collection de cartes Pokémon (TCGdex × principe WikiMasters)

> Statut : **proposition, en attente de ta validation**. Aucune ligne de code n'est écrite avant ton feu vert.
> Destination du code : le dépôt GitHub `KevinSiry/PokeMasters` (une PR par phase, CI GitHub Actions, tu fais `git pull` sous Windows).

---

## 0. Ce qu'il me faut de toi (5 réponses courtes)

| # | Question | Ma recommandation |
|---|---|---|
| 1 | **Nom du jeu.** « PokeMasters » pose problème : *Pokémon Masters* est un jeu officiel (Nintendo/DeNA) et « Poké » est une marque. Pour un fan game toléré, un nom sans « Poké » est bien plus sûr. Pistes : **Holofolio**, **Cartothèque**, **Le Classeur**, **Booster Club**, **Foilbound**. | **Holofolio** (évoque holo + portfolio/classeur, neutre juridiquement). Le dépôt peut garder son nom. |
| 2 | **Direction visuelle** : A « Classeur de nuit » ou B « Arcade prisme » (section 7 + aperçu visuel joint). | **A**, avec l'animation d'ouverture « juicy » de B. |
| 3 | **Valeurs d'équilibrage de départ** (section 5) : je pars sur celles proposées ? Elles seront toutes dans `config/game.ts`. | Oui, on ajustera après des tests de jeu. |
| 4 | **Variantes physiques** (holo / reverse / 1re édition) : chaque exemplaire tiré a-t-il une finition aléatoire ? Ça ajoute de la profondeur (chasser le reverse) mais complexifie le Pokédex. | **Non en V1**, champ prévu en base pour plus tard. |
| 5 | **Réseau de mon environnement cloud** : `api.tcgdex.net` est bloqué depuis mon conteneur. Soit tu ajoutes ce domaine (Paramètres du projet → Environnement cloud → Ajouter un environnement → *Allowed domains* : `api.tcgdex.net`, `assets.tcgdex.net`), soit je lance l'import sur ta machine via une session à distance. | Ajouter le domaine : je pourrai tester l'import moi-même. |

Tout le reste ci-dessous est décidé par défaut et sera consigné dans `DECISIONS.md` ; dis-moi seulement ce que tu veux changer.

---

## 1. Ce que j'ai vérifié dans TCGdex

Sources : tcgdex.dev (pages *card*, *set*, *filtering-sorting-pagination*, *markets-prices*). Les réponses brutes de l'API n'ont pas pu être appelées depuis mon conteneur (blocage réseau, cf. question 5) : le script d'import validera chaque forme à l'exécution (schémas **Zod**), et la Phase 2 commence par un échantillonnage réel.

**Carte** (`GET /v2/{lang}/cards/{id}`, ex. `swsh3-136`) :
`id`, `localId`, `name`, `image` (URL de base, on ajoute `/high.webp` ou `/low.webp`), `category` (Pokemon / Trainer / Energy, **libellés traduits** en FR), `illustrator`, `rarity` (**traduite** en FR), `hp` (nombre), `types[]` (traduits), `evolveFrom`, `description`, `stage`, `attacks[] { cost[], name, effect, damage? }`, `weaknesses[] { type, value }`, `retreat`, `regulationMark`, `legal { standard, expanded }`, `variants { normal, reverse, holo, firstEdition, wPromo }`, `set { id, name, logo, symbol, cardCount { official, total } }`, et **`pricing`** :
- `cardmarket` (EUR, quotidien) : `avg`, `low`, `trend`, `avg1/7/30` + variantes `-holo`, `updated` ;
- `tcgplayer` (USD) : par variante `normal/reverse/holo` → `lowPrice, midPrice, highPrice, marketPrice`, `updated` ;
- objet absent si la carte n'est pas cotée.

**Set** (`GET /v2/{lang}/sets/{id}`) : `id`, `name`, `logo`, `symbol`, `releaseDate` (YYYY-MM-DD), `serie { id, name }`, `cardCount { total, official, normal, holo, reverse, firstEd }`, `legal`, `cards[] { id, localId, name, image }`.

**Listes** : `/series`, `/sets`, `/cards` renvoient des objets résumés. Filtres `champ=valeur` (`eq:`, `like:`, `gte:`, `|`…), tri `sort:field`/`sort:order`, pagination `pagination:page` / `pagination:itemsPerPage` (désactivée par défaut).

**Conséquences pour l'import**
- Le détail complet impose **un appel par carte** (≈ 20 000+ cartes). Avec 4 requêtes en parallèle et ~150 ms chacune, l'import initial prend ~15–25 min. D'où un import **reprenable** (curseur en base) et poli.
- Les ids de cartes sont **identiques entre langues** : on importe le détail en FR (repli EN si 404/vide), et les **noms EN en un seul appel** `GET /v2/en/cards` (liste résumée) pour la recherche bilingue.
- Types, catégories et raretés arrivent **traduits** : on stocke la valeur brute ET une valeur canonique (table de correspondance FR→code : `fire`, `water`…), indispensable pour les filtres et les mauvaises réponses plausibles des duels.
- Le catalogue **TCG Pocket** est la série `tcgp` : exclue par défaut via `config.catalog.excludedSeries`.
- Les prix sont rafraîchis par **rotation** (1/7 du catalogue par jour) pour ne pas refaire 20 000 appels quotidiens ; les nouveaux sets sont détectés chaque nuit par comparaison de `/sets`.

---

## 2. Architecture

### Vue d'ensemble

```
                 ┌────────────── navigateur (mobile-first) ──────────────┐
                 │  Next.js (App Router, RSC)   +   client Socket.IO     │
                 └───────────────┬───────────────────────┬───────────────┘
                     HTTP (intentions)                   WS (duels, chat)
                 ┌───────────────▼─────────┐   ┌─────────▼──────────────┐
                 │ apps/web  (Next.js)     │   │ apps/realtime          │
                 │ pages, Server Actions,  │   │ Socket.IO + workers    │
                 │ Route Handlers /api/*   │   │ BullMQ (sync, enchères)│
                 └──────┬───────────┬──────┘   └──────┬──────────┬──────┘
                        │           │                 │          │
                  ┌─────▼────┐ ┌────▼─────┐           │          │
                  │PostgreSQL│ │  Redis   │◄──────────┘          │
                  │ (Prisma) │ │ duels,   │                      │
                  │ vérité   │ │ rate-lim,│      api.tcgdex.net ◄┘ (sync uniquement)
                  └──────────┘ │ files    │
                               └──────────┘   images : assets.tcgdex.net (direct navigateur)
```

### Monorepo (npm workspaces, pour garder `npm run …` comme tu l'as écrit)

```
/apps/web            Next.js 15, App Router, UI, auth, API HTTP
/apps/realtime       serveur Node : Socket.IO (duels, messagerie, chat guilde)
                     + workers BullMQ (sync catalogue, clôture des enchères, quêtes)
/packages/db         schéma Prisma, client, migrations, seed
/packages/game       LOGIQUE MÉTIER PURE (aucun I/O) : tirage, rareté, économie,
                     générateur de questions, scoring → testée à fond avec Vitest
/packages/tcgdex     client TCGdex + schémas Zod + mapping vers le modèle local
/config/game.ts      TOUS les paramètres d'équilibrage
/scripts             sync-catalog.ts, report-rarities.ts
docker-compose.yml   postgres:16 + redis:7 (+ app en option)
```

**Pourquoi un serveur temps réel séparé** : Socket.IO a besoin d'un process Node persistant, ce que Next.js ne garantit pas (surtout en déploiement serverless). Les deux apps partagent `packages/db` et `packages/game`, donc aucune logique n'est dupliquée. Le serveur temps réel authentifie la connexion WebSocket en relisant le cookie de session Auth.js en base.

### Choix techniques (stack proposée confirmée, avec précisions)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Framework | Next.js 15 App Router, TS `strict` | Pages catalogue en RSC = SEO + rapidité sans compte |
| Mutations | **Server Actions** pour l'UI + quelques Route Handlers `/api/*` | Le client n'envoie que des intentions ; toute validation en Zod côté serveur |
| BDD | PostgreSQL 16 + Prisma | Transactions + `SELECT … FOR UPDATE` (via `$queryRaw`) pour marché et jetons |
| Recherche | `pg_trgm` + `unaccent` sur `nameFr`/`nameEn` | Recherche tolérante (« dracaufeu », « charizard ») sans moteur externe |
| Redis | état des duels, rate limiting, files BullMQ, cache du « pool de tirage » | |
| Minuteur booster | **calcul paresseux en base**, pas de cron | `dispo = min(6, stock + floor((now − ancre)/10 min))` ; impossible à tricher, zéro job |
| RNG | `crypto.randomInt` côté serveur ; chaque ouverture est enregistrée (cartes + tiers) | Audit et anti-triche |
| Auth | Auth.js v5, Twitch + Discord, adaptateur Prisma, **sessions en base** | Révocables, lisibles par le serveur temps réel |
| UI | Tailwind 4 + shadcn/ui (Radix, accessible) + Framer Motion | |
| Tests | Vitest (unitaires + intégration sur Postgres de test), Playwright (parcours clés) | |
| CI | GitHub Actions : lint, typecheck, `prisma validate`, Vitest (service Postgres), build | |
| Windows | scripts en Node/TS uniquement (pas de bash), `cross-env`, chemins via `path` | Tout passe sous PowerShell |

---

## 3. Schéma de base de données (Prisma, cible fin de projet)

Les modèles arrivent progressivement selon les phases (indiquées entre crochets).

```prisma
// ───────── Catalogue [P2] ─────────
model Serie {
  id        String  @id            // "base", "swsh", "sv"
  name      String
  logo      String?
  lang      Lang    @default(fr)
  sets      Set[]
}

model Set {
  id            String   @id       // "base1", "swsh3"
  serieId       String
  serie         Serie    @relation(fields: [serieId], references: [id])
  name          String
  nameEn        String?
  logo          String?
  symbol        String?
  releaseDate   DateTime?
  cardCountOfficial Int
  cardCountTotal    Int
  lang          Lang     @default(fr)
  syncedAt      DateTime
  cards         Card[]
  @@index([serieId, releaseDate])
}

model Card {
  id           String   @id        // "swsh3-136"
  localId      String
  setId        String
  set          Set      @relation(fields: [setId], references: [id])
  nameFr       String?
  nameEn       String?
  lang         Lang                // langue des données affichées (badge "EN")
  image        String?             // base URL CDN ; null → visuel de remplacement
  category     CardCategory        // pokemon | trainer | energy (canonique)
  rarityRaw    String?             // valeur TCGdex telle quelle
  tier         Tier                // tier de jeu calculé
  tierReason   String?             // "rarity" | "price_bump" | "manual"
  hp           Int?
  types        String[]            // codes canoniques: ["fire"]
  stage        String?
  evolveFrom   String?
  dexIds       Int[]               // n° Pokédex si fournis (filtre "par Pokémon")
  illustrator  String?
  retreat      Int?
  attacks      Json                // [{name, cost[], damage, effect}]
  weaknesses   Json
  variants     Json
  priceEurTrend Decimal?           // cardmarket.trend
  priceUpdatedAt DateTime?
  droppable    Boolean  @default(true) // exclure ponctuellement du tirage
  syncedAt     DateTime
  @@index([setId]) @@index([tier]) @@index([illustrator])
  // + index GIN trigram sur nameFr/nameEn (migration SQL)
}

model RarityMapping {          // éditable, rempli par l'import puis validé par toi
  rarityRaw String @id
  tier      Tier
  sample    String?              // un id de carte exemple
}

model SyncRun { id String @id @default(cuid()); kind String; startedAt DateTime; finishedAt DateTime?;
  cursor Json?; stats Json?; error String? }

// ───────── Joueurs & auth [P1] ─────────
model User {
  id          String   @id @default(cuid())
  handle      String   @unique
  displayName String
  avatarUrl   String?
  role        Role     @default(player)
  balance     Int      @default(0)          // Jetons ; CHECK (balance >= 0) en SQL
  boosterStock      Int      @default(1)
  boosterAnchorAt   DateTime @default(now())  // base du minuteur paresseux
  showcase    String[]                        // 6 ids de CardCopy max
  createdAt   DateTime @default(now())
  // relations Auth.js: accounts, sessions
}
// Account, Session, VerificationToken : modèles standard Auth.js

// ───────── Collection [P3] ─────────
model CardCopy {                // un exemplaire possédé = une ligne
  id        String     @id @default(cuid())
  ownerId   String
  cardId    String
  status    CopyStatus @default(owned)   // owned | listed | staked
  finish    String?                      // réservé (question 4)
  obtainedVia String                     // booster | market | duel | seed
  obtainedAt DateTime  @default(now())
  @@index([ownerId, cardId]) @@index([cardId])
}

model BoosterOpening {           // audit de chaque tirage
  id        String @id @default(cuid())
  userId    String
  kind      String               // "all_eras" | "set"
  setId     String?
  cardIds   String[]
  tiers     Tier[]
  cost      Int    @default(0)
  createdAt DateTime @default(now())
}

model SetCompletion { userId String; setId String; completedAt DateTime; rewarded Boolean
  @@id([userId, setId]) }

// ───────── Économie [P4] ─────────
model LedgerEntry {               // source de vérité des Jetons, append-only
  id        BigInt  @id @default(autoincrement())
  userId    String
  delta     Int                   // + crédit / − débit
  balanceAfter Int
  reason    LedgerReason          // recycle | duel_win | set_bonus | quest | set_booster |
                                  // market_fee | market_sale | market_purchase | bid_hold |
                                  // bid_release | guild_create | admin
  refType   String?               // "listing", "duel", ...
  refId     String?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

model DailyQuest { id String @id; userId String; day DateTime @db.Date; kind String;
  target Int; progress Int @default(0); claimedAt DateTime?; @@unique([userId, day, kind]) }

// ───────── Marché [P5] ─────────
model Listing {
  id         String  @id @default(cuid())
  sellerId   String
  copyId     String  @unique       // un exemplaire ne peut être listé qu'une fois
  cardId     String                // dénormalisé pour l'historique
  type       ListingType           // fixed | auction
  price      Int?                  // prix fixe
  startPrice Int?
  currentBid Int?
  currentBidderId String?
  endsAt     DateTime?
  status     ListingStatus         // active | sold | expired | cancelled
  feePaid    Int
  createdAt  DateTime @default(now())
  @@index([status, endsAt]) @@index([cardId, status])
}
model Bid  { id String @id @default(cuid()); listingId String; bidderId String; amount Int; createdAt DateTime @default(now()) }
model Sale { id String @id @default(cuid()); listingId String @unique; cardId String; price Int;
  sellerId String; buyerId String; createdAt DateTime @default(now()); @@index([cardId, createdAt]) }

// ───────── Duels [P6] ─────────
model Duel {
  id          String     @id @default(cuid())
  challengerId String
  opponentId  String
  status      DuelStatus // pending | active | finished | cancelled | expired
  seed        String     // graine du générateur de questions
  questions   Json       // questions + bonnes réponses (jamais envoyées avant réponse)
  scoreA      Int @default(0)
  scoreB      Int @default(0)
  winnerId    String?
  stakeTransfer Boolean  @default(false)
  createdAt   DateTime @default(now())
  finishedAt  DateTime?
}
model DuelStake  { duelId String; copyId String; userId String; @@id([duelId, copyId]) }
model DuelAnswer { duelId String; userId String; qIndex Int; choice Int?; correct Boolean;
  answeredMs Int; @@id([duelId, userId, qIndex]) }

// ───────── Social [P7] ─────────
model Friendship { userId String; friendId String; status String; createdAt DateTime @default(now()); @@id([userId, friendId]) }
model Block      { userId String; blockedId String; @@id([userId, blockedId]) }
model Guild      { id String @id @default(cuid()); name String @unique; tag String @unique;
  ownerId String; createdAt DateTime @default(now()) }
model GuildMember { guildId String; userId String @unique; role String; joinedAt DateTime @default(now()); @@id([guildId, userId]) }
model Message    { id String @id @default(cuid()); channel String /* "dm:a:b" | "guild:id" */;
  authorId String; body String; createdAt DateTime @default(now()); deletedAt DateTime?;
  @@index([channel, createdAt]) }
model Report     { id String @id @default(cuid()); reporterId String; targetType String;
  targetId String; reason String; status String @default("open"); createdAt DateTime @default(now()) }
model LeaderboardSnapshot { kind String; userId String; value Int; rank Int; computedAt DateTime; @@id([kind, userId]) }

enum Tier { common uncommon rare epic legendary mythic }
enum Lang { fr en }
```

**Invariants garantis par la base**
- `User.balance >= 0` (contrainte `CHECK`) et chaque modification de solde se fait dans la même transaction qu'une `LedgerEntry` → `SUM(delta) = balance` vérifiable par un test et une commande `npm run audit:ledger`.
- Un exemplaire listé ou misé change de `status` sous verrou de ligne ; une vente/recyclage/mise exige `status = owned`.
- `Listing.copyId @unique` empêche la double mise en vente.

---

## 4. Règles métier : comment elles seront implémentées

**Tirage d'un booster « Toutes époques »**
1. Le serveur recalcule le stock (minuteur paresseux), le décrémente sous verrou.
2. Pour chaque emplacement : tirage du tier selon `config.boosters.tierWeights`, puis carte uniforme dans le tier (pool d'ids en cache Redis, reconstruit à chaque sync).
3. Garantie : si les 4 premières cartes sont « Commune », la 5ᵉ est tirée en excluant le tier Commune (comme une vraie « carte rare » de booster).
4. Écriture atomique : `CardCopy` ×5 + `BoosterOpening`. Le client reçoit le résultat déjà figé, l'animation ne fait que le révéler.

**Booster de set** : même algorithme restreint au set ; si un tier est vide dans ce set (vieux sets sans « Mythique »), son poids est redistribué proportionnellement.

**Rareté de jeu** : `tier = mapping[rarityRaw]`, puis **bonus prix** : si `priceEurTrend ≥ seuil[tier]` (config), +1 tier (plafond Mythique, une seule montée). L'import produit `reports/rarities.md` avec toutes les valeurs distinctes, leur nombre de cartes et un exemple : **je te soumettrai le mapping à valider** en Phase 2. Proposition provisoire :

| Tier | Raretés TCGdex attendues (à confirmer) |
|---|---|
| Commune | Commune / Common, Aucune / None (cartes sans rareté hors promo) |
| Peu commune | Peu Commune / Uncommon |
| Rare | Rare, Holo Rare |
| Épique | Holo Rare V/EX/GX, Double rare, Rare Prime, Radieux, ACE SPEC, Promo |
| Légendaire | Ultra Rare, Full Art, Illustration rare, Shiny rare, LÉGENDE, Magnifique |
| Mythique | Secret / Rainbow / Gold, Special illustration rare, Hyper rare, Shiny ultra rare, Méga hyper rare |

**Duels quiz**
- Défi → l'adversaire accepte → chacun mise 3 exemplaires (passés en `staked`) → le serveur génère 10 questions à partir des 6 cartes misées (générateur pur et graine enregistrée, donc rejouable en test).
- Les deux joueurs reçoivent la même question en même temps ; le serveur envoie `{énoncé, image?, 4 choix mélangés, deadline}` sans la bonne réponse. Réponse acceptée seulement si reçue avant `deadline` (horloge serveur). Révélation après que les deux ont répondu ou que le temps est écoulé.
- Score : 100 pts par bonne réponse + bonus vitesse jusqu'à 50. Égalité → Jetons partagés.
- Mauvaises réponses plausibles : même type de donnée, tirées d'abord dans la même série/époque, puis même type de Pokémon, sans doublon ni la bonne réponse. Un gabarit est ignoré si la carte n'a pas la donnée (ex. pas de faiblesse sur un Dresseur).
- Déconnexion : 30 s pour revenir, sinon forfait. Mises toujours restituées (sauf option `stakeTransfer` activée).

**Marché**
- Mise en vente : frais 5 % (min 1) débités immédiatement, non remboursés.
- Achat prix fixe : une transaction verrouille l'annonce + l'acheteur, vérifie `status = active` et solde, transfère jetons et exemplaire, crée `Sale`.
- Enchère : l'enchère courante est **réservée** sur le solde de l'enchérisseur (`bid_hold`), libérée (`bid_release`) quand il est surenchéri. Clôture par job BullMQ planifié à `endsAt` + balayage de sécurité chaque minute. Anti-« sniping » : une enchère dans les 60 dernières secondes prolonge de 60 s.
- Limites : 20 annonces actives max, pas d'enchère sur sa propre annonce, rate limit Redis sur les actions.

---

## 5. Équilibrage de départ (`config/game.ts`)

| Paramètre | Valeur proposée |
|---|---|
| Booster gratuit | 5 cartes, 1 / 10 min, stock max 6, 1 en stock à l'inscription |
| Poids des tiers | Commune 55 % · Peu commune 27 % · Rare 12 % · Épique 4,5 % · Légendaire 1,3 % · Mythique 0,2 % |
| Recyclage (Jetons) | 1 · 3 · 10 · 40 · 150 · 600 |
| Booster de set | 120 Jetons (≈ 3× la valeur moyenne de recyclage d'un booster gratuit : c'est un vrai puits) |
| Bonus de set complété | 5 × nombre officiel de cartes du set (ex. 102 cartes → 510 Jetons), une fois |
| Duel | victoire 60 Jetons, égalité 25 chacun, défaite 10 ; plafond 10 duels récompensés / jour |
| Quêtes journalières | 3 par jour (ouvrir 5 boosters, recycler 20 cartes, gagner 1 duel), 30–50 Jetons |
| Marché | frais 5 %, 20 annonces actives, durées 1 h / 12 h / 24 h |
| Guilde | création 2 000 Jetons, 30 membres max |
| Bonus prix | Commune→+1 dès 2 €, Peu commune 4 €, Rare 15 €, Épique 40 €, Légendaire 120 € |

Calcul de cohérence : un booster gratuit vaut en moyenne ~38 Jetons recyclé ; un joueur très actif (≈ 30 boosters/jour) gagne ~1 100 Jetons/jour, soit ~9 boosters de set. Les tests vérifieront ces espérances par simulation (100 000 tirages).

---

## 6. Phases (chacune = 1 PR, compile + tests verts + app lancée en local + récap)

| Phase | Contenu | Livrables vérifiables |
|---|---|---|
| **1. Socle** | Monorepo npm workspaces, Docker Compose (Postgres 16, Redis 7), Prisma + `User`/Auth.js, connexion Twitch & Discord, layout (header avec minuteur factice, footer mentions légales), thème choisi, CI GitHub Actions, `README.md` Windows pas à pas, `DECISIONS.md`, `config/game.ts` | `npm run dev` lance web + realtime ; connexion OK ; CI verte |
| **2. Catalogue** | `packages/tcgdex` (client + Zod), `npm run sync:catalog` (idempotent, reprenable, concurrence 4, retry exponentiel, logs), rapport des raretés **à valider avec toi**, job quotidien, pages publiques Séries → Set → Carte, recherche FR/EN | Import complet en local ; pages consultables sans compte |
| **3. Boosters & collection** | Minuteur paresseux, tirage pondéré + garantie, animation d'ouverture, Pokédex (silhouettes, filtres, barres de complétion), seed démo | Tests : distribution des tiers, garantie, plafond du stock |
| **4. Économie** | Ledger + solde, recyclage (unitaire et « tous les doublons sauf 1 »), boosters de set, bonus de complétion, quêtes | Tests : pas de solde négatif, `SUM(ledger) = balance` |
| **5. Marché** | Prix fixe, enchères + réservation, clôture, historique et prix moyen par carte | Tests de concurrence : 2 achats simultanés → 1 seule vente |
| **6. Duels quiz** | Générateur de questions, Socket.IO, matchmaking simple + défi ami, chronométrage serveur, résultats | Tests : générateur déterministe, 4 choix distincts, scoring, timeout |
| **7. Social** | Profil + vitrine, amis, blocage/signalement, guildes + chat, messagerie, classements (snapshot horaire) | Parcours Playwright : ajouter un ami, envoyer un message |
| **8. Finitions** | Perfs (images `low.webp`, pagination, cache RSC), SEO (métadonnées, sitemap), anti-triche (rate limits, logs), page À propos, guide de déploiement | Lighthouse mobile ≥ 90 sur pages publiques |

**Déploiement (Phase 8, à trancher plus tard)** : le plus simple pour un fan game gratuit est un petit VPS avec Docker Compose (web + realtime + Postgres + Redis). Je proposerai les options le moment venu.

**Comment je travaille avec toi** : je code et teste dans mon environnement cloud, j'ouvre une PR par phase sur `KevinSiry/PokeMasters` et je la pousse jusqu'au vert en CI. Pour le test « l'app tourne sous Windows », je peux lancer une session sur ta machine (tu valides une autorisation) qui fait `docker compose up` + `npm run dev` et me remonte le résultat.

**Ce que tu devras faire toi-même (Phase 1)** : créer deux applications OAuth (Twitch Developer Console, Discord Developer Portal) et coller les identifiants dans `.env.local`. Le README détaillera chaque clic.

---

## 7. Deux directions visuelles

Les deux respectent les mêmes règles : mode sombre par défaut, la carte est la star (l'UI s'efface derrière elle), contrastes AA, et **chaque tier a une couleur ET une forme d'icône** (pour ne jamais dépendre de la couleur seule). Polices Google Fonts libres. Aperçu visuel des deux : https://claude.ai/artifact/HqUyhaJ15wctvePWjgeY3Q

### A — « Classeur de nuit » (ma recommandation)

*Moodboard* : la vitrine d'un collectionneur la nuit. Fond encre bleu nuit, surfaces comme des pochettes de classeur légèrement satinées, un seul accent **or feuille** pour ce qui compte (Jetons, boutons principaux, Mythique). Typographie éditoriale pour les titres, chiffres en monospace façon numéro de carte. Calme, premium, presque muséal : les illustrations Pokémon (très colorées) ressortent car rien ne leur fait concurrence.

| Rôle | Couleur |
|---|---|
| Fond | `#0D1120` |
| Surface | `#161B2E` |
| Surface surélevée | `#20263D` |
| Texte | `#EEF0F7` |
| Texte secondaire | `#A3ABC4` |
| Accent (or) | `#E9B949` |
| Accent secondaire (sarcelle) | `#4CC9B9` |
| Danger | `#F07167` |

Typo : **Fraunces** (titres, caractère éditorial), **Inter** (texte et UI), **JetBrains Mono** (PV, numéros, prix, minuteur).

### B — « Arcade prisme »

*Moodboard* : salle d'arcade et jeu gacha. Noir violacé, dégradés chromatiques, boutons arrondis bien épais qui rebondissent, micro-animations partout. Énergique, très « jeu mobile », excellent pour la dopamine de l'ouverture, mais l'interface entre en concurrence avec les cartes et fatigue sur les longues sessions de Pokédex.

| Rôle | Couleur |
|---|---|
| Fond | `#0B0716` |
| Surface | `#170F2A` |
| Surface surélevée | `#231842` |
| Texte | `#F4F1FF` |
| Texte secondaire | `#B3A9D6` |
| Accent (violet électrique) | `#8B6CFF` |
| Accent secondaire (corail) | `#FF5C85` |
| Accent tertiaire (citron vert) | `#B8F35C` |

Typo : **Unbounded** (titres, ronde et large), **Inter** (texte), **Space Mono** (chiffres).

### Couleurs de tier (communes aux deux directions)

| Tier | Couleur | Icône | Effet sur la carte |
|---|---|---|---|
| Commune | `#9AA3B5` gris | ● cercle | aucun |
| Peu commune | `#5CC98A` vert | ◆ losange | liseré |
| Rare | `#4EA8F5` bleu | ★ étoile | reflet holo léger au survol/inclinaison |
| Épique | `#B57CF7` violet | ✦ étoile 4 branches | holo arc-en-ciel |
| Légendaire | `#F5A524` orange-or | ♛ couronne | holo + scintillement |
| Mythique | dégradé prisme | ✺ soleil | holo prismatique animé + halo |

### Pourquoi je recommande A + l'animation de B

Tu collectionnes ~20 000 illustrations différentes : une UI sobre les met en valeur et vieillit bien. L'excitation est concentrée là où elle compte, **l'ouverture du booster** : pochette qui se déchire, cartes face cachée, retournement une par une (tap ou balayage), et une montée en intensité selon le tier (secousse, lumière qui filtre par le dos de la carte avant le retournement pour Légendaire/Mythique, particules). Les tiers bas se retournent vite pour ne pas lasser ; un bouton « tout révéler » existe pour les pressés. `prefers-reduced-motion` est respecté.
