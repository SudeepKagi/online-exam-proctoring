#!/bin/bash
set -eu

SHARED_ENV="/opt/proctornet/shared/.env"
BUCKET="proctornet-storage-prod-858109978489"
DATE=$(date -u +'%Y%m%d_%H%M%S')
DUMP_FILE="/tmp/proctornet_prod_${DATE}.dump"

CONN_STR=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('$SHARED_ENV', 'utf8');
const directMatch = content.match(/^DIRECT_URL=(.*)$/m);
const dbMatch = content.match(/^DATABASE_URL=(.*)$/m);
let url = directMatch ? directMatch[1].trim() : (dbMatch ? dbMatch[1].trim() : '');
if ((url.startsWith('\"') && url.endsWith('\"')) || (url.startsWith(\"'\") && url.endsWith(\"'\"))) {
    url = url.slice(1, -1);
}
console.log(url);
")

echo "=== 1. EXECUTING LIVE DATABASE DUMP (pg_dump -Fc) ==="
pg_dump -Fc -d "$CONN_STR" -f "$DUMP_FILE"
ls -lh "$DUMP_FILE"

echo "=== 2. VERIFYING DUMP WITH pg_restore --list ==="
TOC_LINES=$(pg_restore --list "$DUMP_FILE" | wc -l)
echo "VERIFIED_TOC_LINES=$TOC_LINES"

TABLE_COUNT=$(pg_restore --list "$DUMP_FILE" | grep "TABLE DATA" | wc -l)
echo "VERIFIED_TABLE_DATA_COUNT=$TABLE_COUNT"

echo "=== 3. COMPUTING DUMP SHA256 CHECKSUM ==="
SHA256=$(sha256sum "$DUMP_FILE" | awk '{print $1}')
echo "DUMP_SHA256=$SHA256"
echo "DUMP_FILENAME=proctornet_prod_${DATE}.dump"

echo "=== 4. UPLOADING BACKUP TO S3 ==="
aws s3 cp "$DUMP_FILE" "s3://${BUCKET}/backups/proctornet_prod_${DATE}.dump"
echo "UPLOADED_S3_PATH=s3://${BUCKET}/backups/proctornet_prod_${DATE}.dump"

# Keep the dump file in /tmp/ until downloaded or cleanup
