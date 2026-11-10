#!/bin/bash
set -euo pipefail

CURRENT_DIR=$(readlink -f /opt/proctornet/current)
echo "Current directory: $CURRENT_DIR"
ls -la "$CURRENT_DIR"
if [ -d "$CURRENT_DIR/backend" ]; then
    echo "--- $CURRENT_DIR/backend ---"
    ls -la "$CURRENT_DIR/backend"
fi
if [ -d "$CURRENT_DIR/node_modules" ]; then
    echo "Root node_modules exists"
fi
if [ -d "$CURRENT_DIR/backend/node_modules" ]; then
    echo "Backend node_modules exists"
fi

# Run the DB query with correct working directory
cd "$CURRENT_DIR/backend"
node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const inProgress = await prisma.examAttempt.count({ where: { status: 'IN_PROGRESS' } });
    const totalAttempts = await prisma.examAttempt.count();
    const testUsers = await prisma.user.findMany({
        where: {
            OR: [
                { email: { endsWith: '@proctornet.local' } },
                { email: { contains: 'test' } },
                { email: { contains: 'seed' } },
                { email: { contains: 'example' } }
            ]
        },
        select: { role: true, email: true }
    });
    console.log('ACTIVE_IN_PROGRESS_ATTEMPTS=' + inProgress);
    console.log('TOTAL_ATTEMPTS=' + totalAttempts);
    console.log('TEST_ACCOUNTS_COUNT=' + testUsers.length);
    testUsers.forEach(u => console.log('TEST_USER: ' + u.role + ' - ' + u.email));
    const migrations = await prisma.\$queryRaw\`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at ASC\`;
    console.log('APPLIED_MIGRATIONS_COUNT=' + migrations.length);
    migrations.forEach(m => console.log('MIGRATION: ' + m.migration_name));
    await prisma.\$disconnect();
}
run().catch(err => { console.error('QUERY_ERR:', err); process.exit(1); });
"
