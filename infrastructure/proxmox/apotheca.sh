#!/usr/bin/env bash
# Copyright (c) 2021-2026 community-scripts ORG
# Author: AnyelsonPerez
# License: MIT
# Source: https://github.com/AnyelsonPerez/Apotheca

# Standalone Proxmox LXC installer for Apotheca.
# Installs natively in the container (no Docker, no nesting).
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
YW=$(printf "\033[33m"); RD=$(printf "\033[01;31m"); GN=$(printf "\033[1;92m")
CL=$(printf "\033[m"); BGN=$(printf "\033[4;92m"); BL=$(printf "\033[36m")

APP="Apotheca"
REPO="https://github.com/AnyelsonPerez/Apotheca.git"
INSTALL_DIR="/opt/apotheca"
DATA_DIR="/var/lib/apotheca"

# ── Header ────────────────────────────────────────────────────────────────────
header_info() {
  clear
  cat <<EOF
${BL}
    ___
   /   |  _________ ___  _______  __
  / /| | / ___/ __   __ \/ ___/ / / /
 / ___ |/ /  / /_/ / / / / /__/ /_/ /
/_/  |_/_/   \__,_/_/ /_/\___/\__, /
          Self-hosted pharmacy  /____/
${CL}
EOF
}

# ── Helpers ───────────────────────────────────────────────────────────────────
msg_info() { echo -e " ${BL}[INFO]${CL} ${1}"; }
msg_ok()   { echo -e " ${GN}[OK]${CL}   ${1}"; }
msg_error(){ echo -e " ${RD}[ERROR]${CL} ${1}"; exit 1; }

# ── Detect defaults ───────────────────────────────────────────────────────────
DEFAULT_CT_ID=$(pvesh get /cluster/nextid 2>/dev/null | tr -d '"' || echo "200")
DEFAULT_GW=$(ip route | awk "/default/ {print \$3; exit}")

# Detect rootfs storage: prefer local-lvm, fall back to local
detect_storage() {
  local stor
  stor=$(pvesm status -content rootdir 2>/dev/null | awk "NR>1{print \$1}" | head -1)
  echo "${stor:-local}"
}
STORAGE=$(detect_storage)

# Detect vztmpl storage
detect_template_storage() {
  local stor
  stor=$(pvesm status -content vztmpl 2>/dev/null | awk "NR>1{print \$1}" | head -1)
  echo "${stor:-local}"
}
TEMPLATE_STORAGE=$(detect_template_storage)

header_info
echo -e "${GN}Welcome to the ${APP} LXC installer!${CL}"
echo ""

# ── Interactive prompts ───────────────────────────────────────────────────────
read -rp "$(echo -e ${BL}"Container ID [${DEFAULT_CT_ID}]: "${CL})" CT_ID
CT_ID="${CT_ID:-$DEFAULT_CT_ID}"

read -rp "$(echo -e ${BL}"IP address (CIDR, e.g. 10.10.0.220/24) or DHCP: "${CL})" CT_IP
if [[ -z "$CT_IP" || "${CT_IP,,}" == "dhcp" ]]; then
  CT_IP="dhcp"
  NET_CONFIG="name=eth0,ip=dhcp"
  msg_info "Using DHCP"
else
  read -rp "$(echo -e ${BL}"Gateway [${DEFAULT_GW}]: "${CL})" CT_GW
  CT_GW="${CT_GW:-$DEFAULT_GW}"
  NET_CONFIG="name=eth0,ip=${CT_IP},gw=${CT_GW}"
fi

read -rp "$(echo -e ${BL}"Disk size (GB) [8]: "${CL})" CT_DISK
CT_DISK="${CT_DISK:-8}"

echo ""
echo -e "${BGN}Summary:${CL}"
echo -e "  CT ID:       ${CT_ID}"
echo -e "  IP:          ${CT_IP}"
echo -e "  Disk:        ${CT_DISK} GB"
echo -e "  Storage:     ${STORAGE}"
echo -e "  Install dir: ${INSTALL_DIR}"
echo -e "  Data dir:    ${DATA_DIR}"
echo ""
read -rp "$(echo -e ${YW}"Press Enter to continue, Ctrl+C to abort..."${CL})"

# ── 1. Download template ──────────────────────────────────────────────────────
msg_info "Updating LXC template cache"
pveam update -q 2>/dev/null || true

TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi
msg_ok "Template ready"

# ── 2. Create container ───────────────────────────────────────────────────────
msg_info "Creating LXC container ${CT_ID}"
pct create "$CT_ID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --arch amd64 \
  --hostname apotheca \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs "${STORAGE}:${CT_DISK}" \
  --net0 "$NET_CONFIG" \
  --unprivileged 1 \
  --onboot 1 \
  --start 0
msg_ok "Container ${CT_ID} created"

# ── 3. Start ─────────────────────────────────────────────────────────────────
msg_info "Starting container"
pct start "$CT_ID"
sleep 5
msg_ok "Container started"

# ── 4. Install dependencies ─────────────────────────────────────────────────
msg_info "Installing system dependencies"
pct exec "$CT_ID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl git ca-certificates nginx >/dev/null 2>&1
'
msg_ok "Dependencies installed"

# ── 5. Install Python + uv ───────────────────────────────────────────────────
msg_info "Installing Python 3.12 and uv"
pct exec "$CT_ID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive

  # Install Python 3.12 from deadsnakes if not available in base
  apt-get install -y -qq python3 python3-pip python3-venv >/dev/null 2>&1

  # Check if python3.12 is available, otherwise add deadsnakes PPA
  if ! command -v python3.12 &>/dev/null; then
    apt-get install -y -qq software-properties-common >/dev/null 2>&1
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -qq
    apt-get install -y -qq python3.12 python3.12-venv python3.12-dev >/dev/null 2>&1
  fi

  # Install uv
  curl -fsSL https://astral.sh/uv/install.sh | sh
