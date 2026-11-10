#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/init-env.js
 *
 * Bootstraps a production or staging environment file ON the host machine:
 * 1. Writes target file with mode 0600 (owner read/write only).
 * 2. Generates all Group-A cryptographic secrets using crypto.randomBytes without
 *    ever logging or printing them to stdout.
 * 3. Populates Group-B values from CLI flags or standard defaults.
 * 4. Leaves Group-C cloud variables marked as 'REPLACE_ME'.
 * 5. Runs preflight-env verification and prints ONLY the variable names still missing.
 *
 * Usage:
 *   node scripts/ops/init-env.js [--staging] [--domain <domain>] [--env <path>] [--s3-bucket <name>] [--force]
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { preflightEnv, parseEnvContent } = require('./preflight-env')

function parseArgs(argv = process.argv.slice(2)) {
  const flags = {
    isStaging: false,
    domain: null,
    origin: null,
    s3Bucket: null,
    awsRegion: 'ap-south-1',
    retentionDays: '90',
    sebMode: null,
    targetFile: null,
    force: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--staging') {
      flags.isStaging = true
    } else if (arg === '--force') {
      flags.force = true
    } else if (arg === '--domain' && argv[i + 1]) {
      flags.domain = argv[++i]
    } else if (arg === '--origin' && argv[i + 1]) {
      flags.origin = argv[++i]
    } else if (arg === '--s3-bucket' && argv[i + 1]) {
      flags.s3Bucket = argv[++i]
    } else if (arg === '--aws-region' && argv[i + 1]) {
      flags.awsRegion = argv[++i]
    } else if (arg === '--retention-days' && argv[i + 1]) {
      flags.retentionDays = argv[++i]
    } else if (arg === '--seb-mode' && argv[i + 1]) {
      flags.sebMode = argv[++i]
    } else if ((arg === '--env' || arg === '-o') && argv[i + 1]) {
      flags.targetFile = argv[++i]
    }
  }

  return flags
}

