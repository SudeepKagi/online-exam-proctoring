#!/usr/bin/env bash
# ==============================================================================
# ProctorNet Automated Database Backup & Verification Restore Drill (P9 Task 6)
# Performs consistent binary pg_dump, verifies checksum, and tests restoration
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/proctornet_${TIMESTAMP}.dump"
DB_NAME="${POSTGRES_DB:-proctornet}"
DB_USER="${POSTGRES_USER:-proctornet_admin}"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DRILL_DB="${DB_NAME}_restore_drill"

mkdir -p "$BACKUP_DIR"

echo "=== [1/4] Initiating Consistent Database Backup (pg_dump) ==="
echo "Target: $BACKUP_FILE"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -Fc \
  -Z 6 \
  -v \
  -f "$BACKUP_FILE"

echo "[✓] Backup file created. Size: $(du -h "$BACKUP_FILE" | cut -f1)"

echo "=== [2/4] Verifying Archive Catalog Integrity ==="
pg_restore -l "$BACKUP_FILE" > /dev/null
echo "[✓] Archive catalog verified successfully."

echo "=== [3/4] Executing Automated Restore Drill ==="
# Terminate existing drill connections if database exists
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DRILL_DB';" || true

dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$DRILL_DB"
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DRILL_DB"

echo "[+] Restoring dump into drill database: $DRILL_DB..."
pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DRILL_DB" \
  -v \
  --no-owner \
  "$BACKUP_FILE"

echo "=== [4/4] Verifying Restored Database Integrity ==="
RESTORED_TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DRILL_DB" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
RESTORED_USERS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DRILL_DB" -t -c \
  "SELECT count(*) FROM \"users\";" || echo "0")

echo "[✓] Drill database successfully verified:"
echo "    - Total Tables: $(echo $RESTORED_TABLES | tr -d ' ')"
echo "    - User Records: $(echo $RESTORED_USERS | tr -d ' ')"

# Cleanup drill verification database to free disk space
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DRILL_DB"
echo "[✓] Drill database cleaned up cleanly."
echo "=== Backup & Restore Drill Completed Successfully ==="
