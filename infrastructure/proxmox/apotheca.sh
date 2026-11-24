#!/usr/bin/env bash
_cs_boot="${COMMUNITY_SCRIPTS_CORE_DIR:-$(dirname "${BASH_SOURCE[0]}")/../../core}/core/build.func"
source "$_cs_boot" 2>/dev/null || source <(curl -fsSL "${COMMUNITY_SCRIPTS_CORE_URL:-https://raw.githubusercontent.com/community-scripts/core/main}/core/build.func")
# Copyright (c) 2021-2026 community-scripts ORG
# Author: AnyelsonPerez
# License: MIT | https://github.com/community-scripts/ProxmoxVE/raw/main/LICENSE
# Source: https://github.com/AnyelsonPerez/Apotheca

APP="Apotheca"
var_tags="${var_tags:-pharmacy;medication}"
var_cpu="${var_cpu:-2}"
var_ram="${var_ram:-2048}"
var_disk="${var_disk:-8}"
var_os="${var_os:-debian}"
var_version="${var_version:-12}"
var_arm64="${var_arm64:-no}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  if [[ ! -d /opt/apotheca ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  msg_info "Pulling latest Apotheca release"
  cd /opt/apotheca
  $STD git pull -q
  msg_ok "Pulled latest release"

  msg_info "Rebuilding and restarting containers"
  cd /opt/apotheca/infrastructure/docker
  $STD docker compose up -d --build
  msg_ok "Containers rebuilt and restarted"

  msg_info "Waiting for Apotheca to be ready"
  for i in $(seq 1 30); do
    if $STD curl -sf http://localhost:8000/health 2>/dev/null; then
      break
    fi
    sleep 2
  done
  msg_ok "Apotheca is ready"

  msg_ok "Updated successfully"
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Access the Web UI using the following URL:${CL}"
echo -e "${GATEWAY}${BGN}http://${IP}${CL}"
