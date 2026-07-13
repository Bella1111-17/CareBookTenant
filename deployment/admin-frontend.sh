#!/bin/bash

# Admin frontend deployment.
# Deploys static assets into the admin site root while keeping backend and ACME folders intact.

set -euo pipefail

SERVER_USER="root"
SERVER_IP="101.133.170.55"
SERVER_PATH="/www/wwwroot/admintenant.care.zbcare.cn"
REMOTE_TMP="/tmp/deploy_admin.tar.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../apps/admin-vue3"

cleanup() {
    rm -f "${PACK_NAME:-}"
}
trap cleanup EXIT

echo ""
echo "=========================================="
echo "  CareBook - Admin deploy"
echo "  Target: ${SERVER_IP}:${SERVER_PATH}"
echo "  Workdir: $(pwd)"
echo "=========================================="

echo ""
echo "1. Building admin frontend..."
pnpm run build:prod
echo "Build complete"

echo ""
echo "2. Packaging..."
PACK_NAME="deploy_admin.tar.gz"
tar -czf "$PACK_NAME" -C ./dist .
echo "Package ready: $(ls -lh "$PACK_NAME" | awk '{print $5}')"

echo ""
echo "3. Uploading and deploying..."

if [ -z "${SERVER_PATH}" ] || [ "${SERVER_PATH}" = "/" ]; then
    echo "Invalid SERVER_PATH"
    exit 1
fi

scp "$PACK_NAME" "${SERVER_USER}@${SERVER_IP}:${REMOTE_TMP}"

ssh "${SERVER_USER}@${SERVER_IP}" bash -s <<'REMOTE_EOF'
set -euo pipefail

BASE="/www/wwwroot/admintenant.care.zbcare.cn"
REMOTE_TMP="/tmp/deploy_admin.tar.gz"
STAGE_DIR="${BASE}_frontend_stage"
BACKUP_DIR="${BASE}_frontend_backup"

if [ -z "$BASE" ] || [ "$BASE" = "/" ]; then
    echo "Invalid deploy path"
    exit 1
fi

mkdir -p "$BASE"
rm -rf "$STAGE_DIR"
rm -rf "$BACKUP_DIR"
mkdir -p "$STAGE_DIR"
mkdir -p "$BACKUP_DIR"

tar -xzf "$REMOTE_TMP" -C "$STAGE_DIR"
rm -f "$REMOTE_TMP"

# Move current frontend files aside first, then switch staged files in.
find "$BASE" -mindepth 1 -maxdepth 1 \
    ! -name 'server' \
    ! -name '.well-known' \
    -exec mv {} "$BACKUP_DIR"/ \;

find "$STAGE_DIR" -mindepth 1 -maxdepth 1 -exec mv {} "$BASE"/ \;

rm -rf "$STAGE_DIR"
rm -rf "$BACKUP_DIR"

echo "Admin frontend deployed"
REMOTE_EOF

echo ""
echo "=========================================="
echo "  Admin deployment complete"
echo "  URL: https://admintenant.care.zbcare.cn"
echo "=========================================="
echo ""
