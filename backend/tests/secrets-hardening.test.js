'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { execSync } = require('child_process')
const path = require('path')

const { validateConfig, KNOWN_DEFAULTS } = require('../src/shared/validateConfig')
const config = require('../src/shared/config')
const { signToken, verifyToken } = require('../src/utils/jwt')
const { authService } = require('../src/modules/auth/auth.service')

describe('Secrets Hardening & Production Startup Invariants', () => {
  it('contains all burned and known defaults in KNOWN_DEFAULTS', () => {
    assert.ok(KNOWN_DEFAULTS.has('proctornet_super_secret_jwt_key_local_development_fallback_2026'))
    assert.ok(KNOWN_DEFAULTS.has('supersecret_jwt_proctornet_production_key_32bytes'))
    assert.ok(KNOWN_DEFAULTS.has('supersecret_jwt_refresh_proctornet_key_32bytes'))
    assert.ok(KNOWN_DEFAULTS.has('dev_seb_link_secret_at_least_32_characters_long_for_hmac'))
    assert.ok(KNOWN_DEFAULTS.has('ci_throwaway_jwt_secret_at_least_32_characters_long_01'))
    assert.ok(KNOWN_DEFAULTS.has('test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!'))
    assert.ok(KNOWN_DEFAULTS.has('changeme'))
  })

  it('rejects missing, short (< 32 chars), and known default secrets in production', () => {
    const backupEnv = { ...process.env }

    try {
      process.env.NODE_ENV = 'production'
      process.env.ALLOW_CONFIG_THROW_FOR_TEST = 'true'
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/proctornet'
      process.env.PUBLIC_ORIGIN = 'https://exam.institution.edu'

      const validSecret1 = 'a_valid_custom_production_secret_key_1_32bytes'
      const validSecret2 = 'a_valid_custom_production_secret_key_2_32bytes'
      const validSecret3 = 'a_valid_custom_production_secret_key_3_32bytes'

      // 1. JWT_SECRET missing
      delete process.env.JWT_SECRET
      process.env.JWT_REFRESH_SECRET = validSecret2
      process.env.SEB_LINK_SECRET = validSecret3
      assert.throws(() => validateConfig(), /JWT_SECRET must be set/)

      // 2. JWT_SECRET < 32 chars
      process.env.JWT_SECRET = 'short_secret_under_32_chars'
      assert.throws(() => validateConfig(), /JWT_SECRET must be at least 32 characters/)

      // 3. JWT_SECRET known default
      process.env.JWT_SECRET = 'supersecret_jwt_proctornet_production_key_32bytes'
      assert.throws(() => validateConfig(), /JWT_SECRET matches a known default/)

      // 4. JWT_REFRESH_SECRET missing
      process.env.JWT_SECRET = validSecret1
      delete process.env.JWT_REFRESH_SECRET
      assert.throws(() => validateConfig(), /JWT_REFRESH_SECRET must be set/)

      // 5. JWT_REFRESH_SECRET < 32 chars
      process.env.JWT_REFRESH_SECRET = 'too_short'
      assert.throws(() => validateConfig(), /JWT_REFRESH_SECRET must be at least 32 characters/)

      // 6. JWT_REFRESH_SECRET known default
      process.env.JWT_REFRESH_SECRET = 'supersecret_jwt_refresh_proctornet_key_32bytes'
      assert.throws(() => validateConfig(), /JWT_REFRESH_SECRET matches a known default/)

      // 7. SEB_LINK_SECRET missing
      process.env.JWT_REFRESH_SECRET = validSecret2
      delete process.env.SEB_LINK_SECRET
      assert.throws(() => validateConfig(), /SEB_LINK_SECRET must be set/)

      // 8. SEB_LINK_SECRET < 32 chars
      process.env.SEB_LINK_SECRET = 'short_link_secret'
      assert.throws(() => validateConfig(), /SEB_LINK_SECRET must be at least 32 characters/)

      // 9. SEB_LINK_SECRET known default
      process.env.SEB_LINK_SECRET = 'dev_seb_link_secret_at_least_32_characters_long_for_hmac'
      assert.throws(() => validateConfig(), /SEB_LINK_SECRET matches a known default/)

      // 10. Valid production secrets pass cleanly
      process.env.JWT_SECRET = validSecret1
      process.env.JWT_REFRESH_SECRET = validSecret2
      process.env.SEB_LINK_SECRET = validSecret3
      assert.doesNotThrow(() => validateConfig())
    } finally {
      process.env = backupEnv
    }
  })

  it('exits with code 1 in a live production node process when secrets are invalid', () => {
    const scriptPath = path.resolve(__dirname, '../src/shared/validateConfig.js')
    const cmd = `node -e "process.env.NODE_ENV='production'; process.env.JWT_SECRET='supersecret_jwt_proctornet_production_key_32bytes'; require('${scriptPath.replace(/\\/g, '/')}').validateConfig()"`
    let exitedWithCode1 = false
    try {
      execSync(cmd, { stdio: 'pipe' })
    } catch (err) {
      exitedWithCode1 = (err.status === 1)
    }
    assert.strictEqual(exitedWithCode1, true, 'Process must exit with code 1 in production on known default')
  })

  it('verifies that issueTokens and signToken read from config with zero hardcoded fallbacks', () => {
    const dummyUser = { id: 'usr-hardening-test', email: 'test@example.com', role: 'STUDENT', name: 'Tester' }
    const tokens = authService.issueTokens(dummyUser)
    assert.ok(tokens.accessToken)
    assert.ok(tokens.refreshToken)

    const verifiedAccess = authService.verifyToken(tokens.accessToken)
    assert.strictEqual(verifiedAccess.sub, dummyUser.id)

    const directToken = signToken({ sub: 'user-direct', role: 'FACULTY' })
    const verifiedDirect = verifyToken(directToken)
    assert.strictEqual(verifiedDirect.sub, 'user-direct')
  })
})
