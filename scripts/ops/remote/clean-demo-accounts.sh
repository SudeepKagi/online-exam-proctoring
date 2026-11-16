#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. VERIFYING LIVE DATABASE BACKUP ==="
DUMP_FILE=$(ls -t /tmp/proctornet_prod_*.dump 2>/dev/null | head -n 1 || echo "")
if [ -z "$DUMP_FILE" ]; then
    echo "ERROR: No backup dump file found in /tmp. Aborting." >&2
    exit 1
fi

DUMP_MTIME=$(stat -c %Y "$DUMP_FILE")
NOW_TIME=$(date +%s)
AGE_MINUTES=$(( (NOW_TIME - DUMP_MTIME) / 60 ))
echo "Latest backup: $DUMP_FILE (age: ${AGE_MINUTES}m)"
if [ "$AGE_MINUTES" -gt 30 ]; then
    echo "ERROR: Backup is older than 30 minutes. Taking a fresh backup first..."
    /opt/proctornet/current/scripts/ops/backup-postgres.sh || true
fi

echo "=== 2. SURGICAL REMOVAL OF UNREFERENCED DEMO ACCOUNTS ==="
cd /opt/proctornet/current/backend

node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_EMAILS = [
  'faculty@proctornet.com',
  'invigilator@proctornet.com',
  'student1@proctornet.com',
  'student2@proctornet.com'
];

async function main() {
  console.log('Auditing target demo accounts for zero relations before deletion...');
  for (const email of TARGET_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            createdExams: true,
            assignments: true,
            attempts: true,
            reviewedAttempts: true,
            readinessReports: true,
            consents: true
          }
        }
      }
    });

    if (!user) {
      console.log(\`User \${email} does not exist (already cleaned).\`);
      continue;
    }

    const totalRelations = Object.values(user._count).reduce((a, b) => a + b, 0);
    if (totalRelations > 0) {
      throw new Error(\`SAFETY ABORT: User \${email} has \${totalRelations} active relations! Cannot delete.\`);
    }

    console.log(\`Verified safe to remove: \${email} (ID: \${user.id}, 0 relations).\`);
    await prisma.user.delete({ where: { id: user.id } });
    console.log(\`Deleted demo user: \${email}\`);
  }

  const remainingUsers = await prisma.user.findMany({
    select: { email: true, role: true }
  });
  console.log('Remaining users in production:');
  console.log(JSON.stringify(remainingUsers, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.\$disconnect());
"

echo "=== 3. CLEANUP COMPLETE ==="

