#!/usr/bin/env bash
# Restaure le dump de production dans le conteneur PostgreSQL "db" de docker compose.
# ATTENTION : écrase intégralement la base cible.
# Usage : bash db/restore.sh [chemin/du/dump.sql]
set -euo pipefail

DUMP="${1:-db/dump/sinistreflow_prod_2026-09-28.sql}"
PSQL="docker compose exec -T db psql -v ON_ERROR_STOP=1 -U sinistreflow -d sinistreflow"

echo "Restauration de $DUMP ..."
$PSQL -q -c 'SET client_min_messages TO warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
$PSQL -q < "$DUMP" > /dev/null
$PSQL -c 'SELECT version, name FROM schema_migrations ORDER BY version;'
echo "Base restaurée."
