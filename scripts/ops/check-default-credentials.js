#!/usr/bin/env node
'use strict'

/**
 * check-default-credentials.js
 * Read-only security audit script for production and staging environments (Â§P9 F5).
 * Validates that no administrator accounts are using known default passwords.
 *
 * Exit code 0: Clean (no default credentials detected)
 * Exit code 1: Violation (at least one admin matches a known default password)
 */

const path = require('path')
const REPO_ROOT = path.resolve(__dirname, '../..')
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend')
if (!process.env.NODE_PATH) {
  process.env.NODE_PATH = `${path.join(BACKEND_ROOT, 'node_modules')}${path.delimiter}${path.join(REPO_ROOT, 'node_modules')}`
  require('module').Module._initPaths()
}

try {
  require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') })
} catch {
  // Ignore if dotenv is unavailable
}

let bcrypt
try {
  bcrypt = require('bcryptjs')
} catch {
  try {
    bcrypt = require('bcrypt')
  } catch {
    bcrypt = require(path.join(BACKEND_ROOT, 'node_modules/bcryptjs'))
  }
}

const { prisma } = require(path.join(BACKEND_ROOT, 'src/infra/postgres/client'))

const KNOWN_DEFAULT_PASSWORDS = [
  'Admin@123',
  'Admin@12345',
  'Faculty@123',
  'Student@123',
  'admin',
  'admin123',
  'password',
  'proctornet',
  'proctornet123'
]

async function checkAdminCredentials() {
  console.log('[SECURITY AUDIT] Checking administrator accounts for default credentials...')

  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        mustChangePassword: true
      }
    })

    if (!admins || admins.length === 0) {
      console.warn('[SECURITY AUDIT] Warning: No administrator accounts found in database.')
      return 0
    }

    let violations = 0

    for (const admin of admins) {
      let isDefault = false
      for (const candidate of KNOWN_DEFAULT_PASSWORDS) {
        const matches = await bcrypt.compare(candidate, admin.password)
        if (matches) {
          console.error(`[SECURITY VIOLATION] Admin account '${admin.email}' is using known default password: '${candidate}'!`)
          isDefault = true
          violations++
          break
        }
      }

      if (!isDefault) {
        console.log(`[PASS] Admin account '${admin.email}' uses a custom secure password.`)
      }
    }

    const isWarnOnly = process.argv.includes('--warn-only') || process.env.ALLOW_DEFAULT_CREDENTIALS === 'true'
    if (violations > 0) {
      console.error(`\n[ACTION REQUIRED] Found ${violations} administrator account(s) with known default credentials!`)
      if (isWarnOnly) {
        console.warn('[SECURITY AUDIT] --warn-only flag specified; continuing with exit code 0.')
        return 0
      }
      console.error('Rotate the password immediately via SSM: node scripts/ops/rotate-admin-password.js\n')
      return 1
    }

    console.log(`\n[PASS] All ${admins.length} administrator account(s) verified clean. No default credentials detected.\n`)
    return 0
  } catch (err) {
    console.error('[SECURITY AUDIT] Error executing credential check:', err.message)
    return 1
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) {
  checkAdminCredentials()
    .then((exitCode) => {
      process.exit(exitCode)
    })
    .catch((err) => {
      console.error('[FATAL] Unhandled audit error:', err)
      process.exit(1)
    })
}

module.exports = {
  checkAdminCredentials,
  KNOWN_DEFAULT_PASSWORDS
}

