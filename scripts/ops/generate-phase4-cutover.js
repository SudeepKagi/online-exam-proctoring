#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '../..')
const schemaPath = path.join(repoRoot, 'backend/prisma/schema.prisma')
const scriptPath = path.join(repoRoot, 'scripts/ops/remote/phase4-cutover.sh')

const headSha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
const schemaContent = fs.readFileSync(schemaPath, 'utf8')
const schemaB64 = Buffer.from(schemaContent, 'utf8').toString('base64')

const script = `#!/bin/bash
set -euo pipefail

HEAD_SHA="${headSha}"
BASE_DIR="/opt/proctornet"
NEW_RELEASE="$BASE_DIR/releases/release-\${HEAD_SHA}"
CURRENT_LINK="$BASE_DIR/current"
SHARED_ENV="$BASE_DIR/shared/.env"
DUMP_FILE="\${DUMP_FILE:-$(ls -t /tmp/proctornet_prod_*.dump 2>/dev/null | head -n 1 || echo "")}"

echo "======================================================================"
echo " ProctorNet Phase 4: Production Live Cutover"
echo "======================================================================"
date -u +"UTC Time: %Y-%m-%d %H:%M:%S"

echo "=== 1. PRE-CHECKS ==="
# 1.1 Disk Space Check (> 2 GB)
FREE_KB=$(df / | awk 'NR==2 {print $4}')
FREE_MB=$((FREE_KB / 1024))
echo "Available disk space: \${FREE_MB} MB"
if [ "$FREE_MB" -lt 2000 ]; then
    echo "ERROR: Disk space is below 2000 MB! Aborting cutover." >&2
    exit 1
fi
echo "[✓] Disk space check PASSED: \${FREE_MB} MB free (> 2000 MB threshold)."

# 1.2 Backup File Verification (< 30 minutes old)
if [ ! -f "$DUMP_FILE" ]; then
    echo "ERROR: Production dump file $DUMP_FILE not found! Aborting cutover." >&2
    exit 1
fi
DUMP_MTIME=$(stat -c %Y "$DUMP_FILE")
NOW_TIME=$(date +%s)
AGE_MINUTES=$(( (NOW_TIME - DUMP_MTIME) / 60 ))
echo "Last backup age: \${AGE_MINUTES} minutes (Threshold: < 30 minutes)"
if [ "$AGE_MINUTES" -gt 30 ]; then
    echo "ERROR: Backup is older than 30 minutes! Aborting cutover." >&2
    exit 1
fi
echo "[✓] Backup freshness check PASSED: Dump is \${AGE_MINUTES} minutes old."

# 1.3 Active Exam Attempts Check (MUST BE 0)
cd "$NEW_RELEASE/backend"
ACTIVE_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '$SHARED_ENV' });
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});
async function main() {
  const count = await prisma.examAttempt.count({
    where: { status: 'IN_PROGRESS' }
  });
  console.log(count);
  await prisma.\\$disconnect();
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
")

echo "Active IN_PROGRESS exam attempts: $ACTIVE_COUNT"
if [ "$ACTIVE_COUNT" -ne 0 ]; then
    echo "STOP: Active exam attempts found ($ACTIVE_COUNT)! Aborting cutover to prevent disrupting live students." >&2
    exit 1
fi
echo "[✓] Active exam attempts check PASSED: 0 active exams."

echo "=== 2. DEPLOYING VERIFIED PRISMA SCHEMA & GENERATING CLIENT ==="
echo "${schemaB64}" | base64 -d > "$NEW_RELEASE/backend/prisma/schema.prisma"
npx prisma generate
chown -R proctornet:proctornet "$NEW_RELEASE/backend"

echo "=== 3. EXECUTING LIVE DATABASE MIGRATIONS ==="
set -a
. "$SHARED_ENV"
set +a

npx prisma migrate deploy
echo "[✓] Prisma migrate deploy completed successfully."

echo "Verifying migration status on live database:"
npx prisma migrate status

echo "=== 4. VALIDATING CADDY CONFIGURATION ==="
caddy validate --config /etc/caddy/Caddyfile
echo "[✓] Caddyfile validated successfully."

echo "=== 5. ATOMIC SYMLINK SWITCH ==="
echo "Previous release was: $(readlink -f $CURRENT_LINK)"
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"
echo "Current symlink now points to: $(readlink -f $CURRENT_LINK)"

echo "=== 6. RESTARTING BACKEND SERVICE & RELOADING PROXY ==="
systemctl restart proctornet.service
systemctl reload caddy.service

echo "Checking proctornet.service status:"
systemctl is-active proctornet.service

echo "=== 7. POST-CUTOVER HEALTH & SMOKE CHECKS ==="
sleep 3

echo "Check 7.1: Internal /healthz (port 5000)"
curl -sSf http://127.0.0.1:5000/healthz | jq . || curl -sSf http://127.0.0.1:5000/healthz
echo ""

echo "Check 7.2: Proxy /healthz (Caddy via domain resolve)"
curl -sSf --resolve proctornet.duckdns.org:443:127.0.0.1 https://proctornet.duckdns.org/healthz | jq . || curl -sSf --resolve proctornet.duckdns.org:443:127.0.0.1 https://proctornet.duckdns.org/healthz
echo ""

echo "Check 7.3: External public domain /healthz"
curl -sSf https://proctornet.duckdns.org/healthz | jq . || curl -sSf https://proctornet.duckdns.org/healthz
echo ""

echo "Check 7.4: SEB Ping endpoint"
curl -sSf http://127.0.0.1:5000/api/v1/seb/ping | jq . || curl -sSf http://127.0.0.1:5000/api/v1/seb/ping
echo ""

echo "Check 7.5: SPA Root HTML serving"
curl -sSf --resolve proctornet.duckdns.org:443:127.0.0.1 https://proctornet.duckdns.org/ | head -n 15
echo ""

echo "Check 7.6: Backend journalctl logs (last 30 lines)"
journalctl -u proctornet.service -n 30 --no-pager

echo "======================================================================"
echo "[✓] PHASE 4 CUTOVER COMPLETE: New release is LIVE and healthy."
echo "======================================================================"
`

fs.writeFileSync(scriptPath, script, 'utf8')
console.log('Generated:', scriptPath)
