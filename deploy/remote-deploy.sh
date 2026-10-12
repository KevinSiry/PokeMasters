#!/usr/bin/env bash
# Exécuté sur le VPS par le workflow Release (.github/workflows/release.yml), via SSH.
# Usage : remote-deploy.sh <tag> [dossier]
#   1. sauvegarde la base avant la mise à jour (les migrations ne se défont pas) ;
#   2. fixe IMAGE_TAG=<tag> dans .env, ce qui permet de revenir en arrière en changeant cette ligne ;
#   3. récupère l'image et relance la stack (le service init applique les migrations avant
#      que le site et le temps réel redémarrent) ;
#   4. vérifie que le site et le temps réel tournent bien sur l'image du tag.
# Utilisable aussi à la main : ssh vps 'bash -s -- 0.3.0' < deploy/remote-deploy.sh
# Le script de sauvegarde est lu dans le même dossier : backup.sh, copié à côté.
set -euo pipefail

TAG="${1:?usage: remote-deploy.sh <tag> [dossier]}"
APP_DIR="${2:-$HOME/pokeflex}"
# « ~ » transmis tel quel par le workflow : le développer ici, sur le VPS.
APP_DIR="${APP_DIR/#\~/$HOME}"

if ! [[ "$TAG" =~ ^[0-9A-Za-z._-]+$ ]]; then
  echo "Tag invalide : $TAG" >&2
  exit 1
fi

cd "$APP_DIR"
test -f .env || { echo "Fichier .env introuvable dans $APP_DIR (modèle : deploy/.env.example)" >&2; exit 1; }

echo "==> Sauvegarde de la base"
# Seulement si la base tourne déjà (pas au tout premier déploiement).
if [ -n "$(docker compose ps -q --status running postgres 2>/dev/null)" ]; then
  bash ./backup.sh "$APP_DIR" "before-$TAG" < /dev/null
else
  echo "   base arrêtée : pas de sauvegarde"
fi

echo "==> IMAGE_TAG=$TAG"
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env
else
  printf '\nIMAGE_TAG=%s\n' "$TAG" >> .env
fi

echo "==> Mise à jour des conteneurs"
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f

echo "==> Vérification de la version"
for service in web realtime; do
  image="$(docker compose ps --status running --format '{{.Image}}' "$service" < /dev/null)"
  case "$image" in
    *":$TAG") echo "   $service : $image" ;;
    *) echo "$service ne tourne pas en $TAG (image : ${image:-aucune}) : docker compose logs $service" >&2; exit 1 ;;
  esac
done

echo "==> Déployé : $TAG"
