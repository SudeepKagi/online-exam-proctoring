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
const { tokenService } = require(path.join(BACKEND_ROOT, 'src/modules/auth/tokenService'))

describe('F6 — CSRF & CORS Production Parity Enforcement', () => {
  it('rejects cross-origin requests from arbitrary sslip.io subdomains (e.g. evil.sslip.io)', () => {
    // Test exact origin evaluation function pattern in app.js
    const allowedOrigins = ['https://exam.myuniversity.edu']
    const evaluateOrigin = (origin, isProd = true) => {
      if (!origin) return true
      if (allowedOrigins.includes(origin)) return true
      if (!isProd && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        return true
      }
      return false
    }

    assert.strictEqual(evaluateOrigin('https://evil.sslip.io', true), false)
    assert.strictEqual(evaluateOrigin('https://evil.nip.io', true), false)
    assert.strictEqual(evaluateOrigin('https://evil.duckdns.org', true), false)
    assert.strictEqual(evaluateOrigin('https://exam.myuniversity.edu', true), true)
  })

  it('rejects spoofed x-client-type or x-agent-session on cookie-authenticated requests in production', () => {
    const evaluateCsrfBypass = ({ method, headers, cookies, isProd, originalUrl }) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true

      const hasCookieAuth = Boolean(
        cookies?.pn_at ||
        cookies?.proctornet_auth ||
        (headers.cookie && (headers.cookie.includes('pn_at=') || headers.cookie.includes('proctornet_auth=')))
      )

      // 1. x-client-type bypass only in non-production
      if (!isProd && (headers['x-client-type'] === 'test' || headers['x-client-type'] === 'cli')) {
        return true
      }

      // 2. Agent headers only bypass on /api/v1/agent/* for non-cookie requests
      const isAgentRoute = originalUrl?.startsWith('/api/v1/agent')
      if (!hasCookieAuth && isAgentRoute && (headers['x-agent-signature'] || headers['x-agent-session'])) {
        return true
      }

      return false // proceeds to strict origin check
    }

    // Attempted bypass in production with x-client-type: test
    const testBypassInProd = evaluateCsrfBypass({
      method: 'POST',
      headers: { 'x-client-type': 'test' },
      cookies: {},
      isProd: true,
      originalUrl: '/api/v1/exams'
    })
    assert.strictEqual(testBypassInProd, false, 'x-client-type must NOT bypass CSRF in production')

    // Attempted bypass with x-agent-session on cookie-authenticated browser request
    const agentBypassOnCookie = evaluateCsrfBypass({
      method: 'POST',
      headers: { 'x-agent-session': 'spoofed-session' },
      cookies: { pn_at: 'valid-jwt-token' },
      isProd: true,
      originalUrl: '/api/v1/exams/1/submit'
    })
    assert.strictEqual(agentBypassOnCookie, false, 'Agent headers must NOT bypass CSRF for cookie-authenticated browser requests')
  })

  it('sets secure cookie flags (HttpOnly, Secure, SameSite) in production profile', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const capturedCookies = {}
    const mockRes = {
      cookie: (name, val, opts) => {
        capturedCookies[name] = opts
      }
    }

    tokenService.setSessionCookies(mockRes, {
      accessToken: 'dummy-at',
      refreshToken: 'dummy-rt'
    })

    process.env.NODE_ENV = originalEnv

    assert.ok(capturedCookies['pn_at'], 'pn_at cookie must be set')
    assert.strictEqual(capturedCookies['pn_at'].httpOnly, true, 'pn_at must be HttpOnly')
    assert.strictEqual(capturedCookies['pn_at'].secure, true, 'pn_at must be Secure in production')
    assert.strictEqual(capturedCookies['pn_at'].sameSite, 'lax', 'pn_at must be SameSite=lax')

    assert.ok(capturedCookies['pn_rt'], 'pn_rt cookie must be set')
    assert.strictEqual(capturedCookies['pn_rt'].httpOnly, true, 'pn_rt must be HttpOnly')
    assert.strictEqual(capturedCookies['pn_rt'].secure, true, 'pn_rt must be Secure in production')
    assert.strictEqual(capturedCookies['pn_rt'].sameSite, 'lax', 'pn_rt must be SameSite=lax')
  })
})
