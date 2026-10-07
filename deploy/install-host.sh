#!/usr/bin/env bash
# Installe le site nginx et les tâches planifiées. Usage : sudo bash deploy/install-host.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sinistreflow}"
DEPLOY_USER="deploy"

[ "$(id -u)" -eq 0 ] || { echo "ERREUR : à lancer en root (sudo bash $0)" >&2; exit 1; }
[ -f "${APP_DIR}/deploy/nginx/sinistreflow.conf" ] || { echo "ERREUR : dépôt absent de ${APP_DIR}" >&2; exit 1; }

echo "==> Site nginx"
install -m 644 "${APP_DIR}/deploy/nginx/sinistreflow.conf" /etc/nginx/sites-available/sinistreflow
ln -sf /etc/nginx/sites-available/sinistreflow /etc/nginx/sites-enabled/sinistreflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Tâches planifiées"
cat > /etc/cron.d/sinistreflow <<EOF
# Géré par deploy/install-host.sh
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# sauvegarde quotidienne de la base, à 2 h 30
30 2 * * * ${DEPLOY_USER} bash ${APP_DIR}/deploy/backup.sh >> /var/log/sinistreflow-backup.log 2>&1

# connecteur ExpertAuto, toutes les heures (code du partenaire, non modifié)
0 * * * * ${DEPLOY_USER} bash ${APP_DIR}/deploy/run-connector.sh >> /var/log/sinistreflow-connecteur.log 2>&1
EOF
chmod 644 /etc/cron.d/sinistreflow
touch /var/log/sinistreflow-backup.log /var/log/sinistreflow-connecteur.log
chown "${DEPLOY_USER}:${DEPLOY_USER}" /var/log/sinistreflow-backup.log /var/log/sinistreflow-connecteur.log

echo "Installation terminée."
