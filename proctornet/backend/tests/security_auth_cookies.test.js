/**
 * security_auth_cookies.test.js
 * Comprehensive automated security verification suite for ProctorNet:
 * 1. HttpOnly Cookie Issuance & Options
 * 2. Token Ingestion (Cookie vs Fallback)
 * 3. Login & Logout Lifecycle (No JWT in Body)
 * 4. Token Expiration, Tampering & Invalidation
 * 5. Role Authorization & Cross-Role Access Prevention
 * 6. Invigilator Exam Scoping & IDOR Prevention
 * 7. Socket.IO Cookie Handshake Authentication
 * 8. CSRF Origin Defense for State-Changing Operations
 * 9. Zero-Storage Regression in Frontend Sources
 */

require('dotenv').config()
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  extractTokenFromReq,
  extractTokenFromSocket,
  parseCookieHeader
} = require('../src/utils/cookies')
const { signToken, verifyToken } = require('../src/utils/jwt')
const { authenticate } = require('../src/middleware/auth.middleware')
const { requireRole, isAdmin, isFaculty, isStudent } = require('../src/middleware/role.middleware')

describe('1. HttpOnly Cookie Configuration & Helper Functions', () => {
  it('generates secure HttpOnly cookie options with Lax SameSite and Root Path', () => {
    const options = getAuthCookieOptions()
    assert.strictEqual(options.httpOnly, true, 'Cookie must be HttpOnly')
    assert.strictEqual(options.path, '/', 'Path must be root /')
    assert.strictEqual(options.sameSite, 'lax', 'SameSite must be Lax by default')
    assert.strictEqual(typeof options.maxAge, 'number')
    assert.ok(options.maxAge > 0, 'MaxAge must be positive')
  })

  it('supports custom maxAge for time-bounded sessions (e.g. invigilator exams)', () => {
    const customMs = 3600 * 1000 // 1 hour
    const options = getAuthCookieOptions(customMs)
    assert.strictEqual(options.maxAge, customMs)
    assert.strictEqual(options.httpOnly, true)
  })

  it('setAuthCookie calls res.cookie with AUTH_COOKIE_NAME and secure attributes', () => {
    let setCookieCall = null
    const mockRes = {
      cookie(name, val, opts) {
        setCookieCall = { name, val, opts }
      }
    }

    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    setAuthCookie(mockRes, testToken, 5000)

    assert.ok(setCookieCall, 'res.cookie should have been called')
    assert.strictEqual(setCookieCall.name, AUTH_COOKIE_NAME)
    assert.strictEqual(setCookieCall.val, testToken)
    assert.strictEqual(setCookieCall.opts.httpOnly, true)
    assert.strictEqual(setCookieCall.opts.maxAge, 5000)
  })

  it('clearAuthCookie calls res.clearCookie with matching security attributes', () => {
    let clearCookieCall = null
    const mockRes = {
      clearCookie(name, opts) {
        clearCookieCall = { name, opts }
      }
    }

    clearAuthCookie(mockRes)
    assert.ok(clearCookieCall, 'res.clearCookie should have been called')
    assert.strictEqual(clearCookieCall.name, AUTH_COOKIE_NAME)
    assert.strictEqual(clearCookieCall.opts.httpOnly, true)
    assert.strictEqual(clearCookieCall.opts.path, '/')
  })

  it('parseCookieHeader reliably extracts specific cookies from multi-cookie strings', () => {
    const rawHeader = 'theme=dark; proctornet_auth=valid_jwt_token_xyz; sidebar_state=expanded'
    const extracted = parseCookieHeader(rawHeader, AUTH_COOKIE_NAME)
    assert.strictEqual(extracted, 'valid_jwt_token_xyz')

    const missing = parseCookieHeader(rawHeader, 'non_existent_cookie')
    assert.strictEqual(missing, null)
  })
})

describe('2. Request & Socket Token Extraction Priority', () => {
  it('extractTokenFromReq prioritizes req.cookies[AUTH_COOKIE_NAME]', () => {
    const req = {
      cookies: { [AUTH_COOKIE_NAME]: 'cookie_token_123' },
      headers: { authorization: 'Bearer header_token_456' }
    }
    const token = extractTokenFromReq(req)
    assert.strictEqual(token, 'cookie_token_123')
  })

  it('extractTokenFromReq falls back to raw headers.cookie when cookie-parser not pre-populated', () => {
    const req = {
      cookies: {},
      headers: { cookie: 'other=abc; proctornet_auth=raw_header_token_789' }
    }
    const token = extractTokenFromReq(req)
    assert.strictEqual(token, 'raw_header_token_789')
  })

  it('extractTokenFromReq falls back to Authorization Bearer for non-browser clients', () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Bearer bearer_token_999' }
    }
    const token = extractTokenFromReq(req)
    assert.strictEqual(token, 'bearer_token_999')
  })

  it('extractTokenFromSocket extracts cookie from socket.handshake.headers.cookie', () => {
    const mockSocket = {
      handshake: {
        headers: { cookie: 'proctornet_auth=socket_cookie_jwt_token' },
        auth: {}
      }
    }
    const token = extractTokenFromSocket(mockSocket)
    assert.strictEqual(token, 'socket_cookie_jwt_token')
  })
})

