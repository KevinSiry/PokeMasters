#!/usr/bin/env bash
# Sauvegarde de la base PostgreSQL de PokeFlex, sur le VPS (docs/deploiement.md).
# Usage : backup.sh [dossier] [suffixe]
#   dossier : celui de docker-compose.yml et .env (défaut : ~/pokeflex)
#   suffixe : ajouté au nom du fichier (ex. « before-0.3.0 » par remote-deploy.sh)
# Écrit backups/pokeflex-AAAA-MM-JJ-HHMMSS[-suffixe].dump (format pg_dump -Fc), puis supprime
# les sauvegardes plus vieilles que BACKUP_RETENTION_DAYS jours (.env, 14 par défaut).
# Chaque nuit (crontab -e) :
#   30 4 * * * $HOME/pokeflex/backup.sh >> $HOME/pokeflex/backups/backup.log 2>&1
set -euo pipefail

APP_DIR="${1:-$HOME/pokeflex}"
APP_DIR="${APP_DIR/#\~/$HOME}"
SUFFIX="${2:-}"

cd "$APP_DIR"
test -f .env || { echo "Fichier .env introuvable dans $APP_DIR" >&2; exit 1; }
RETENTION="$(sed -n 's/^BACKUP_RETENTION_DAYS=//p' .env | tail -n 1)"
RETENTION="${RETENTION:-14}"
[[ "$RETENTION" =~ ^[0-9]+$ ]] || { echo "BACKUP_RETENTION_DAYS invalide : $RETENTION" >&2; exit 1; }

if [ -z "$(docker compose ps -q --status running postgres 2>/dev/null)" ]; then
  echo "La base ne tourne pas : pas de sauvegarde" >&2
  exit 1
fi

mkdir -p backups
chmod 700 backups  # comptes des joueurs : données personnelles
name="backups/pokeflex-$(date +%F-%H%M%S)${SUFFIX:+-$SUFFIX}.dump"
# Écrit à côté puis renommé : une sauvegarde interrompue ne laisse pas de fichier tronqué.
# < /dev/null : appelé via « bash -s », exec ne doit pas lire le script sur l'entrée standard.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
  < /dev/null > "$name.tmp"
test -s "$name.tmp" || { rm -f "$name.tmp"; echo "Sauvegarde vide" >&2; exit 1; }
mv "$name.tmp" "$name"
chmod 600 "$name"
echo "Sauvegarde : $APP_DIR/$name ($(du -h "$name" | cut -f1))"

find backups -maxdepth 1 -name 'pokeflex-*.dump' -mtime "+$RETENTION" -print -delete
