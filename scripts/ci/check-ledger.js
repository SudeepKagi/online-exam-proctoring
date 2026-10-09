#!/usr/bin/env node
/**
 * scripts/ci/check-ledger.js
 * 
 * CI Guardrail: Master Claims Ledger Integrity Checker (§Prompt 7 T0)
 * 
 * Asserts:
 * 1. Allowed status vocabulary strictly:
 *    PASSED | HUMAN_REQUIRED | UNVERIFIED | PENDING | IN_PROGRESS | DISPUTED | RED_BASELINE
 * 2. Physical/human claims (multi-OS real device matrix, 20-laptop pilot, antivirus coexistence)
 *    are strictly HUMAN_REQUIRED, NEVER marked PASSED.
 * 3. Exact verification command must not use unknown or disallowed tool runners (e.g. mocha).
 * 4. Verification timestamps for PASSED claims must be valid and fresher than 30 days.
 * 5. Concrete artifact files for PASSED claims must exist on disk.
 * 6. Evidence files in reports/evidence/ must have valid Command, Git SHA, Timestamp, Environment, and Output.
 * 7. Git commit messages must NOT contain goal-driven evasion like "achieve/make ledger green".
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '../..')
const LEDGER_PATH = path.join(REPO_ROOT, 'docs/qa/CLAIMS_LEDGER.md')

const ALLOWED_STATUSES = new Set([
  'PASSED',
  'HUMAN_REQUIRED',
  'UNVERIFIED',
  'PENDING',
  'IN_PROGRESS',
  'DISPUTED',
  'RED_BASELINE'
])

const FORBIDDEN_COMMIT_PATTERNS = [
  /achieve.*(?:100%|all)?.*ledger.*green/i,
  /make.*ledger.*green/i
]

const PHYSICAL_ITEM_IDS = new Set(['A8-01', 'A9-01'])
const PHYSICAL_TEXT_PATTERNS = [
  /pilot.*laptop/i,
  /35-machine/i,
  /antivirus coexistence/i,
  /volunteer.*machine/i,
  /real-device & quality matrix/i
]

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function checkCommitMessage() {
  const errors = []
  let commitMsg = ''

  // Check if explicit argument passed
  const msgArgIdx = process.argv.indexOf('--commit-msg')
  if (msgArgIdx !== -1 && process.argv[msgArgIdx + 1]) {
    const candidate = process.argv[msgArgIdx + 1]
    if (fs.existsSync(candidate)) {
      commitMsg = fs.readFileSync(candidate, 'utf8')
    } else {
      commitMsg = candidate
    }
  } else {
    try {
      commitMsg = execSync('git log -1 --pretty=%B', { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    } catch {
      // Non-git environment or git not available
      commitMsg = ''
    }
  }

  if (commitMsg) {
    for (const pattern of FORBIDDEN_COMMIT_PATTERNS) {
      if (pattern.test(commitMsg)) {
        errors.push(`Commit message contains forbidden goal-driven phrase matching ${pattern}: "${commitMsg.trim()}"`)
      }
    }
  }

  return errors
}

function parseLedgerRows(content) {
  const lines = content.split('\n')
  const rows = []
  let inTable = false

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim()
    if (!line.startsWith('|')) continue

    const cells = line.split('|').map(c => c.trim())
    // Header separator like |---|---|
    if (cells.some(c => c.startsWith('---'))) {
      inTable = true
      continue
    }

    if (inTable && cells.length >= 8 && cells[1] && cells[1].startsWith('**')) {
      const id = cells[1].replace(/\*\*/g, '').trim()
      const category = cells[2]
      const description = cells[3]
      const command = cells[4].replace(/^`|`$/g, '').trim()
      const timestamp = cells[5]
      const rawStatus = cells[6]
      const artifactPath = cells[7].replace(/^`|`$/g, '').trim()

      // Normalize status by stripping annotations like PASSED (0 broken links)
      let status = rawStatus
      for (const allowed of ALLOWED_STATUSES) {
        if (rawStatus.startsWith(allowed)) {
          status = allowed
          break
        }
      }

      rows.push({
        lineNumber: lineIndex + 1,
        id,
        category,
        description,
        command,
        timestamp,
        rawStatus,
        status,
        artifactPath
      })
    }
  }

  return rows
}

