#!/bin/bash 
set -euo pipefail 
if true; then 
  systemctl reload nginx_nonexistent 2>/dev/null 
  echo REACHED after failed reload 
fi 
echo REACHED after if 
