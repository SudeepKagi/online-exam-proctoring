'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const { initEnv, parseArgs } = require('../../scripts/ops/init-env')
const { parseEnvContent } = require('../../scripts/ops/preflight-env')

describe('Host Environment Initializer Invariants (scripts/ops/init-env.js)', () => {
  const tmpDir = path.join(os.tmpdir(), `pn-init-env-test-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  function getTempTarget(prefix = 'env') {
    return path.join(tmpDir, `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`)
  }

  test('1. parseArgs correctly parses flags', () => {
    const flags = parseArgs([
      '--staging',
      '--domain', 'exam.test.edu',
      '--origin', 'https://exam.test.edu',
      '--s3-bucket', 'test-bucket-proctornet',
      '--aws-region', 'us-east-1',
      '--retention-days', '60',
      '--seb-mode', 'off',
      '--env', 'custom.env',
      '--force'
    ])

    assert.strictEqual(flags.isStaging, true)
    assert.strictEqual(flags.domain, 'exam.test.edu')
    assert.strictEqual(flags.origin, 'https://exam.test.edu')
    assert.strictEqual(flags.s3Bucket, 'test-bucket-proctornet')
    assert.strictEqual(flags.awsRegion, 'us-east-1')
    assert.strictEqual(flags.retentionDays, '60')
    assert.strictEqual(flags.sebMode, 'off')
    assert.strictEqual(flags.targetFile, 'custom.env')
    assert.strictEqual(flags.force, true)
  })

  test('2. initEnv generates production file with 7 distinct high-entropy secrets', () => {
    const targetFile = getTempTarget('prod')
    const result = initEnv({
      targetFile,
      force: true
    })

    assert.strictEqual(result.isStaging, false)
    assert.ok(fs.existsSync(targetFile))

    const raw = fs.readFileSync(targetFile, 'utf8')
    const env = parseEnvContent(raw)

    // Check 7 secrets
    const secrets = [
      env.JWT_SECRET,
      env.JWT_REFRESH_SECRET,
      env.SEB_LINK_SECRET,
      env.POSTGRES_PASSWORD,
      env.REDIS_PASSWORD,
      env.RABBITMQ_DEFAULT_PASS,
      env.PII_ENCRYPTION_KEY
    ]

    for (const secret of secrets) {
      assert.ok(secret, 'Secret must be defined')
      assert.ok(secret.length >= 32, `Secret length must be at least 32, got ${secret.length}`)
      assert.ok(!secret.includes('REPLACE_ME'), 'Generated secrets must not be placeholder')
      assert.ok(!secret.includes('default'), 'Generated secrets must not be default values')
    }

    // Ensure all secrets are distinct
    const uniqueSecrets = new Set(secrets)
    assert.strictEqual(uniqueSecrets.size, secrets.length, 'All generated secrets must be distinct')

    // Check database and connection strings
    assert.strictEqual(env.NODE_ENV, 'production')
    assert.strictEqual(env.POSTGRES_DB, 'proctornet')
    assert.ok(env.DATABASE_URL.includes(env.POSTGRES_PASSWORD))
    assert.ok(env.REDIS_URL.includes(env.REDIS_PASSWORD))
    assert.ok(env.RABBITMQ_URL.includes(env.RABBITMQ_DEFAULT_PASS))
  })

  test('3. initEnv staging configuration sets staging defaults and flags', () => {
    const targetFile = getTempTarget('staging')
    const result = initEnv({
      isStaging: true,
      targetFile,
      force: true
    })

    assert.strictEqual(result.isStaging, true)
    const raw = fs.readFileSync(targetFile, 'utf8')
    const env = parseEnvContent(raw)

    assert.strictEqual(env.POSTGRES_DB, 'proctornet_staging')
    assert.strictEqual(env.SEB_MODE, 'log')
    assert.strictEqual(env.PUBLIC_HOST, 'staging.proctornet.duckdns.org')
    assert.strictEqual(env.PUBLIC_ORIGIN, 'https://staging.proctornet.duckdns.org')
  })

  test('4. initEnv accurately tracks REPLACE_ME external cloud variables', () => {
    const targetFile = getTempTarget('missing')
    const result = initEnv({
      targetFile,
      force: true
    })

    assert.ok(result.missingVars.includes('S3_BUCKET'))
    assert.ok(result.missingVars.includes('AWS_ACCESS_KEY_ID'))
    assert.ok(result.missingVars.includes('AWS_SECRET_ACCESS_KEY'))
    assert.ok(!result.missingVars.includes('JWT_SECRET'), 'JWT_SECRET must be generated, not missing')
  })

  test('5. initEnv custom parameters override defaults cleanly', () => {
    const targetFile = getTempTarget('override')
    initEnv({
      targetFile,
      domain: 'proctor.college.edu',
      origin: 'https://proctor.college.edu',
      s3Bucket: 'college-exam-vault',
      awsRegion: 'eu-west-1',
      retentionDays: '120',
      sebMode: 'off',
      force: true
    })

    const raw = fs.readFileSync(targetFile, 'utf8')
    const env = parseEnvContent(raw)

    assert.strictEqual(env.PUBLIC_HOST, 'proctor.college.edu')
    assert.strictEqual(env.SITE_ADDRESS, 'proctor.college.edu')
    assert.strictEqual(env.PUBLIC_ORIGIN, 'https://proctor.college.edu')
    assert.strictEqual(env.S3_BUCKET, 'college-exam-vault')
    assert.strictEqual(env.AWS_REGION, 'eu-west-1')
    assert.strictEqual(env.RETENTION_DAYS, '120')
    assert.strictEqual(env.SEB_MODE, 'off')
  })

  test('6. initEnv refuses to overwrite an existing file unless force: true', () => {
    const targetFile = getTempTarget('no-overwrite')
    fs.writeFileSync(targetFile, 'EXISTING_CONTENT=1\n', 'utf8')

    assert.throws(
      () => initEnv({ targetFile, force: false }),
      /Target file already exists/
    )

    // With force: true, succeeds
    const result = initEnv({ targetFile, force: true })
    assert.strictEqual(result.targetPath, targetFile)
  })

  test('7. CLI execution runs cleanly without leaking secrets to stdout/stderr', () => {
    const targetFile = getTempTarget('cli')
    const scriptPath = path.resolve(__dirname, '../../scripts/ops/init-env.js')

    const stdout = execFileSync('node', [
      scriptPath,
      '--staging',
      '--env', targetFile,
      '--s3-bucket', 'staging-bucket-test',
      '--force'
    ], { encoding: 'utf8' })

    assert.ok(fs.existsSync(targetFile))
    const raw = fs.readFileSync(targetFile, 'utf8')
    const env = parseEnvContent(raw)

    // Verify stdout does NOT contain any secret value
    assert.ok(!stdout.includes(env.JWT_SECRET), 'stdout must never print JWT_SECRET')
    assert.ok(!stdout.includes(env.JWT_REFRESH_SECRET), 'stdout must never print JWT_REFRESH_SECRET')
    assert.ok(!stdout.includes(env.SEB_LINK_SECRET), 'stdout must never print SEB_LINK_SECRET')
    assert.ok(!stdout.includes(env.POSTGRES_PASSWORD), 'stdout must never print POSTGRES_PASSWORD')
    assert.ok(!stdout.includes(env.REDIS_PASSWORD), 'stdout must never print REDIS_PASSWORD')
    assert.ok(!stdout.includes(env.RABBITMQ_DEFAULT_PASS), 'stdout must never print RABBITMQ_DEFAULT_PASS')
    assert.ok(!stdout.includes(env.PII_ENCRYPTION_KEY), 'stdout must never print PII_ENCRYPTION_KEY')

    assert.ok(stdout.includes('Environment file created with mode 0600'))
    assert.ok(stdout.includes('Generated 7 cryptographically secure secrets'))
  })
})

