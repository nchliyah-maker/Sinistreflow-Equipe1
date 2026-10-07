#!/usr/bin/env bash
# Sauvegarde de la base PostgreSQL (pg_dump compressé), lancée chaque nuit par cron.
# Garde les 14 dernières sauvegardes. Restauration : voir docs/RUNBOOK.md.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sinistreflow}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sinistreflow}"
KEEP="${KEEP:-14}"

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
file="${BACKUP_DIR}/sinistreflow_$(date +%Y-%m-%d_%H%M).sql.gz"

docker compose exec -T db pg_dump -U sinistreflow -d sinistreflow --no-owner | gzip > "${file}.tmp"
mv "${file}.tmp" "$file"
chmod 600 "$file"

# ne garder que les $KEEP sauvegardes les plus récentes
find "$BACKUP_DIR" -maxdepth 1 -name 'sinistreflow_*.sql.gz' -printf '%T@ %p\n' \
  | sort -rn | tail -n +"$((KEEP + 1))" | cut -d' ' -f2- | xargs -r rm -f

echo "$(date '+%F %T') sauvegarde : ${file} ($(du -h "$file" | cut -f1))"
