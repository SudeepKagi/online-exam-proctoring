#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/preflight-env.js
 * Validates an environment configuration file prior to deployment.
 *
 * Checks:
 * 1. Has every required production variable name.
 * 2. Enforces minimum lengths for secrets (>= 32 chars).
 * 3. Rejects known development/testing default secrets.
 * 4. Verifies PUBLIC_ORIGIN is a bare origin (no trailing slash, path, query, or hash).
 * 5. Verifies SEB_MODE is strictly 'off', 'log', or 'enforce'.
 * 6. Forbids test, pilot, or dev database names when NODE_ENV is production.
 *
 * Usage:
 *   node scripts/ops/preflight-env.js <path-to-env-file> [--prod]
 */

const fs = require('fs')
const path = require('path')

const KNOWN_DEFAULTS = new Set([
  'default_jwt_secret_must_be_changed_in_production_32chars',
  'supersecret_jwt_proctornet_production_key_32bytes',
  'default_jwt_refresh_secret_at_least_32_characters!',
  'default_seb_link_hmac_secret_at_least_32_chars_long!',
  'ci_test_postgres_32char_secure_password_01',
  'ci_test_redis_32char_secure_password_01',
  'test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!',
  'test_suite_jwt_refresh_secret_at_least_32_chars!',
  'test_suite_seb_link_secret_at_least_32_characters_long_for_hmac!',
  'proctornet_super_secret_jwt_key_change_in_production',
  'proctornet-super-secret-key-production-ready',
  'proctornet_default_jwt_signing_secret_key_2026',
  'secret',
  'jwtsecret',
  'supersecret',
  'changeme',
  'password',
  '12345678',
  'proctornet'
])

const REQUIRED_NAMES = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PUBLIC_ORIGIN',
  'SEB_MODE',
  'REDIS_URL',
  'S3_BUCKET',
  'AWS_REGION',
  'SEB_LINK_SECRET'
]

function parseEnvContent(content) {
  const result = {}
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim().replace(/^export\s+/, '')
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

function validatePublicOrigin(rawOrigin) {
  if (!rawOrigin) return { valid: false, error: 'PUBLIC_ORIGIN is missing' }
  const clean = String(rawOrigin).trim()
  let url
  try {
    url = new URL(clean)
  } catch {
    return { valid: false, error: `PUBLIC_ORIGIN "${clean}" is not a valid URL` }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: `PUBLIC_ORIGIN must use http: or https: scheme. Received: ${url.protocol}` }
  }

  if (url.pathname && url.pathname !== '/') {
    return { valid: false, error: `PUBLIC_ORIGIN must not contain a path. Received: "${url.pathname}"` }
  }

  if (clean.endsWith('/') && clean !== `${url.protocol}//`) {
    return { valid: false, error: 'PUBLIC_ORIGIN must be a bare origin without a trailing slash' }
  }

  if (url.search) {
    return { valid: false, error: `PUBLIC_ORIGIN must not contain query parameters. Received: "${url.search}"` }
  }

  if (url.hash) {
    return { valid: false, error: `PUBLIC_ORIGIN must not contain a fragment/hash. Received: "${url.hash}"` }
  }

  if (url.origin !== clean.replace(/\/+$/, '')) {
    return { valid: false, error: `PUBLIC_ORIGIN "${clean}" does not match its parsed origin "${url.origin}"` }
  }

  return { valid: true, origin: url.origin }
}

function preflightEnv(filePath, options = {}) {
  const errors = []
  const warnings = []

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      valid: false,
      errors: [`Env file not found at path: ${filePath}`],
      warnings: []
    }
  }

  const rawContent = fs.readFileSync(filePath, 'utf8')
  const envMap = parseEnvContent(rawContent)
  const isProduction = Boolean(
    options.isProduction ||
    process.argv.includes('--prod') ||
    envMap.NODE_ENV === 'production'
  )

  // 1. Check required names
  for (const name of REQUIRED_NAMES) {
    if (!envMap[name] && (name !== 'S3_BUCKET' || !envMap.AWS_S3_BUCKET)) {
      errors.push(`Missing required variable: ${name}`)
    }
  }

  // 2. Minimum length checks
  const minLengthChecks = [
    { name: 'JWT_SECRET', min: 32 },
    { name: 'JWT_REFRESH_SECRET', min: 32 },
    { name: 'SEB_LINK_SECRET', min: 32 }
  ]
  for (const { name, min } of minLengthChecks) {
    const val = envMap[name]
    if (val && val.length < min) {
      errors.push(`${name} length (${val.length}) is below required minimum of ${min} characters`)
    }
  }

  // 3. Known default secret checks
  const secretKeysToCheck = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SEB_LINK_SECRET', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD']
  for (const key of secretKeysToCheck) {
    const val = envMap[key]
    if (val && KNOWN_DEFAULTS.has(val.trim())) {
      errors.push(`${key} matches known default/test secret and is forbidden in production`)
    }
  }

  // 4. PUBLIC_ORIGIN bare origin check
  if (envMap.PUBLIC_ORIGIN) {
    const originCheck = validatePublicOrigin(envMap.PUBLIC_ORIGIN)
    if (!originCheck.valid) {
      errors.push(originCheck.error)
    }
  }

  // 5. SEB_MODE validity check
  if (envMap.SEB_MODE) {
    const mode = envMap.SEB_MODE.toLowerCase().trim()
    if (!['off', 'log', 'enforce'].includes(mode)) {
      errors.push(`SEB_MODE must be 'off', 'log', or 'enforce'. Received: "${envMap.SEB_MODE}"`)
    }
  }

  // 6. Database name checks for production
  if (isProduction) {
    const dbUrl = envMap.DATABASE_URL || ''
    const directUrl = envMap.DIRECT_URL || ''
    const forbidPatterns = [/_test(\b|\?)/i, /_pilot(\b|\?)/i, /_dev(\b|\?)/i, /localhost/i, /127\.0\.0\.1/i]

    for (const pat of forbidPatterns) {
      if (pat.test(dbUrl)) {
        errors.push(`DATABASE_URL contains forbidden non-production pattern (${pat}) in production environment`)
        break
      }
    }
    for (const pat of forbidPatterns) {
      if (directUrl && pat.test(directUrl)) {
        errors.push(`DIRECT_URL contains forbidden non-production pattern (${pat}) in production environment`)
        break
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    envCount: Object.keys(envMap).length,
    isProduction
  }
}

function runCli() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (args.length === 0) {
    console.error('Usage: node scripts/ops/preflight-env.js <env-file> [--prod]')
    process.exit(1)
  }

  const envPath = path.resolve(process.cwd(), args[0])
  const result = preflightEnv(envPath)

  console.log(`\n==========================================================`)
  console.log(` ProctorNet Preflight Environment Validation`)
  console.log(` Target: ${envPath}`)
  console.log(` Mode:   ${result.isProduction ? 'PRODUCTION' : 'STAGING / NON-PRODUCTION'}`)
  console.log(` Keys:   ${result.envCount} variables parsed`)
  console.log(`==========================================================`)

  if (!result.valid) {
    console.error('\n❌ PREFLIGHT CHECKS FAILED:')
    for (const err of result.errors) {
      console.error(`  [-] ${err}`)
    }
    console.error(`\nRefusing deployment. Correct the above environment errors.\n`)
    process.exit(1)
  }

  console.log('\n✅ All preflight environment checks passed successfully.\n')
  process.exit(0)
}

if (require.main === module) {
  runCli()
}

module.exports = {
  preflightEnv,
  validatePublicOrigin,
  parseEnvContent,
  KNOWN_DEFAULTS,
  REQUIRED_NAMES
}

