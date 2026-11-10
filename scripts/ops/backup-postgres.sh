#!/usr/bin/env bash
# ==============================================================================
# ProctorNet PostgreSQL Automated Nightly Backup Script
# Retention: 7 days default (customizable via RETENTION_DAYS)
# Off-box: Sync to AWS S3 (customizable via OFFBOX_S3_BUCKET / AWS CLI)
# ==============================================================================
set -eu
set -o pipefail 2>/dev/null || true

BACKUP_DIR="${BACKUP_DIR:-/opt/proctornet/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/proctornet_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="${POSTGRES_CONTAINER:-proctornet-test-postgres}"
DB_NAME="${POSTGRES_DB:-proctornet}"
DB_USER="${POSTGRES_USER:-proctornet}"
OFFBOX_S3_BUCKET="${OFFBOX_S3_BUCKET:-proctornet-storage-prod-858109978489}"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting database backup for '${DB_NAME}' at ${TIMESTAMP}..."

if [ -n "${DIRECT_URL:-}" ]; then
  echo "[INFO] Using DIRECT_URL connection string..."
  CLEAN_CONN=$(echo "$DIRECT_URL" | sed 's/[?&]schema=.*//; s/[?&]sslmode=.*//')
  pg_dump -Fc -d "$CLEAN_CONN" -f "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
elif command -v docker >/dev/null 2>&1; then
  docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
else
  echo "[ERROR] Neither pg_dump nor docker command is available." >&2
  exit 1
fi

FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[INFO] Backup successfully created: ${BACKUP_FILE} (${FILE_SIZE})"

# Retention policy: remove backups older than RETENTION_DAYS
echo "[INFO] Cleaning up local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "proctornet_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete

# Off-box copy step
if [ -n "${OFFBOX_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "[INFO] Copying backup to off-box S3 storage: s3://${OFFBOX_S3_BUCKET}/backups/postgres/..."
  aws s3 cp "${BACKUP_FILE}" "s3://${OFFBOX_S3_BUCKET}/backups/postgres/$(basename "${BACKUP_FILE}")"
  echo "[INFO] Off-box copy complete."
else
  echo "[INFO] Off-box copy skipped (AWS CLI not configured or OFFBOX_S3_BUCKET unset)."
fi

echo "[INFO] Backup workflow completed successfully."

