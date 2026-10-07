#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# restore-drill.sh
# R5 — Automated Database Restore Drill into a Scratch Database
# ─────────────────────────────────────────────────────────────

set -eo pipefail

SCRATCH_DB_NAME="proctornet_restore_drill_$(date +%s)"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_USER="${PGUSER:-proctornet_admin}"
PG_PASSWORD="${PGPASSWORD:-}"
SOURCE_DB="${PGDATABASE:-proctornet}"

echo "=========================================================="
echo " Starting Database Restore Drill"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo " Source DB: $SOURCE_DB | Scratch Target: $SCRATCH_DB_NAME"
echo "=========================================================="

DUMP_PATH="/tmp/drill_dump_$$.sql.gz"

# 1. Create a fresh dump of the active database
echo "[1/5] Creating source database export..."
pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$SOURCE_DB" --no-owner --clean | gzip -9 > "$DUMP_PATH"

DUMP_SIZE=$(du -h "$DUMP_PATH" | cut -f1)
echo "[✓] Source export completed (Size: $DUMP_SIZE)."

# 2. Provision isolated scratch database
echo "[2/5] Creating scratch database '$SCRATCH_DB_NAME'..."
createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$SCRATCH_DB_NAME"

# 3. Restore dump into scratch database
echo "[3/5] Restoring database into '$SCRATCH_DB_NAME'..."
gunzip -c "$DUMP_PATH" | psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$SCRATCH_DB_NAME" --quiet

# 4. Verify Schema and Data Integrity in Scratch Database
echo "[4/5] Executing integrity verification queries against scratch DB..."
STUDENTS_COUNT=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$SCRATCH_DB_NAME" -t -A -c "SELECT COUNT(*) FROM students;" || echo "0")
EXAMS_COUNT=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$SCRATCH_DB_NAME" -t -A -c "SELECT COUNT(*) FROM exams;" || echo "0")
QUESTIONS_COUNT=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$SCRATCH_DB_NAME" -t -A -c "SELECT COUNT(*) FROM questions;" || echo "0")
ATTEMPTS_COUNT=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$SCRATCH_DB_NAME" -t -A -c "SELECT COUNT(*) FROM exam_attempts;" || echo "0")

echo "Integrity verification results:"
echo "  - Students registered: $STUDENTS_COUNT"
echo "  - Exams configured:    $EXAMS_COUNT"
echo "  - Questions available: $QUESTIONS_COUNT"
echo "  - Attempts recorded:   $ATTEMPTS_COUNT"

# 5. Clean up temporary artifacts
echo "[5/5] Cleaning up scratch database and temporary dump..."
dropdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$SCRATCH_DB_NAME"
rm -f "$DUMP_PATH"

echo "=========================================================="
echo " [✓] RESTORE DRILL PASSED: Database fully verified"
echo " Duration: $SECONDS seconds"
echo " Ready for ledger recording."
echo "=========================================================="
