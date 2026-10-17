#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/ci-local.js
 * Clean-Room Local CI Runner (Prompt 11 / V3.5)
 *
 * Replicates the CI blocking pipeline locally using docker-compose.ci.yml:
 * 1. Spins up Postgres 16 and MinIO backing containers.
 * 2. Runs `npm run verify` (Zero-dependency checks, lints, build, quality.js).
 * 3. Applies database migrations to local test database.
 * 4. Runs backend integration tests + boot smoke.
 * 5. Optional `--e2e` runs Playwright journey suite.
 */

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const REPO_ROOT = path.resolve(__dirname, '../..')
const withE2E = process.argv.includes('--e2e')

function run(command, args, options = {}) {
  console.log(`\n▶ [ci:local] ${command} ${args.join(' ')}`)
  const start = Date.now()
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: true,
    ...options
  })
  const duration = Date.now() - start

  if (result.status !== 0) {
    console.error(`\n❌ [ci:local] Command failed in ${duration}ms!`)
    process.exit(result.status || 1)
  }
  console.log(`✅ [ci:local] Step completed (${duration}ms)`)
}

async function main() {
  console.log('🚀 Starting Local CI Clean-Room Replication Pipeline...')

  // Load ci/ci.env if it exists
  const envFile = path.join(REPO_ROOT, 'ci/ci.env')
  if (fs.existsSync(envFile)) {
    const dotenv = require('dotenv')
    dotenv.config({ path: envFile })
  }

  // 1. Verify stage (lint, quality gates, build, unit tests)
  run('node', ['scripts/ci/verify.js'])

  // 2. Start backing services via Docker Compose
  console.log('\n🐳 Ensuring local CI backing containers (Postgres 16, MinIO) are active...')
  run('docker', ['compose', '-f', 'docker-compose.ci.yml', 'up', '-d'])

  // 3. Database migrations against CI container
  console.log('\n📦 Applying database migrations to CI Postgres container...')
  run('npx', ['prisma', 'migrate', 'deploy', '--schema=backend/prisma/schema.prisma'])

  // 4. Run Integration Tests & Boot Smoke
  console.log('\n🧪 Executing backend integration tests and boot smoke...')
  run('node', ['scripts/ci/boot-smoke.js'])

  // 5. Optional E2E Journeys
  if (withE2E) {
    console.log('\n🎭 Executing Playwright E2E journey suite...')
    run('npx', ['playwright', 'test'])
  }

  console.log('\n✨ [ci:local] Complete local pipeline verified green!')
}

main().catch((err) => {
  console.error('Fatal error during local CI run:', err)
  process.exit(1)
})
