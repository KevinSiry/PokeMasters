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

## Versions

- **Next.js 15.5, Prisma 6.19, TypeScript 5.9, Vitest 3, ESLint 9** plutôt que les dernières majeures (Next 16, Prisma 7, TS 7) : versions éprouvées, documentation stable. Migration à reconsidérer en phase 8.
- **next-auth 5 (beta.32)** : la v5 (Auth.js) reste publiée en bêta mais c'est la version recommandée pour l'App Router ; beta.32 corrige des failles connues des bêtas précédentes.
- **postcss forcé en ≥ 8.5.23** (`overrides`) pour corriger une faille de la version embarquée par Next.js 15.
- `npm audit` signale encore `deepmerge-ts` via la CLI Prisma 6 : outil de développement uniquement, non exposé à l'exécution.

## Rendu

- Les pages lisent la session dans le layout (minuteur dans l'en-tête), donc elles sont rendues dynamiquement côté serveur. Le HTML reste complet pour le référencement ; la mise en cache des pages publiques sera traitée en phase 8.
- Mode sombre uniquement pour l'instant (« sombre par défaut ») ; un thème clair pourra venir en phase 8.

## GitHub

- **Règles du dépôt reprises de Kroniq et Chabowt** (demande de Kevin, 2026-10-12) : sur `main`, suppression et force-push interdits, et les deux jobs de CI (Linux et Windows) doivent être verts pour fusionner. Le ruleset est versionné dans `.github/rulesets/protect-main.json` (à importer dans *Settings → Rules → Rulesets → New ruleset → Import a ruleset*). Réglages de fusion identiques aux deux projets : auto-merge activé, branche supprimée après fusion.
