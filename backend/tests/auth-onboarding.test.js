'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { prisma } = require('../src/infra/postgres/client')
const { authService } = require('../src/modules/auth/auth.service')

describe('Onboarding Password Persistence & Authentication Flow', () => {
  const testEmail = `onboard_test_${Date.now()}@univ.edu`
  const tempPassword = 'TempPassword@123'
  const newPermanentPassword = 'PermanentPass@456'
  let createdUser = null

  before(async () => {
    const hashedTemp = await bcrypt.hash(tempPassword, 10)
    createdUser = await prisma.user.create({
      data: {
        email: testEmail.toLowerCase(),
        passwordHash: hashedTemp,
        fullName: 'Test Student',
        institutionId: `USN-${Date.now()}`,
        role: 'STUDENT',
        status: 'PENDING_SETUP'
      }
    })
  })

  after(async () => {
    if (createdUser?.id) {
      await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {})
    }
  })

  it('1. Login with temporary password succeeds prior to onboarding', async () => {
    const authResult = await authService.authenticate(testEmail, tempPassword, 'STUDENT')
    assert.ok(authResult.accessToken, 'Must issue accessToken')
    assert.strictEqual(authResult.user.email, testEmail)
  })

  it('2. Submitting onboarding with password shorter than 8 chars is rejected', async () => {
    await assert.rejects(
      async () => {
        await authService.submitOnboarding(createdUser.id, {
          newPassword: 'short',
          department: 'Computer Science and Engineering',
          semester: 'Sem 6'
        })
      },
      (err) => {
        assert.strictEqual(err.status, 400)
        assert.match(err.message, /at least 8 characters/i)
        return true
      }
    )
  })

  it('3. Submitting onboarding updates password, normalizes dept/sem and transitions status to PENDING_APPROVAL', async () => {
    const res = await authService.submitOnboarding(createdUser.id, {
      newPassword: newPermanentPassword,
      department: 'Computer Science and Engineering',
      semester: '6',
      phone: '+91 9999999999'
    })

    assert.ok(res.user, 'Must return updated user')
    assert.strictEqual(res.user.status, 'PENDING_APPROVAL')
    assert.strictEqual(res.user.profileMetadata.department, 'Computer Science and Engineering')
    assert.strictEqual(res.user.profileMetadata.semester, 'Sem 6')
  })

  it('4. Old temporary password fails with 401 Invalid credentials', async () => {
    await assert.rejects(
      async () => {
        await authService.authenticate(testEmail, tempPassword, 'STUDENT')
      },
      (err) => {
        assert.strictEqual(err.status, 401)
        assert.match(err.message, /invalid credentials/i)
        return true
      }
    )
  })

  it('5. New permanent password succeeds with full tokens', async () => {
    const authResult = await authService.authenticate(testEmail, newPermanentPassword, 'STUDENT')
    assert.ok(authResult.accessToken)
    assert.strictEqual(authResult.user.id, createdUser.id)
    assert.strictEqual(authResult.user.status, 'PENDING_APPROVAL')
  })
})
