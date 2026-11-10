'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const {
  preflightEnv,
  validatePublicOrigin,
  parseEnvContent
} = require('../../scripts/ops/preflight-env')

describe('Preflight Env Script Invariants (scripts/ops/preflight-env.js)', () => {
  const tmpDir = path.join(os.tmpdir(), `pn-preflight-test-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  function createTempEnv(content) {
    const filePath = path.join(tmpDir, `.env.${Date.now()}.${Math.random().toString(36).substring(7)}`)
    fs.writeFileSync(filePath, content, 'utf8')
    return filePath
  }

  const validProdEnv = `
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://proctornet_prod_user:p0_strong_secret_db_pass_2026@db.internal:5432/proctornet_production
JWT_SECRET=production_grade_secure_jwt_secret_key_random_64_characters_long_val!
JWT_REFRESH_SECRET=production_grade_secure_jwt_refresh_secret_key_random_64_chars!
SEB_LINK_SECRET=production_grade_secure_seb_link_hmac_secret_key_random_64_chars!
PUBLIC_ORIGIN=https://exam.university.edu
SEB_MODE=enforce
REDIS_URL=redis://:strong_redis_auth_token_32chars@redis.internal:6379/0
S3_BUCKET=proctornet-institution-prod-evidence
AWS_REGION=ap-south-1
`

  test('1. Valid production environment passes all preflight checks', () => {
    const file = createTempEnv(validProdEnv)
    const result = preflightEnv(file, { isProduction: true })
    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.errors.length, 0)
  })

  test('2. Missing required variable is reported as an error', () => {
    const incomplete = validProdEnv.replace(/JWT_SECRET=.*\n/, '')
    const file = createTempEnv(incomplete)
    const result = preflightEnv(file, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('Missing required variable: JWT_SECRET')))
  })

  test('3. Secrets below 32 characters are rejected', () => {
    const shortSecret = validProdEnv.replace(
      /JWT_SECRET=.*/,
      'JWT_SECRET=short_insecure_key'
    )
    const file = createTempEnv(shortSecret)
    const result = preflightEnv(file, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('JWT_SECRET length') && e.includes('below required minimum of 32')))
  })

  test('4. Insecure known development defaults are strictly rejected', () => {
    const knownDefault = validProdEnv.replace(
      /JWT_SECRET=.*/,
      'JWT_SECRET=default_jwt_secret_must_be_changed_in_production_32chars'
    )
    const file = createTempEnv(knownDefault)
    const result = preflightEnv(file, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('JWT_SECRET matches known default/test secret')))
  })

  test('5. PUBLIC_ORIGIN validation: bare origins pass, trailing slashes, paths and queries fail', () => {
    assert.strictEqual(validatePublicOrigin('https://exam.university.edu').valid, true)
    assert.strictEqual(validatePublicOrigin('http://localhost:5000').valid, true)

    // Trailing slash
    const slash = validatePublicOrigin('https://exam.university.edu/')
    assert.strictEqual(slash.valid, false)
    assert.ok(slash.error.includes('bare origin without a trailing slash'))

    // Subpath
    const subpath = validatePublicOrigin('https://exam.university.edu/api')
    assert.strictEqual(subpath.valid, false)
    assert.ok(subpath.error.includes('must not contain a path'))

    // Query param
    const query = validatePublicOrigin('https://exam.university.edu?test=1')
    assert.strictEqual(query.valid, false)
    assert.ok(query.error.includes('must not contain query parameters'))
  })

  test('6. SEB_MODE accepts off, log, enforce and rejects arbitrary strings', () => {
    const badMode = validProdEnv.replace('SEB_MODE=enforce', 'SEB_MODE=strict')
    const file = createTempEnv(badMode)
    const result = preflightEnv(file, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes("SEB_MODE must be 'off', 'log', or 'enforce'")))
  })

  test('7. Database names ending in _test, _pilot, or _dev are rejected in production', () => {
    const testDb = validProdEnv.replace(
      /DATABASE_URL=.*/,
      'DATABASE_URL=postgresql://user:pass@db.internal:5432/proctornet_e2e_test'
    )
    const file = createTempEnv(testDb)
    const result = preflightEnv(file, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('forbidden non-production pattern')))
  })

  test('8. Database names ending in _test are permitted in non-production environments', () => {
    const testDbNonProd = validProdEnv
      .replace('NODE_ENV=production', 'NODE_ENV=development')
      .replace(
        /DATABASE_URL=.*/,
        'DATABASE_URL=postgresql://user:pass@db.internal:5432/proctornet_e2e_test'
      )
    const file = createTempEnv(testDbNonProd)
    const result = preflightEnv(file, { isProduction: false })
    assert.strictEqual(result.valid, true)
  })

  test('9. CLI execution exits 0 on valid config and 1 on invalid config', () => {
    const scriptPath = path.resolve(__dirname, '../../scripts/ops/preflight-env.js')
    const validFile = createTempEnv(validProdEnv)
    const invalidFile = createTempEnv('NODE_ENV=production\n')

    // Valid file exits 0
    const out = execFileSync(process.execPath, [scriptPath, validFile, '--prod'], { encoding: 'utf8' })
    assert.ok(out.includes('All preflight environment checks passed successfully'))

    // Invalid file exits non-zero
    assert.throws(() => {
      execFileSync(process.execPath, [scriptPath, invalidFile, '--prod'], { stdio: 'pipe' })
    })
  })
})

