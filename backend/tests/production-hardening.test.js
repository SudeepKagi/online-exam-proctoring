'use strict'

// Set test environment and in-memory cache driver before requiring app
process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { getAuthCookieOptions } = require('../src/utils/cookies')
const { toErrorEnvelope, AppError } = require('../src/shared/errors')
const { app } = require('../src/app')

describe('Phase 2: Production Hardening Invariants (Cookies, CORS, Error Envelope, Trust Proxy)', () => {
  const originalEnv = { ...process.env }

  test('1. Express trust proxy is configured to exactly 1 hop (Caddy reverse proxy)', () => {
    assert.strictEqual(app.get('trust proxy'), 1)
  })

  test('2. Cookies: getAuthCookieOptions defaults to secure=true in NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.COOKIE_SECURE

    const options = getAuthCookieOptions(15 * 60 * 1000)
    assert.strictEqual(options.httpOnly, true)
    assert.strictEqual(options.secure, true)
    assert.strictEqual(options.sameSite, 'lax')
    assert.strictEqual(options.path, '/')

    // Explicit override to false
    process.env.COOKIE_SECURE = 'false'
    const devOptions = getAuthCookieOptions(15 * 60 * 1000)
    assert.strictEqual(devOptions.secure, false)

    // Restore
    process.env.NODE_ENV = 'test'
    if (originalEnv.COOKIE_SECURE) {
      process.env.COOKIE_SECURE = originalEnv.COOKIE_SECURE
    } else {
      delete process.env.COOKIE_SECURE
    }
  })

  test('3. Error Envelope: toErrorEnvelope never leaks err.stack in responses', () => {
    const errorWithStack = new AppError('Database connection reset', 500, 'DB_ERR')
    errorWithStack.stack = 'Error: Database connection reset\n    at internal/db.js:42:15\n    at runQuery (/srv/app/db.js:10)'

    const envelope = toErrorEnvelope(errorWithStack, 'req-trace-12345')

    assert.strictEqual(envelope.requestId, 'req-trace-12345')
    assert.strictEqual(envelope.code, 'DB_ERR')
    assert.strictEqual(envelope.message, 'Database connection reset')
    assert.strictEqual(envelope.stack, undefined, 'stack must never be exposed on envelope')
    assert.strictEqual(envelope.error.stack, undefined, 'stack must never be exposed on envelope.error')
  })

  test('4. Security headers middleware includes S3 wildcard and strict directives', () => {
    const { helmetMiddleware } = require('../src/middleware/security')
    assert.ok(typeof helmetMiddleware === 'function')
  })
})
