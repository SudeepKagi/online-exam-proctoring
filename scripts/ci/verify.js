#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/verify.js
 * Hermetic Verification Suite (Prompt 11 / V3.1)
 *
 * Runs zero-dependency verification steps in one command:
 * 1. Backend Linting
 * 2. Frontend Linting & Build
 * 3. Unit Tests (Isolated, in-memory)
 * 4. Prisma Schema Validation & Migration Diff
 * 5. Consolidated Quality & Architecture Guardrails (quality.js)
 */

const { spawnSync } = require('child_process')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')

function runStep(name, command, args, cwd = REPO_ROOT) {
  console.log(`\n▶ [Verify] ${name}...`)
  const start = Date.now()
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, CI: 'true' }
  })
  const duration = Date.now() - start

  if (result.status !== 0) {
    console.error(`\n❌ [Verify] Step '${name}' failed in ${duration}ms!`)
    process.exit(result.status || 1)
  }
  console.log(`✅ [Verify] ${name} passed (${duration}ms)`)
}

async function main() {
  console.log('🔍 Starting ProctorNet Verification Pipeline...')

  // Ensure default offline/dummy database URLs exist for Prisma schema validation
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/proctornet_ci?schema=public'
  process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL

  // 1. Prisma Validate
  runStep(
    'Prisma Validate',
    'npx',
    ['prisma', 'validate', '--schema=proctornet/backend/prisma/schema.prisma']
  )

  // 2. Prisma Migration Drift Diff (when shadow DB URL is explicitly provided)
  const shadowUrl = process.env.SHADOW_DATABASE_URL
  if (shadowUrl && !shadowUrl.includes('dummy')) {
    try {
      runStep(
        'Prisma Migration Drift Check',
        'npx',
        [
          'prisma',
          'migrate',
          'diff',
          '--from-migrations=proctornet/backend/prisma/migrations',
          '--to-schema-datamodel=proctornet/backend/prisma/schema.prisma',
          `--shadow-database-url=${shadowUrl}`,
          '--exit-code'
        ]
      )
    } catch (_) {
      console.log('ℹ️ [Verify] Shadow database offline; full migration diff runs in integration stage.')
    }
  } else {
    console.log('ℹ️ [Verify] Skipping live shadow DB diff in offline verify; full migration diff runs in integration stage.')
  }

  // 3. Backend Linting
  runStep(
    'Backend Lint',
    'npm',
    ['run', 'lint', '--prefix', 'proctornet/backend']
  )

  // 4. Frontend Lint & Build
  runStep(
    'Frontend Build',
    'npm',
    ['run', 'build', '--prefix', 'proctornet/frontend']
  )

  // 5. Unit Tests (Pure in-memory, no external database or redis dependencies)
  runStep(
    'Unit Tests',
    'node',
    [
      '--test',
      'proctornet/backend/tests/assertNonProduction.test.js',
      'proctornet/backend/tests/p4-state-machine.test.js',
      'proctornet/backend/tests/p5-client-compression.test.js',
      'proctornet/backend/tests/gate-sanity-banned-terms.test.js',
      'proctornet/backend/tests/w1-student-presenter.test.js',
      'proctornet/backend/tests/w2-agent-gate.test.js',
      'proctornet/backend/tests/w3-groq-llm.test.js'
    ]
  )

  // 6. Consolidated Quality & Architecture Guardrails
  runStep(
    'Quality & Architecture Guardrails',
    'node',
    ['scripts/ci/quality.js']
  )

  console.log('\n✨ [Verify] All verification checks completed successfully!')
}

main().catch((err) => {
  console.error('Fatal error during verification:', err)
  process.exit(1)
})
