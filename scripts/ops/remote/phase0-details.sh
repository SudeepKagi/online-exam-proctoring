#!/bin/bash
set -euo pipefail

echo "=== 1. LISTENING PORTS (ss -tlnp) ==="
ss -tlnp

echo "=== 2. CADDY SERVICE & CADDYFILE ==="
systemctl is-active caddy || true
if [ -f /etc/caddy/Caddyfile ]; then
    echo "--- /etc/caddy/Caddyfile ---"
    cat /etc/caddy/Caddyfile
fi

echo "=== 3. APP DIRECTORY & RELEASE LAYOUT ==="
if [ -d /opt/proctornet ]; then
    echo "--- /opt/proctornet ---"
    ls -la /opt/proctornet
    if [ -d /opt/proctornet/releases ]; then
        echo "--- /opt/proctornet/releases ---"
        ls -la /opt/proctornet/releases
    fi
    if [ -d /opt/proctornet/shared ]; then
        echo "--- /opt/proctornet/shared ---"
        ls -la /opt/proctornet/shared
    fi
    if [ -L /opt/proctornet/current ]; then
        echo "--- /opt/proctornet/current target ---"
        readlink -f /opt/proctornet/current
    fi
fi

echo "=== 4. SYSTEMD UNIT CONFIGURATION ==="
if [ -f /etc/systemd/system/proctornet.service ]; then
    cat /etc/systemd/system/proctornet.service
fi

echo "=== 5. NODE & RUNTIME VERSIONS ==="
which node || true
node -v || true
which npm || true
npm -v || true

echo "=== 6. DEPLOYED COMMIT & GIT STATUS ==="
CURRENT_DIR=$(readlink -f /opt/proctornet/current || echo "/opt/proctornet/current")
if [ -d "$CURRENT_DIR/.git" ]; then
    git --git-dir="$CURRENT_DIR/.git" --work-tree="$CURRENT_DIR" log -1 --oneline || true
elif [ -d "$CURRENT_DIR/proctornet/.git" ]; then
    git --git-dir="$CURRENT_DIR/proctornet/.git" --work-tree="$CURRENT_DIR/proctornet" log -1 --oneline || true
elif [ -f "$CURRENT_DIR/RELEASE" ]; then
    cat "$CURRENT_DIR/RELEASE"
fi

echo "=== 7. LIVE DATABASE & ATTEMPTS COUNT ==="
# Locate .env
ENV_FILE=""
for f in /opt/proctornet/shared/.env /opt/proctornet/.env /opt/proctornet/current/.env; do
    if [ -f "$f" ]; then
        ENV_FILE="$f"
        break
    fi
done
echo "Active ENV_FILE: $ENV_FILE"
ls -la "$ENV_FILE"

# Extract database host & name without credentials
DB_HOST=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*@([^:\/]+).*/\1/' || true)
DB_NAME=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*\/([^?]+).*/\1/' || true)
echo "Target DB Host: $DB_HOST"
echo "Target DB Name: $DB_NAME"

# Check if PostgreSQL is running locally or managed
if command -v psql >/dev/null 2>&1; then
    psql --version || true
else
    echo "psql client not installed on host"
fi

# Run read-only query using node script inside the app
NODE_APP_DIR="$CURRENT_DIR/proctornet/backend"
if [ ! -d "$NODE_APP_DIR" ]; then
    NODE_APP_DIR="$CURRENT_DIR/backend"
fi
if [ ! -d "$NODE_APP_DIR" ]; then
    NODE_APP_DIR="$CURRENT_DIR"
fi
echo "Using Node App Dir: $NODE_APP_DIR"

cat << 'EOF' > /tmp/query-live-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. In-progress exam attempts
        const inProgressCount = await prisma.examAttempt.count({
            where: {
                status: 'IN_PROGRESS'
            }
        });
        console.log(`[DB] IN_PROGRESS Exam Attempts: ${inProgressCount}`);

        // 2. Total attempts
        const totalAttempts = await prisma.examAttempt.count();
        console.log(`[DB] Total Exam Attempts: ${totalAttempts}`);

        // 3. Total exams
        const totalExams = await prisma.exam.count();
        console.log(`[DB] Total Exams: ${totalExams}`);

        // 4. Seeded-looking accounts (@proctornet.local or obvious test emails)
        const testUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { email: { endsWith: '@proctornet.local' } },
                    { email: { contains: 'test' } },
                    { email: { contains: 'seed' } },
                    { email: { contains: 'example' } }
                ]
            },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
        console.log(`[DB] Seeded / Test-looking accounts found (${testUsers.length}):`);
        testUsers.forEach(u => {
            console.log(`  - Role: ${u.role}, Email: ${u.email}`);
        });

        // 5. Check if _prisma_migrations table exists
        const migrations = await prisma.$queryRaw`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at ASC;`;
        console.log(`[DB] Applied Migrations in Database (${migrations.length}):`);
        migrations.forEach(m => {
            console.log(`  - ${m.migration_name} (finished: ${m.finished_at})`);
        });

    } catch (err) {
        console.error('[DB Query Error]:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
EOF

cd "$NODE_APP_DIR"
node --env-file="$ENV_FILE" /tmp/query-live-db.js
rm -f /tmp/query-live-db.js

echo "=== 8. S3 USAGE & BUCKET CONFIGURATION ==="
S3_BUCKET_NAME=$(grep -E '^S3_BUCKET=' "$ENV_FILE" | cut -d'=' -f2- || true)
echo "Configured S3 Bucket: $S3_BUCKET_NAME"

echo "=== 9. BACKUP TIMERS & CRONTABS ==="
systemctl list-timers --all | grep -E '(proctor|backup)' || true
crontab -l 2>/dev/null || echo "No root crontab"
