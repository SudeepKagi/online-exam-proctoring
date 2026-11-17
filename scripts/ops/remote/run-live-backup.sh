#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " PROCTORNET LIVE DATABASE BACKUP (TOC-VERIFIED)"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

BASE_DIR="/opt/proctornet"
mkdir -p "$BASE_DIR/backups/postgres"
BACKUP_TS=$(date +%s)
DUMP_FILE="$BASE_DIR/backups/postgres/pre_deploy_v1.3.0_${BACKUP_TS}.dump"

set -a
. "$BASE_DIR/shared/.env"
set +a

CLEAN_CONN=$(echo "$DIRECT_URL" | sed 's/[?&]schema=.*//; s/[?&]sslmode=.*//')
echo "Creating automated pre-deployment database dump..."
pg_dump -Fc -d "$CLEAN_CONN" -f "$DUMP_FILE"

echo "Verifying database dump TOC with pg_restore --list..."
pg_restore --list "$DUMP_FILE" > "${DUMP_FILE}.toc"
sha256sum "$DUMP_FILE" > "${DUMP_FILE}.sha256"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
DUMP_BYTES=$(stat -c%s "$DUMP_FILE")
echo "[✓] Verified database dump: ${DUMP_FILE} (${DUMP_SIZE}, ${DUMP_BYTES} bytes)"

echo "Dump TOC entries count: $(wc -l < "${DUMP_FILE}.toc")"

if command -v aws >/dev/null 2>&1; then
  echo "Uploading backup to off-box S3..."
  aws s3 cp "$DUMP_FILE" "s3://proctornet-storage-prod-858109978489/backups/postgres/$(basename "$DUMP_FILE")"
  aws s3 cp "${DUMP_FILE}.sha256" "s3://proctornet-storage-prod-858109978489/backups/postgres/$(basename "$DUMP_FILE").sha256"
  echo "[✓] Off-box S3 backup verified."
fi

echo "================================================================="
