'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { getApiLimiterKey, getApiLimiterMax } = require('../src/middleware/security')
const { getLoginLimiterKey } = require('../src/modules/auth/auth.routes')

describe('Phase 2: Campus NAT-Resilient Rate Limiting Invariants', () => {
  test('1. apiLimiter keys by user.id for authenticated requests to isolate students behind shared NAT IP', () => {
    // Student 1 and Student 2 share the exact same campus NAT IP
    const campusIp = '203.0.113.195'
    const reqStudent1 = { user: { id: 'student-uuid-001', role: 'STUDENT' }, ip: campusIp }
    const reqStudent2 = { user: { id: 'student-uuid-002', role: 'STUDENT' }, ip: campusIp }

    const key1 = getApiLimiterKey(reqStudent1)
    const key2 = getApiLimiterKey(reqStudent2)

    assert.strictEqual(key1, 'user_student-uuid-001')
    assert.strictEqual(key2, 'user_student-uuid-002')
    assert.notStrictEqual(key1, key2, 'Students sharing the same IP must have distinct rate-limit keys')
  })

  test('2. apiLimiter allocates 1800 requests/window to STUDENT and 1500 to unauthenticated lab IP', () => {
    // Ensure production mode behavior is tested
    const prevEnv = process.env.LOADTEST_ALLOW
    const prevDisable = process.env.DISABLE_RATE_LIMIT
    const prevNodeEnv = process.env.NODE_ENV

    process.env.NODE_ENV = 'production'
    delete process.env.LOADTEST_ALLOW
    delete process.env.DISABLE_RATE_LIMIT

    const studentReq = { user: { id: 's1', role: 'STUDENT' } }
    const unauthReq = { ip: '203.0.113.195' }

    assert.strictEqual(getApiLimiterMax(studentReq), 1800, 'Student role must receive 1800 requests/window')
    assert.strictEqual(getApiLimiterMax(unauthReq), 1500, 'Unauthenticated IP must receive 1500 coarse limit for campus labs')

    process.env.NODE_ENV = prevNodeEnv
    if (prevEnv) process.env.LOADTEST_ALLOW = prevEnv
    if (prevDisable) process.env.DISABLE_RATE_LIMIT = prevDisable
  })

  test('3. loginLimiter keys by email/account to prevent brute force without locking out classroom peers', () => {
    const campusIp = '198.51.100.42'

    // Alice and Bob log in from the same computer lab
    const aliceReq = { body: { email: 'Alice.Smith@University.edu' }, ip: campusIp }
    const bobReq = { body: { email: 'bob.jones@university.edu' }, ip: campusIp }
    const fallbackReq = { body: {}, ip: campusIp }

    const aliceKey = getLoginLimiterKey(aliceReq)
    const bobKey = getLoginLimiterKey(bobReq)
    const fallbackKey = getLoginLimiterKey(fallbackReq)

    assert.strictEqual(aliceKey, 'auth_login_alice.smith@university.edu')
    assert.strictEqual(bobKey, 'auth_login_bob.jones@university.edu')
    assert.notStrictEqual(aliceKey, bobKey, 'Different users on same IP must receive distinct keys')
    assert.strictEqual(fallbackKey, 'auth_ip_198.51.100.42', 'Fallback must key by IP if email is absent')
  })
})
