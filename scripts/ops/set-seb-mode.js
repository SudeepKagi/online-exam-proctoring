'use strict'

/**
 * scripts/ops/set-seb-mode.js
 *
 * Sets the institution Safe Exam Browser mode (off | audit | enforce).
 *
 * Strict Invariant:
 * Mode 'enforce' is accepted ONLY if the database shows a verified ping
 * (lastVerifiedAt) within 7 days; otherwise it refuses, prints the exact
 * by-hand steps, and changes nothing.
 *
 * Usage:
 *   node scripts/ops/set-seb-mode.js <off|audit|enforce> [--remote]
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const TARGET_MODE = (process.argv[2] || '').toLowerCase().trim()
const IS_REMOTE = process.argv.includes('--remote') || process.argv.includes('--live')

if (!['off', 'audit', 'enforce'].includes(TARGET_MODE)) {
  console.error('Usage: node scripts/ops/set-seb-mode.js <off|audit|enforce> [--remote]')
  process.exit(1)
}

const INSTANCE_ID = process.env.INSTANCE_ID || 'i-0d242d962823f0a89'
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1'

const internalScript = `
cd /opt/proctornet/current/backend
NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
const { settingsService } = require("./src/modules/admin/settings.service");
const { getInstitutionSebState, invalidateInstitutionSebState } = require("./src/modules/seb/seb.service");

async function main() {
  const targetMode = "${TARGET_MODE}";
  const sebConfig = await settingsService.getSebConfig();

  if (!sebConfig || !sebConfig.configKey) {
    console.error("[REFUSED] Safe Exam Browser is not configured in the database.");
    console.error("Please upload the institution configuration file (.seb) and Config Key first at /admin/seb.");
    process.exit(1);
  }

  const lastVerifiedAt = sebConfig.lastVerifiedAt;
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const isVerifiedRecent = lastVerifiedAt && new Date(lastVerifiedAt).getTime() >= sevenDaysAgo;

  if (targetMode === "enforce" && !isVerifiedRecent) {
    console.error("================================================================================");
    console.error("[REFUSED] Cannot set Safe Exam Browser mode to \\"enforce\\".");
    console.error("Reason: Safe Exam Browser setup has not been verified within the last 7 days.");
    console.error("Last Verified: " + (lastVerifiedAt ? new Date(lastVerifiedAt).toISOString() : "Never verified"));
    console.error("================================================================================");
    console.error("");
    console.error("EXACT BY-HAND STEPS TO ENABLE ENFORCEMENT:");
    console.error("1. Open https://proctornet.duckdns.org/admin/seb in your browser as System Administrator.");
    console.error("2. Verify that Section 1 & Section 2 show \\"Configured\\" and object storage is OK.");
    console.error("3. Scroll down to Section 3: \\"Test my setup\\".");
    console.error("4. Click \\"Generate Launch Token & Launch SEB\\" to test the cryptographic handshake.");
    console.error("5. Safe Exam Browser will launch on your machine and submit the verified startup ping.");
    console.error("6. Confirm that \\"Last Verified\\" updates to \\"Verified just now\\" on /admin/seb.");
    console.error("7. Re-run: node scripts/ops/set-seb-mode.js enforce --remote");
    console.error("================================================================================");
    process.exit(1);
  }

  // Update requested mode
  await settingsService.saveSebConfig({
    fileKey: sebConfig.fileKey,
    configKey: sebConfig.configKey,
    uploadedAt: sebConfig.uploadedAt,
    lastVerifiedAt: sebConfig.lastVerifiedAt,
    requestedMode: targetMode
  });
  invalidateInstitutionSebState();

  const state = await getInstitutionSebState({ bypassCache: true });
  console.log("SUCCESS: Institution Safe Exam Browser mode updated.");
  console.log("Requested Mode: " + state.requestedMode);
  console.log("Effective Mode: " + state.effectiveMode);
  if (state.enforcementReason) {
    console.log("Notice: " + state.enforcementReason);
  }
}

main().catch(err => {
  console.error("Execution failed:", err.message);
  process.exit(1);
}).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
`

async function runLocal() {
  const { settingsService } = require('../../backend/src/modules/admin/settings.service')
  const { getInstitutionSebState, invalidateInstitutionSebState } = require('../../backend/src/modules/seb/seb.service')

  const sebConfig = await settingsService.getSebConfig()
  if (!sebConfig || !sebConfig.configKey) {
    console.error('[REFUSED] Safe Exam Browser is not configured in the database.')
    console.error('Please upload the institution configuration file (.seb) and Config Key first at /admin/seb.')
    process.exit(1)
  }

  const lastVerifiedAt = sebConfig.lastVerifiedAt
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const isVerifiedRecent = lastVerifiedAt && new Date(lastVerifiedAt).getTime() >= sevenDaysAgo

  if (TARGET_MODE === 'enforce' && !isVerifiedRecent) {
    console.error('================================================================================')
    console.error('[REFUSED] Cannot set Safe Exam Browser mode to "enforce".')
    console.error('Reason: Safe Exam Browser setup has not been verified within the last 7 days.')
    console.error('Last Verified: ' + (lastVerifiedAt ? new Date(lastVerifiedAt).toISOString() : 'Never verified'))
    console.error('================================================================================')
    console.error('')
    console.error('EXACT BY-HAND STEPS TO ENABLE ENFORCEMENT:')
    console.error('1. Open https://proctornet.duckdns.org/admin/seb in your browser as System Administrator.')
    console.error('2. Verify that Section 1 & Section 2 show "Configured" and object storage is OK.')
    console.error('3. Scroll down to Section 3: "Test my setup".')
    console.error('4. Click "Generate Launch Token & Launch SEB" to test the cryptographic handshake.')
    console.error('5. Safe Exam Browser will launch on your machine and submit the verified startup ping.')
    console.error('6. Confirm that "Last Verified" updates to "Verified just now" on /admin/seb.')
    console.error('7. Re-run: node scripts/ops/set-seb-mode.js enforce --remote')
    console.error('================================================================================')
    process.exit(1)
  }

  await settingsService.saveSebConfig({
    fileKey: sebConfig.fileKey,
    configKey: sebConfig.configKey,
    uploadedAt: sebConfig.uploadedAt,
    lastVerifiedAt: sebConfig.lastVerifiedAt,
    requestedMode: TARGET_MODE
  })
  invalidateInstitutionSebState()

  const state = await getInstitutionSebState({ bypassCache: true })
  console.log('SUCCESS: Institution Safe Exam Browser mode updated.')
  console.log('Requested Mode: ' + state.requestedMode)
  console.log('Effective Mode: ' + state.effectiveMode)
  if (state.enforcementReason) {
    console.log('Notice: ' + state.enforcementReason)
  }
}

async function runRemote() {
  const tmpParam = path.join(os.tmpdir(), `ssm-seb-mode-${Date.now()}.json`)
  fs.writeFileSync(tmpParam, JSON.stringify({ commands: [internalScript] }))

  try {
    const ssmCmd = `aws ssm send-command --instance-ids "${INSTANCE_ID}" --region "${AWS_REGION}" --document-name "AWS-RunShellScript" --parameters "file://${tmpParam.replace(/\\/g, '/')}" --output json`
    const res = JSON.parse(execSync(ssmCmd, { encoding: 'utf8' }))
    const commandId = res.Command.CommandId
    fs.unlinkSync(tmpParam)

    console.log(`Dispatched SSM Command ${commandId} to ${INSTANCE_ID}...`)

    for (let i = 0; i < 25; i++) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
      try {
        const poll = JSON.parse(execSync(
          `aws ssm get-command-invocation --command-id "${commandId}" --instance-id "${INSTANCE_ID}" --region "${AWS_REGION}" --output json`,
          { encoding: 'utf8' }
        ))
        if (poll.Status === 'Success') {
          console.log(poll.StandardOutputContent)
          process.exit(0)
        } else if (poll.Status === 'Failed') {
          console.error(poll.StandardErrorContent || poll.StandardOutputContent)
          process.exit(1)
        }
      } catch (_) {}
    }
    console.error('SSM Command timed out after 50 seconds.')
    process.exit(1)
  } catch (err) {
    if (fs.existsSync(tmpParam)) fs.unlinkSync(tmpParam)
    console.error('SSM Dispatch error:', err.message)
    process.exit(1)
  }
}

if (IS_REMOTE) {
  runRemote()
} else {
  runLocal().catch(err => {
    console.error('Local run failed:', err.message)
    process.exit(1)
  })
}
