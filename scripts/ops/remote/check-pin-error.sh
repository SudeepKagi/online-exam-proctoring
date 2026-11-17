#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " SEB PIN EXCHANGE & VERIFICATION JOURNAL AUDIT"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

echo "--- 1. SYSTEMD JOURNAL LOGS (LAST 30 MIN) FOR PIN & SEB ---"
journalctl -u proctornet.service --since "30 minutes ago" --no-pager | grep -iE "pin|seb|exchange|launch|enter|token" | tail -n 60 || true

echo ""
echo "--- 2. ALL RECENT PROCTORNET LOG ERRORS / WARNS ---"
journalctl -u proctornet.service --since "30 minutes ago" --no-pager | grep -iE "warn|error" | tail -n 40 || true

echo ""
echo "--- 3. SYSTEM SETTINGS IN DB ---"
cd /opt/proctornet/current/backend
node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const settings = await prisma.systemSetting.findMany();
  settings.forEach(s => {
    console.log('KEY:', s.key, 'VALUE:', s.value);
  });
  await prisma.\$disconnect();
}
main().catch(console.error);
"

echo "================================================================="
