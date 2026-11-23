#!/bin/bash
set -euo pipefail

CURRENT_DIR=$(readlink -f /opt/proctornet/current)
cd "$CURRENT_DIR/backend"

node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const row = await prisma.systemSetting.findUnique({
    where: { key: 'seb_config' }
  });
  if (!row) {
    console.error('NO_SEB_CONFIG_ROW');
    process.exit(1);
  }
  const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  val.configKey = process.env.NEW_CONFIG_KEY || 'e6b6658de7e289d476020f39661f3ec79a11aba8832409101f5a5c7c544ce9c0';

  await prisma.systemSetting.update({
    where: { key: 'seb_config' },
    data: { value: val }
  });

  const updated = await prisma.systemSetting.findUnique({
    where: { key: 'seb_config' }
  });
  const upVal = typeof updated.value === 'string' ? JSON.parse(updated.value) : updated.value;

  console.log(JSON.stringify({
    success: true,
    keyPresent: Boolean(upVal.configKey),
    keyLength: upVal.configKey ? upVal.configKey.length : 0,
    keySuffix: upVal.configKey ? upVal.configKey.slice(-4) : null,
    requestedMode: upVal.requestedMode,
    updatedAt: updated.updatedAt
  }, null, 2));

  await prisma.\$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
"

sudo systemctl restart proctornet.service
echo "proctornet.service restarted"
