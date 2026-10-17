#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/ci-doctor.js
 * CI Log Diagnostician & Failure Analyzer (Prompt 11 / V3.5)
 *
 * Downloads and parses GitHub Action run logs using gh CLI (or reads local log file),
 * matches known signatures to root causes, and prints reproduction commands.
 *
 * Usage:
 *   node scripts/ci/ci-doctor.js [run-id | latest | path/to/log]
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SIGNATURES = [
  {
    name: 'PostgreSQL Connection Refused',
    pattern: /ECONNREFUSED.*5432|connect ECONNREFUSED 127\.0\.0\.1:5432/i,
    cause: 'PostgreSQL container is not started or not ready to accept connections.',
    reproduce: 'docker compose -f docker-compose.ci.yml up -d postgres && npx prisma migrate deploy'
  },
  {
    name: 'Dependency / Hoisting Failure',
    pattern: /Cannot find module ['"]([^'"]+)['"]/i,
    cause: 'Missing npm package or workspace hoisting mismatch.',
    reproduce: 'npm ci'
  },
  {
    name: 'Origin / CORS Misconfiguration',
    pattern: /Forbidden origin|Origin.*not allowed by Access-Control-Allow-Origin/i,
    cause: 'Request origin is not allowed by ALLOWED_ORIGINS or PUBLIC_ORIGIN.',
    reproduce: 'Check ci/ci.env ALLOWED_ORIGINS and PUBLIC_ORIGIN configuration.'
  },
  {
    name: 'Port Conflict (EADDRINUSE)',
    pattern: /EADDRINUSE.*:(\d+)/i,
    cause: 'Port is already bound by another background process.',
    reproduce: 'netstat -ano | findstr :5000 (Windows) or lsof -i :5000 (Linux/Mac)'
  },
  {
    name: 'Prisma Schema Drift / Migration Failure',
    pattern: /P3005|P3006|P3009|The migration.*failed to apply cleanly/i,
    cause: 'Database schema drift or pending Prisma migration conflict.',
    reproduce: 'npx prisma migrate diff --from-migrations backend/prisma/migrations --to-schema-datamodel backend/prisma/schema.prisma --exit-code'
  },
  {
    name: 'Playwright E2E Timeout',
    pattern: /Test timeout of (\d+)ms exceeded|TimeoutError: locator\./i,
    cause: 'E2E browser action timed out waiting for element or network response.',
    reproduce: 'npx playwright test --trace on'
  },
  {
    name: 'Quality Gate Violation',
    pattern: /❌ Check failed: (\d+) legacy violation|❌ Forbidden token|❌ User-facing abstraction violation/i,
    cause: 'Architecture or abstraction gate failed in quality.js.',
    reproduce: 'node scripts/ci/quality.js'
  }
]

function getLogContent(target) {
  if (target && fs.existsSync(target)) {
    console.log(`📖 Reading local log file: ${target}`)
    return fs.readFileSync(target, 'utf8')
  }

  const runArg = target && target !== 'latest' ? target : ''
  console.log(`🌐 Fetching run log via GitHub CLI (run ${runArg || 'latest'})...`)
  try {
    const cmd = runArg ? `gh run view ${runArg} --log-failed` : 'gh run view --log-failed'
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (err) {
    console.warn('⚠️ Could not fetch log via gh CLI. Attempting to read recent local log...')
    const localLogs = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.log'))
    if (localLogs.length > 0) {
      return fs.readFileSync(localLogs[0], 'utf8')
    }
    throw new Error('No logs found. Specify a run ID or log file path.')
  }
}

function analyze(content) {
  console.log('\n🩺 CI Doctor: Diagnosing failure signatures...')
  let matchesFound = 0

  for (const sig of SIGNATURES) {
    const match = content.match(sig.pattern)
    if (match) {
      matchesFound++
      console.log(`\n======================================================`)
      console.log(`🚨 [MATCH] ${sig.name}`)
      console.log(`   Likely Cause: ${sig.cause}`)
      console.log(`   Sample Match: ${match[0].slice(0, 150)}`)
      console.log(`   Command to Reproduce Locally:`)
      console.log(`   👉 ${sig.reproduce}`)
      console.log(`======================================================`)
    }
  }

  if (matchesFound === 0) {
    console.log('ℹ️ No known error signatures matched in log output.')
    console.log('Tip: Run `npm run verify` or `npm run test` locally to inspect full stack trace.')
  } else {
    console.log(`\nFound ${matchesFound} diagnosed issue(s). Follow reproduction steps above.`)
  }
}

const target = process.argv[2]
try {
  const content = getLogContent(target)
  analyze(content)
} catch (err) {
  console.error('Error running CI doctor:', err.message)
  process.exit(1)
}
