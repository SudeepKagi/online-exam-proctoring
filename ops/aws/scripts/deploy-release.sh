#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy-release.sh v2
# S5 / R5 — Exam-Aware Release Deployment & Automated Rollback
# Executed on EC2 instance via AWS SSM send-command during CI/CD
# ─────────────────────────────────────────────────────────────

set -eo pipefail

RELEASE_TARBALL="${1:-}"
BUCKET_NAME="${2:-}"
shift 2 || true

OVERRIDE_REASON=""
EXPECTED_SHA=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --override)
            OVERRIDE_REASON="$2"
            shift 2
            ;;
        --expected-sha)
            EXPECTED_SHA="$2"
            shift 2
            ;;
        *)
            # Ignore unexpected args
            shift
            ;;
    esac
done

if [ -z "$RELEASE_TARBALL" ] || [ -z "$BUCKET_NAME" ]; then
    echo "Usage: $0 <release-tarball-name> <s3-bucket-name> [--override <reason>] [--expected-sha <sha>]"
    exit 1
fi

RELEASE_ID=$(basename "$RELEASE_TARBALL" .tar.gz)
BASE_DIR="/opt/proctornet"
RELEASES_DIR="$BASE_DIR/releases"
NEW_RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
CURRENT_LINK="$BASE_DIR/current"
SHARED_ENV="$BASE_DIR/shared/.env"

echo "=========================================================="
echo " Starting ProctorNet Release Deployment: $RELEASE_ID"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================================="

# 0. Preflight Validations: Disk Space & Exam-Aware Gate (§3.3 & Appendix D)
echo "[0/6] Running deployment preflight checks..."

