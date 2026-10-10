'use strict'

/**
 * proctornet/backend/src/infra/postgres/assertNonProduction.js
 *
 * Mandatory safety guard for all data mutation, seeding, reset, and test helper scripts.
 * Enforces that scripts can only write to local/CI/test databases unless explicitly
 * confirmed with production-specific flags AND an environment token present only on the server.
 */

const LOCAL_HOST_ALLOWLIST = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'db',
  'host.docker.internal'
])

const SAFE_DB_NAME_REGEX = /(_test|_ci|_dev|_local)$/i

function parseDatabaseConnection(urlStr) {
  if (!urlStr) return { host: 'unknown', dbName: 'unknown' }
  try {
    const parsed = new URL(urlStr)
    const host = parsed.hostname.toLowerCase()
    const dbName = (parsed.pathname || '').replace(/^\//, '').toLowerCase()
    return { host, dbName }
  } catch {
    return { host: 'unknown', dbName: 'unknown' }
  }
}

function isNonProductionDatabase(dbUrl = process.env.DATABASE_URL) {
  const { host, dbName } = parseDatabaseConnection(dbUrl)
  if (LOCAL_HOST_ALLOWLIST.has(host)) return true
  if (SAFE_DB_NAME_REGEX.test(dbName)) return true
  return false
}

function assertNonProduction(caller = 'Unknown Script') {
  // If running under automated unit tests with in-memory or stubbed mocks, allow
  if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) {
    return true
  }

  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL
  const { host, dbName } = parseDatabaseConnection(dbUrl)

  const isSafe = isNonProductionDatabase(dbUrl)
  if (isSafe) {
    return true
  }

  // Database is remote/production. Require explicit CLI flags and environment token.
  const args = process.argv || []
  const hasTargetProd = args.includes('--target') && args[args.indexOf('--target') + 1] === 'production'
  const confirmIndex = args.indexOf('--confirm')
  const confirmVal = confirmIndex !== -1 ? args[confirmIndex + 1] : ''
  const hasTypedConfirm = confirmVal === `I_CONFIRM_PRODUCTION_WRITE_${host}` || confirmVal === 'I_CONFIRM_PRODUCTION_WRITE'
  const hasServerEnvToken = process.env.PROCTORNET_ALLOW_PRODUCTION_MUTATION === 'true'

  if (hasTargetProd && hasTypedConfirm && hasServerEnvToken) {
    console.warn(`[!] CAUTION: ${caller} executing against PRODUCTION database: ${host}/${dbName}`)
    return true
  }

  const err = new Error(
    `\n[FATAL SAFETY VIOLATION] Script "${caller}" refused to execute against production/remote database!\n` +
    `  Target Host : ${host}\n` +
    `  Database    : ${dbName}\n` +
    `  Remediation : Data-writing scripts may only execute against local/CI databases (${Array.from(LOCAL_HOST_ALLOWLIST).join(', ')}) or databases ending in _test|_ci|_dev.\n` +
    `  If this is an intentional manual server-side operation on EC2, you must supply:\n` +
    `    1. --target production\n` +
    `    2. --confirm "I_CONFIRM_PRODUCTION_WRITE_${host}"\n` +
    `    3. PROCTORNET_ALLOW_PRODUCTION_MUTATION=true\n`
  )
  console.error(err.message)
  process.exit(1)
}

module.exports = {
  assertNonProduction,
  isNonProductionDatabase,
  LOCAL_HOST_ALLOWLIST
}
