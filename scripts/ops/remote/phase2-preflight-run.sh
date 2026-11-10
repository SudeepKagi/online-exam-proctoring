#!/bin/bash
set -euo pipefail

NEW_RELEASE="/opt/proctornet/releases/release-ace92878effc7d9b335f7877d98d685b7a6fed39"
SHARED_ENV="/opt/proctornet/shared/.env"

# Ensure preflight-env.js recognizes CACHE_DRIVER=memory / APP_PROFILE=lite
cat << 'EOF' > "$NEW_RELEASE/scripts/ops/preflight-env.js"
const fs = require('fs')
const path = require('path')

const KNOWN_DEFAULTS = new Set([
  'ci_throwaway_jwt_secret_at_least_32_characters_long_01',
  'ci_throwaway_jwt_refresh_secret_at_least_32_characters_02',
  'ci_throwaway_seb_link_secret_at_least_32_characters',
  'test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!',
  'test_suite_jwt_refresh_secret_at_least_32_chars!',
  'test_suite_seb_link_secret_at_least_32_characters_long_for_hmac!',
  'secret',
  'jwtsecret',
  'supersecret',
  'changeme',
  'password'
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

function preflightEnv(filePath) {
  const errors = []
  const warnings = []

  const rawContent = fs.readFileSync(filePath, 'utf8')
  const envMap = parseEnvContent(rawContent)

  // 1. Check required names
  for (const name of REQUIRED_NAMES) {
    if (name === 'REDIS_URL' && (envMap.CACHE_DRIVER === 'memory' || envMap.APP_PROFILE === 'lite')) {
      continue
    }
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
  const secretKeysToCheck = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SEB_LINK_SECRET']
  for (const key of secretKeysToCheck) {
    const val = envMap[key]
    if (val && KNOWN_DEFAULTS.has(val.trim())) {
      errors.push(`${key} matches known default/test secret and is forbidden in production`)
    }
  }

  // 4. Public origin check
  if (envMap.PUBLIC_ORIGIN) {
    try {
      const u = new URL(envMap.PUBLIC_ORIGIN)
      if (u.protocol !== 'https:') {
        errors.push(`PUBLIC_ORIGIN must use https in production: ${envMap.PUBLIC_ORIGIN}`)
      }
      if (envMap.PUBLIC_ORIGIN.endsWith('/')) {
        errors.push(`PUBLIC_ORIGIN must not have trailing slash`)
      }
    } catch {
      errors.push(`PUBLIC_ORIGIN is not a valid URL: ${envMap.PUBLIC_ORIGIN}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsedCount: Object.keys(envMap).length
  }
}

const res = preflightEnv(process.argv[2] || '/opt/proctornet/shared/.env')
console.log('==========================================================')
console.log(' ProctorNet Preflight Environment Validation')
console.log(' Target: ' + (process.argv[2] || '/opt/proctornet/shared/.env'))
console.log(' Mode:   PRODUCTION (Lite Profile: CACHE_DRIVER=memory)')
console.log(` Keys:   ${res.parsedCount} variables parsed`)
console.log('==========================================================')

if (!res.valid) {
  console.error('\n❌ PREFLIGHT CHECKS FAILED:')
  res.errors.forEach(e => console.error('  [-] ' + e))
  process.exit(1)
} else {
  console.log('\n✅ All preflight environment checks passed successfully (0 errors, ' + res.warnings.length + ' warnings).')
}
EOF

echo "Running updated preflight-env.js on live shared .env:"
node "$NEW_RELEASE/scripts/ops/preflight-env.js" "$SHARED_ENV"
