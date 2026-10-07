#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy-release.sh
# R5 — Zero-Downtime Release Deployment & Automated Rollback
# Executed on EC2 instance via AWS SSM send-command during CI/CD
# ─────────────────────────────────────────────────────────────

set -eo pipefail

RELEASE_TARBALL="${1:-}"
BUCKET_NAME="${2:-}"

if [ -z "$RELEASE_TARBALL" ] || [ -z "$BUCKET_NAME" ]; then
    echo "Usage: $0 <release-tarball-name> <s3-bucket-name>"
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

# 4. Database Migrations (Expand Phase)
echo "[4/6] Ensuring production dependencies and executing database migrations..."
cd "$NEW_RELEASE_DIR/proctornet/backend"
if [ ! -d "node_modules" ]; then
    echo "[-] Installing production dependencies..."
    sudo -u proctornet npm install --omit=dev --no-audit --no-fund
    sudo -u proctornet npx prisma generate
fi
if sudo -u proctornet npx prisma migrate deploy; then
    echo "[✓] Prisma migrations successfully applied."
else
    echo "[x] Database migration failed! Aborting before switching active symlink."
    rm -rf "$NEW_RELEASE_DIR"
    exit 1
fi

# 5. Atomic Symlink Switch & Service Restart
echo "[5/6] Atomically switching active symlink and restarting systemd service..."
ln -sfn "$NEW_RELEASE_DIR" "$CURRENT_LINK"
systemctl restart proctornet

# 6. Automated Health Checks with Rollback on Failure
echo "[6/6] Verifying service health (/healthz and /readyz)..."
HEALTHY=false
for i in {1..15}; do
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/healthz || true)
    READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9100/readyz || true)
    if [ "$READY_STATUS" != "200" ]; then
        READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/readyz || true)
    fi

    if [ "$HEALTH_STATUS" = "200" ] && [ "$READY_STATUS" = "200" ]; then
        echo "[✓] Health check passed on attempt $i (healthz=$HEALTH_STATUS, readyz=$READY_STATUS)."
        HEALTHY=true
        break
    fi

    echo "[-] Attempt $i/15: waiting for backend startup (healthz=$HEALTH_STATUS, readyz=$READY_STATUS)..."
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
