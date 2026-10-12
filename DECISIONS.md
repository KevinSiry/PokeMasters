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
- **Correspondance des raretés dans `config/rarities.ts`** (versionnée, relue en PR) plutôt qu'une table éditable : une rareté inconnue tombe sur Commune et apparaît « non classée » dans `reports/rarities.md`. `npm run sync:catalog -- --retier` recalcule les tiers après une modification. Mapping validé par Kevin le 2026-10-12 (Promo en Rare, Magnifique rare et Ultra Rare en Légendaire, Mythique réservé aux Illustration spéciale, Hyper, Chromatique ultra, Méga Hyper, Noir Blanc et Secret).
- **Promos en Rare** : très hétérogènes (McDonald's, kits…) ; le bonus prix fait monter les plus recherchées.
- **Prix** : tendance Cardmarket (EUR), sinon moyenne. Sert uniquement au bonus de tier, jamais affiché comme un prix d'achat.
- **Synchro quotidienne dans le serveur temps réel** (vérification horaire, garde « dernière synchro réussie > 24 h » en base) plutôt que BullMQ + cron : rien à installer sous Windows, et un redémarrage ne relance pas une synchro déjà faite. Désactivable avec `CATALOG_AUTO_SYNC=false`.
- **Recherche** : `pg_trgm` + `unaccent` (fonction `pf_unaccent` immuable pour l'index GIN) sur les noms FR et EN. « charizard », « dracofeu » ou « electhor » trouvent la bonne carte.
- **Échantillon de catalogue dans le seed** (Set de Base + 151, données réelles exportées par `npm run fixture:export`) : la CI et une première découverte hors ligne ont des cartes à montrer.
- **Navigation mobile** : barre d'onglets en bas de l'écran (zone du pouce), liens dans l'en-tête sur ordinateur.

## Boosters et collection (phase 3)

- **Tirage entièrement côté serveur, avant toute animation** : la transaction verrouille la ligne du joueur (`SELECT … FOR UPDATE`), consomme le booster, tire les cartes et crée les exemplaires ; le client ne fait que révéler un résultat déjà enregistré. Quatre ouvertures simultanées avec un seul booster en stock donnent un seul succès (test d'intégration).
- **Meilleure carte révélée en dernier** : les emplacements sont triés par tier. Garantie d'au moins une Peu commune ; un tier absent du pool redistribue son poids.
- **Finition tirée parmi les variantes réelles** de la carte (normale, reverse, holo, 1re édition) selon les poids de `config/game.ts` ; sans variante connue, finition normale.
- **Pools de tirage en mémoire** (ids par tier, rafraîchis toutes les 10 minutes) : l'ouverture ne scanne pas 21 000 cartes. Le tier enregistré est celui du tirage.
- **Animation avec `motion`** (ex-Framer Motion) : machine d'états charge → déchirure → révélation → récapitulatif, suspense et lueur proportionnels à la rareté, flash et rayons pour Légendaire et Mythique, retour haptique, clavier (Espace, Entrée, flèche droite), balayage, « Tout révéler ». Tout est respecté en mouvement réduit.
- **Dos de carte original PokeFlex** : aucun visuel officiel n'est copié.
- **Pokédex de cartes par génération** : un Pokémon compte comme « vu » dès qu'une de ses cartes est possédée ; les cartes non possédées s'affichent en silhouette.
- **Collections de démo simulées par le seed** (RNG à graine fixe : 120 boosters pour demo-collection, 60 pour demo-marchand) afin de voir la collection, le Pokédex et plus tard le marché remplis.
- **E2E avec sessions en base** : le `globalSetup` Playwright crée des sessions Auth.js pour les comptes de démo, sans passer par un fournisseur OAuth.
- **Tests d'intégration base désactivables** (`SKIP_DB_TESTS=1`) : la CI Windows n'a pas de Postgres ; la CI Linux les exécute.

## Économie (phase 4)

- **Registre des Jetons en ajout seul** (`LedgerEntry`) : chaque modification de solde passe par `applyLedger`, dans la transaction de l'action. Le débit est un `UPDATE … WHERE balance + delta >= 0` atomique, doublé des contraintes `CHECK` sur `User.balance` et `LedgerEntry.balanceAfter`. `npm run audit:ledger` vérifie SUM(delta) = solde pour chaque joueur ; la CI le lance après les tests e2e.
- **Actions d'un joueur sérialisées** par un verrou sur sa ligne `User` (ouverture, recyclage, réclamation de quête) : deux onglets ou un double clic ne peuvent ni payer deux fois, ni recycler deux fois le même exemplaire, ni réclamer deux fois une récompense (tests de concurrence en base).
- **Recyclage = suppression de l'exemplaire** ; le registre garde la trace (nombre de cartes par tier). Seuls les exemplaires « possédés » se recyclent (pas ceux en vente ou misés).
- **« Tous les doublons sauf un »** garde la plus belle finition (1re édition > holo > reverse > normale), puis le plus ancien. Par défaut, les doublons Légendaire et Mythique sont décochés : ils valent davantage au marché et en duel. La liste est recalculée côté serveur au moment de l'action.
- **Set complété = toutes ses cartes tirables possédées** : les 1 642 cartes sans image ne sortent jamais d'un booster et rendraient 62 sets impossibles à finir. La progression affichée suit la même règle. Bonus versé une seule fois (`SetCompletion`), même si des cartes sont recyclées ensuite.
- **Boosters de set** : proposés pour les sets d'au moins 10 cartes tirables, même tirage que le booster gratuit (garantie, redistribution des tiers absents) restreint au set. Pochettes aux couleurs dérivées de l'id du set et logo officiel servi par TCGdex (WebP, repli PNG).
- **Quêtes du jour créées à la première visite**, identiques pour tous les joueurs un jour donné, remise à zéro à minuit heure de Paris. « Gagner 1 duel » attend la phase 6 ; d'ici là, la troisième quête est « Découvrir 3 nouvelles cartes » (40 Jetons). La récompense se réclame d'un clic (moment de satisfaction plutôt qu'un crédit silencieux).
- **Jetons de démo inscrits au registre** (motif `seed`) : 600 pour demo-collection, 2 500 pour demo-marchand.
- **Menu joueur** : la déconnexion passe dans le menu de l'avatar pour laisser la place au solde dans l'en-tête mobile.

## Marché (phase 5)

- **Services partagés dans `packages/server`** : la logique en base (registre, quêtes, boosters, recyclage, marché) quitte `apps/web` pour être appelée aussi par le serveur temps réel (clôture des enchères, duels en phase 6).
- **Annonce = un exemplaire précis**, mis de côté (`listed`) tant qu'elle est active. Index unique partiel : un exemplaire n'a qu'une annonce active. L'exemplaire garde sa finition et rejoint l'acheteur à la vente.
- **Frais de mise en vente de 5 % (minimum 1 Jeton), non remboursés** si l'annonce est retirée : ils freinent le spam d'annonces et retirent des Jetons de l'économie. 20 annonces actives au plus par joueur, prix de 1 à 1 000 000.
- **Enchères de 1 h, 12 h ou 24 h**. Une offre réserve les Jetons de l'enchérisseur (`bid_hold`) ; ils lui sont rendus dès qu'il est dépassé (`bid_release`). Pas d'achat immédiat sur une enchère. Incrément minimal : 5 % de l'offre en cours (au moins 1). Une offre dans la dernière minute repousse la fin d'une minute (anti-snipe).
- **Clôture des enchères** toutes les 15 s par le serveur temps réel, et à l'affichage d'une page du marché, pour ne jamais montrer une enchère échue comme active. Sans offre, la carte revient au vendeur.
- **Achat et enchère sérialisés** : verrou sur les deux joueurs (ordre fixe, sans interblocage) puis sur l'annonce. Deux acheteurs simultanés : un seul paie (tests de concurrence en base).
- **Historique des ventes conservé** même si l'exemplaire est recyclé ensuite (`Listing.copyId` passe à NULL). La cote d'une carte = prix moyen des ventes des 30 derniers jours ; le prix suggéré à la mise en vente en découle (sinon 3 × la valeur de recyclage).
- **Annonces de démo** : le seed met en vente 16 cartes de demo-marchand (doublons puis cartes rares, une sur quatre aux enchères), frais payés au registre.

## Docker Compose (phase 5)

- **`docker compose up --build` lance tout le jeu** (Postgres, Redis, site, temps réel) sans Node.js ni `.env` sur la machine. Une seule image sert au site, au temps réel et au service `init` (migrations, échantillon de catalogue, comptes de démo), qui s'exécute avant les deux autres à chaque démarrage ; tout y est idempotent.
- **Image `node:22-bookworm` complète** plutôt que `slim` : OpenSSL y est déjà, ce que Prisma exige, sans `apt-get` au build.
- **Comptes de démo autorisés sur un build de production servi sur localhost** (`APP_URL` en localhost, 127.0.0.1 ou ::1). Un site en ligne a une autre adresse : la connexion de démo y reste impossible même si `ALLOW_DEV_LOGIN` est posé par erreur.
- **Catalogue complet à la demande** (`docker compose run --rm init npm run sync:catalog`) : l'import prend du temps, l'échantillon suffit pour essayer. Synchro quotidienne désactivée par défaut dans Docker (`CATALOG_AUTO_SYNC`).
- La CI construit l'image et vérifie que le jeu répond après `docker compose up`.

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

## Déploiement

- **Un tag de version sur `main` déploie sur le VPS** (demande de Kevin, 2026-10-12), comme Kroniq et Chabowt : CI complète, image unique poussée sur ghcr.io, déploiement par SSH derrière le Traefik existant, release GitHub. Guide : `docs/deploiement.md`.
- **Temps réel sur le même domaine** que le site, sous `/socket.io` (routage Traefik) : même origine, donc le cookie de session suit sans sous-domaine ni CORS. `NEXT_PUBLIC_REALTIME_URL` vaut l'URL publique, figée au build de l'image.
- **Pas de seed en production** : le service `init` n'applique que les migrations (ni comptes ni annonces de démo). Le catalogue complet s'importe une fois à la main, puis la synchro quotidienne prend le relais.
