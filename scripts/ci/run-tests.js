'use strict'

/**
 * ProctorNet Autodiscovery Test Runner (§1 CI-A, C1.6, C1.7)
 *
 * Guarantees:
 * 1. Autodiscovers all test files across repo without rot from curated lists.
 * 2. Enforces tests/EXCLUDED.md expiration: fails immediately if any exclusion has expired.
 * 3. Warns loudly on active (unexpired) exclusions.
 * 4. Executes tests/ci_workflow_integrity.test.js FIRST for sub-second failure on CI regressions.
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '../..')
const EXCLUDED_FILE = path.join(REPO_ROOT, 'tests/EXCLUDED.md')

function parseExcludedRegistry() {
  const excluded = new Map()
  if (!fs.existsSync(EXCLUDED_FILE)) return excluded

  const content = fs.readFileSync(EXCLUDED_FILE, 'utf8')
  const lines = content.split('\n')
  const today = new Date().toISOString().split('T')[0]

  let currentEntry = null
  let inCodeBlock = false
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    if (line.startsWith('- file:')) {
      if (currentEntry) checkAndRegister(currentEntry)
      currentEntry = { file: line.replace('- file:', '').trim() }
    } else if (currentEntry && line.startsWith('category:')) {
      currentEntry.category = line.replace('category:', '').trim()
    } else if (currentEntry && line.startsWith('reason:')) {
      currentEntry.reason = line.replace('reason:', '').trim()
    } else if (currentEntry && line.startsWith('expires:')) {
      currentEntry.expires = line.replace('expires:', '').trim()
    }
  }
  if (currentEntry) checkAndRegister(currentEntry)

  function checkAndRegister(entry) {
    if (!entry.file) return
    if (entry.expires && entry.expires < today) {
      console.error(
        `\n[CI-A CRITICAL ERROR] Excluded test "${entry.file}" expired on ${entry.expires}!\n` +
        `Policy dictates that temporary test exclusions must be fixed within 7 days.\n`
      )
      process.exit(1)
    }
    console.warn(`[CI-A WARNING] Skipping excluded test "${entry.file}" (Reason: ${entry.reason || 'None'}, Expires: ${entry.expires})`)
    excluded.set(path.normalize(entry.file), entry)
  }

  return excluded
}

function discoverTests() {
  const testFiles = []

  function walk(dir, pattern) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== 'helpers' && ent.name !== 'fixtures') {
          walk(fullPath, pattern)
        }
      } else if (ent.isFile() && pattern.test(ent.name)) {
        testFiles.push(fullPath)
      }
    }
  }

  // 1. Root tests
  walk(path.join(REPO_ROOT, 'tests'), /\.test\.js$/)

  // 2. Backend tests
  walk(path.join(REPO_ROOT, 'proctornet/backend/tests'), /\.js$/)

  // 3. Device Agent tests
  walk(path.join(REPO_ROOT, 'proctornet/device-agent/test'), /\.test\.js$/)

  return testFiles
}

function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run') || args.includes('--list')

  const excludedMap = parseExcludedRegistry()
  const discovered = discoverTests()

  // Filter excluded
  const activeTests = discovered.filter((absPath) => {
    const relPath = path.relative(REPO_ROOT, absPath).replace(/\\/g, '/')
    return !excludedMap.has(path.normalize(relPath))
  })

  // Sort so tests/ci_workflow_integrity.test.js runs FIRST (C1.7)
  activeTests.sort((a, b) => {
    const isIntegrityA = a.includes('ci_workflow_integrity.test.js')
    const isIntegrityB = b.includes('ci_workflow_integrity.test.js')
    if (isIntegrityA) return -1
    if (isIntegrityB) return 1
    return a.localeCompare(b)
  })

  console.log(`\n======================================================`)
  console.log(`ProctorNet Autodiscovery Test Runner (Total: ${activeTests.length} tests)`)
  console.log(`======================================================\n`)

  if (isDryRun) {
    activeTests.forEach((t, i) => console.log(`[${i + 1}] ${path.relative(REPO_ROOT, t)}`))
    return
  }

  let passed = 0
  let failed = 0
  const failedList = []

  for (let i = 0; i < activeTests.length; i++) {
    const testFile = activeTests[i]
    const relPath = path.relative(REPO_ROOT, testFile).replace(/\\/g, '/')
    process.stdout.write(`[${i + 1}/${activeTests.length}] Running ${relPath} ... `)

    const start = Date.now()
    const backendNodeModules = path.join(REPO_ROOT, 'proctornet/backend/node_modules')
    const rootNodeModules = path.join(REPO_ROOT, 'node_modules')
    const nodePath = [backendNodeModules, rootNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter)

    const result = spawnSync('node', ['--test', '--test-force-exit', testFile], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NODE_PATH: nodePath,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/proctornet_test?schema=public',
        DIRECT_URL: process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5433/proctornet_test?schema=public',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000 // 30s per-test timeout
    })
    const duration = Date.now() - start

    if (result.status === 0) {
      console.log(`✓ PASSED (${duration}ms)`)
      passed++
    } else {
      console.log(`✗ FAILED (${duration}ms)`)
      failed++
      failedList.push({ file: relPath, stdout: result.stdout?.toString(), stderr: result.stderr?.toString() })
    }
  }

  console.log(`\n======================================================`)
  console.log(`Test Execution Summary: ${passed} passed, ${failed} failed`)
  console.log(`======================================================\n`)

  if (failed > 0) {
    console.error('Failed test files:')
    for (const f of failedList) {
      console.error(`\n--- [FAILED] ${f.file} ---`)
      if (f.stderr) console.error(f.stderr.trim())
      if (f.stdout) console.error(f.stdout.trim())
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  discoverTests,
  parseExcludedRegistry
}
