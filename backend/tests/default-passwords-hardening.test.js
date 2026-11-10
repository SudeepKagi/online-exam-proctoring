'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const ExcelJS = require('exceljs')

const { prisma } = require('../src/infra/postgres/client')
const { usersService } = require('../src/modules/users/users.service')
const { authService } = require('../src/modules/auth/auth.service')
const { parseExcelBuffer } = require('../src/modules/users/users.excel')

describe('Default Passwords Removal & One-Time Password Enforcement Suite', () => {
  const createdUserIds = []

  after(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } }
      }).catch(() => {})
    }
  })

  it('1. createUser with no password generates unique random one-time password and forces PENDING_SETUP for student', async () => {
    const email = `test-student-otp-${Date.now()}@proctornet.test`
    const user = await usersService.createUser({
      email,
      fullName: 'OTP Student',
      role: 'STUDENT'
    })
    createdUserIds.push(user.id)

    assert.ok(user.generatedPassword, 'generatedPassword must be returned to creator')
    assert.notStrictEqual(user.generatedPassword, 'Default#1234', 'Never use Default#1234')
    assert.ok(user.generatedPassword.length >= 10, 'Generated password must be strong')
    assert.strictEqual(user.status, 'PENDING_SETUP', 'Student status must be PENDING_SETUP')

    // Verify passwordHash matches generatedPassword
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    const matches = await bcrypt.compare(user.generatedPassword, dbUser.passwordHash)
    assert.strictEqual(matches, true, 'Stored hash must match generated password')

    // Verify Default#1234 does NOT match
    const defaultMatches = await bcrypt.compare('Default#1234', dbUser.passwordHash)
    assert.strictEqual(defaultMatches, false, 'Default#1234 must fail authentication')
  })

  it('2. createUser with no password forces PENDING_SETUP for FACULTY and INVIGILATOR roles', async () => {
    const facultyEmail = `test-faculty-otp-${Date.now()}@proctornet.test`
    const faculty = await usersService.createUser({
      email: facultyEmail,
      fullName: 'OTP Faculty',
      role: 'FACULTY'
    })
    createdUserIds.push(faculty.id)

    assert.ok(faculty.generatedPassword)
    assert.strictEqual(faculty.status, 'PENDING_SETUP', 'Faculty must be forced to PENDING_SETUP')

    const invigEmail = `test-invig-otp-${Date.now()}@proctornet.test`
    const invigilator = await usersService.createUser({
      email: invigEmail,
      fullName: 'OTP Invigilator',
      role: 'INVIGILATOR'
    })
    createdUserIds.push(invigilator.id)

    assert.ok(invigilator.generatedPassword)
    assert.strictEqual(invigilator.status, 'PENDING_SETUP', 'Invigilator must be forced to PENDING_SETUP')
  })

  it('3. bulkCreateUsers generates distinct random one-time passwords for rows without password', async () => {
    const ts = Date.now()
    const accounts = [
      { email: `bulk-otp-1-${ts}@proctornet.test`, name: 'Bulk User 1', role: 'STUDENT' },
      { email: `bulk-otp-2-${ts}@proctornet.test`, name: 'Bulk User 2', role: 'STUDENT' }
    ]

    const results = await usersService.bulkCreateUsers(accounts)
    assert.strictEqual(results.length, 2)
    assert.strictEqual(results[0].success, true)
    assert.strictEqual(results[1].success, true)

    createdUserIds.push(results[0].user.id, results[1].user.id)

    assert.ok(results[0].generatedPassword, 'Row 1 must have generated password')
    assert.ok(results[1].generatedPassword, 'Row 2 must have generated password')
    assert.notStrictEqual(results[0].generatedPassword, results[1].generatedPassword, 'Generated passwords must be unique')
    assert.notStrictEqual(results[0].generatedPassword, 'Default#1234')
    assert.strictEqual(results[0].user.status, 'PENDING_SETUP')
    assert.strictEqual(results[1].user.status, 'PENDING_SETUP')
  })

  it('4. parseExcelBuffer without password column yields empty password without inserting Default#1234', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Students')
    sheet.addRow(['email', 'name', 'usn', 'role'])
    sheet.addRow(['excel-test@proctornet.test', 'Excel Student', 'USN001', 'STUDENT'])

    const buffer = await workbook.xlsx.writeBuffer()
    const parsed = await parseExcelBuffer(buffer)

    assert.strictEqual(parsed.length, 1)
    assert.strictEqual(parsed[0].email, 'excel-test@proctornet.test')
    assert.strictEqual(parsed[0].password, '', 'Password must be empty string, not Default#1234')
  })

  it('5. User created with one-time password can login and complete first-login password rotation', async () => {
    const email = `test-rotation-${Date.now()}@proctornet.test`
    const user = await usersService.createUser({
      email,
      fullName: 'Rotation User',
      role: 'STUDENT'
    })
    createdUserIds.push(user.id)

    // Authenticate with temporary password
    const loginResult = await authService.authenticate(email, user.generatedPassword)
    assert.strictEqual(loginResult.user.status, 'PENDING_SETUP')

    // Submit onboarding to set permanent password
    const onboardingResult = await authService.submitOnboarding(user.id, {
      newPassword: 'Permanent#Secure#2026',
      department: 'Computer Science and Engineering',
      semester: 'Sem 6',
      institutionId: 'ROT-001'
    })

    assert.strictEqual(onboardingResult.user.status, 'PENDING_APPROVAL')

    // Old temporary password must now fail
    await assert.rejects(
      async () => authService.authenticate(email, user.generatedPassword),
      (err) => err.status === 401
    )

    // New permanent password succeeds
    const newLogin = await authService.authenticate(email, 'Permanent#Secure#2026')
    assert.ok(newLogin.accessToken)
  })
})
