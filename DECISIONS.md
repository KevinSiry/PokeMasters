# Décisions

Chaque entrée : la décision, pourquoi, et qui l'a prise. Les plus récentes en bas de chaque section.

## Produit (validées par Kevin le 2026-10-12)

- **Nom : PokeFlex.** Choix de Kevin. Point signalé lors du plan : « Poké » est une marque de The Pokémon Company ; le pied de page et la page À propos portent les mentions de fan game non officiel.
- **Direction visuelle : « Arcade prisme »** (noir violacé, dégradé violet → corail, citron vert pour les Jetons et le focus ; Unbounded / Inter / Space Mono).
- **Équilibrage de départ** : valeurs du plan, toutes dans `config/game.ts`.
- **Finitions par exemplaire : oui.** Chaque exemplaire tiré reçoit une finition (normale, reverse, holo, 1re édition) parmi les variantes que la carte possède réellement. La complétion du Pokédex compte la carte quelle que soit sa finition ; les finitions sont un objectif de collection en plus.

## Architecture

- **Monorepo npm workspaces** (`apps/web`, `apps/realtime`, `packages/db`, `packages/game`, `config`). npm plutôt que pnpm pour garder `npm run …` et ne rien installer de plus sous Windows.
- **Paquets internes en TypeScript source** (pas d'étape de build) : Next.js les transpile (`transpilePackages`), le serveur temps réel tourne avec `tsx`.
- **Serveur temps réel séparé** (`apps/realtime`) : Socket.IO a besoin d'un process Node persistant, que Next.js ne garantit pas. Il authentifie chaque connexion en relisant le cookie de session Auth.js en base.
- **Sessions Auth.js en base** (stratégie `database`) : révocables, et lisibles par le serveur temps réel sans partager de clé JWT.
- **Fournisseurs OAuth optionnels** : un fournisseur n'apparaît que si ses identifiants sont présents. Une connexion de démo (`ALLOW_DEV_LOGIN`) permet de développer sans OAuth ; elle est désactivée en production quoi qu'il arrive.
- **Minuteur des boosters paresseux** : on stocke `boosterStock` et `boosterAnchorAt`, le stock disponible se calcule à la demande (`packages/game/src/booster-timer.ts`). Pas de cron, et rien que le client puisse falsifier.
- **Aléa injectable** : la logique de tirage reçoit un `Rng` (`crypto.randomInt` en production, générateur à graine en test).
- **Invariants en base** : contraintes `CHECK` `balance >= 0` et `boosterStock >= 0` sur `User`.
- **Un seul `.env` à la racine**, chargé par Next.js (`loadEnvConfig`), par Prisma et par le serveur temps réel (`--env-file-if-exists`).
- **Polices auto-hébergées via @fontsource** plutôt que `next/font/google` : le build ne dépend pas d'un accès réseau à Google Fonts.
- **Couleurs testées** : `apps/web/src/lib/theme.ts` est la source des jetons ; un test vérifie les contrastes AA et la concordance avec `globals.css`.
- **Images de cartes** : `<img>` direct sur `assets.tcgdex.net` (jamais re-hébergées, pas d'optimisation Next.js qui les copierait), avec visuel de remplacement si l'image manque ou échoue.

## Catalogue (phase 2)

- **Import REST carte par carte**, en FR puis repli EN : l'API GraphQL de TCGdex rejette les cartes sans rareté (champ non nul), elle n'est pas fiable pour un import complet. Concurrence 4, retry exponentiel avec gigue sur réseau/429/5xx ; l'import complet prend environ 4 minutes.
- **Union FR + EN par set** : une carte qui n'existe pas en français est importée en anglais (`lang = en`, badge « EN »). Les sets sans version française sont importés en anglais. Les logos de set manquants en FR reprennent le logo anglais, et une image de carte manquante en FR reprend l'image anglaise si elle existe.
- **Une carte sans aucune image n'est jamais tirée** (`droppable = false`) : l'ouverture d'un booster ne doit jamais montrer de carte vide. Elle reste visible au catalogue avec un visuel de remplacement.
- **Correspondance des raretés dans `config/rarities.ts`** (versionnée, relue en PR) plutôt qu'une table éditable : une rareté inconnue tombe sur Commune et apparaît « non classée » dans `reports/rarities.md`. `npm run sync:catalog -- --retier` recalcule les tiers après une modification. Mapping provisoire, à valider par Kevin.
- **Promos en Rare** : très hétérogènes (McDonald's, kits…) ; le bonus prix fait monter les plus recherchées.
- **Prix** : tendance Cardmarket (EUR), sinon moyenne. Sert uniquement au bonus de tier, jamais affiché comme un prix d'achat.
- **Synchro quotidienne dans le serveur temps réel** (vérification horaire, garde « dernière synchro réussie > 24 h » en base) plutôt que BullMQ + cron : rien à installer sous Windows, et un redémarrage ne relance pas une synchro déjà faite. Désactivable avec `CATALOG_AUTO_SYNC=false`.
- **Recherche** : `pg_trgm` + `unaccent` (fonction `pf_unaccent` immuable pour l'index GIN) sur les noms FR et EN. « charizard », « dracofeu » ou « electhor » trouvent la bonne carte.
- **Échantillon de catalogue dans le seed** (Set de Base + 151, données réelles exportées par `npm run fixture:export`) : la CI et une première découverte hors ligne ont des cartes à montrer.
- **Navigation mobile** : barre d'onglets en bas de l'écran (zone du pouce), liens dans l'en-tête sur ordinateur.

## Versions

- **Next.js 15.5, Prisma 6.19, TypeScript 5.9, Vitest 3, ESLint 9** plutôt que les dernières majeures (Next 16, Prisma 7, TS 7) : versions éprouvées, documentation stable. Migration à reconsidérer en phase 8.
- **next-auth 5 (beta.32)** : la v5 (Auth.js) reste publiée en bêta mais c'est la version recommandée pour l'App Router ; beta.32 corrige des failles connues des bêtas précédentes.
- **postcss forcé en ≥ 8.5.23** (`overrides`) pour corriger une faille de la version embarquée par Next.js 15.
- `npm audit` signale encore `deepmerge-ts` via la CLI Prisma 6 : outil de développement uniquement, non exposé à l'exécution.

## Rendu

- Les pages lisent la session dans le layout (minuteur dans l'en-tête), donc elles sont rendues dynamiquement côté serveur. Le HTML reste complet pour le référencement ; la mise en cache des pages publiques sera traitée en phase 8.
- Mode sombre uniquement pour l'instant (« sombre par défaut ») ; un thème clair pourra venir en phase 8.
