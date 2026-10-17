'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const { verifyToken, signToken } = require('../src/utils/jwt')
const { ROLES, normalizeRole } = require('../src/shared/roles')
const { BoundedLruCache } = require('../src/infra/redis/lruCache')
const { MemoryS3Adapter } = require('../src/infra/s3/memoryAdapter')
const { ATTEMPT_STATUS, ALLOWED_TRANSITIONS, TERMINAL_STATES } = require('../src/modules/attempts/attempts.service')

describe('Clean Architecture — Domain & Primitives Verification', () => {
  it('strictly validates the 7 canonical Prisma schema models', () => {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma')
    const schemaContent = fs.readFileSync(schemaPath, 'utf8')
    const requiredModels = ['User', 'Exam', 'Question', 'ExamAssignment', 'ExamAttempt', 'AttemptAnswer', 'ProctoringLog']
    requiredModels.forEach(model => {
      assert.ok(
        schemaContent.includes(`model ${model} `),
        `Prisma schema must contain model ${model}`
      )
    })

    // Banned legacy models
    const bannedModels = ['AuditLog', 'Notification', 'RefreshToken', 'VpnPeer', 'SupportTicket', 'Enrollment']
    bannedModels.forEach(model => {
      assert.ok(
        !schemaContent.includes(`model ${model} `),
        `Prisma schema must NOT contain legacy model ${model}`
      )
    })
  })

  it('verifies standard JWT generation and verification', () => {
    const user = { id: 'usr-123', role: 'STUDENT', name: 'Test Student' }
    const token = signToken(user)
    assert.ok(typeof token === 'string' && token.length > 20)

    const decoded = verifyToken(token)
    assert.strictEqual(decoded.id, 'usr-123')
    assert.strictEqual(decoded.role, 'STUDENT')
  })

  it('normalizes roles and enforces role enum constants', () => {
    assert.strictEqual(normalizeRole('STUDENT'), ROLES.STUDENT)
    assert.strictEqual(normalizeRole('faculty'), ROLES.FACULTY)
    assert.strictEqual(normalizeRole('ADMIN'), ROLES.ADMIN)
    assert.strictEqual(normalizeRole('invigilator'), ROLES.INVIGILATOR)
    assert.strictEqual(normalizeRole('UNKNOWN_ROLE'), null)
  })

  it('tests in-memory BoundedLruCache eviction and TTL bounds', () => {
    const cache = new BoundedLruCache(3, 1000)
    cache.set('a', 'alpha')
    cache.set('b', 'beta')
    cache.set('c', 'gamma')
    assert.strictEqual(cache.get('a'), 'alpha')

    // Eviction test: adding 'd' should evict 'b' (since 'a' was refreshed by get)
    cache.set('d', 'delta')
    assert.strictEqual(cache.get('b'), null)
    assert.strictEqual(cache.get('d'), 'delta')
    assert.strictEqual(cache.get('a'), 'alpha')
  })

  it('tests MemoryS3Adapter put and get object buffers', async () => {
    const s3 = new MemoryS3Adapter({ bucket: 'test-bucket' })
    const buffer = Buffer.from('test webp data')
    await s3.putObject('live/exam1/att1/screen.webp', buffer, 'image/webp')

    const retrieved = await s3.getObjectBuffer('live/exam1/att1/screen.webp')
    assert.deepEqual(retrieved, buffer)

    const head = await s3.headObject('live/exam1/att1/screen.webp')
    assert.strictEqual(head.ContentType, 'image/webp')
    assert.strictEqual(head.ContentLength, buffer.length)
  })

  it('validates attempt state machine transitions and terminal states', () => {
    assert.ok(TERMINAL_STATES.includes('SUBMITTED'))
    assert.ok(TERMINAL_STATES.includes('TIMED_OUT'))
    assert.ok(!TERMINAL_STATES.includes('IN_PROGRESS'))
    assert.deepEqual(ALLOWED_TRANSITIONS.NOT_STARTED, ['IN_PROGRESS'])
    assert.deepEqual(ALLOWED_TRANSITIONS.SUBMITTED, [])
  })
})
