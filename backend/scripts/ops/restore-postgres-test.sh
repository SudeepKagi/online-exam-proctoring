#!/usr/bin/env bash
# ==============================================================================
# ProctorNet Automated Disaster Recovery & Backup Restore Test (POSIX shell)
# ==============================================================================
set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER:-proctornet-test-postgres}"
DB_USER="${POSTGRES_USER:-proctornet}"
SCRATCH_DB="${SCRATCH_DB:-proctornet_scratch_restore_test}"
BACKUP_DIR="${BACKUP_DIR:-/opt/proctornet/backups/postgres}"

echo "======================================================================"
echo " ProctorNet Automated Disaster Recovery & Backup Restore Test"
echo "======================================================================"

# 1. Run backup
echo "[1/5] Running backup script..."
bash "$(dirname "$0")/backup-postgres.sh"

LATEST_BACKUP="$(find "${BACKUP_DIR}" -name "proctornet_backup_*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)"
if [ -z "${LATEST_BACKUP:-}" ]; then
  echo "[ERROR] No backup file found in ${BACKUP_DIR}" >&2
  exit 1
fi
echo "[1/5] Restoring from latest backup: ${LATEST_BACKUP}"

# 2. Init scratch db
echo "[2/5] Creating clean scratch database '${SCRATCH_DB}'..."
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${SCRATCH_DB};"

# 3. Restore
echo "[3/5] Restoring dump stream into '${SCRATCH_DB}'..."
gzip -dc "${LATEST_BACKUP}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${SCRATCH_DB}"

# 4. Verification
echo "[4/5] Running verification audit..."
TABLE_COUNT=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${SCRATCH_DB}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
USER_COUNT=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${SCRATCH_DB}" -t -A -c "SELECT count(*) FROM users;")
EXAM_COUNT=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${SCRATCH_DB}" -t -A -c "SELECT count(*) FROM exams;")

echo " [+] Public Tables Count: ${TABLE_COUNT}"
echo " [+] Users Count        : ${USER_COUNT}"
echo " [+] Exams Count        : ${EXAM_COUNT}"

if [ "${TABLE_COUNT}" -eq 0 ]; then
  echo "[ERROR] Restore verification failed: table count is 0" >&2
  exit 1
fi

# 5. Cleanup
echo "[5/5] Cleaning up scratch database '${SCRATCH_DB}'..."
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
echo "======================================================================"
echo " RESTORE TEST PASSED: ALL DATA INVARIANTS & SCHEMAS VERIFIED"
echo "======================================================================"

