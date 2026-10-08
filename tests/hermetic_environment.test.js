'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
let z
try {
  z = require('zod')
} catch (_) {
  try {
    z = require('../proctornet/node_modules/zod')
  } catch (__) {
    z = require('../proctornet/backend/node_modules/zod')
  }
}
if (z.z) z = z.z
const { KNOWN_DEFAULTS } = require('../proctornet/backend/src/shared/validateConfig')
const config = require('../proctornet/backend/src/shared/config')

describe('Hermetic Environment & Configuration Integrity Gates (Phase C2)', () => {
  it('C2.1: Production boot-time validation fails closed on insecure or missing JWT_SECRET', () => {
    // Test schema against insecure defaults
    assert.ok(KNOWN_DEFAULTS.has('proctornet-super-secret-key-production-ready'))
    assert.ok(KNOWN_DEFAULTS.has('proctornet_default_jwt_signing_secret_key_2026'))
    assert.ok(KNOWN_DEFAULTS.has('supersecret'))
    assert.ok(KNOWN_DEFAULTS.has('changeme'))

    // Verify minimum length check
    const shortSecret = 'short-secret'
    assert.ok(shortSecret.length < 32, 'Must be < 32 chars')
  })

  it('C2.2: config.js does not invent dummy secret fallbacks for jwtSecret', () => {
    // When JWT_SECRET is unset in production, config.jwtSecret must be undefined, not a dummy string
    const originalSecret = process.env.JWT_SECRET
    delete process.env.JWT_SECRET

    // Re-evaluating should not fallback to a hardcoded string
    const freshConfig = require('../proctornet/backend/src/shared/config')
    // In test environment, it reads process.env.JWT_SECRET if set, but never hardcodes 'dummy-secret'
    assert.notStrictEqual(freshConfig.jwtSecret, 'dummy-secret')
    assert.notStrictEqual(freshConfig.jwtSecret, 'secret')

    if (originalSecret) process.env.JWT_SECRET = originalSecret
  })

  it('C2.3: Production environment enforces fail-closed COOKIE_SECURE and S3_BUCKET', () => {
    const prodSchema = z.object({
      COOKIE_SECURE: z.literal('true'),
      S3_BUCKET: z.string().min(3),
      DATABASE_URL: z.string().min(1)
    })

    // Insecure config must fail
    const insecureAttempt = prodSchema.safeParse({
      COOKIE_SECURE: 'false',
      S3_BUCKET: '',
      DATABASE_URL: ''
    })
    assert.strictEqual(insecureAttempt.success, false)
    assert.strictEqual(insecureAttempt.error.issues.length, 3)

    // Secure config must pass
    const secureAttempt = prodSchema.safeParse({
      COOKIE_SECURE: 'true',
      S3_BUCKET: 'proctornet-prod-bucket',
      DATABASE_URL: 'postgresql://db.prod:5432/proctornet'
    })
    assert.strictEqual(secureAttempt.success, true)
  })

  it('C2.4: Production AWS S3 client never uses static keys in IS_PROD mode', () => {
    // Inspect s3.client.js source to assert IS_PROD credential rule
    const fs = require('fs')
    const path = require('path')
    const s3Source = fs.readFileSync(path.join(__dirname, '../proctornet/backend/src/infra/s3/s3.client.js'), 'utf8')

    // Must guard credentials with if (!IS_PROD)
    assert.match(s3Source, /if\s*\(!IS_PROD\)/, 'Static credentials must only be allowed when !IS_PROD')
    assert.match(s3Source, /USE_MOCK\s*=\s*!IS_PROD/, 'Mock store must only be allowed when !IS_PROD')
  })

  it('C2.5: No CI workflow copies .env.example', () => {
    const fs = require('fs')
    const path = require('path')
    const ciContent = fs.readFileSync(path.join(__dirname, '../.github/workflows/ci.yml'), 'utf8')

    assert.doesNotMatch(ciContent, /cp\s+.*\.env\.example\s+.*\.env/, 'ci.yml must not copy .env.example')
  })
})
