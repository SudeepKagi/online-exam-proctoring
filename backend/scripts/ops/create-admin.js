#!/usr/bin/env node
'use strict'

/**
 * ProctorNet First Admin Account Creation Script
 *
 * Usage:
 *   node scripts/ops/create-admin.js [--email admin@institution.edu] [--password <secret>] [--name "Admin Name"] [--force]
 *
 * Requirements:
 *   - Refuses to run if any ADMIN account already exists in the database unless --force is specified.
 *   - Generates or prompts for a high-entropy password if not provided.
 *   - Displays generated password ONCE on the terminal; never logs it to file or git.
 *   - Sets mustChangePassword: true (profileMetadata) to enforce password change on first login.
 */

require('dotenv').config()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

// Resolve prisma client relative to script location (supporting both host and container contexts)
function resolveBackendModule(subpath) {
  const candidates = [
    path.resolve(__dirname, '../../backend', subpath),
    path.resolve(__dirname, '../..', subpath),
    path.resolve('/app', subpath)
  ]
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e
    }
  }
  return require(path.resolve(__dirname, '../../backend', subpath))
}

const { prisma: defaultPrisma } = resolveBackendModule('src/infra/postgres/client')

function parseArgs(args = process.argv.slice(2)) {
  const flags = {
    email: null,
    password: null,
    name: 'System Administrator',
    force: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--email' && args[i + 1]) {
      flags.email = args[++i]
    } else if (arg === '--password' && args[i + 1]) {
      flags.password = args[++i]
    } else if (arg === '--name' && args[i + 1]) {
      flags.name = args[++i]
    } else if (arg === '--force') {
      flags.force = true
    }
  }

  return flags
}

function generateSecurePassword(length = 20) {
  // Generate high-entropy, terminal-safe alphanumeric + symbol password
  return crypto.randomBytes(length).toString('base64url').slice(0, length)
}

async function createAdmin({
  email = null,
  password = null,
  name = 'System Administrator',
  force = false,
  prismaClient = defaultPrisma
} = {}) {
  const adminEmail = (email || process.env.ADMIN_EMAIL || 'admin@proctornet.com').trim().toLowerCase()
  const adminName = (name || 'System Administrator').trim()

  // 1. Check for existing administrators
  const existingAdmins = await prismaClient.user.count({
    where: { role: 'ADMIN' }
  })

  if (existingAdmins > 0 && !force) {
    const errorMsg = `Refusing to run: ${existingAdmins} administrator account(s) already exist in the database. Use --force to override.`
    const err = new Error(errorMsg)
    err.code = 'ADMIN_EXISTS'
    throw err
  }

  // 2. Generate or use provided password
  const isGenerated = !password && !process.env.ADMIN_PASSWORD
  const plainPassword = password || process.env.ADMIN_PASSWORD || generateSecurePassword(20)

  if (plainPassword.length < 8) {
    throw new Error('Admin password must be at least 8 characters long.')
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(plainPassword, 12)

  // 4. Create or update user
  const user = await prismaClient.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminName,
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      profileMetadata: {
        mustChangePassword: true,
        firstLogin: true,
        updatedVia: 'create-admin.js',
        updatedAt: new Date().toISOString()
      }
    },
    create: {
      email: adminEmail,
      fullName: adminName,
      role: 'ADMIN',
      status: 'ACTIVE',
      institutionId: 'INST-ADMIN-01',
      passwordHash,
      profileMetadata: {
        mustChangePassword: true,
        firstLogin: true,
        createdVia: 'create-admin.js',
        createdAt: new Date().toISOString()
      }
    }
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      profileMetadata: user.profileMetadata
    },
    plainPassword,
    isGenerated
  }
}

async function main() {
  const options = parseArgs()

  try {
    const result = await createAdmin(options)

    console.log('\n' + '='.repeat(70))
    console.log(' PROCTORNET ADMINISTRATOR INITIALIZATION')
    console.log('='.repeat(70))
    console.log(` Administrator ID   : ${result.user.id}`)
    console.log(` Administrator Name : ${result.user.fullName}`)
    console.log(` Administrator Email: ${result.user.email}`)
    console.log(` Status             : ${result.user.status}`)
    console.log(` Role               : ${result.user.role}`)
    console.log('-'.repeat(70))
    console.log(` Temporary Password : ${result.plainPassword}`)
    console.log('-'.repeat(70))
    console.log(' SECURITY NOTICE:')
    console.log(' • Store this temporary password in a secure password manager immediately.')
    console.log(' • This password is shown ONCE in terminal output and is NEVER logged to disk.')
    console.log(' • Forced password change at first login is ENFORCED (mustChangePassword: true).')
    console.log('='.repeat(70) + '\n')

    process.exit(0)
  } catch (err) {
    console.error('\n[FATAL ERROR]', err.message)
    if (err.code === 'ADMIN_EXISTS') {
      console.error('To reset or add an admin account regardless of existing admins, pass: --force\n')
    }
    process.exit(1)
  } finally {
    await defaultPrisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  createAdmin,
  generateSecurePassword,
  parseArgs
}
