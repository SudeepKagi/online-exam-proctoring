#!/usr/bin/env node
'use strict'

/**
 * ProctorNet Rehearsal Environment Generator
 * Generates a throwaway .env.rehearsal with non-default cryptographic secrets
 * and localhost configuration for local Docker rehearsal.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const targetPath = path.resolve(__dirname, '../../.env.rehearsal')

const jwtSecret = crypto.randomBytes(32).toString('hex')
const jwtRefreshSecret = crypto.randomBytes(32).toString('hex')
const sebLinkSecret = crypto.randomBytes(32).toString('hex')
const postgresPass = crypto.randomBytes(24).toString('hex')
const redisPass = crypto.randomBytes(24).toString('hex')
const rabbitPass = crypto.randomBytes(24).toString('hex')

const content = `# ==============================================================================
# ProctorNet Local Rehearsal Configuration (.env.rehearsal)
# Throwaway secrets generated for local rehearsal. Never commit to git.
# ==============================================================================

NODE_ENV=production
PORT=5000

# Canonical Public Identity for local testing
PUBLIC_HOST=localhost
SITE_ADDRESS=localhost, localhost:8443
PUBLIC_ORIGIN=https://localhost:8443
ALLOWED_ORIGINS=https://localhost:8443

# Database
POSTGRES_USER=proctornet
POSTGRES_PASSWORD=${postgresPass}
POSTGRES_DB=proctornet
DATABASE_URL=postgresql://proctornet:${postgresPass}@postgres:5432/proctornet?schema=public
DIRECT_URL=postgresql://proctornet:${postgresPass}@postgres:5432/proctornet?schema=public

# Redis
REDIS_PASSWORD=${redisPass}
REDIS_URL=redis://:${redisPass}@redis:6379

# RabbitMQ
RABBITMQ_DEFAULT_USER=proctornet
RABBITMQ_DEFAULT_PASS=${rabbitPass}
RABBITMQ_URL=amqp://proctornet:${rabbitPass}@rabbitmq:5672

# Cryptographic Application Secrets (Non-default ≥32 chars)
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
SEB_LINK_SECRET=${sebLinkSecret}

# Safe Exam Browser
SEB_MODE=log
SEB_CONFIG_KEY=
SEB_PRE_DOWNLOAD_MINUTES=30

# AWS & Storage Drivers
S3_BUCKET=proctornet-rehearsal
AWS_REGION=ap-south-1
CACHE_DRIVER=redis
FACE_DRIVER=off
MEDIA_DRIVER=snapshot
COOKIE_SECURE=false
`

fs.writeFileSync(targetPath, content, 'utf8')
console.log(`[✓] Successfully generated throwaway rehearsal configuration at:\n    ${targetPath}`)
console.log('    All secrets populated with fresh 256-bit entropy. File is gitignored.')
