'use strict'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const bcrypt = require('bcryptjs')
const path = require('path')

const { prisma } = require('../src/infra/postgres/client')
const { assertSeedAllowed } = require('../src/infra/postgres/assertNonProduction')
const { createAdmin, generateSecurePassword } = require('../../scripts/ops/create-admin')

describe('Admin Creation & Seed Safety Guards (DoD §Task 3)', () => {
  const originalEnv = { ...process.env }
  const testAdminEmail = 'test-ops-admin@proctornet-test.edu'

  beforeEach(() => {
    // Restore env before each test
    process.env = { ...originalEnv }
    process.env.ALLOW_CONFIG_THROW_FOR_TEST = 'true'
  })

  after(async () => {
    process.env = originalEnv
    // Clean up test admin account if created
    await prisma.user.deleteMany({
      where: { email: { in: [testAdminEmail, 'admin@proctornet.com'] } }
    }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('1. Test Seed Safety Guard (assertSeedAllowed)', () => {
    it('refuses to run when NODE_ENV=production even if database name is safe', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_URL = 'postgresql://proctornet:secret@localhost:5432/proctornet_test?schema=public'

      assert.throws(() => {
        assertSeedAllowed('prisma/seed/admin.js')
      }, /refused to run.*NODE_ENV is set to "production"/i)
    })

    it('refuses to run when database name does not end in _test, _pilot or _dev', () => {
      process.env.NODE_ENV = 'development'
      // Production database name
      process.env.DATABASE_URL = 'postgresql://proctornet:secret@localhost:5432/proctornet?schema=public'

      assert.throws(() => {
        assertSeedAllowed('prisma/seed/admin.js')
      }, /refused to run.*does not end in _test, _pilot, or _dev/i)

      // Another unsafe database name
      process.env.DATABASE_URL = 'postgresql://proctornet:secret@db.company.com:5432/production_live?schema=public'

      assert.throws(() => {
        assertSeedAllowed('prisma/seed/admin.js')
      }, /refused to run.*does not end in _test, _pilot, or _dev/i)
    })

    it('allows execution when database ends in _test, _pilot, or _dev in non-production mode', () => {
      process.env.NODE_ENV = 'test'
      process.env.DATABASE_URL = 'postgresql://proctornet:secret@localhost:5432/proctornet_e2e_test?schema=public'
      assert.strictEqual(assertSeedAllowed('prisma/seed/admin.js'), true)

      process.env.DATABASE_URL = 'postgresql://proctornet:secret@localhost:5432/proctornet_pilot?schema=public'
      assert.strictEqual(assertSeedAllowed('prisma/seed/admin.js'), true)

      process.env.NODE_ENV = 'development'
      process.env.DATABASE_URL = 'postgresql://proctornet:secret@localhost:5432/proctornet_dev?schema=public'
      assert.strictEqual(assertSeedAllowed('prisma/seed/admin.js'), true)
    })
  })

  describe('2. Admin Account Initialization (create-admin.js)', () => {
    it('generates high-entropy passwords of specified length', () => {
      const pwd20 = generateSecurePassword(20)
      assert.strictEqual(pwd20.length, 20)

      const pwd32 = generateSecurePassword(32)
      assert.strictEqual(pwd32.length, 32)
    })

    it('refuses to run without --force if an admin user already exists', async () => {
      // Ensure at least one admin exists in DB
      await prisma.user.upsert({
        where: { email: testAdminEmail },
        update: { role: 'ADMIN' },
        create: {
          email: testAdminEmail,
          fullName: 'Existing Test Administrator',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: await bcrypt.hash('ExistingPassword@123', 10)
        }
      })

      // Attempt createAdmin without force
      await assert.rejects(
        async () => {
          await createAdmin({
            email: 'another-admin@proctornet-test.edu',
            force: false,
            prismaClient: prisma
          })
        },
        (err) => {
          assert.strictEqual(err.code, 'ADMIN_EXISTS')
          assert.ok(err.message.includes('administrator account(s) already exist'))
          return true
        }
      )
    })

    it('creates or resets admin when --force is specified, enforcing mustChangePassword: true', async () => {
      const explicitPassword = 'TempAdminPassword@2026!'
      const result = await createAdmin({
        email: testAdminEmail,
        password: explicitPassword,
        name: 'Force-Created Administrator',
        force: true,
        prismaClient: prisma
      })

      assert.strictEqual(result.user.email, testAdminEmail)
      assert.strictEqual(result.user.fullName, 'Force-Created Administrator')
      assert.strictEqual(result.user.role, 'ADMIN')
      assert.strictEqual(result.user.status, 'ACTIVE')
      assert.strictEqual(result.plainPassword, explicitPassword)
      assert.strictEqual(result.user.profileMetadata.mustChangePassword, true)

      // Verify database record has valid bcrypt hash that matches the temporary password
      const dbUser = await prisma.user.findUnique({
        where: { email: testAdminEmail }
      })
      assert.ok(dbUser)
      const isMatch = await bcrypt.compare(explicitPassword, dbUser.passwordHash)
      assert.strictEqual(isMatch, true, 'Stored bcrypt hash must match generated plain password')
      assert.strictEqual(dbUser.profileMetadata?.mustChangePassword, true)
    })

    it('auto-generates a secure password and sets mustChangePassword: true when password is omitted', async () => {
      const result = await createAdmin({
        email: testAdminEmail,
        force: true,
        prismaClient: prisma
      })

      assert.ok(result.plainPassword)
      assert.ok(result.plainPassword.length >= 20, 'Generated password must be at least 20 chars')
      assert.strictEqual(result.isGenerated, true)
      assert.strictEqual(result.user.profileMetadata.mustChangePassword, true)

      // Verify db password matches generated password
      const dbUser = await prisma.user.findUnique({
        where: { email: testAdminEmail }
      })
      const isMatch = await bcrypt.compare(result.plainPassword, dbUser.passwordHash)
      assert.strictEqual(isMatch, true)
    })
  })
})
