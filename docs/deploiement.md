# Déploiement sur le VPS

Même chaîne que Kroniq et Chabowt : **poser un tag de version sur `main` déploie automatiquement** sur le VPS, derrière le Traefik déjà en place.

```
Internet ──► Traefik (VPS, HTTPS) ──┬─► web (Next.js :3000) ──┬─► postgres
           réseau « proxy »         └─► /socket.io ─► realtime (:3001) ─┘   redis
                                                    réseau privé « internal »
```

## Ce qui va où

| Où | Quoi |
|---|---|
| GitHub Actions | CI des pull requests ; sur un tag : CI complète, construction de l'image, envoi sur ghcr.io, déploiement sur le VPS, release GitHub |
| ghcr.io (privé) | `ghcr.io/kevinsiry/pokeflex` : une seule image pour le site, le temps réel et les migrations, **sans aucun secret** |
| VPS `~/pokeflex/` | `docker-compose.yml` et `backup.sh` (recopiés par le workflow à chaque version) + `.env` (secrets, `chmod 600`, écrit une fois à la main) |

## Mise en place (une seule fois)

### 1. DNS
Créer un enregistrement **A** `<domaine>` → IP du VPS (et **AAAA** si le VPS a une IPv6), par exemple `pokeflex.chabow.fr`.
Vérifier depuis Windows : `Resolve-DnsName <domaine>`.

