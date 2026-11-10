/**
 * validateConfig.js
 * Boot-time configuration validation for ProctorNet (Phase S2 / Appendix A).
 * Enforces production invariants, rejects known default secrets, and normalizes environment variables.
 */

const { z } = require('zod')

const KNOWN_DEFAULTS = new Set([
  'proctornet_super_secret_jwt_key_local_development_fallback_2026',
  'supersecret_jwt_proctornet_production_key_32bytes',
  'supersecret_jwt_refresh_proctornet_key_32bytes',
  'dev_seb_link_secret_at_least_32_characters_long_for_hmac',
  'ci_throwaway_jwt_secret_at_least_32_characters_long_01',
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

// Canonical S3 bucket name (§Prompt 7 T4)
if (!process.env.S3_BUCKET && process.env.S3_BUCKET_NAME) {
  process.env.S3_BUCKET = process.env.S3_BUCKET_NAME
}
if (!process.env.S3_BUCKET && process.env.AWS_S3_BUCKET) {
  process.env.S3_BUCKET = process.env.AWS_S3_BUCKET
}
if (!process.env.S3_BUCKET) {
  process.env.S3_BUCKET = 'proctornet-evidence'
}

function normalizePublicOrigin(val) {
  if (!val) {
    return 'http://localhost:5000'
  }
  const str = String(val).trim()
  let u
  try {
    u = new URL(str)
  } catch (err) {
    throw new Error(`PUBLIC_ORIGIN must be a valid absolute URL (bare origin): "${str}"`, { cause: err })
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`PUBLIC_ORIGIN protocol must be http: or https:. Received: "${u.protocol}"`)
  }
  if (u.pathname && u.pathname !== '/') {
    throw new Error(`PUBLIC_ORIGIN must be a bare origin with no path. Received pathname: "${u.pathname}"`)
  }
  if (u.search) {
    throw new Error(`PUBLIC_ORIGIN must not contain query parameters. Received: "${u.search}"`)
  }
  if (u.hash) {
    throw new Error(`PUBLIC_ORIGIN must not contain a fragment/hash. Received: "${u.hash}"`)
  }
  return u.origin
}

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  PUBLIC_ORIGIN: z
    .string()
    .optional()
    .default('http://localhost:5000')
    .refine((val) => {
      try {
        normalizePublicOrigin(val)
        return true
      } catch {
        return false
      }
    }, 'PUBLIC_ORIGIN must be a bare origin (no path, query, or fragment) normalized by URL class')
    .transform((val) => normalizePublicOrigin(val)),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long').refine(
    val => !KNOWN_DEFAULTS.has(val.trim()),
    'JWT_SECRET matches a known insecure default and is forbidden in production'
  ),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long').refine(
    val => !KNOWN_DEFAULTS.has(val.trim()),
    'JWT_REFRESH_SECRET matches a known insecure default'
  ).optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  AWS_REGION: z.string().min(3, 'AWS_REGION is required').default('ap-south-1'),
  S3_BUCKET: z.string().min(3, 'S3_BUCKET is required').default('proctornet-evidence'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  FACE_DRIVER: z.enum(['rekognition', 'onnx', 'off', 'test']).default('off'),
  MEDIA_DRIVER: z.enum(['snapshot']).default('snapshot'),
  CACHE_DRIVER: z.enum(['memory', 'redis']).default('redis'),
  SEB_MODE: z.string().optional().default('off').transform(v => (v || 'off').toLowerCase()).pipe(z.enum(['off', 'log', 'enforce'])),
  SEB_CONFIG_KEY: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, 'SEB_CONFIG_KEY must be a 64-character hex string')
    .optional()
    .or(z.literal('')),
  SEB_LINK_SECRET: z
    .string()
    .min(32, 'SEB_LINK_SECRET must be at least 32 characters long')
    .refine(val => !KNOWN_DEFAULTS.has(val.trim()), 'SEB_LINK_SECRET matches a known insecure default')
    .optional(),
  SEB_PRE_DOWNLOAD_MINUTES: z.coerce.number().default(30)
})

function validateConfig() {
  const isProd = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest) {
    // In automated unit tests, provide fallback test secret if unset
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!'
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      process.env.JWT_REFRESH_SECRET = 'test_suite_jwt_refresh_secret_at_least_32_chars!'
    }
    if (!process.env.S3_BUCKET) {
      process.env.S3_BUCKET = 'proctornet-test-bucket'
      process.env.AWS_S3_BUCKET = 'proctornet-test-bucket'
    }
    if (!process.env.SEB_LINK_SECRET) {
      process.env.SEB_LINK_SECRET = 'test_suite_seb_link_secret_at_least_32_characters_long_for_hmac!'
    }
  }

  if (isProd) {
    const requiredProdSecrets = [
      { name: 'JWT_SECRET', val: process.env.JWT_SECRET },
      { name: 'JWT_REFRESH_SECRET', val: process.env.JWT_REFRESH_SECRET },
      { name: 'SEB_LINK_SECRET', val: process.env.SEB_LINK_SECRET }
    ]

    for (const { name, val } of requiredProdSecrets) {
      const trimmed = (val || '').trim()
      if (!trimmed) {
        console.error(`Refusing to start application in production: ${name} must be set.`)
        if (process.env.ALLOW_CONFIG_THROW_FOR_TEST) {
          throw new Error(`Refusing to start application in production: ${name} must be set.`)
        }
        process.exit(1)
      }
      if (trimmed.length < 32) {
        console.error(`Refusing to start application in production: ${name} must be at least 32 characters long.`)
        if (process.env.ALLOW_CONFIG_THROW_FOR_TEST) {
          throw new Error(`Refusing to start application in production: ${name} must be at least 32 characters long.`)
        }
        process.exit(1)
      }
      if (KNOWN_DEFAULTS.has(trimmed)) {
        console.error(`Refusing to start application in production: ${name} matches a known default and is forbidden.`)
        if (process.env.ALLOW_CONFIG_THROW_FOR_TEST) {
          throw new Error(`Refusing to start application in production: ${name} matches a known default and is forbidden.`)
        }
        process.exit(1)
      }
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

    const hasSebOrOriginError = result.error.issues.some(
      issue => issue.path.includes('SEB_MODE') || issue.path.includes('SEB_CONFIG_KEY') || issue.path.includes('PUBLIC_ORIGIN')
    )

    if (isProd || hasSebOrOriginError) {
      console.error('Refusing to start application in production or with invalid SEB/Origin configuration. Exiting.')
      throw new Error(
        `Boot-Time Configuration Validation Failed: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      )
    } else {
      console.warn('WARNING: Running with configuration warnings in non-production environment.')
    }
  }

  return result.data
}

module.exports = {
  validateConfig,
  normalizePublicOrigin,
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