function initEnv(options = {}) {
  const isStaging = Boolean(options.isStaging)
  const defaultDomain = isStaging ? 'staging.proctornet.duckdns.org' : 'proctornet.duckdns.org'
  const domain = options.domain || defaultDomain
  const origin = options.origin || `https://${domain}`
  const dbName = isStaging ? 'proctornet_staging' : 'proctornet'
  const sebMode = options.sebMode || (isStaging ? 'log' : 'enforce')
  const s3Bucket = options.s3Bucket || (isStaging ? 'REPLACE_ME' : 'REPLACE_ME')
  const awsRegion = options.awsRegion || 'ap-south-1'
  const retentionDays = String(options.retentionDays || '90')

  const defaultFileName = isStaging ? '.env.staging' : '.env.production'
  const targetPath = options.targetFile
    ? path.resolve(process.cwd(), options.targetFile)
    : path.resolve(process.cwd(), defaultFileName)

  if (fs.existsSync(targetPath) && !options.force) {
    throw new Error(`Target file already exists: ${targetPath}. Pass --force to overwrite.`)
  }

  // Group A: Cryptographically secure secrets generated directly in memory (never logged)
  const jwtSecret = crypto.randomBytes(32).toString('hex')
  const jwtRefreshSecret = crypto.randomBytes(32).toString('hex')
  const sebLinkSecret = crypto.randomBytes(32).toString('hex')
  const postgresPass = crypto.randomBytes(24).toString('hex')
  const redisPass = crypto.randomBytes(24).toString('hex')
  const rabbitPass = crypto.randomBytes(24).toString('hex')
  const piiEncryptionKey = crypto.randomBytes(32).toString('hex')

  const content = `# ==============================================================================
# ProctorNet ${isStaging ? 'Staging' : 'Production'} Environment Configuration
# Generated automatically by init-env.js on ${new Date().toISOString()}
# Strict permissions: mode 0600 (owner read/write only). Never commit to git.
# ==============================================================================

# Runtime & Server
NODE_ENV=production
PORT=5000

# Canonical Public Identity (Group B)
PUBLIC_HOST=${domain}
SITE_ADDRESS=${domain}
PUBLIC_ORIGIN=${origin}
ALLOWED_ORIGINS=${origin}

# Database Credentials & Connections (Group A generated / Group B decided)
POSTGRES_USER=proctornet
POSTGRES_PASSWORD=${postgresPass}
POSTGRES_DB=${dbName}
DATABASE_URL=postgresql://proctornet:${postgresPass}@postgres:5432/${dbName}?schema=public&connection_limit=30
DIRECT_URL=postgresql://proctornet:${postgresPass}@postgres:5432/${dbName}?schema=public

# Redis L2 Cache & Cluster Pub/Sub (Group A generated)
REDIS_PASSWORD=${redisPass}
REDIS_URL=redis://:${redisPass}@redis:6379

# RabbitMQ Message Broker (Group A generated)
RABBITMQ_DEFAULT_USER=proctornet
RABBITMQ_DEFAULT_PASS=${rabbitPass}
RABBITMQ_URL=amqp://proctornet:${rabbitPass}@rabbitmq:5672

# Application Cryptographic Secrets (Group A generated - 256-bit entropy)
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
SEB_LINK_SECRET=${sebLinkSecret}
PII_ENCRYPTION_KEY=${piiEncryptionKey}

# Operational Policies (Group B decided)
RETENTION_DAYS=${retentionDays}
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
CACHE_DRIVER=redis
QUEUE_DRIVER=postgres
START_WORKERS=true
FACE_DRIVER=off
MEDIA_DRIVER=snapshot

# Safe Exam Browser Settings (Group B decided)
SEB_MODE=${sebMode}
SEB_CONFIG_KEY=
SEB_PRE_DOWNLOAD_MINUTES=30

# AWS S3 Object Storage (Group C from AWS)
S3_BUCKET=${s3Bucket}
AWS_REGION=${awsRegion}
AWS_ACCESS_KEY_ID=REPLACE_ME_OR_USE_IAM_ROLE
AWS_SECRET_ACCESS_KEY=REPLACE_ME_OR_USE_IAM_ROLE
`

  // Write with mode 0600
  fs.writeFileSync(targetPath, content, { mode: 0o600, encoding: 'utf8' })
  try {
    fs.chmodSync(targetPath, 0o600)
  } catch (_) {
    // Graceful on file systems that do not support POSIX chmod (e.g. Windows non-NTFS)
  }

  // Parse and audit missing variables
  const parsed = parseEnvContent(content)
  const missingVars = []
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val === 'string' && val.startsWith('REPLACE_ME')) {
      missingVars.push(key)
    }
  }

  // Execute preflight check
  const preflight = preflightEnv(targetPath, { isProduction: !isStaging })

  return {
    targetPath,
    isStaging,
    missingVars,
    preflightValid: preflight.valid,
    preflightErrors: preflight.errors,
    envCount: Object.keys(parsed).length
  }
}

function runCli() {
  const flags = parseArgs()

  try {
    const result = initEnv(flags)

    console.log('\n==========================================================')
    console.log(' ProctorNet Host Environment Initializer')
    console.log(' Target File: ' + result.targetPath)
    console.log(' Mode:        ' + (result.isStaging ? 'STAGING' : 'PRODUCTION'))
    console.log(' Permissions: 0600 (Owner Read/Write)')
    console.log('==========================================================\n')

    console.log('[✓] Environment file created with mode 0600.')
    console.log('[✓] Generated 7 cryptographically secure secrets (never displayed in terminal).')

    if (result.missingVars.length > 0) {
      console.log('\n[!] ACTION REQUIRED: The following cloud/external variables require your values:')
      for (const varName of result.missingVars) {
        console.log(`    - ${varName}`)
      }
    } else {
      console.log('\n[✓] All required production variables are populated.')
    }

    if (!result.preflightValid) {
      const actionableErrors = result.preflightErrors.filter(e => !e.includes('REPLACE_ME'))
      if (actionableErrors.length > 0) {
        console.warn('\n[!] Preflight warnings/errors detected:')
        for (const err of actionableErrors) {
          console.warn(`    [-] ${err}`)
        }
      }
    } else {
      console.log('[✓] Preflight environment validation passed.')
    }

    console.log('\nInitialization complete.\n')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Initialization failed: ' + err.message + '\n')
    process.exit(1)
  }
}

if (require.main === module) {
  runCli()
}

module.exports = {
  initEnv,
  parseArgs
}