### 2. Applications OAuth
- Twitch (https://dev.twitch.tv/console/apps) : ajouter l'URL de redirection `https://<domaine>/api/auth/callback/twitch`. On peut garder celle de `localhost` à côté.
- Discord (facultatif) : redirect `https://<domaine>/api/auth/callback/discord`.

### 3. Clé SSH de déploiement (PowerShell, sur le poste de dev)
```powershell
ssh-keygen -t ed25519 -C "github-actions-pokeflex" -f pokeflex-deploy   # Entrée deux fois : pas de phrase de passe
type pokeflex-deploy.pub | ssh ubuntu@<ip-du-vps> "cat >> ~/.ssh/authorized_keys"
ssh-keyscan -p 22 <ip-du-vps>      # sortie → secret VPS_KNOWN_HOSTS
Get-Content pokeflex-deploy -Raw   # contenu → secret VPS_SSH_KEY
```
Une fois les secrets créés (étape 4), supprimer `pokeflex-deploy` et `pokeflex-deploy.pub`.

### 4. Secrets et variables GitHub
Dans le dépôt : **Settings → Secrets and variables → Actions**.

Onglet *Secrets* :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | IP ou nom du VPS |
| `VPS_USER` | Utilisateur SSH (ex. `ubuntu`), membre du groupe `docker` |
| `VPS_SSH_KEY` | Clé privée de l'étape 3 (tout le fichier, lignes `BEGIN`/`END` comprises) |
| `VPS_KNOWN_HOSTS` | Sortie de `ssh-keyscan` de l'étape 3 |
| `VPS_PORT` | Facultatif, `22` par défaut |

Onglet *Variables* :

| Variable | Valeur |
|---|---|
| `PUBLIC_URL` | **Obligatoire** : `https://<domaine>`, sans `/` final. Figée dans l'image (adresse du temps réel vue par le navigateur) : la changer demande une nouvelle version. |
| `VPS_APP_DIR` | Facultatif, `~/pokeflex` par défaut |

Pas de secret pour le registre : le workflow pousse l'image sur ghcr.io avec le jeton fourni par GitHub.

### 5. Préparer le VPS
Les images ghcr.io d'un dépôt privé sont privées. Si le VPS n'est pas déjà connecté à ghcr.io (Kroniq l'exige aussi, le même token convient), créer un token GitHub *classic* avec le seul droit **`read:packages`**, puis sur le VPS :
```bash
echo '<token>' | docker login ghcr.io -u KevinSiry --password-stdin
```
Créer le dossier et le `.env` :
```bash
mkdir -p ~/pokeflex && cd ~/pokeflex
nano .env          # coller le contenu de deploy/.env.example, puis le remplir
chmod 600 .env
openssl rand -hex 24      # POSTGRES_PASSWORD (hexadécimal : il va dans une URL)
openssl rand -base64 32   # AUTH_SECRET
```
Le réseau Docker `proxy` de Traefik existe déjà sur le VPS (Kroniq et Chabowt l'utilisent) ; sinon : `docker network create proxy`.

### 6. Première version
Depuis le poste de dev :
```powershell
git fetch origin
git tag 0.1.0 origin/main
git push origin 0.1.0
```
Puis, une seule fois, importer le catalogue complet TCGdex sur le VPS (long ; reprend là où il s'est arrêté s'il est interrompu) :
```bash
cd ~/pokeflex && docker compose run --rm init npm run sync:catalog
```
Ensuite le temps réel ajoute chaque jour les nouveaux sets et rafraîchit les prix (`CATALOG_AUTO_SYNC`).

## Publier une version
```powershell
git fetch origin
git tag 0.2.0 origin/main
git push origin 0.2.0        # « v0.2.0 » marche aussi, l'image sera taguée 0.2.0
```
Le workflow **Release** (`.github/workflows/release.yml`) enchaîne :
1. la CI complète (lint, types, tests, build, e2e, Docker Compose) ;
2. la construction de l'image `linux/amd64`, poussée avec les tags `0.2.0` et `latest` ;
3. la copie de `deploy/docker-compose.yml` et `deploy/backup.sh` dans `~/pokeflex/`, puis `deploy/remote-deploy.sh` par SSH : sauvegarde de la base dans `~/pokeflex/backups/`, `IMAGE_TAG=0.2.0` dans `.env`, `docker compose pull && docker compose up -d` (le service `init` applique les migrations avant de relancer le site et le temps réel), vérification que les conteneurs tournent sur l'image `0.2.0` ;
4. l'attente que `https://<domaine>/connexion` et `/socket.io` répondent ;
5. la release GitHub, avec des notes générées à partir des PR.

Une préversion (`0.2.0-rc1`) suit le même chemin sans déplacer `latest`, et sa release est marquée *pre-release*. Si une étape échoue, les suivantes ne partent pas : suivi dans l'onglet **Actions**.

Validation manuelle avant chaque mise en ligne (facultatif) : *Settings → Environments → production → Required reviewers*.

### À la main
Déployer depuis le poste de dev une version déjà publiée (PowerShell) :
```powershell
Get-Content deploy/remote-deploy.sh -Raw | ssh ubuntu@<ip-du-vps> "bash -s -- 0.2.0"
```
Revenir en arrière : `IMAGE_TAG=0.1.0` dans `~/pokeflex/.env`, puis `docker compose up -d`.
⚠️ Après une migration de la base, revenir en arrière n'est pas toujours possible : restaurer la sauvegarde `before-<tag>` si besoin.

## Sauvegardes
`backup.sh` est lancé avant chaque déploiement. Chaque nuit à 4 h 30, avec 14 jours de rétention (`crontab -e` sur le VPS) :
```
30 4 * * * $HOME/pokeflex/backup.sh >> $HOME/pokeflex/backups/backup.log 2>&1
```
Restauration :
```bash
cd ~/pokeflex
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/pokeflex-AAAA-MM-JJ-HHMMSS.dump
```

## Dépannage
| Symptôme | Piste |
|---|---|
| `Variable PUBLIC_URL manquante` dans Actions | Variable `PUBLIC_URL` absente (étape 4, onglet *Variables*). |
| `Permission denied (publickey)` | Clé publique absente de `~/.ssh/authorized_keys` du VPS, ou `VPS_SSH_KEY` incomplète. |
| `Host key verification failed` | `VPS_KNOWN_HOSTS` vide ou d'un autre port : refaire `ssh-keyscan -p <port> <ip>`. |
| `denied` / `unauthorized` au `docker compose pull` | `docker login ghcr.io` absent ou token expiré sur le VPS (étape 5). |
| `… manquant dans .env` | Variable obligatoire absente du `.env` du VPS : le compose la nomme. |
| 404 de Traefik | `DOMAIN` du `.env` différent du DNS, ou conteneurs hors du réseau `proxy` : `docker compose ps`, `docker network inspect proxy`. |
| 502 de Traefik | `docker compose logs web realtime init` (souvent une migration en échec ou la base injoignable). |
| Erreur Twitch `redirect_mismatch` | L'URL de redirection doit être exactement `https://<domaine>/api/auth/callback/twitch`. |
