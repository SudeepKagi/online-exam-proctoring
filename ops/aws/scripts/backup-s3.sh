#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# backup-s3.sh
# Nightly database backup script streaming compressed pg_dump to S3
# ─────────────────────────────────────────────────────────────

set -eo pipefail

BUCKET_NAME="${1:-${AWS_S3_BUCKET:-}}"
DB_URL="${DATABASE_URL:-}"

if [ -z "$BUCKET_NAME" ] || [ -z "$DB_URL" ]; then
    echo "Usage: $0 <s3-bucket-name>"
    echo "Or ensure AWS_S3_BUCKET and DATABASE_URL are exported."
    exit 1
fi

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="/tmp/proctornet_backup_${TIMESTAMP}.sql.gz"
S3_TARGET="s3://${BUCKET_NAME}/backups/proctornet_backup_${TIMESTAMP}.sql.gz"

echo "=== Starting Database Backup Drill ==="
echo "Target S3 destination: $S3_TARGET"

# Execute pg_dump with gzip compression
pg_dump "$DB_URL" --format=plain --no-owner --no-privileges | gzip -9 > "$BACKUP_FILE"

# Upload to S3 with server-side encryption
aws s3 cp "$BACKUP_FILE" "$S3_TARGET" --sse AES256

# Cleanup local temp file
rm -f "$BACKUP_FILE"

echo "[✓] Database backup successfully archived to $S3_TARGET"
