#!/bin/bash

# Backend deployment.
# Deploys the Node service under the admin site directory so a single admin domain can be kept.

set -euo pipefail

SERVER_USER="root"
SERVER_IP="101.133.170.55"
SERVER_PATH="/www/wwwroot/admintenant.care.zbcare.cn/server"
SERVER_LOG="/www/wwwlogs/admintenant.care.zbcare.cn"
NODE_BIN="/www/server/nodejs/v24.17.0/bin"
REMOTE_TMP="/tmp/deploy_server.tar.gz"
REMOTE_ENV_TMP="/tmp/deploy_server.env"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR_PARENT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SCRIPT_DIR/../apps/server"

cleanup() {
    rm -f "${PACK_NAME:-}"
}
trap cleanup EXIT

echo ""
echo "=========================================="
echo "  CareBook - Server deploy"
echo "  Target: ${SERVER_IP}:${SERVER_PATH}"
echo "  Workdir: $(pwd)"
echo "=========================================="

echo ""
echo "1. Building backend..."
pnpm run build
echo "Build complete"

echo ""
echo "2. Packaging..."
PACK_NAME="deploy_server.tar.gz"
tar -czf "$PACK_NAME" \
    package.json \
    bun.lock \
    -C ./dist .
echo "Package ready: $(ls -lh "$PACK_NAME" | awk '{print $5}')"

echo ""
echo "3. Checking certificates..."
CERT_DIR="/etc/carebook/wechat"
if ssh "${SERVER_USER}@${SERVER_IP}" "mkdir -p '${CERT_DIR}' && test -f '${CERT_DIR}/apiclient_key.pem'"; then
    echo "   Certificates already exist, skipping"
else
    CERT_SOURCE="${SCRIPT_DIR_PARENT}/apps/server/secrets/wechat"
    if [ -f "${CERT_SOURCE}/apiclient_key.pem" ] && [ -f "${CERT_SOURCE}/apiclient_cert.pem" ] && [ -f "${CERT_SOURCE}/pub_key.pem" ]; then
        scp "${CERT_SOURCE}/apiclient_key.pem" \
            "${CERT_SOURCE}/apiclient_cert.pem" \
            "${CERT_SOURCE}/pub_key.pem" \
            "${SERVER_USER}@${SERVER_IP}:${CERT_DIR}/"
        ssh "${SERVER_USER}@${SERVER_IP}" "chmod 400 '${CERT_DIR}'/apiclient_key.pem '${CERT_DIR}'/apiclient_cert.pem '${CERT_DIR}'/pub_key.pem"
        echo "   Certificates uploaded with chmod 400"
    else
        echo "   Certificates not found locally; keep remote files in ${CERT_DIR} if WeChat Pay is enabled"
    fi
fi

echo ""
echo "4. Uploading and deploying code..."

scp "$PACK_NAME" "${SERVER_USER}@${SERVER_IP}:${REMOTE_TMP}"
if [ -n "${DEPLOY_ENV_FILE}" ] && [ -f "${DEPLOY_ENV_FILE}" ]; then
    scp "${DEPLOY_ENV_FILE}" "${SERVER_USER}@${SERVER_IP}:${REMOTE_ENV_TMP}"
elif [ -f "${SCRIPT_DIR_PARENT}/.env.production" ]; then
    scp "${SCRIPT_DIR_PARENT}/.env.production" "${SERVER_USER}@${SERVER_IP}:${REMOTE_ENV_TMP}"
else
    echo "No production env file uploaded; remote ${SERVER_PATH}/.env must already be configured"
fi

ssh "${SERVER_USER}@${SERVER_IP}" bash -s <<'REMOTE_EOF'
set -euo pipefail

export PATH=/www/server/nodejs/v24.17.0/bin:$PATH
BASE="/www/wwwroot/admintenant.care.zbcare.cn/server"
LOG="/www/wwwlogs/admintenant.care.zbcare.cn"
REMOTE_TMP="/tmp/deploy_server.tar.gz"
REMOTE_ENV_TMP="/tmp/deploy_server.env"

echo "   Extracting..."
mkdir -p "$BASE" "$LOG"

find "$BASE" -mindepth 1 -maxdepth 1 \
    ! -name 'node_modules' \
    ! -name '.pnpm-store' \
    -exec rm -rf {} + 2>/dev/null || true

tar -xzf "$REMOTE_TMP" -C "$BASE"
rm -f "$REMOTE_TMP"
if [ -f "$REMOTE_ENV_TMP" ]; then
    mv "$REMOTE_ENV_TMP" "$BASE/.env"
    chmod 600 "$BASE/.env"
fi

mkdir -p "$BASE/public" "$BASE/upload"

echo "   Installing dependencies..."
cd "$BASE"
pnpm install --prod --frozen-lockfile=false --ignore-scripts
echo "   Dependencies installed"

echo "   Restarting service..."
OLD_PID=$(lsof -ti:8081 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    OLD_CMD=$(cat "/proc/$OLD_PID/cmdline" 2>/dev/null | tr '\0' ' ' || true)
    if echo "$OLD_CMD" | grep -qi 'node'; then
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
        echo "   Stopped old node process PID: $OLD_PID"
    else
        echo "   Port 8081 occupied by non-node process, refusing to kill:"
        ps -fp "$OLD_PID" || true
        exit 1
    fi
fi

export NODE_ENV=production
cd "$BASE"
nohup node main > "$LOG/server.out.log" 2>&1 </dev/null &

for i in $(seq 1 15); do
    sleep 2
    if curl -fsS "http://127.0.0.1:8081/prod-api/swagger-ui/" >/dev/null 2>&1; then
        NEW_PID=$(lsof -ti:8081 2>/dev/null || true)
        echo "   Service started PID: ${NEW_PID:-unknown}"
        echo "   Health check passed on attempt $i"
        exit 0
    fi
done

echo "   Service failed health check after 30s, latest log:"
tail -30 "$LOG/server.out.log"
exit 1
REMOTE_EOF

echo ""
echo "=========================================="
echo "  Server deployment complete"
echo "  Backend path: ${SERVER_PATH}"
echo "=========================================="
echo ""
