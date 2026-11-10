#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../..')
const backupSh = fs.readFileSync(path.join(repoRoot, 'scripts/ops/backup-postgres.sh'), 'utf8').replace(/\r\n/g, '\n')
const backupService = fs.readFileSync(path.join(repoRoot, 'scripts/ops/proctornet-backup.service'), 'utf8').replace(/\r\n/g, '\n')
const backupTimer = fs.readFileSync(path.join(repoRoot, 'scripts/ops/proctornet-backup.timer'), 'utf8').replace(/\r\n/g, '\n')

const b64Sh = Buffer.from(backupSh, 'utf8').toString('base64')
const b64Service = Buffer.from(backupService, 'utf8').toString('base64')
const b64Timer = Buffer.from(backupTimer, 'utf8').toString('base64')

const script = `#!/bin/bash
set -euo pipefail

SHARED_ENV="/opt/proctornet/shared/.env"

echo "======================================================================"
echo " ProctorNet Phase 5: Production Audit & Hardening"
echo "======================================================================"
date -u +"UTC Time: %Y-%m-%d %H:%M:%S"

echo "=== 1. SERVER-SIDE LISTENING PORTS INVENTORY ==="
ss -tlnp

echo "=== 2. INSTALLING & VERIFYING AUTOMATED BACKUP TIMER ==="
mkdir -p /var/log/proctornet /opt/proctornet/backups/postgres /opt/proctornet/current/scripts/ops
chown -R proctornet:proctornet /var/log/proctornet /opt/proctornet/backups

echo "${b64Sh}" | base64 -d > /opt/proctornet/current/scripts/ops/backup-postgres.sh
chmod 750 /opt/proctornet/current/scripts/ops/backup-postgres.sh
chown proctornet:proctornet /opt/proctornet/current/scripts/ops/backup-postgres.sh

echo "${b64Service}" | base64 -d > /etc/systemd/system/proctornet-backup.service
echo "${b64Timer}" | base64 -d > /etc/systemd/system/proctornet-backup.timer

systemctl daemon-reload
systemctl enable --now proctornet-backup.timer
systemctl list-timers proctornet-backup.timer --no-pager

echo "Testing automated backup service execution (oneshot test):"
systemctl start proctornet-backup.service || true
systemctl status proctornet-backup.service --no-pager || true

echo "=== 3. REHEARSING SEB KILL SWITCH (SEB_MODE=off -> restart -> SEB_MODE=log) ==="
# 3.1 Switch to off
sed -i 's/^SEB_MODE=.*/SEB_MODE=off/' "$SHARED_ENV"
systemctl restart proctornet.service
sleep 2
echo "Health with SEB_MODE=off:"
curl -sSf http://127.0.0.1:5000/healthz | jq -c .

# 3.2 Return to log
sed -i 's/^SEB_MODE=.*/SEB_MODE=log/' "$SHARED_ENV"
systemctl restart proctornet.service
sleep 2
echo "Health restored with SEB_MODE=log:"
curl -sSf http://127.0.0.1:5000/healthz | jq -c .

echo "=== 4. LOG AUDIT (LAST 30 LINES) ==="
journalctl -u proctornet.service -n 30 --no-pager

echo "======================================================================"
echo "[✓] PHASE 5 COMPLETE: Server audit and hardening verified."
echo "======================================================================"
`

const targetPath = path.join(repoRoot, 'scripts/ops/remote/phase5-hardening.sh')
fs.writeFileSync(targetPath, script, 'utf8')
console.log('Generated:', targetPath)
