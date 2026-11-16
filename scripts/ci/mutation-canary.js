#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/mutation-canary.js
 * Applies five deliberate temporary breaks to verify test suite assertion strength:
 *   1. Remove SEB check in enforce mode (backend/src/middleware/seb.js)
 *   2. Remove authentication on an admin route (backend/src/modules/admin/sebAdmin.routes.js)
 *   3. Wrong score calculation (backend/src/modules/attempts/attempts.sql.js)
 *   4. Client-trusted timer / expired timer (backend/src/modules/attempts/attempts.sql.js)
 *   5. Un-strip sebConfigKey (backend/src/modules/exams/exams.service.js)
 *
 * For each mutation:
 *   - Applies temporary code patch
 *   - Runs the designated regression test
 *   - Asserts that the test FAILS (non-zero exit code)
 *   - Automatically restores the original code via git checkout
 *
 * Exit code: 0 if all 5 mutations were caught, 1 if any mutation slipped through undetected.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '../..')

console.log('='.repeat(72))
console.log(' ProctorNet Mutation Canary & Test Assertion Strength Suite')
console.log(` Timestamp : ${new Date().toISOString()}`)
console.log(` Target    : 5 Deliberate Fault Injections`)
console.log('='.repeat(72))

const results = []

function runTest(cmd) {
  try {
    execSync(cmd, {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 45000,
      env: { ...process.env, NODE_ENV: 'test' }
    })
    return { passed: true, exitCode: 0 }
  } catch (err) {
    return { passed: false, exitCode: err.status || 1, output: (err.stdout || err.stderr || '').toString() }
  }
}

function restoreFile(relPath) {
  try {
    execSync(`git checkout -- "${relPath}"`, { cwd: repoRoot, stdio: 'pipe' })
  } catch (err) {
    console.error(`Failed to revert ${relPath}:`, err.message)
  }
}

const mutations = [
  {
    name: '1. Remove SEB Check in Enforce Mode',
    file: 'backend/src/middleware/seb.js',
    testCmd: 'node --env-file=backend/../.env.test --test backend/tests/seb-step2-middleware.test.js',
    mutate(content) {
      // Bypass enforcement check by immediately calling next()
      return content.replace(
        'async function runVerifySeb(req, res, next) {',
        'async function runVerifySeb(req, res, next) { return next();'
      )
    }
  },
  {
    name: '2. Remove Auth on Admin Route',
    file: 'backend/src/modules/admin/sebAdmin.routes.js',
    testCmd: 'node --env-file=backend/../.env.test --test backend/tests/seb-institution-config.test.js',
    mutate(content) {
      // Comment out authentication middleware on admin router
      return content.replace(
        'router.use(authenticateToken)',
        '// router.use(authenticateToken)'
      )
    }
  },
  {
    name: '3. Wrong Score Calculation',
    file: 'backend/src/modules/attempts/attempts.sql.js',
    testCmd: 'node --env-file=backend/../.env.test --test backend/tests/concurrency-security.test.js',
    mutate(content) {
      // Mutate final score calculation to an invalid fixed constant 9999
      return content.replace(
        'totalScore = Math.round(Math.max(0, totalScore) * 100) / 100',
        'totalScore = 9999'
      )
    }
  },
  {
    name: '4. Client-Trusted Timer / Clock Drift',
    file: 'backend/src/modules/attempts/attempts.service.js',
    testCmd: 'node --env-file=backend/../.env.test --test backend/tests/concurrency-security.test.js',
    mutate(content) {
      // Tamper server-authoritative timer: advance clock 1 year into future (causing EXAM_ENDED for all starts)
      return content.replace(
        'const now = new Date()',
        'const now = new Date(Date.now() + 31536000000)'
      )
    }
  },
  {
    name: '5. Un-strip sebConfigKey (Student Leakage)',
    file: 'backend/src/modules/exams/exams.service.js',
    testCmd: 'node --env-file=backend/../.env.test --test backend/tests/baseline-verification.test.js',
    mutate(content) {
      // Prevent stripping of sebConfigKey for student responses
      return content.replace(
        'delete pConfig.sebConfigKey',
        'pConfig.sebConfigKey = "LEAKED_RAW_HEX_KEY_1234567890"'
      )
    }
  }
]

async function executeCanary() {
  for (const m of mutations) {
    const fullPath = path.resolve(repoRoot, m.file)
    const originalContent = fs.readFileSync(fullPath, 'utf8')
    const mutated = m.mutate(originalContent)

    if (mutated === originalContent) {
      console.error(`[MUTATION ERROR] Target replacement pattern not found in ${m.file}`)
      results.push({ name: m.name, caught: false, error: 'Pattern not found' })
      continue
    }

    try {
      // Apply break
      fs.writeFileSync(fullPath, mutated, 'utf8')

      // Run designated test suite
      const testResult = runTest(m.testCmd)

      // Test MUST fail to pass the canary assertion
      if (!testResult.passed) {
        console.log(` [PASS] ${m.name} -> Test failed as expected (Exit code ${testResult.exitCode})`)
        results.push({ name: m.name, caught: true })
      } else {
        console.error(` [FAIL] ${m.name} -> TEST PASSED! The test suite did NOT catch this bug!`)
        results.push({ name: m.name, caught: false, error: 'Test suite passed unexpectedly' })
      }
    } finally {
      // Guarantee rollback of mutation
      restoreFile(m.file)
    }
  }

  console.log('='.repeat(72))
  const missed = results.filter(r => !r.caught)
  if (missed.length > 0) {
    console.error(`CANARY VERIFICATION FAILED: ${missed.length} / ${results.length} mutations were NOT caught by tests!`)
    process.exit(1)
  } else {
    console.log(`CANARY VERIFICATION SUCCESS: All ${results.length} deliberate mutations caught by tests!`)
    process.exit(0)
  }
}

executeCanary().catch(err => {
  console.error('Fatal canary error:', err)
  process.exit(1)
})