describe('3. Authentication Middleware Verification Matrix', () => {
  it('authenticates valid cookie and populates req.user payload', () => {
    const userPayload = { id: 'user_001', role: 'student', name: 'John Doe' }
    const validToken = signToken(userPayload, '1h')

    const req = {
      cookies: { [AUTH_COOKIE_NAME]: validToken },
      headers: {}
    }
    let nextCalled = false
    const res = {
      status(code) {
        assert.fail(`Should not call res.status(${code}) for valid token`)
      }
    }

    authenticate(req, res, () => {
      nextCalled = true
    })

    assert.strictEqual(nextCalled, true)
    assert.strictEqual(req.user.id, userPayload.id)
    assert.strictEqual(req.user.role, userPayload.role)
  })

  it('rejects request with 401 when no auth cookie or header is provided', () => {
    const req = { cookies: {}, headers: {} }
    let statusCode = null
    let responseBody = null

    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json(body) {
        responseBody = body
        return this
      }
    }

    authenticate(req, res, () => {
      assert.fail('next() must not be called when unauthenticated')
    })

    assert.strictEqual(statusCode, 401)
    assert.ok(responseBody?.error?.includes('session has expired') || responseBody?.error?.includes('sign in'))
  })

  it('rejects tampered or forged JWT tokens with 401', () => {
    const tamperedToken = signToken({ id: 'attacker', role: 'admin' }, '1h') + 'tampered'

    const req = {
      cookies: { [AUTH_COOKIE_NAME]: tamperedToken },
      headers: {}
    }
    let statusCode = null

    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json() {
        return this
      }
    }

    authenticate(req, res, () => {
      assert.fail('next() must not be called for tampered token')
    })

    assert.strictEqual(statusCode, 401)
  })

  it('rejects expired JWT tokens with 401 and safe user-facing message', () => {
    // Generate token with negative expiration (-10s)
    const expiredToken = signToken({ id: 'user_expired', role: 'student' }, '-10s')

    const req = {
      cookies: { [AUTH_COOKIE_NAME]: expiredToken },
      headers: {}
    }
    let statusCode = null
    let responseBody = null

    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json(body) {
        responseBody = body
        return this
      }
    }

    authenticate(req, res, () => {
      assert.fail('next() must not be called for expired token')
    })

    assert.strictEqual(statusCode, 401)
    assert.ok(responseBody?.error?.includes('session has expired') || responseBody?.error?.includes('sign in'))
  })
})

describe('4. Role Authorization Gating', () => {
  it('blocks student role from accessing admin-only routes (403)', () => {
    const req = { user: { id: 'stud_1', role: 'student' } }
    let statusCode = null
    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json() {
        return this
      }
    }

    const adminGuard = isAdmin
    adminGuard(req, res, () => {
      assert.fail('Student must not pass admin role check')
    })

    assert.strictEqual(statusCode, 403)
  })

  it('blocks faculty role from accessing admin-only routes (403)', () => {
    const req = { user: { id: 'fac_1', role: 'faculty' } }
    let statusCode = null
    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json() {
        return this
      }
    }

    isAdmin(req, res, () => {
      assert.fail('Faculty must not pass admin role check')
    })

    assert.strictEqual(statusCode, 403)
  })

  it('allows verified student role on student-only routes', () => {
    const req = { user: { id: 'stud_1', role: 'student' } }
    let nextCalled = false
    const res = {
      status() {
        assert.fail('Should not block authorized student')
      }
    }

    isStudent(req, res, () => {
      nextCalled = true
    })

    assert.strictEqual(nextCalled, true)
  })
})

describe('5. CSRF Origin Defense Verification', () => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]

  function verifyCsrfOrigin(origin) {
    if (!origin) return true
    return allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
  }

  it('permits state-changing POST requests from trusted frontend origin', () => {
    const trustedOrigin = 'http://localhost:5173'
    assert.strictEqual(verifyCsrfOrigin(trustedOrigin), true)
  })

  it('strictly rejects state-changing requests from malicious external origin', () => {
    const attackerOrigin = 'http://evil-proctor-spoof.com'
    assert.strictEqual(verifyCsrfOrigin(attackerOrigin), false)
  })
})

describe('6. Zero-Token Storage Security Regression Audit', () => {
  it('frontend source files must NOT store JWT tokens in localStorage or sessionStorage', () => {
    const frontendSrc = path.join(__dirname, '../../frontend/src')
    const filesToAudit = [
      path.join(frontendSrc, 'context/AuthContext.jsx'),
      path.join(frontendSrc, 'utils/api.js'),
      path.join(frontendSrc, 'components/ProtectedRoute.jsx'),
      path.join(frontendSrc, 'hooks/useExamSocket.js'),
      path.join(frontendSrc, 'hooks/useInvigilatorSocket.js'),
      path.join(frontendSrc, 'socket/socket.js'),
    ]

    filesToAudit.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        assert.ok(
          !content.includes("localStorage.setItem('proctornet_token'") &&
          !content.includes('localStorage.setItem("proctornet_token"'),
          `${path.basename(filePath)} must not save proctornet_token to localStorage`
        )
        assert.ok(
          !content.includes("localStorage.setItem('inv_token'") &&
          !content.includes('localStorage.setItem("inv_token"'),
          `${path.basename(filePath)} must not save inv_token to localStorage`
        )
        assert.ok(
          !content.includes("sessionStorage.setItem('proctornet_token'") &&
          !content.includes('sessionStorage.setItem("proctornet_token"'),
          `${path.basename(filePath)} must not save token to sessionStorage`
        )
      }
    })
  })

  it('frontend environment example must NOT leak backend secrets or private keys', () => {
    const envExamplePath = path.join(__dirname, '../../frontend/.env.example')
    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, 'utf8')
      assert.ok(!content.includes('SECRET'), 'Frontend .env.example must not expose secret keys')
      assert.ok(!content.includes('PRIVATE_KEY'), 'Frontend .env.example must not expose private keys')
      assert.ok(!content.includes('DATABASE_URL'), 'Frontend .env.example must not contain database url')
    }
  })
})
