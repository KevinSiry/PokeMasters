# PokeFlex

Fan game web **non officiel et non commercial** de collection de cartes Pokémon. Toutes les cartes sorties depuis 1999, un booster gratuit toutes les 10 minutes, et un marché entre joueurs. Les données et les images viennent de [TCGdex](https://tcgdex.dev).

> PokeFlex n'est pas affilié à The Pokémon Company, Nintendo, Creatures ou Game Freak. Aucun paiement, aucune publicité ; les Jetons n'ont aucune valeur réelle.

## Essayer en local avec Docker Compose (le plus simple)

Seul [Docker Desktop](https://www.docker.com/products/docker-desktop/) est nécessaire, démarré. Pas besoin de Node.js ni de fichier `.env`. Dans PowerShell :

```powershell
git clone https://github.com/KevinSiry/PokeMasters.git
cd PokeMasters
docker compose up --build
```

Le premier lancement construit l'image (quelques minutes), applique les migrations, charge un échantillon du catalogue (Set de Base et 151, 309 cartes) et crée les comptes de démo. Ouvre ensuite http://localhost:3000, page **Connexion**, et choisis un compte de démo :

- **demo-dresseur** : compte neuf, pour découvrir les boosters.
- **demo-collection** : 600 cartes et 600 Jetons, pour la collection, les quêtes et les achats au marché.
- **demo-marchand** : 16 cartes en vente au marché.

| Besoin | Commande |
|---|---|
| Lancer en arrière-plan | `docker compose up -d --build` |
| Arrêter | `docker compose down` |
| Repartir d'une base vide | `docker compose down -v` puis `docker compose up --build` |
| Importer tout le catalogue TCGdex (long, plus de 20 000 cartes) | `docker compose run --rm init npm run sync:catalog` |
| Voir les journaux | `docker compose logs -f web realtime` |

Port 3000, 3001 ou 5432 déjà pris ? Crée un fichier `.env` à côté de `docker-compose.yml` avec par exemple `WEB_PORT=3100`, `REALTIME_PUBLIC_PORT=3101` ou `POSTGRES_PORT=5433`, puis relance `docker compose up --build`.

Les comptes de démo sans OAuth ne sont proposés que parce que le site est servi sur `localhost` ; ils sont désactivés sur un site en ligne.

## Développer sous Windows (pas à pas)

### 1. Prérequis

Installe une seule fois :

| Outil | Version | Vérifier dans PowerShell |
|---|---|---|
| [Node.js](https://nodejs.org) LTS | 22 ou plus | `node -v` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | récent, **démarré** | `docker version` |
| [Git](https://git-scm.com/download/win) | récent | `git --version` |

### 2. Récupérer le projet et installer les dépendances

```powershell
git clone https://github.com/KevinSiry/PokeMasters.git
cd PokeMasters
npm install
npm run setup
```

`npm run setup` crée le fichier `.env` à partir de `.env.example` et génère `AUTH_SECRET`.

### 3. Démarrer la base de données et Redis

```powershell
npm run db:up       # lance seulement Postgres 16 et Redis 7 dans Docker
npm run db:deploy   # applique les migrations
npm run db:seed     # crée les comptes de démo
```

Le port 5432 est déjà pris (un Postgres installé sur ta machine) ? Ajoute `POSTGRES_PORT=5433` dans `.env`, adapte le port dans `DATABASE_URL`, puis relance `npm run db:up`.

### 4. Lancer l'application

```powershell
npm run dev
```

- Site : http://localhost:3000
- Serveur temps réel : http://localhost:3001/health

Sans configuration OAuth, la page **Connexion** propose les comptes de démo (en local uniquement, désactivé sur un site en ligne).

### 5. Importer le catalogue de cartes

```powershell
npm run sync:catalog
```

Environ 4 minutes : toutes les séries, tous les sets, ~21 000 cartes, en français (anglais quand la version française n'existe pas). Le script est reprenable : si tu l'interromps (Ctrl+C), relance la même commande et il repart où il s'était arrêté. À la fin, il écrit `reports/rarities.md` (les raretés rencontrées et leur tier de jeu).

Ensuite, le serveur temps réel (`npm run dev`) vérifie chaque jour s'il y a de nouveaux sets et rafraîchit les prix d'un septième du catalogue.

| Variante | Effet |
|---|---|
| `npm run sync:catalog -- --restart` | Repart de zéro |
| `npm run sync:catalog -- --sets=base1,sv03.5` | Seulement ces sets |
| `npm run sync:catalog -- --new-sets` | Seulement les nouveaux sets |
| `npm run sync:catalog -- --prices` | Rotation des prix du jour |
| `npm run sync:catalog -- --retier` | Recalcule les tiers après une modification de `config/rarities.ts` |

Sans import, `npm run db:seed` charge un petit échantillon (Set de Base et 151) pour découvrir le jeu.

### Jouer

Connecte-toi (en développement, avec un compte de démo), puis ouvre l'onglet **Boosters** : un booster gratuit se recharge toutes les 10 minutes, jusqu'à 6 en réserve (réglable dans `config/game.ts`). Les cartes tirées rejoignent ta **Collection** (progression par set, Pokédex par génération, illustrateurs). Le compte **demo-collection** a déjà 600 cartes pour voir une collection remplie.

Les **Jetons** (sans valeur réelle) se gagnent en recyclant des cartes, en terminant les quêtes du jour et en complétant des sets. Ils servent à acheter des boosters d'un set précis (onglet Boosters, « Boosters de set »). L'historique est dans le menu de l'avatar, « Mes Jetons ».

Le **Marché** permet d'acheter et de vendre des cartes entre joueurs, à prix fixe ou aux enchères. Pour vendre, ouvre la fiche d'une carte possédée, section « Dans ta collection », bouton **Vendre**. Tes annonces sont dans « Mes ventes », tes offres dans « Mes enchères ». Le compte **demo-marchand** a déjà 16 cartes en vente pour essayer.

Sur la fiche d'une carte, l'étoile la met en **favori** (cartes de ta collection, jamais recyclées avec les doublons) et le cœur ajoute une carte qui te manque à ta **wishlist** (elle en sort d'elle-même quand tu l'obtiens). Les deux listes sont dans la Collection ; une alerte s'affiche dès qu'un joueur met en vente une carte de ta wishlist, et le Marché a un filtre « Ma wishlist ».

Côté **social**, chaque joueur a un profil public avec une vitrine de 6 cartes (`/joueurs/<pseudo>`). Le menu de l'avatar mène aux **Amis**, aux **Guildes** (chat en direct, fonder coûte 2 000 Jetons) et aux **Classements**, mis à jour toutes les heures ; la bulle de l'en-tête ouvre les **Messages**. Pour essayer à deux, utilise une fenêtre privée avec un autre compte de démo.

### 6. Brancher la connexion Twitch et Discord

**Twitch**
1. Va sur https://dev.twitch.tv/console/apps et clique *Register Your Application*.
2. Nom : `PokeFlex local` ; *OAuth Redirect URLs* : `http://localhost:3000/api/auth/callback/twitch` ; catégorie : *Website Integration* ; type de client : *Confidential*.
3. Copie le *Client ID* dans `AUTH_TWITCH_ID`, clique *New Secret* et copie-le dans `AUTH_TWITCH_SECRET`.

**Discord**
1. Va sur https://discord.com/developers/applications et clique *New Application*.
2. Onglet *OAuth2* : ajoute la redirection `http://localhost:3000/api/auth/callback/discord`.
3. Copie *Client ID* dans `AUTH_DISCORD_ID` et *Client Secret* (bouton *Reset Secret*) dans `AUTH_DISCORD_SECRET`.

Redémarre `npm run dev`. Les boutons apparaissent automatiquement pour chaque fournisseur configuré.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Site (Next.js) + serveur temps réel, avec rechargement à chaud |
| `npm run build` / `npm start` | Build de production puis lancement |
| `npm run lint` | ESLint sur tout le monorepo |
| `npm run typecheck` | Vérification TypeScript de chaque paquet |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Parcours navigateur (Playwright) ; faire `npm run build` avant, et `npx playwright install chromium` la première fois |
| `npm run db:up` / `db:down` | Démarrer / arrêter Postgres et Redis |
| `npm run db:migrate` | Créer une migration après une modification du schéma Prisma |
| `npm run db:deploy` | Appliquer les migrations existantes |
| `npm run db:seed` | (Re)créer les comptes de démo (et l'échantillon de catalogue si la base est vide) |
| `npm run sync:catalog` | Importer / synchroniser le catalogue TCGdex |
| `npm run audit:ledger` | Vérifier que chaque solde de Jetons est égal à la somme de son registre |
| `npm run db:reset` | Vider la base et tout réappliquer |
| `npm run db:studio` | Explorer la base dans le navigateur |

## Variables d'environnement

Toutes dans `.env` à la racine (modèle : `.env.example`).

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `REDIS_URL` | Connexion Redis |
| `APP_URL` | URL publique du site (origine autorisée par le serveur temps réel) |
| `REALTIME_PORT`, `NEXT_PUBLIC_REALTIME_URL` | Port et URL du serveur Socket.IO |
| `AUTH_SECRET` | Secret Auth.js (généré par `npm run setup`) |
| `AUTH_TWITCH_ID`, `AUTH_TWITCH_SECRET` | Application OAuth Twitch |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` | Application OAuth Discord |
| `ALLOW_DEV_LOGIN` | `true` pour afficher les comptes de démo (ignoré en production, sauf si `APP_URL` pointe sur localhost) |

## Organisation du code

```
apps/web         Next.js (App Router) : pages, connexion, actions serveur
apps/realtime    Serveur Socket.IO (messagerie) et tâches de fond
packages/db      Schéma Prisma, migrations, seed, client partagé
packages/game    Logique métier pure et testée (minuteur, tirages, économie)
packages/server  Services en base (boosters, marché, social, registre des Jetons)
config/game.ts   Tous les paramètres d'équilibrage
```

Les décisions d'architecture et d'équilibrage sont consignées dans [DECISIONS.md](DECISIONS.md).

## Crédits

Données et images : [TCGdex](https://tcgdex.dev). Concept inspiré de WikiMasters.
