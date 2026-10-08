/**
 * validateConfig.js
 * Boot-time configuration validation for ProctorNet (Phase S2 / Appendix A).
 * Enforces production invariants, rejects known default secrets, and normalizes environment variables.
 */

const { z } = require('zod')

const KNOWN_DEFAULTS = new Set([
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

// Normalize S3 environment variable names across the codebase
if (!process.env.S3_BUCKET && process.env.AWS_S3_BUCKET) {
  process.env.S3_BUCKET = process.env.AWS_S3_BUCKET
}
if (!process.env.AWS_S3_BUCKET && process.env.S3_BUCKET) {
  process.env.AWS_S3_BUCKET = process.env.S3_BUCKET
}

const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long').refine(
    val => !KNOWN_DEFAULTS.has(val.trim()),
    'JWT_SECRET matches a known insecure default and is forbidden in production'
  ),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  AWS_REGION: z.string().min(3, 'AWS_REGION is required').default('ap-south-1'),
  S3_BUCKET: z.string().min(3, 'S3_BUCKET is required'),
  COOKIE_SECURE: isProd
    ? z.literal('true', { errorMap: () => ({ message: 'COOKIE_SECURE must be explicitly "true" in production behind HTTPS' }) })
    : z.string().optional(),
  FACE_DRIVER: z.enum(['rekognition', 'onnx', 'off']).default('off'),
  MEDIA_DRIVER: z.enum(['snapshot', 'livekit', 'livekit-selfhost', 'livekit-cloud']).default('snapshot'),
  QUEUE_DRIVER: z.enum(['postgres', 'rabbitmq']).default('postgres'),
  CACHE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
  AGENT_PAIRING_PEPPER: isProd
    ? z.string().min(32, 'AGENT_PAIRING_PEPPER must be at least 32 characters in production')
    : z.string().optional(),
  AGENT_POLICY_SIGNING_KEY: isProd
    ? z.string().min(32, 'AGENT_POLICY_SIGNING_KEY must be at least 32 characters in production')
    : z.string().optional(),
  ALLOW_SELF_REGISTRATION: isProd
    ? z.literal('false', { errorMap: () => ({ message: 'ALLOW_SELF_REGISTRATION must be "false" in production (single admin model)' }) }).default('false')
    : z.string().default('false')
})

function validateConfig() {
  if (isTest) {
    // In automated unit tests, provide fallback test secret if unset
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!'
    }
    if (!process.env.S3_BUCKET) {
      process.env.S3_BUCKET = 'proctornet-test-bucket'
      process.env.AWS_S3_BUCKET = 'proctornet-test-bucket'
    }
  }

  const result = configSchema.safeParse(process.env)
  if (!result.success) {
    console.error('\n==========================================================')
    console.error(' FATAL: Boot-Time Configuration Validation Failed')
    console.error('==========================================================')
    result.error.issues.forEach(issue => {
      console.error(` [-] ${issue.path.join('.') || 'CONFIG'}: ${issue.message}`)
    })
    console.error('==========================================================\n')

    if (isProd) {
      console.error('Refusing to start application in production with invalid configuration. Exiting.')
      process.exit(1)
    } else {
      console.warn('WARNING: Running with configuration warnings in non-production environment.')
    }
  }

  return result.data
}

module.exports = {
  validateConfig,
  KNOWN_DEFAULTS
}

if (require.main === module) {
  try {
    validateConfig()
    console.log('Configuration validation passed.')
    process.exit(0)
  } catch (err) {
    console.error('Configuration validation failed:', err.message)
    process.exit(1)
  }
}
