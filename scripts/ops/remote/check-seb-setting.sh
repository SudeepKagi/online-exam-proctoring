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
    console.log('NO_SEB_CONFIG_ROW');
    return;
  }
  const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  console.log(JSON.stringify({
    keyPresent: Boolean(val.configKey),
    keyLength: val.configKey ? val.configKey.length : 0,
    s3Key: val.s3Key,
    lastVerifiedAt: val.lastVerifiedAt,
    lastVerifiedMethod: val.lastVerifiedMethod,
    lastVerifiedUserAgent: val.lastVerifiedUserAgent,
    updatedAt: row.updatedAt
  }, null, 2));
  await prisma.\$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
"
