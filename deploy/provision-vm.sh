#!/usr/bin/env bash
# Provisionnement d'une VM Ubuntu 24.04 pour SinistreFlow.
# Usage (en root, une seule fois) : sudo bash provision-vm.sh
set -euo pipefail

DEPLOY_USER="deploy"
APP_DIR="/opt/sinistreflow"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "ce script doit être lancé en root (sudo bash $0)"
# shellcheck disable=SC1091
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || fail "ce script est prévu pour Ubuntu (trouvé : ${ID:-inconnu})"

export DEBIAN_FRONTEND=noninteractive

log "1/6 Paquets de base"
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades nginx python3 netcat-openbsd

log "2/6 Utilisateur ${DEPLOY_USER}"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi

SOURCE_USER="${SUDO_USER:-root}"
SOURCE_HOME="$(getent passwd "$SOURCE_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
if [ -s "${SOURCE_HOME}/.ssh/authorized_keys" ]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    "${SOURCE_HOME}/.ssh/authorized_keys" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

# ne jamais couper la connexion par mot de passe si deploy n'a pas de clé SSH
[ -s "/home/${DEPLOY_USER}/.ssh/authorized_keys" ] \
  || fail "aucune clé SSH pour ${DEPLOY_USER} : ajoutez votre clé publique dans /home/${DEPLOY_USER}/.ssh/authorized_keys puis relancez"

log "3/6 Durcissement de SSH"
cat > /etc/ssh/sshd_config.d/99-sinistreflow.conf <<'EOF'
# Géré par deploy/provision-vm.sh
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
sshd -t || fail "configuration SSH invalide, rien n'a été rechargé"
systemctl reload ssh

systemctl enable --now fail2ban

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

log "4/6 Pare-feu ufw : 22, 80 et 443 uniquement"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

log "5/6 Docker Engine et plugin compose (dépôt officiel Docker)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

log "6/6 Dossier de l'application et nginx"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/backups/sinistreflow

rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

log "Provisionnement terminé"
ufw status verbose
cat <<EOF

Étapes suivantes (voir docs/RUNBOOK.md) :
  1. depuis votre poste, vérifier la connexion :  ssh ${DEPLOY_USER}@<ip de la VM>
     (gardez la session actuelle ouverte tant que ce test n'a pas réussi)
  2. depuis votre poste, vérifier que la base est fermée :  nc -zv <ip de la VM> 5432
  3. en tant que ${DEPLOY_USER} : récupérer le dépôt dans ${APP_DIR}, créer le fichier .env,
     puis lancer  sudo bash ${APP_DIR}/deploy/install-host.sh
EOF