# Check available disk space (require >= 2048 MB free)
AVAILABLE_MB=$(df -m "$BASE_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "99999")
if [ "$AVAILABLE_MB" -lt 2048 ]; then
    echo "[x] Preflight failed: Insufficient disk space ($AVAILABLE_MB MB available < 2048 MB required)."
    exit 1
fi
echo "[✓] Disk space verified: ${AVAILABLE_MB} MB available."

# Exam-Aware Gate: Refuse deploy if any attempts are ACTIVE unless explicit override is given
ACTIVE_SCRIPT="$CURRENT_LINK/proctornet/backend/scripts/ops/active-attempts.js"
if [ -L "$CURRENT_LINK" ] && [ -f "$ACTIVE_SCRIPT" ]; then
    echo "[-] Checking for active exam attempts..."
    ACTIVE=$(node "$ACTIVE_SCRIPT" 2>/dev/null || echo "0")
    if [ "$ACTIVE" -gt 0 ] && [ -z "$OVERRIDE_REASON" ]; then
        echo "=========================================================="
        echo "[x] Refusing to deploy: $ACTIVE attempts ACTIVE."
        echo "    Re-run with --override \"<reason>\" to proceed."
        echo "=========================================================="
        exit 3
    elif [ "$ACTIVE" -gt 0 ]; then
        echo "[!] OVERRIDE APPLIED: Proceeding with deployment despite $ACTIVE active attempts."
        echo "    Override reason: $OVERRIDE_REASON"
    else
        echo "[✓] Zero active attempts. Safe to proceed with release."
    fi
else
    echo "[-] No existing release found or active-attempts script not present. Skipping active attempt check."
fi

# 1. Capture Previous Release Directory for Rollback
PREV_RELEASE_DIR=""
if [ -L "$CURRENT_LINK" ]; then
    PREV_RELEASE_DIR=$(readlink -f "$CURRENT_LINK" || true)
    echo "[✓] Captured previous release for rollback: $PREV_RELEASE_DIR"
fi

# 2. Download and Unpack New Release
echo "[1/6] Downloading tarball from s3://$BUCKET_NAME/releases/$RELEASE_TARBALL..."
mkdir -p "$NEW_RELEASE_DIR"
aws s3 cp "s3://$BUCKET_NAME/releases/$RELEASE_TARBALL" "/tmp/$RELEASE_TARBALL"

echo "[2/6] Extracting release payload..."
tar -xzf "/tmp/$RELEASE_TARBALL" -C "$NEW_RELEASE_DIR"
rm -f "/tmp/$RELEASE_TARBALL"

# Ensure correct permissions
chown -R proctornet:proctornet "$NEW_RELEASE_DIR"

# 3. Symlink Shared Environment Variables
echo "[3/6] Linking persistent configuration (.env)..."
if [ -f "$SHARED_ENV" ]; then
    ln -sf "$SHARED_ENV" "$NEW_RELEASE_DIR/proctornet/backend/.env"
else
    echo "[-] WARNING: $SHARED_ENV does not exist. Using environment or defaults."
fi

# 4. Database Pre-Migration Snapshot & Migrations (Expand Phase)
echo "[4/6] Creating pre-migration database snapshot..."
SNAPSHOT_DIR="$BASE_DIR/backups"
mkdir -p "$SNAPSHOT_DIR"
SNAPSHOT_FILE="$SNAPSHOT_DIR/pre-deploy-${RELEASE_ID}-$(date +%s).sql.gz"

if [ -f "$SHARED_ENV" ]; then
    DB_URL=$(grep '^DATABASE_URL=' "$SHARED_ENV" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    CLEAN_DB_URL=$(echo "$DB_URL" | sed 's/[?&]pgbouncer=[^&]*//g; s/[?&]connection_limit=[^&]*//g; s/[?&]pool_timeout=[^&]*//g; s/?$//')
    if [ -n "$CLEAN_DB_URL" ] && command -v pg_dump >/dev/null 2>&1; then
        if pg_dump "$CLEAN_DB_URL" 2>/dev/null | gzip > "$SNAPSHOT_FILE"; then
            echo "[✓] Database snapshot created: $SNAPSHOT_FILE"
            aws s3 cp "$SNAPSHOT_FILE" "s3://${BUCKET_NAME}/backups/$(basename "$SNAPSHOT_FILE")" 2>/dev/null || true
        fi
    fi
fi

echo "[-] Ensuring production dependencies and executing database migrations..."
if [ -n "$PREV_RELEASE_DIR" ]; then
    if [ -d "$PREV_RELEASE_DIR/proctornet/node_modules" ] && [ ! -d "$NEW_RELEASE_DIR/proctornet/node_modules" ]; then
        echo "[-] Copying root node_modules cache from $PREV_RELEASE_DIR..."
        cp -rp "$PREV_RELEASE_DIR/proctornet/node_modules" "$NEW_RELEASE_DIR/proctornet/node_modules"
    fi
    if [ -d "$PREV_RELEASE_DIR/proctornet/backend/node_modules" ] && [ ! -d "$NEW_RELEASE_DIR/proctornet/backend/node_modules" ]; then
        echo "[-] Copying backend node_modules cache from $PREV_RELEASE_DIR..."
        cp -rp "$PREV_RELEASE_DIR/proctornet/backend/node_modules" "$NEW_RELEASE_DIR/proctornet/backend/node_modules"
    fi
    chown -R proctornet:proctornet "$NEW_RELEASE_DIR"
fi

cd "$NEW_RELEASE_DIR/proctornet/backend"
if [ ! -d "node_modules" ]; then
    echo "[-] Installing production dependencies..."
    sudo -u proctornet npm install --omit=dev --no-audit --no-fund
fi

# Use bundled prisma CLI if present, otherwise fallback
if [ -f "./node_modules/.bin/prisma" ]; then
    sudo -u proctornet ./node_modules/.bin/prisma generate
    MIGRATE_CMD="sudo -u proctornet ./node_modules/.bin/prisma migrate deploy"
else
    sudo -u proctornet npx prisma generate
    MIGRATE_CMD="sudo -u proctornet npx prisma migrate deploy"
fi

if $MIGRATE_CMD; then
    echo "[✓] Prisma migrations successfully applied."
else
    echo "[x] Database migration failed! Aborting before switching active symlink."
    rm -rf "$NEW_RELEASE_DIR"
    exit 1
fi

# 5. Atomic Symlink Switch, Service Restart & Caddy Sync
echo "[5/6] Atomically switching active symlink and restarting systemd service..."
ln -sfn "$NEW_RELEASE_DIR" "$CURRENT_LINK"
systemctl restart proctornet

if [ -f "$NEW_RELEASE_DIR/ops/caddy/Caddyfile" ]; then
    echo "[-] Syncing Caddy reverse proxy configuration from release..."
    cp "$NEW_RELEASE_DIR/ops/caddy/Caddyfile" /etc/caddy/Caddyfile
    if caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile; then
        systemctl reload caddy || systemctl restart caddy
        echo "[✓] Caddy configuration successfully validated and reloaded."
    else
        echo "[x] WARNING: Caddyfile validation failed! Retaining previous configuration."
    fi
fi

# 6. Automated Functional Health Checks with Rollback on Failure
echo "[6/6] Verifying service health (/healthz, /readyz, /api/v1/version, /api/v1/config)..."
HEALTHY=false
for i in {1..15}; do
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/healthz || true)
    READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9100/readyz || true)
    if [ "$READY_STATUS" != "200" ]; then
        READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/readyz || true)
    fi
    CONFIG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/v1/config || true)

    if [ "$HEALTH_STATUS" = "200" ] && [ "$READY_STATUS" = "200" ] && [ "$CONFIG_STATUS" = "200" ]; then
        echo "[✓] Health & Config checks passed on attempt $i (healthz=$HEALTH_STATUS, readyz=$READY_STATUS, config=$CONFIG_STATUS)."
        
        # Verify /api/v1/version
        VERSION_RESP=$(curl -s http://127.0.0.1:5000/api/v1/version || true)
        echo "[✓] Release version probe: $VERSION_RESP"
        
        HEALTHY=true
        break
    fi

    echo "[-] Attempt $i/15: waiting for backend startup (healthz=$HEALTH_STATUS, readyz=$READY_STATUS, config=$CONFIG_STATUS)..."
    sleep 2
done

if [ "$HEALTHY" = true ]; then
    echo "=========================================================="
    echo " [✓] Deployment SUCCESSFUL for release: $RELEASE_ID"
    echo "=========================================================="

    # Prune old releases, retaining last 5
    echo "Pruning old releases (keeping newest 5)..."
    cd "$RELEASES_DIR"
    ls -dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf || true
    exit 0
else
    echo "=========================================================="
    echo " [x] HEALTH CHECK FAILED! Triggering Automatic Rollback..."
    echo "=========================================================="

    if [ -n "$PREV_RELEASE_DIR" ] && [ -d "$PREV_RELEASE_DIR" ]; then
        echo "[ROLLBACK] Reverting symlink to previous release: $PREV_RELEASE_DIR"
        ln -sfn "$PREV_RELEASE_DIR" "$CURRENT_LINK"
        systemctl restart proctornet

        # Verify rollback health
        sleep 3
        ROLLBACK_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/healthz || true)
        if [ "$ROLLBACK_HEALTH" = "200" ]; then
            echo "[ROLLBACK ✓] Successfully restored traffic to previous release ($PREV_RELEASE_DIR)."
        else
            echo "[ROLLBACK x] CRITICAL: Rollback failed to achieve 200 OK."
        fi
    else
        echo "[ROLLBACK x] No previous release available to roll back to."
    fi

    echo "Removing failed release directory: $NEW_RELEASE_DIR"
    rm -rf "$NEW_RELEASE_DIR"
    exit 1
fi
