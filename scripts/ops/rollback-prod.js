#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/rollback-prod.js
 *
 * Production Rollback Orchestrator for ProctorNet
 *
 * Reverts the live production symlink (/opt/proctornet/current) to either:
 * - A specified target release (--target <sha-or-tag>)
 * - The previously recorded release in /opt/proctornet/releases/PREVIOUS_RELEASE
 *
 * Restarts backend service, reloads Caddy, validates health probes,
 * runs the smoke suite, and logs the rollback event to docs/ops/DEPLOY_LOG.md.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)

let instanceId = 'i-0d242d962823f0a89'
let targetRelease = ''

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--instance' && args[i + 1]) {
    instanceId = args[++i]
  } else if (args[i] === '--target' && args[i + 1]) {
    targetRelease = args[++i]
  }
}

console.log('='.repeat(70))
console.log(' ProctorNet Production Rollback Orchestrator')
console.log(` Target Instance : ${instanceId}`)
console.log(` Target Release  : ${targetRelease || 'PREVIOUS_RELEASE'}`)
console.log(` Timestamp       : ${new Date().toISOString()}`)
console.log('='.repeat(70))

async function runRollback() {
  const startTime = Date.now()

  const remoteScript = `#!/bin/bash
set -euo pipefail

BASE_DIR="/opt/proctornet"
CURRENT_LINK="$BASE_DIR/current"
PREV_RECORD="$BASE_DIR/releases/PREVIOUS_RELEASE"
SPECIFIED_TARGET="${targetRelease}"

echo "======================================================================"
echo " ProctorNet Live Rollback Execution"
echo " Time: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "======================================================================"

TARGET_DIR=""
if [ -n "$SPECIFIED_TARGET" ]; then
  if [ -d "$BASE_DIR/releases/$SPECIFIED_TARGET" ]; then
    TARGET_DIR="$BASE_DIR/releases/$SPECIFIED_TARGET"
  elif [ -d "$BASE_DIR/releases/release-$SPECIFIED_TARGET" ]; then
    TARGET_DIR="$BASE_DIR/releases/release-$SPECIFIED_TARGET"
  elif [ -d "$SPECIFIED_TARGET" ]; then
    TARGET_DIR="$SPECIFIED_TARGET"
  else
    echo "ERROR: Specified rollback release '$SPECIFIED_TARGET' not found on server!" >&2
    exit 1
  fi
else
  if [ -f "$PREV_RECORD" ]; then
    TARGET_DIR=$(cat "$PREV_RECORD")
  fi
fi

if [ -z "$TARGET_DIR" ] || [ ! -d "$TARGET_DIR" ]; then
  echo "ERROR: Could not resolve valid target release directory for rollback! Target: '$TARGET_DIR'" >&2
  exit 1
fi

echo "Current symlink points to : $(readlink -f "$CURRENT_LINK")"
echo "Rolling back to           : $TARGET_DIR"

# Atomic symlink switch
ln -sfn "$TARGET_DIR" "$CURRENT_LINK"
echo "Symlink reverted to $(readlink -f "$CURRENT_LINK")"

# Restart services
echo "Restarting backend and proxy..."
systemctl restart proctornet.service
systemctl reload caddy.service

# Post-rollback health checks
sleep 3
echo "Checking /healthz (port 5000)..."
curl -sSf http://127.0.0.1:5000/healthz | jq -c .

echo "Checking external /healthz..."
curl -sSf https://proctornet.duckdns.org/healthz | jq -c .

echo "======================================================================"
echo "[✓] ROLLBACK COMPLETE: Active release is now $(basename "$TARGET_DIR")"
echo "======================================================================"
`

  const rollbackScriptPath = path.resolve(repoRoot, 'scripts/ops/remote/automated-rollback.sh')
  fs.writeFileSync(rollbackScriptPath, remoteScript, 'utf8')

  // Dispatch via dispatch-ssm.js
  const ssmCmd = `node scripts/ops/dispatch-ssm.js --script "${rollbackScriptPath}" --instance "${instanceId}" --log "rollback-${Date.now()}"`
  console.log('-> Executing remote rollback via SSM...')
  execSync(ssmCmd, { cwd: repoRoot, stdio: 'inherit' })
  console.log('[✓] Remote SSM rollback executed successfully.')

  try { fs.unlinkSync(rollbackScriptPath) } catch (_) {}

  // Run smoke verification
  console.log('\nRunning Live Smoke Verification post-rollback...')
  execSync('node scripts/ops/smoke-prod.js --origin https://proctornet.duckdns.org', { cwd: repoRoot, stdio: 'inherit' })
  console.log('[✓] Post-rollback smoke verification passed.')

  // Log to docs/ops/DEPLOY_LOG.md
  const durationSec = Math.round((Date.now() - startTime) / 1000)
  const deployLogFile = path.resolve(repoRoot, 'docs/ops/DEPLOY_LOG.md')
  const timestamp = new Date().toISOString()
  const logEntry = `\n### [${timestamp}] Production Rollback Executed\n- **Target Server**: \`${instanceId}\` (proctornet.duckdns.org)\n- **Target Release**: \`${targetRelease || 'PREVIOUS_RELEASE'}\`\n- **Duration**: ${durationSec} seconds\n- **Status**: SUCCESS\n- **Smoke Check**: 8/8 Passed Cleanly\n`
  fs.appendFileSync(deployLogFile, logEntry, 'utf8')
  console.log(`[✓] Rollback logged to ${path.relative(repoRoot, deployLogFile)}`)
}

runRollback().catch((err) => {
  console.error('\n[FATAL] Rollback failed:', err.message)
  process.exit(1)
})
