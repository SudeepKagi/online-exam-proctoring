#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/quality.js
 * Consolidated Quality & Architecture Guardrails Suite (Prompt 11 / V3.2)
 *
 * Runs custom static analysis and architectural gates in parallel in < 30s:
 * 1. no-stubs           - AST/Regex stub checks (zero fake passes, zero unobserved writes)
 * 2. no-legacy          - Ensures legacy routes/controllers/render.yaml and tokens are eliminated
 * 3. banned-terms       - User-facing text abstraction check (§4.1 spec)
 * 4. no-source-grep     - Prohibits tests from grepping runtime code strings instead of testing behavior
 * 5. route-inventory    - Asserts mounted routes match docs/api/ROUTE_INVENTORY.md
 * 6. e2e-integrity      - Asserts E2E tests avoid waitForTimeout, networkidle, and bypass flags
 *
 * Usage:
 *   node scripts/ci/quality.js [--only <name>]
 */

const fs = require('fs')
const path = require('path')
const { fork } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)
const onlyIndex = args.indexOf('--only')
const targetGate = onlyIndex !== -1 ? args[onlyIndex + 1] : null

const CHECKS = [
  {
    name: 'no-stubs',
    description: 'AST & regex scan for stubs, fake scores, unobserved writes',
    script: path.join(__dirname, 'check-no-stubs.js'),
    fixCommand: 'node scripts/ci/check-no-stubs.js'
  },
  {
    name: 'no-legacy',
    description: 'Absence of legacy dirs, deployment configs, and schema tokens',
    script: path.join(__dirname, 'check-no-legacy.js'),
    fixCommand: 'node scripts/ci/check-no-legacy.js'
  },
  {
    name: 'banned-terms',
    description: 'User-facing abstraction validation against tech vocabulary',
    script: path.join(__dirname, 'scan-banned-terms.js'),
    fixCommand: 'node scripts/ci/scan-banned-terms.js'
  },
  {
    name: 'no-source-grep',
    description: 'Tests invoke behaviors rather than grepping runtime source code',
    script: path.join(__dirname, 'check-no-source-grep-tests.js'),
    fixCommand: 'node scripts/ci/check-no-source-grep-tests.js'
  },
  {
    name: 'route-inventory',
    description: 'Mounted Express routers match canonical ROUTE_INVENTORY.md',
    script: path.join(__dirname, 'generate-route-inventory.js'),
    args: ['--check'],
    fixCommand: 'node scripts/ci/generate-route-inventory.js'
  },
  {
    name: 'e2e-integrity',
    description: 'Playwright journeys avoid waitForTimeout and forbidden bypasses',
    script: path.join(__dirname, 'check-e2e-integrity.js'),
    fixCommand: 'node scripts/ci/check-e2e-integrity.js'
  }
]

function runGate(check) {
  return new Promise((resolve) => {
    const start = Date.now()
    const scriptArgs = check.args || []
    const child = fork(check.script, scriptArgs, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })

    child.on('close', (code) => {
      const durationMs = Date.now() - start
      resolve({
        name: check.name,
        description: check.description,
        fixCommand: check.fixCommand,
        passed: code === 0,
        code,
        durationMs,
        stdout,
        stderr
      })
    })
  })
}

async function main() {
  console.log('⚡ ProctorNet Consolidated Quality Suite starting...')
  const selected = targetGate
    ? CHECKS.filter(c => c.name === targetGate)
    : CHECKS

  if (selected.length === 0) {
    console.error(`❌ Unknown check specified by --only "${targetGate}". Available: ${CHECKS.map(c => c.name).join(', ')}`)
    process.exit(1)
  }

  const results = await Promise.all(selected.map(runGate))

  let hasFailure = false
  const summaryRows = []

  console.log('\n================ QUALITY GATE SUMMARY ================')
  for (const r of results) {
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${statusIcon} [${r.name.padEnd(16)}] (${r.durationMs}ms) - ${r.description}`)
    if (!r.passed) {
      hasFailure = true
      console.log(`   Fix command: ${r.fixCommand}`)
      if (r.stderr.trim()) {
        console.log(`   Error output:\n   ${r.stderr.trim().split('\n').join('\n   ')}`)
      } else if (r.stdout.trim()) {
        const errorLines = r.stdout.split('\n').filter(l => l.includes('❌') || l.includes('Error') || l.includes('fail'))
        if (errorLines.length > 0) {
          console.log(`   Details:\n   ${errorLines.slice(0, 5).join('\n   ')}`)
        }
      }
    }
    summaryRows.push(`| ${r.name} | ${r.passed ? '✅ Passed' : '❌ Failed'} | ${r.durationMs}ms | \`${r.fixCommand}\` |`)
  }
  console.log('======================================================\n')

  // Export to $GITHUB_STEP_SUMMARY if available
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (summaryFile) {
    const mdTable = [
      '### 🛡️ Quality & Architecture Gate Summary',
      '',
      '| Check | Status | Duration | Fix Command |',
      '| :--- | :--- | :--- | :--- |',
      ...summaryRows,
      '',
      hasFailure ? '> ⚠️ One or more quality gates failed. Review logs above or run the corresponding fix command locally.' : '> ✨ All consolidated quality checks passed cleanly.'
    ].join('\n')

    try {
      fs.appendFileSync(summaryFile, mdTable + '\n\n', 'utf8')
    } catch (_) {}
  }

  if (hasFailure) {
    process.exit(1)
  } else {
    console.log('✨ All consolidated quality gates green!')
  }
}

main().catch((err) => {
  console.error('Fatal execution error in quality runner:', err)
  process.exit(1)
})
