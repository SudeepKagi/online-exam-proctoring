#!/usr/bin/env node
'use strict'

/**
 * ProctorNet Admin Bootstrap & Credential Rotation Tool (§Prompt 7 T3.6)
 *
 * Usage:
 *   node scripts/ops/bootstrap-admin.js --email admin@example.com [--name "Admin Name"] [--rotate]
 *
 * Guarantees:
 * 1. Generates cryptographically secure 20-character random one-time password.
 * 2. Hashes using bcrypt with cost configured from config.bcryptRounds.
 * 3. Enforces mustChangePassword = true.
 * 4. Prints generated password ONCE to stdout; never logs or persists plaintext password.
 */

require('dotenv').config()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const config = require('../../src/shared/config')

function generateSecurePassword(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+'
  const randomBytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length]
  }
  return result
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    email: null,
    name: 'System Administrator',
    rotate: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--email' && argv[i + 1]) args.email = argv[++i]
    else if (arg === '--name' && argv[i + 1]) args.name = argv[++i]
    else if (arg === '--rotate') args.rotate = true
  }

  return args
}

async function main() {
  const args = parseArgs()

  if (!args.email) {
    console.error('Usage: node scripts/ops/bootstrap-admin.js --email <email> [--name <name>] [--rotate]')
    process.exit(1)
  }

  const email = args.email.trim().toLowerCase()
  const prisma = new PrismaClient()

  try {
    const existing = await prisma.admin.findUnique({ where: { email } })

    if (existing && !args.rotate) {
      console.error(`Admin with email "${email}" already exists. Pass --rotate to update password.`)
      process.exit(1)
    }

    const plainPassword = generateSecurePassword(20)
    const saltRounds = config.bcryptRounds || 10
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds)

    let adminRecord
    if (existing) {
      adminRecord = await prisma.admin.update({
        where: { email },
        data: {
          password: hashedPassword,
          mustChangePassword: true
        }
      })
      console.log(`\n✓ Rotated credentials for Admin: ${email}`)
    } else {
      adminRecord = await prisma.admin.create({
        data: {
          email,
          name: args.name,
          password: hashedPassword,
          mustChangePassword: true
        }
      })
      console.log(`\n✓ Bootstrapped new Admin: ${email}`)
    }

    console.log('=================================================================')
    console.log('Admin ID:                 ', adminRecord.id)
    console.log('Email:                    ', adminRecord.email)
    console.log('Must Change Password:     ', true)
    console.log('-----------------------------------------------------------------')
    console.log('ONE-TIME GENERATED PASSWORD (PRINTED ONCE — SAVE IMMEDIATELY):')
    console.log(`\n    ${plainPassword}\n`)
    console.log('=================================================================\n')
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[BOOTSTRAP ERROR]', err.message)
    process.exit(1)
  })
}

module.exports = {
  generateSecurePassword,
  parseArgs
}
