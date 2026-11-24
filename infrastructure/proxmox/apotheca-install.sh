#!/usr/bin/env bash
# Copyright (c) 2021-2026 community-scripts ORG
# Author: AnyelsonPerez
# License: MIT | https://github.com/community-scripts/ProxmoxVE/raw/main/LICENSE
# Source: https://github.com/AnyelsonPerez/Apotheca

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing Dependencies"
$STD apt-get install -y --no-install-recommends \
  curl \
  git \
  ca-certificates
msg_ok "Installed Dependencies"

msg_info "Installing Docker"
$STD curl -fsSL https://get.docker.com | sh
msg_ok "Installed Docker"

msg_info "Deploying Apotheca"
mkdir -p /opt/apotheca
$STD git clone -q https://github.com/AnyelsonPerez/Apotheca.git /opt/apotheca
cd /opt/apotheca/infrastructure/docker
$STD docker compose up -d --build
msg_ok "Deployed Apotheca"

msg_info "Waiting for Apotheca to be ready"
for i in $(seq 1 30); do
  if $STD curl -sf http://localhost:8000/health 2>/dev/null; then
    break
  fi
  sleep 2
done
msg_ok "Apotheca is ready"

motd_ssh
customize
cleanup_lxc