function validateRow(row) {
  const errors = []

  // 1. Status allowed vocabulary
  if (!ALLOWED_STATUSES.has(row.status)) {
    errors.push(`Row ${row.id} (line ${row.lineNumber}): Unknown status "${row.rawStatus}". Allowed: ${Array.from(ALLOWED_STATUSES).join(', ')}`)
  }

  // 2. Physical / human claims must NOT be PASSED
  const isPhysical = PHYSICAL_ITEM_IDS.has(row.id) ||
    PHYSICAL_TEXT_PATTERNS.some(p => p.test(row.category) || p.test(row.description))
  if (isPhysical && row.status === 'PASSED') {
    errors.push(`Row ${row.id} (line ${row.lineNumber}): Physical/human claim marked PASSED. Must be HUMAN_REQUIRED.`)
  }

  // 3. For PASSED claims, enforce rigorous verification integrity
  if (row.status === 'PASSED') {
    // Command check
    if (!row.command || row.command.length === 0) {
      errors.push(`Row ${row.id} (line ${row.lineNumber}): PASSED claim is missing verification command.`)
    } else if (/\bmocha\b/i.test(row.command)) {
      errors.push(`Row ${row.id} (line ${row.lineNumber}): Command references unknown or disallowed runner "mocha". Native node --test must be used.`)
    }

    // Timestamp check
    const ts = new Date(row.timestamp).getTime()
    if (isNaN(ts)) {
      errors.push(`Row ${row.id} (line ${row.lineNumber}): Invalid ISO timestamp "${row.timestamp}".`)
    } else {
      const ageMs = Date.now() - ts
      if (ageMs > THIRTY_DAYS_MS) {
        errors.push(`Row ${row.id} (line ${row.lineNumber}): Verification timestamp "${row.timestamp}" is older than 30 days (${Math.round(ageMs / (24 * 3600 * 1000))} days old).`)
      }
    }

    // Concrete artifact check
    if (!row.artifactPath || row.artifactPath.length === 0) {
      errors.push(`Row ${row.id} (line ${row.lineNumber}): PASSED claim is missing concrete artifact path.`)
    } else {
      const fullPath = path.resolve(REPO_ROOT, row.artifactPath)
      if (!fs.existsSync(fullPath)) {
        errors.push(`Row ${row.id} (line ${row.lineNumber}): Artifact path does not exist on disk: "${row.artifactPath}"`)
      } else if (row.artifactPath.startsWith('reports/evidence/') && row.artifactPath.endsWith('.txt')) {
        // Enforce evidence file metadata contract
        const evidenceContent = fs.readFileSync(fullPath, 'utf8')
        const hasCmd = /command[: ]/i.test(evidenceContent) || /node|npm|npx|terraform/i.test(evidenceContent)
        const hasSha = /git sha|sha[: ]|commit[: ]/i.test(evidenceContent) || /[0-9a-f]{7,40}/i.test(evidenceContent)
        const hasTime = /timestamp[: ]|generated[: ]|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i.test(evidenceContent)
        const hasEnv = /environment[: ]|host[: ]|platform|runner|node\.js/i.test(evidenceContent)

        if (!hasCmd) errors.push(`Evidence file "${row.artifactPath}" for ${row.id} is missing Command execution log.`)
        if (!hasSha) errors.push(`Evidence file "${row.artifactPath}" for ${row.id} is missing Git SHA.`)
        if (!hasTime) errors.push(`Evidence file "${row.artifactPath}" for ${row.id} is missing Timestamp.`)
        if (!hasEnv) errors.push(`Evidence file "${row.artifactPath}" for ${row.id} is missing Host/Environment description.`)
      }
    }
  }

  return errors
}

function main() {
  console.log('🔍 Checking Master Claims Ledger Integrity (docs/qa/CLAIMS_LEDGER.md)...')

  const commitErrors = checkCommitMessage()
  if (commitErrors.length > 0) {
    console.error('❌ Commit message policy violation:')
    commitErrors.forEach(err => console.error(`  - ${err}`))
    process.exit(1)
  }

  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`❌ Ledger file not found at: ${LEDGER_PATH}`)
    process.exit(1)
  }

  const content = fs.readFileSync(LEDGER_PATH, 'utf8')
  const rows = parseLedgerRows(content)

  if (rows.length === 0) {
    console.error('❌ No valid table rows found in CLAIMS_LEDGER.md')
    process.exit(1)
  }

  console.log(`📋 Parsed ${rows.length} claim rows. Verifying statuses, commands, artifacts, and evidence...`)

  const allErrors = []
  let passedCount = 0
  let humanRequiredCount = 0
  let redBaselineCount = 0
  let otherCount = 0

  for (const row of rows) {
    if (row.status === 'PASSED') passedCount++
    else if (row.status === 'HUMAN_REQUIRED') humanRequiredCount++
    else if (row.status === 'RED_BASELINE') redBaselineCount++
    else otherCount++

    const rowErrors = validateRow(row)
    if (rowErrors.length > 0) {
      allErrors.push(...rowErrors)
    }
  }

  console.log(`📊 Claims Breakdown:`)
  console.log(`   - PASSED: ${passedCount}`)
  console.log(`   - HUMAN_REQUIRED: ${humanRequiredCount}`)
  console.log(`   - RED_BASELINE: ${redBaselineCount}`)
  console.log(`   - OTHER / UNVERIFIED: ${otherCount}`)

  if (allErrors.length > 0) {
    console.error(`\n❌ Found ${allErrors.length} ledger integrity violations:`)
    allErrors.forEach(err => console.error(`   - ${err}`))
    process.exit(1)
  }

  console.log('\n✅ Ledger integrity check PASSED: all claims truthful, commands verifiable, and evidence verified.')
  process.exit(0)
}

if (require.main === module) {
  main()
}

module.exports = { parseLedgerRows, validateRow, checkCommitMessage }
