#!/bin/bash

#
# ------------------------------------------------------------
# DEPLOY SCRIPT — halcyon
# ------------------------------------------------------------
#
# ONE-TIME SERVER SETUP (ks-b):
#
# 1) Create releases directory:
#    sudo mkdir -p /var/www/halcyon/releases
#
# 2) Create initial symlink (required for first deploy):
#    sudo ln -s /var/www/halcyon/releases /var/www/halcyon/current
#
# 3) Ensure nginx serves the "current" symlink. The app has its own
#    subdomain, so this is a server block of its own rather than a
#    location under the studio site:
#    server {
#        server_name halcyon.1991computer.com;
#        root /var/www/halcyon/current;
#        index index.html;
#        try_files $uri $uri/ /index.html;
#    }
#
# After any nginx configuration change:
#    sudo nginx -t && sudo systemctl reload nginx
#
# ------------------------------------------------------------
# USAGE:
#   ./deploy-halcyon.sh
#   ./deploy-halcyon.sh rollback
#
# NOTES:
# - This script performs a local Vite build, uploads the dist/
#   folder via rsync, and switches releases atomically.
# - Rollback is supported via symlink switching.
# ------------------------------------------------------------

set -euo pipefail

# The app owns its directory directly under /var/www, like every other app
# on this box — never inside the studio site's webroot.
SERVER_USER="debian"
SERVER_HOST="ks-b"
APP_NAME="halcyon"
REMOTE_FRONT="/var/www/$APP_NAME"

GREEN="\033[0;32m"
BLUE="\033[38;5;81m"
RED="\033[0;31m"
RESET="\033[0m"

log() { printf "${BLUE}%s${RESET}\n" "$1"; }
ok()  { printf "${GREEN}%s${RESET}\n" "$1"; }
err() { printf "${RED}%s${RESET}\n" "$1"; }

manual_rollback() {
  log "Searching releases..."
  RELEASES=$(ssh "$SERVER_USER@$SERVER_HOST" "ls -1t '$REMOTE_FRONT/releases'")
  CURRENT=$(ssh "$SERVER_USER@$SERVER_HOST" "readlink '$REMOTE_FRONT/current' | xargs basename")

  PREVIOUS=$(echo "$RELEASES" | grep -v "$CURRENT" | head -n 1)

  if [ -z "$PREVIOUS" ]; then
    err "No previous release available."
    exit 1
  fi

  log "Rolling back to: $PREVIOUS"
  ssh "$SERVER_USER@$SERVER_HOST" \
    "rm -rf '$REMOTE_FRONT/current' && ln -s '$REMOTE_FRONT/releases/$PREVIOUS' '$REMOTE_FRONT/current'"

  ok "Rollback complete. Reload nginx manually when ready."
  exit 0
}

if [ "${1:-}" = "rollback" ]; then
  manual_rollback
fi

TIMESTAMP=$(date +"%Y-%m-%d-%Hh%M%S")
RELEASE_DIR="$REMOTE_FRONT/releases/$TIMESTAMP"

if [ ! -d "src" ]; then
  err "src/ directory not found. Run this script from the project root."
  exit 1
fi

log "Building project..."
pnpm build
ok "Build complete."

log "Preparing release folder..."
ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p '$REMOTE_FRONT/releases'"

CURRENT_RELEASE=$(ssh "$SERVER_USER@$SERVER_HOST" "readlink '$REMOTE_FRONT/current' || true")

log "Uploading new release..."
rsync -az dist/ "$SERVER_USER@$SERVER_HOST:$RELEASE_DIR/" || {
  err "Upload failed."
  exit 1
}
ok "Upload complete."

rollback_auto() {
  err "Deploy failed. Rolling back..."
  if [ -n "$CURRENT_RELEASE" ]; then
    ssh "$SERVER_USER@$SERVER_HOST" \
      "rm -rf '$REMOTE_FRONT/current' && ln -s '$CURRENT_RELEASE' '$REMOTE_FRONT/current'"
    ok "Rollback restored previous release."
  else
    err "No previous release to restore."
  fi
  ssh "$SERVER_USER@$SERVER_HOST" "rm -rf '$RELEASE_DIR'"
  exit 1
}

log "Switching active release..."
ssh "$SERVER_USER@$SERVER_HOST" \
  "rm -rf '$REMOTE_FRONT/current' && ln -s '$RELEASE_DIR' '$REMOTE_FRONT/current'" \
  || rollback_auto

ok "Active release set to $TIMESTAMP."

log "Cleaning old releases..."
ssh "$SERVER_USER@$SERVER_HOST" \
  "cd '$REMOTE_FRONT/releases' && ls -1t | tail -n +4 | xargs -r rm -rf"

ok "Cleanup complete."
ok "Deployment successful. Reload nginx manually when ready."