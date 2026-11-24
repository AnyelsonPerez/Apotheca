#!/usr/bin/env bash
# Copyright (c) 2021-2026 community-scripts ORG
# Author: AnyelsonPerez
# License: MIT
# Source: https://github.com/AnyelsonPerez/Apotheca

# Standalone Proxmox LXC installer for Apotheca.
# Does NOT depend on the community-scripts framework — works standalone.
# When Apotheca is accepted into community-scripts, use ct/apotheca.sh instead.

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
YW=$(printf "\033[33m"); RD=$(printf "\033[01;31m"); GN=$(printf "\033[1;92m")
CL=$(printf "\033[m"); BGN=$(printf "\033[4;92m"); BL=$(printf "\033[36m")

APP="Apotheca"
REPO="https://github.com/AnyelsonPerez/Apotheca.git"
INSTALL_DIR="/opt/apotheca"

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

header_info
echo -e "${GN}Welcome to the ${APP} LXC installer!${CL}"
echo ""

# ── Interactive prompts ───────────────────────────────────────────────────────
read -rp "$(echo -e ${BL}"Container ID [${DEFAULT_CT_ID}]: "${CL})" CT_ID
CT_ID="${CT_ID:-$DEFAULT_CT_ID}"

read -rp "$(echo -e ${BL}"IP address (CIDR, e.g. 10.10.0.220/24): "${CL})" CT_IP
if [[ -z "$CT_IP" ]]; then
  CT_IP="dhcp"
  msg_info "No IP set — using DHCP"
fi

if [[ "$CT_IP" != "dhcp" ]]; then
  read -rp "$(echo -e ${BL}"Gateway [${DEFAULT_GW}]: "${CL})" CT_GW
  CT_GW="${CT_GW:-$DEFAULT_GW}"
  NET_CONFIG="name=eth0,ip=${CT_IP},gw=${CT_GW}"
else
  NET_CONFIG="name=eth0,ip=dhcp"
fi

read -rp "$(echo -e ${BL}"Disk size (GB) [8]: "${CL})" CT_DISK
CT_DISK="${CT_DISK:-8}"

echo ""
echo -e "${BGN}Summary:${CL}"
echo -e "  CT ID:     ${CT_ID}"
echo -e "  IP:        ${CT_IP}"
echo -e "  Disk:      ${CT_DISK} GB"
echo -e "  Install:   ${INSTALL_DIR}"
echo ""
read -rp "$(echo -e ${YW}"Press Enter to continue, Ctrl+C to abort..."${CL})"

# ── 1. Download template ──────────────────────────────────────────────────────
msg_info "Updating LXC template cache"
pveam update -q 2>/dev/null || true

TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list local 2>/dev/null | grep -q "$TEMPLATE"; then
  pveam download local "$TEMPLATE"
fi
msg_ok "Template ready"

# ── 2. Create container ───────────────────────────────────────────────────────
msg_info "Creating LXC container ${CT_ID}"
pct create "$CT_ID" "local:vztmpl/${TEMPLATE}" \
  --arch amd64 \
  --hostname apotheca \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs "local-lvm:${CT_DISK}" \
  --net0 "$NET_CONFIG" \
  --features "nesting=1" \
  --unprivileged 1 \
  --onboot 1 \
  --start 0
msg_ok "Container ${CT_ID} created"

# ── 3. Start ─────────────────────────────────────────────────────────────────
msg_info "Starting container"
pct start "$CT_ID"
sleep 5
msg_ok "Container started"

# ── 4. Install Docker + deps ─────────────────────────────────────────────────
msg_info "Installing Docker inside the container"
pct exec "$CT_ID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl git ca-certificates >/dev/null 2>&1
  curl -fsSL https://get.docker.com | sh
'
msg_ok "Docker installed"

# ── 5. Clone & deploy ────────────────────────────────────────────────────────
msg_info "Cloning Apotheca and building containers"
pct exec "$CT_ID" -- bash -c '
  set -e
  rm -rf '"${INSTALL_DIR}"'
  git clone -q '"${REPO}"' '"${INSTALL_DIR}"'
  cd '"${INSTALL_DIR}"'/infrastructure/docker
  docker compose up -d --build
'
msg_ok "Apotheca deployed"

# ── 6. Health check ──────────────────────────────────────────────────────────
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
echo ""
echo -e "${YW}Next: Open the Web UI and register your first user.${CL}"
echo -e "${YW}Then visit /app to download the Android APK.${CL}"
echo ""