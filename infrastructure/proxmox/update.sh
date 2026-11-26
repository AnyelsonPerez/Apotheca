#!/usr/bin/env bash
# Apotheca LXC update script - run INSIDE the container.
# Usage:  bash /opt/apotheca/update.sh
#
# Checks for new commits on the main branch, and if found:
#   1. Pulls latest code
#   2. Syncs Python deps (uv)
#   3. Runs database migrations
#   4. Rebuilds the web frontend
#   5. Downloads the latest APK from GitHub Releases
#   6. Restarts the API service
set -euo pipefail

# -- Colors --
YW=$(printf "\033[33m")
RD=$(printf "\033[01;31m")
GN=$(printf "\033[1;92m")
BL=$(printf "\033[36m")
CL=$(printf "\033[m")

INSTALL_DIR="/opt/apotheca"
WEB_DIR="/var/www/apotheca"
DATA_DIR="/var/lib/apotheca"
REPO="https://github.com/AnyelsonPerez/Apotheca.git"

msg_info() { echo -e " ${BL}[INFO]${CL} ${1}"; }
msg_ok()   { echo -e " ${GN}[OK]${CL}   ${1}"; }
msg_error(){ echo -e " ${RD}[ERROR]${CL} ${1}"; exit 1; }

# -- Ensure this script is callable as 'apotheca-update' / 'update' --
if [ "$(command -v apotheca-update 2>/dev/null)" != "$INSTALL_DIR/update.sh" ]; then
  ln -sf "$INSTALL_DIR/update.sh" /usr/local/bin/apotheca-update 2>/dev/null || true
  ln -sf "$INSTALL_DIR/update.sh" /usr/local/bin/update 2>/dev/null || true
fi

# -- Self-repair: sync nginx config, systemd service, and auto-login --
self_repair() {
  # nginx config — always sync so config changes in the repo are applied
  msg_info "Syncing nginx config"
  cp "$INSTALL_DIR/infrastructure/proxmox/nginx-apotheca.conf" /etc/nginx/sites-available/apotheca
  ln -sf /etc/nginx/sites-available/apotheca /etc/nginx/sites-enabled/apotheca
  rm -f /etc/nginx/sites-enabled/default
  if nginx -t 2>/dev/null; then
    systemctl reload nginx || true
  else
    systemctl restart nginx || true
  fi
  msg_ok "nginx config synced"

  # systemd service — always sync
  msg_info "Syncing systemd service"
  cp "$INSTALL_DIR/infrastructure/proxmox/apotheca-api.service" /etc/systemd/system/apotheca-api.service
  systemctl daemon-reload
  systemctl enable -q apotheca-api
  msg_ok "systemd service synced"

  # auto-login on console
  if [ ! -f /etc/systemd/system/container-getty@.service.d/override.conf ]; then
    msg_info "Enabling console auto-login"
    passwd -d root 2>/dev/null || true
    mkdir -p /etc/systemd/system/container-getty@.service.d
    printf "[Service]\nEnvironment=TERM=linux\nExecStart=\nExecStart=-/sbin/agetty --autologin root --noissue --keep-baud - 115200,38400,9600 linux\n" > /etc/systemd/system/container-getty@.service.d/override.conf
    mkdir -p /etc/systemd/system/console-getty.service.d
    printf "[Service]\nEnvironment=TERM=linux\nExecStart=\nExecStart=-/sbin/agetty --autologin root --noissue --keep-baud - 115200,38400,9600 linux\n" > /etc/systemd/system/console-getty.service.d/override.conf
    touch /root/.hushlogin
    systemctl daemon-reload
    systemctl restart container-getty@1.service 2>/dev/null || true
    systemctl restart console-getty.service 2>/dev/null || true
    msg_ok "Console auto-login enabled"
  fi
}

# -- 0. Check for updates --
msg_info "Checking for updates..."
cd "$INSTALL_DIR"

# Fetch latest from origin
git fetch -q origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  msg_ok "Apotheca is already up to date."
  # Still run self-repair in case nginx/service are broken
  self_repair
  exit 0
fi

msg_ok "Update available! Updating from ${LOCAL:0:7} to ${REMOTE:0:7}"

# -- 1. Pull latest code --
msg_info "Pulling latest code"
git pull -q origin main
msg_ok "Code updated"

# -- 2. Sync API dependencies --
msg_info "Syncing Python dependencies"
export PATH="/root/.local/bin:$PATH"
cd "$INSTALL_DIR/apps/api"
uv sync --no-dev
msg_ok "Dependencies synced"

# -- 3. Run database migrations --
msg_info "Running database migrations"
uv run alembic upgrade head
msg_ok "Migrations complete"

# -- 4. Rebuild web frontend --
msg_info "Rebuilding web frontend"
cd "$INSTALL_DIR"
pnpm install --frozen-lockfile
pnpm --filter @apotheca/web build
rm -rf "$WEB_DIR"/*
cp -r apps/web/dist/* "$WEB_DIR/"
msg_ok "Web frontend rebuilt"

# -- 5. Download latest APK --
msg_info "Downloading latest APK"
mkdir -p "$WEB_DIR/downloads"
curl -fsSL -o "$WEB_DIR/downloads/apotheca.apk" "https://github.com/AnyelsonPerez/Apotheca/releases/download/latest/apotheca.apk" || echo "  APK not available yet"
msg_ok "APK updated"

# -- 6. Self-repair (nginx, service, auto-login) then restart API --
self_repair
msg_info "Restarting API service"
systemctl restart apotheca-api 2>/dev/null || systemctl start apotheca-api
msg_ok "API restarted"

# -- 7. Health check (through nginx on port 49200) --
msg_info "Health check (port 49200/api/health)"
for i in $(seq 1 15); do
  if curl -sf http://localhost:49200/api/health >/dev/null 2>&1; then
    msg_ok "API is healthy and reachable through nginx on port 49200!"
    echo ""
    echo -e " ${GN}Apotheca updated successfully!${CL}"
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
# Diagnostic: show what's listening
msg_error "Health check failed. Listening ports:\n$(ss -tlnp 2>/dev/null || true)\nCheck logs: journalctl -u apotheca-api -n 50 && nginx -t"
