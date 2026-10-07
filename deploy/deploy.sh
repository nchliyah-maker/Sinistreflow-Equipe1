#!/usr/bin/env bash
# Déploiement de SinistreFlow avec retour arrière automatique.
# Usage : bash deploy/deploy.sh ghcr.io/nchliyah-maker/sinistreflow-equipe1:<sha>
# Options : WITH_MONITORING, RUN_CONNECTOR, SKIP_PULL, HEALTH_TIMEOUT (voir docs/RUNBOOK.md)
# Attention : revenir à l'image précédente ne "dé-migre" pas la base.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sinistreflow}"
WITH_MONITORING="${WITH_MONITORING:-1}"
RUN_CONNECTOR="${RUN_CONNECTOR:-1}"
SKIP_PULL="${SKIP_PULL:-0}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"

NEW_IMAGE="${1:-}"
[ -n "$NEW_IMAGE" ] || { echo "Usage : bash deploy/deploy.sh <image:tag>" >&2; exit 2; }

cd "$APP_DIR"
[ -f .env ] || { echo "ERREUR : ${APP_DIR}/.env absent (voir .env.example)" >&2; exit 2; }

STATE_DIR="${APP_DIR}/.deploy"
HISTORY="${STATE_DIR}/historique.log"
mkdir -p "$STATE_DIR"

COMPOSE=(docker compose -f docker-compose.yml)
if [ "$WITH_MONITORING" = "1" ]; then
  COMPOSE+=(-f docker-compose.monitoring.yml)
fi

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }
record() { printf '%s\t%s\t%s\n' "$(date '+%F %T')" "$1" "$2" >> "$HISTORY"; }

PREVIOUS_IMAGE=""
[ -f "${STATE_DIR}/image_courante" ] && PREVIOUS_IMAGE="$(cat "${STATE_DIR}/image_courante")"

start_stack() {
  SINISTREFLOW_IMAGE="$1" "${COMPOSE[@]}" up -d --no-build --remove-orphans --wait --wait-timeout "$HEALTH_TIMEOUT"
}

wait_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)" = "200" ]; then
      return 0
    fi
    sleep 3
  done
  return 1
}

remember_image() {
  echo "$1" > "${STATE_DIR}/image_courante"
  if grep -q '^SINISTREFLOW_IMAGE=' .env; then
    sed -i "s|^SINISTREFLOW_IMAGE=.*|SINISTREFLOW_IMAGE=$1|" .env
  else
    printf '\nSINISTREFLOW_IMAGE=%s\n' "$1" >> .env
  fi
}

rollback() {
  local reason="$1"
  log "ÉCHEC : ${reason}"
  record "$NEW_IMAGE" "ECHEC (${reason})"
  "${COMPOSE[@]}" logs --no-color --tail 40 app migrate 2>/dev/null || true

  if [ -z "$PREVIOUS_IMAGE" ]; then
    log "Aucune version précédente : pas de retour arrière possible."
    exit 1
  fi

  log "Retour arrière vers ${PREVIOUS_IMAGE}"
  if start_stack "$PREVIOUS_IMAGE" && wait_health; then
    remember_image "$PREVIOUS_IMAGE"
    record "$PREVIOUS_IMAGE" "RETOUR ARRIERE OK"
    log "Retour arrière réussi : ${PREVIOUS_IMAGE} est de nouveau en service."
  else
    record "$PREVIOUS_IMAGE" "RETOUR ARRIERE EN ECHEC"
    log "Le retour arrière a échoué lui aussi : intervention manuelle nécessaire (docs/RUNBOOK.md)."
  fi
  exit 1
}

log "Déploiement de ${NEW_IMAGE} (version en service : ${PREVIOUS_IMAGE:-aucune})"

if [ "$SKIP_PULL" != "1" ]; then
  log "1/4 Récupération de l'image"
  SINISTREFLOW_IMAGE="$NEW_IMAGE" "${COMPOSE[@]}" pull --quiet app migrate || rollback "image introuvable ou registre inaccessible"
fi

log "2/4 Migrations puis démarrage de l'application"
start_stack "$NEW_IMAGE" || rollback "la stack n'a pas démarré (migrations ou application)"

log "3/4 Attente de ${HEALTH_URL}"
wait_health || rollback "/health ne répond pas 200 après ${HEALTH_TIMEOUT} s"

if [ "$RUN_CONNECTOR" = "1" ]; then
  log "4/4 Recette du connecteur ExpertAuto"
  bash deploy/run-connector.sh || rollback "le connecteur ExpertAuto n'est pas conforme"
else
  log "4/4 Connecteur ExpertAuto non lancé (RUN_CONNECTOR=0)"
fi

remember_image "$NEW_IMAGE"
record "$NEW_IMAGE" "OK"
log "Déploiement réussi : ${NEW_IMAGE} est en service."
