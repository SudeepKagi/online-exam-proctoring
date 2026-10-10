'use strict'

process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.START_WORKERS = 'false'
process.env.NODE_ENV = 'test'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const REPO_ROOT = path.resolve(__dirname, '..')
const BACKEND_ROOT = path.join(REPO_ROOT, 'proctornet/backend')

let bcrypt
try {
  bcrypt = require('bcrypt')
} catch {
  try {
    bcrypt = require(path.join(REPO_ROOT, 'proctornet/node_modules/bcrypt'))
  } catch {
    bcrypt = require(path.join(REPO_ROOT, 'node_modules/bcryptjs'))
  }
}

const { authenticate } = require(path.join(BACKEND_ROOT, 'src/middleware/authentication'))
const { tokenService } = require(path.join(BACKEND_ROOT, 'src/modules/auth/tokenService'))
const { KNOWN_DEFAULT_PASSWORDS } = require(path.join(REPO_ROOT, 'scripts/ops/check-default-credentials'))

describe('F5 — Default Password Security & Mandatory Password Change Gate', () => {
  it('KNOWN_DEFAULT_PASSWORDS includes known defaults Admin@123, Faculty@123, Student@123', () => {
    assert.strictEqual(KNOWN_DEFAULT_PASSWORDS.includes('Admin@123'), true)
    assert.strictEqual(KNOWN_DEFAULT_PASSWORDS.includes('Faculty@123'), true)
    assert.strictEqual(KNOWN_DEFAULT_PASSWORDS.includes('Student@123'), true)
  })

  it('detects if a hash matches a known default password', async () => {
    const hash = await bcrypt.hash('Admin@123', 10)
    let found = false
    for (const candidate of KNOWN_DEFAULT_PASSWORDS) {
      if (await bcrypt.compare(candidate, hash)) {
        found = true
        break
      }
    }
    assert.strictEqual(found, true)
  })

  it('rejects access to protected business routes when mustChangePassword is true', async () => {
    const token = tokenService.signAccessToken({
      id: 'user-temp-1',
      role: 'student',
      mustChangePassword: true
    })

    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/exams',
      url: '/api/v1/exams'
    }
    const res = {}

    let caughtError = null
    await authenticate(req, res, (err) => {
      caughtError = err
    })

    assert.ok(caughtError, 'Expected an error to be thrown')
    assert.strictEqual(caughtError.code, 'PASSWORD_CHANGE_REQUIRED')
    assert.strictEqual(caughtError.statusCode, 403)
  })

  it('allows access to change-password and logout routes when mustChangePassword is true', async () => {
    const token = tokenService.signAccessToken({
      id: 'user-temp-2',
      role: 'student',
      mustChangePassword: true
    })

    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/change-password',
      url: '/api/v1/auth/change-password'
    }
    const res = {}

    let passed = false
    await authenticate(req, res, (err) => {
      if (!err) passed = true
    })

    assert.strictEqual(passed, true, 'change-password route should be allowed')
  })
})
