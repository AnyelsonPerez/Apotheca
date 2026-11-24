#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Apotheca - Proxmox LXC deployment script
# =============================================================================
# Creates a Debian 12 LXC container on Proxmox, installs Docker + Docker Compose,
# clones the repo, and launches the API + Web stack.
#
# Usage (run on the Proxmox host as root):
#   bash infrastructure/proxmox/install.sh [CT_ID] [CT_IP]
#
# Examples:
#   bash infrastructure/proxmox/install.sh
#   bash infrastructure/proxmox/install.sh 220 10.10.0.220
#   bash infrastructure/proxmox/install.sh 220 10.10.0.220 24
#
# After deployment, the web UI is at http://<CT_IP>
# =============================================================================

CT_ID="${1:-220}"
CT_IP="${2:-10.10.0.220}"
CT_GW="${3:-}"
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
STORAGE="${CT_STORAGE:-local}"
ROOTFS="${CT_ROOTFS:-local-lvm:4}"

# Auto-detect gateway if not provided
if [[ -z "$CT_GW" ]]; then
  CT_GW=$(ip route | awk '/default/ {print $3; exit}')
fi

echo "╔════════════════════════════════════════════════════╗"
echo "║         Apotheca — Proxmox LXC Deploy              ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║  CT ID:     $CT_ID"
echo "║  CT IP:     $CT_IP"
echo "║  Gateway:   $CT_GW"
echo "║  Storage:   $STORAGE"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# --- 1. Create container ---
echo "[1/6] Creating LXC container $CT_ID..."
# Download template if not present
pveam update -q 2>/dev/null || true
if ! pveam list "$STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  pveam download "$STORAGE" "$TEMPLATE"
fi

pct create "$CT_ID" "${STORAGE}:vztmpl/${TEMPLATE}" \
  --arch amd64 \
  --hostname apotheca \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs "$ROOTFS" \
  --net0 "name=eth0,ip=${CT_IP}/24,gw=${CT_GW}" \
  --features "nesting=1" \
  --unprivileged 1 \
  --onboot 1 \
  --start 0

echo "[1/6] Container created."
echo ""

# --- 2. Start container ---
echo "[2/6] Starting container..."
pct start "$CT_ID"
sleep 5
echo "[2/6] Container started."
echo ""

# --- 3. Install Docker inside the container ---
echo "[3/6] Installing Docker..."
pct exec "$CT_ID" -- bash -c '
  set -e
  apt-get update -qq
  apt-get install -y -qq curl git ca-certificates >/dev/null 2>&1

  # Install Docker
  curl -fsSL https://get.docker.com | sh

  # Add Docker Compose plugin (v2) — included in get.docker.com
  docker --version
  docker compose version
'
echo "[3/6] Docker installed."
echo ""

# --- 4. Clone the repo ---
echo "[4/6] Cloning Apotheca..."
pct exec "$CT_ID" -- bash -c '
  set -e
  rm -rf /opt/apotheca
  git clone https://github.com/AnyelsonPerez/Apotheca.git /opt/apotheca
'
echo "[4/6] Repo cloned."
echo ""

# --- 5. Build and launch ---
echo "[5/6] Building and launching containers..."
pct exec "$CT_ID" -- bash -c '
  set -e
  cd /opt/apotheca/infrastructure/docker
  docker compose up -d --build
'
echo "[5/6] Services launched."
echo ""

# --- 6. Wait for health check ---
echo "[6/6] Waiting for services to be ready..."
for i in $(seq 1 30); do
  if pct exec "$CT_ID" -- bash -c "curl -sf http://localhost:8000/health" 2>/dev/null; then
    echo ""
    echo "✅ API is healthy!"
    break
  fi
  printf "."
  sleep 2
done

echo ""
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║          ✅  Apotheca is deployed!                 ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║                                                    ║"
echo "║  Web UI:    http://$CT_IP"
echo "║  API:       http://$CT_IP:8000"
echo "║  API Docs:  http://$CT_IP:8000/docs"
echo "║                                                    ║"
echo "║  Container: pct enter $CT_ID"
echo "║  App dir:   /opt/apotheca"
echo "║  Data:      Docker volume apotheca-data"
echo "║                                                    ║"
echo "║  Next: Register your first user at the web UI.     ║"
echo "║  Then download the Android app from /app page.     ║"
echo "╚════════════════════════════════════════════════════╝"