'
msg_ok "Python and uv installed"

# ── 6. Clone repo ────────────────────────────────────────────────────────────
msg_info "Cloning Apotheca"
pct exec "$CT_ID" -- bash -c "
  set -e
  rm -rf ${INSTALL_DIR}
  git clone -q ${REPO} ${INSTALL_DIR}
"
msg_ok "Repository cloned"

# ── 7. Setup API ─────────────────────────────────────────────────────────────
msg_info "Setting up API"
pct exec "$CT_ID" -- bash -c '
  set -e
  export PATH="$HOME/.local/bin:$PATH"
  cd '"${INSTALL_DIR}"'/apps/api

  # Create data directory
  mkdir -p '"${DATA_DIR}"'

  # Install Python dependencies with uv
  uv sync --no-dev

  # Run migrations
  uv run alembic upgrade head || true
'
msg_ok "API ready"

# ── 8. Build web ──────────────────────────────────────────────────────────────
msg_info "Building web frontend"
pct exec "$CT_ID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive

  # Install Node.js 22
  if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs >/dev/null 2>&1
  fi

  # Install pnpm
  corepack enable
  corepack prepare pnpm@latest --activate

  # Build web
  cd '"${INSTALL_DIR}"'
  pnpm install --frozen-lockfile
  pnpm --filter @apotheca/web build

  # Copy build to nginx
  mkdir -p /var/www/apotheca
  cp -r apps/web/dist/* /var/www/apotheca/
  cp -r apps/web/public/downloads /var/www/apotheca/downloads 2>/dev/null || true
'
msg_ok "Web frontend built"

# ── 9. Configure nginx ────────────────────────────────────────────────────────
msg_info "Configuring nginx"
pct exec "$CT_ID" -- bash -c '
  set -e
  cat <<NGINX > /etc/nginx/sites-available/apotheca
server {
    listen 80;
    server_name _;

    root /var/www/apotheca;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /auth/      { proxy_pass http://127.0.0.1:8000; }
    location /cima/      { proxy_pass http://127.0.0.1:8000; }
    location /inventory/ { proxy_pass http://127.0.0.1:8000; }
    location /settings/  { proxy_pass http://127.0.0.1:8000; }
    location /alerts/    { proxy_pass http://127.0.0.1:8000; }
    location /health     { proxy_pass http://127.0.0.1:8000; }
    location /docs       { proxy_pass http://127.0.0.1:8000; }
    location /openapi    { proxy_pass http://127.0.0.1:8000; }

    location /downloads/ {
        alias /var/www/apotheca/downloads/;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/apotheca /etc/nginx/sites-enabled/apotheca
  rm -f /etc/nginx/sites-enabled/default
  systemctl restart nginx
'
msg_ok "nginx configured"

# ── 10. Create systemd services ──────────────────────────────────────────────
msg_info "Creating systemd services"
pct exec "$CT_ID" -- bash -c '
  set -e

  # API service
  cat <<SYSTEMD > /etc/systemd/system/apotheca-api.service
[Unit]
Description=Apotheca API (FastAPI)
After=network.target

[Service]
Type=simple
WorkingDirectory='"${INSTALL_DIR}"'/apps/api
Environment=APOTHECA_DATABASE_PATH='"${DATA_DIR}"'/apotheca.db
Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/root/.local/bin/uv run uvicorn apotheca_api.app:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD

  systemctl daemon-reload
  systemctl enable -q apotheca-api
  systemctl start apotheca-api
'
msg_ok "Services created and started"

# ── 11. Health check ─────────────────────────────────────────────────────────
msg_info "Waiting for API health check"
for i in $(seq 1 30); do
  if pct exec "$CT_ID" -- bash -c "curl -sf http://localhost:8000/health" 2>/dev/null; then
    echo ""
    msg_ok "API is healthy!"
    break
  fi
  printf "."
  sleep 2
done

# ── Done ─────────────────────────────────────────────────────────────────────
if [[ "$CT_IP" == "dhcp" ]]; then
  CT_IP=$(pct exec "$CT_ID" -- ip -4 addr show eth0 | grep -oP "(?<=inet\s)\d+(\.\d+){3}")
fi

echo ""
echo -e "${GN}${APP} has been successfully installed!${CL}"
echo ""
echo -e "  ${BL}Web UI:${CL}    http://${CT_IP%%/*}"
echo -e "  ${BL}API:${CL}       http://${CT_IP%%/*}:8000"
echo -e "  ${BL}API Docs:${CL}  http://${CT_IP%%/*}:8000/docs"
echo ""
echo -e "  ${BL}Container:${CL}  pct enter ${CT_ID}"
echo -e "  ${BL}App dir:${CL}    ${INSTALL_DIR}"
echo -e "  ${BL}Data dir:${CL}   ${DATA_DIR}"
echo ""
echo -e "  ${BL}Update:${CL}     pct enter ${CT_ID} && cd ${INSTALL_DIR} && git pull && cd apps/api && uv sync && cd ../.. && pnpm --filter @apotheca/web build && cp -r apps/web/dist/* /var/www/apotheca/ && systemctl restart apotheca-api"
echo ""
echo -e "${YW}Next: Open the Web UI and register your first user.${CL}"
echo -e "${YW}Then visit /app to download the Android APK.${CL}"
echo ""