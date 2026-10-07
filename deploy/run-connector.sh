#!/usr/bin/env bash
# Lance le connecteur ExpertAuto ; la clé API est lue dans .env.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sinistreflow}"
cd "$APP_DIR"

EXPERTAUTO_API_KEY="$(grep -E '^EXPERTAUTO_API_KEY=' .env | cut -d= -f2- | tr -d '\r')"
[ -n "$EXPERTAUTO_API_KEY" ] || { echo "ERREUR : EXPERTAUTO_API_KEY absent de ${APP_DIR}/.env" >&2; exit 1; }
export EXPERTAUTO_API_KEY
export SINISTREFLOW_URL="${SINISTREFLOW_URL:-http://127.0.0.1:3000}"

PYTHON="$(command -v python3 || command -v python)"
exec "$PYTHON" partner-client/expertauto_sync.py
