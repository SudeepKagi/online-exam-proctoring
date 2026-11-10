#!/bin/bash
set -euo pipefail

HEAD_SHA="ace92878effc7d9b335f7877d98d685b7a6fed39"
BASE_DIR="/opt/proctornet"
RELEASES_DIR="$BASE_DIR/releases"
NEW_RELEASE="$RELEASES_DIR/release-${HEAD_SHA}"
SHARED_ENV="$BASE_DIR/shared/.env"
BUCKET="proctornet-storage-prod-858109978489"
TAR_FILE="release-${HEAD_SHA}.tar.gz"

echo "=== 1. PREPARING NEW RELEASE DIRECTORY ==="
mkdir -p "$NEW_RELEASE"
cd "$NEW_RELEASE"

echo "Fetching release tarball from S3..."
aws s3 cp "s3://${BUCKET}/releases/${TAR_FILE}" "/tmp/${TAR_FILE}"
tar -xzf "/tmp/${TAR_FILE}" -C "$NEW_RELEASE"
rm -f "/tmp/${TAR_FILE}"
chown -R proctornet:proctornet "$NEW_RELEASE"
ls -la "$NEW_RELEASE"

echo "=== 2. LINKING SHARED ENVIRONMENT ==="
ln -sf "$SHARED_ENV" "$NEW_RELEASE/backend/.env"
ln -sf "$SHARED_ENV" "$NEW_RELEASE/.env"

echo "=== 3. INSTALLING/CACHING PRODUCTION DEPENDENCIES IN NEW RELEASE ==="
PREV_RELEASE=$(readlink -f "$BASE_DIR/current" || echo "")
if [ -n "$PREV_RELEASE" ] && [ -d "$PREV_RELEASE/backend/node_modules" ] && [ ! -d "$NEW_RELEASE/backend/node_modules" ]; then
    echo "Copying previous node_modules cache from $PREV_RELEASE/backend/node_modules..."
    cp -rp "$PREV_RELEASE/backend/node_modules" "$NEW_RELEASE/backend/node_modules"
fi

cd "$NEW_RELEASE/backend"
npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
npx prisma generate
chown -R proctornet:proctornet "$NEW_RELEASE/backend"

echo "=== 4. AUDITING LIVE JWT_SECRET AGAINST KNOWN DEFAULTS ==="
node -e "
const fs = require('fs');
const content = fs.readFileSync('$SHARED_ENV', 'utf8');
const match = content.match(/^JWT_SECRET=(.*)$/m);
const jwtSecret = match ? match[1].trim() : '';
const KNOWN_DEFAULTS = [
    'ci_throwaway_jwt_secret_at_least_32_characters_long_01',
    'default_jwt_secret_change_in_production_at_least_32_chars',
    'proctornet_default_super_secret_jwt_key_at_least_32_chars_long',
    'secret',
    'supersecret',
    'changeme',
    'jwt_secret',
    'jwtsecret'
];
if (!jwtSecret || KNOWN_DEFAULTS.includes(jwtSecret)) {
    console.log('JWT_SECRET_STATUS: default');
} else {
    console.log('JWT_SECRET_STATUS: ok');
}
"

echo "=== 5. CHECKING AND APPENDING MISSING PRODUCTION VARIABLES ==="
node -e "
const fs = require('fs');
const crypto = require('crypto');

const envPath = '$SHARED_ENV';
let content = fs.readFileSync(envPath, 'utf8');

function ensureVar(key, val) {
    const regex = new RegExp('^' + key + '=', 'm');
    if (!regex.test(content)) {
        content += '\n' + key + '=' + val;
        console.log('ADDED_VAR: ' + key);
    } else {
        console.log('EXISTING_VAR: ' + key);
    }
}

function updateVar(key, val) {
    const regex = new RegExp('^' + key + '=.*$', 'm');
    if (regex.test(content)) {
        content = content.replace(regex, key + '=' + val);
        console.log('UPDATED_VAR: ' + key);
    } else {
        content += '\n' + key + '=' + val;
        console.log('ADDED_VAR: ' + key);
    }
}

// 1. Secrets (generate on host if missing)
const jwtMatch = content.match(/^JWT_SECRET=(.*)$/m);
if (!jwtMatch || !jwtMatch[1].trim() || jwtMatch[1].trim() === 'ci_throwaway_jwt_secret_at_least_32_characters_long_01') {
    const newJwtSecret = crypto.randomBytes(32).toString('hex');
    updateVar('JWT_SECRET', newJwtSecret);
}

if (!/^JWT_REFRESH_SECRET=/m.test(content)) {
    const newRefreshSecret = crypto.randomBytes(32).toString('hex');
    ensureVar('JWT_REFRESH_SECRET', newRefreshSecret);
}

if (!/^SEB_LINK_SECRET=/m.test(content)) {
    const newSebSecret = crypto.randomBytes(32).toString('hex');
    ensureVar('SEB_LINK_SECRET', newSebSecret);
}

// 2. Canonical Origins and SEB Config
updateVar('PUBLIC_ORIGIN', 'https://proctornet.duckdns.org');
updateVar('ALLOWED_ORIGINS', 'https://proctornet.duckdns.org');
updateVar('SEB_MODE', 'log');
ensureVar('SEB_PRE_DOWNLOAD_MINUTES', '30');
ensureVar('SUPPORT_URL', 'https://proctornet.duckdns.org');
ensureVar('SEB_DOWNLOAD_URL', 'https://safeexambrowser.org/download_en.html');

fs.writeFileSync(envPath, content, 'utf8');
"

chmod 600 "$SHARED_ENV"
chown proctornet:proctornet "$SHARED_ENV"

echo "=== 6. RUNNING PREFLIGHT ENV VALIDATION ==="
node "$NEW_RELEASE/scripts/ops/preflight-env.js" "$SHARED_ENV" --prod || true
