'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { validateConfig } = require('../src/shared/validateConfig')
const { preflightEnv } = require('../../scripts/ops/preflight-env')

describe('Storage Configuration Validation Invariants', () => {
  const baseProdConfig = {
    NODE_ENV: 'production',
    PORT: 5000,
    DATABASE_URL: 'postgresql://prod_user:p0_strong_secret_db_pass_2026@db.internal:5432/prod_db',
    JWT_SECRET: 'production_grade_secure_jwt_secret_key_random_64_characters_long_val!',
    JWT_REFRESH_SECRET: 'production_grade_secure_jwt_refresh_secret_key_random_64_chars!',
    SEB_LINK_SECRET: 'production_grade_secure_seb_link_hmac_secret_key_random_64_chars!',
    PUBLIC_ORIGIN: 'https://proctornet.duckdns.org',
    SEB_MODE: 'enforce',
    REDIS_URL: 'redis://:strong_redis_auth_token_32chars@redis.internal:6379/0',
    S3_BUCKET: 'proctornet-storage-prod-858109978489',
    AWS_REGION: 'ap-south-1'
  }

  const tmpDir = path.join(os.tmpdir(), `pn-storage-val-test-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  function createEnvFile(obj) {
    const lines = Object.entries(obj).map(([k, v]) => `${k}=${v}`)
    const filePath = path.join(tmpDir, `.env.${Date.now()}.${Math.random().toString(36).substring(7)}`)
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
    return filePath
  }

  test('1. Valid production storage configuration passes validateConfig', () => {
    assert.doesNotThrow(() => {
      validateConfig(baseProdConfig)
    })
  })

  test('2. S3_ENDPOINT pointing to localhost is strictly refused in production', () => {
    const badConfig = { ...baseProdConfig, S3_ENDPOINT: 'http://localhost:9000' }
    assert.throws(
      () => validateConfig(badConfig),
      /Production S3_ENDPOINT must NOT point to local\/MinIO services/
    )
  })

  test('3. S3_ENDPOINT pointing to 127.0.0.1 is strictly refused in production', () => {
    const badConfig = { ...baseProdConfig, S3_ENDPOINT: 'http://127.0.0.1:9000' }
    assert.throws(
      () => validateConfig(badConfig),
      /Production S3_ENDPOINT must NOT point to local\/MinIO services/
    )
  })

  test('4. S3_ENDPOINT pointing to minio is strictly refused in production', () => {
    const badConfig = { ...baseProdConfig, S3_ENDPOINT: 'http://minio:9000' }
    assert.throws(
      () => validateConfig(badConfig),
      /Production S3_ENDPOINT must NOT point to local\/MinIO services/
    )
  })

  test('5. S3_MOCK is strictly refused in production', () => {
    const badConfig = { ...baseProdConfig, S3_MOCK: 'true' }
    assert.throws(
      () => validateConfig(badConfig),
      /S3_MOCK is strictly forbidden in production/
    )
  })

  test('6. Missing S3_BUCKET is refused in production', () => {
    const badConfig = { ...baseProdConfig }
    delete badConfig.S3_BUCKET
    assert.throws(
      () => validateConfig(badConfig),
      /S3_BUCKET must be configured in production/
    )
  })

  test('7. Missing AWS_REGION is refused in production', () => {
    const badConfig = { ...baseProdConfig }
    delete badConfig.AWS_REGION
    assert.throws(
      () => validateConfig(badConfig),
      /AWS_REGION must be configured in production/
    )
  })

  test('8. preflight-env rejects S3_ENDPOINT pointing to localhost/127.0.0.1 in production', () => {
    const envFile = createEnvFile({ ...baseProdConfig, S3_ENDPOINT: 'http://127.0.0.1:9000' })
    const result = preflightEnv(envFile, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('Production S3_ENDPOINT must NOT point to local/MinIO services')))
  })

  test('9. preflight-env rejects S3_MOCK in production', () => {
    const envFile = createEnvFile({ ...baseProdConfig, S3_MOCK: 'true' })
    const result = preflightEnv(envFile, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('S3_MOCK is strictly forbidden in production')))
  })

  test('10. preflight-env requires S3_BUCKET and AWS_REGION in production', () => {
    const cfg = { ...baseProdConfig }
    delete cfg.S3_BUCKET
    delete cfg.AWS_REGION
    const envFile = createEnvFile(cfg)
    const result = preflightEnv(envFile, { isProduction: true })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('Missing required variable: S3_BUCKET')))
    assert.ok(result.errors.some(e => e.includes('Missing required variable: AWS_REGION')))
  })
})
