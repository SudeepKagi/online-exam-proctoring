#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/check-e2e-integrity.js
 * 
 * Verifies E2E test suite integrity rules (§P9 §5):
 * 1. No `waitForTimeout` outside the humanizer (`e2e/helpers/humanize.ts`).
 * 2. No `networkidle` anywhere in `e2e/`.
 * 3. No `force: true` in `e2e/` locator actions.
 * 4. No vacuous `.toBeDefined()` or `.toBeTruthy()` calls on locators.
 * 5. No unreferenced `test.skip` or `test.fixme` without a ticket ID (e.g., PROCT-).
 * 6. No forbidden bypass flags in `playwright.config.ts` prod-parity profile
 *    (S3_MOCK, DISABLE_RATE_LIMIT, LOADTEST_ALLOW, START_WORKERS: 'false', NODE_ENV: 'test').
 */

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')
const E2E_DIR = path.join(REPO_ROOT, 'e2e')
const CONFIG_FILE = path.join(REPO_ROOT, 'playwright.config.ts')

let failures = []

function scanDirectory(dir, filter = /\.(ts|js)$/) {
  let files = []
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.git') {
        files = files.concat(scanDirectory(fullPath, filter))
      }
    } else if (filter.test(item.name)) {
      files.push(fullPath)
    }
  }
  return files
}

// 1. Audit Playwright Config parity profile
if (fs.existsSync(CONFIG_FILE)) {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8')
  const forbiddenPatterns = [
    { key: 'S3_MOCK', regex: /S3_MOCK\s*:\s*['"]?true['"]?/i },
    { key: 'DISABLE_RATE_LIMIT', regex: /DISABLE_RATE_LIMIT\s*:\s*['"]?1['"]?/i },
    { key: 'LOADTEST_ALLOW', regex: /LOADTEST_ALLOW\s*:\s*['"]?1['"]?/i },
    { key: 'START_WORKERS: false', regex: /START_WORKERS\s*:\s*['"]false['"]/i },
    { key: 'NODE_ENV: test', regex: /NODE_ENV\s*:\s*['"]test['"]/i }
  ]

  for (const { key, regex } of forbiddenPatterns) {
    if (regex.test(configContent)) {
      failures.push(`playwright.config.ts contains forbidden bypass setting: ${key}`)
    }
  }

  // Duplicate config file check
  if (fs.existsSync(path.join(REPO_ROOT, 'playwright.config.js'))) {
    failures.push(`Duplicate legacy playwright.config.js found. Must be removed in favor of playwright.config.ts.`)
  }
} else {
  failures.push('playwright.config.ts not found.')
}

// 2. Scan e2e test files
const e2eFiles = scanDirectory(E2E_DIR)

for (const filePath of e2eFiles) {
  const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  const isHumanizer = relPath.endsWith('humanize.ts')

  lines.forEach((line, idx) => {
    const lineNum = idx + 1
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return

    // Rule 1: waitForTimeout outside humanizer
    if (!isHumanizer && /waitForTimeout\s*\(/.test(line)) {
      failures.push(`${relPath}:${lineNum} - Banned: waitForTimeout outside humanizer helper.`)
    }

    // Rule 2: networkidle
    if (/networkidle/i.test(line)) {
      failures.push(`${relPath}:${lineNum} - Banned: networkidle causes flakiness and masks real network behavior.`)
    }

    // Rule 3: force: true on locator actions
    if (/\.(click|check|uncheck|dblclick|hover|fill|type|press)\([^)]*force\s*:\s*true/i.test(line)) {
      failures.push(`${relPath}:${lineNum} - Banned: force: true bypasses Playwright actionability checks.`)
    }

    // Rule 4: toBeDefined() or toBeTruthy() on locator calls
    if (/locator\([^)]+\)\.toBeDefined\(\)/.test(line) || /locator\([^)]+\)\.toBeTruthy\(\)/.test(line) ||
        /\(\s*\w+\s*=>.*locator\(.*\.toBeDefined\(\)/.test(line)) {
      failures.push(`${relPath}:${lineNum} - Banned: Vacuous assertion .toBeDefined()/.toBeTruthy() on locator.`)
    }

    // Rule 5: test.skip or test.fixme without ticket
    if (/test\.(skip|fixme)\s*\(/.test(line)) {
      // Must reference a ticket e.g. PROCT-, #123, or defect ID like A-01
      if (!/PROCT-|#[0-9]+|[A-Z]+-[0-9]+/i.test(line)) {
        failures.push(`${relPath}:${lineNum} - Banned: test.skip/fixme without ticket tracking reference.`)
      }
    }
  })
}

// Summary
console.log('--- E2E Test Suite Integrity Verification ---')
if (failures.length > 0) {
  console.error(`\n❌ Integrity verification FAILED with ${failures.length} issue(s):\n`)
  failures.forEach(f => console.error(`  - ${f}`))
  console.error('\nFix the above violations before running E2E suites.')
  process.exit(1)
} else {
  console.log(`✅ Integrity verification PASSED! (${e2eFiles.length} files scanned, 0 violations found)`)
  process.exit(0)
}
