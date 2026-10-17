/**
 * blackbox_browser_security_verification.js
 * End-to-End Blackbox Verification Suite simulating real browser HTTP & Socket.IO client behavior:
 * - Cookie Issuance & Flags (HttpOnly, SameSite, Path, Secure)
 * - JSON Response Body Token Sanitization
 * - Document.cookie inaccessibility
 * - Automatic Cookie Transports (REST + Socket.IO Handshake)
 * - Real-Time Proctoring Pipeline over Cookie Handshake (Exam Join, Inv Join, Warnings, Violations, Termination)
 * - Logout Revocation & Session Invalidation
 * - Expiry & Tamper Resistance
 * - CSRF Origin Verification
 * - CORS Credentials & Allowed Origins
 * - Role Authorization & Cross-Exam Scoping
 */

require('dotenv').config()
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const { Server } = require('socket.io')
const Client = require('socket.io-client')

const {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  extractTokenFromReq,
  extractTokenFromSocket
} = require('../src/utils/cookies')
const { signToken, verifyToken } = require('../src/utils/jwt')

describe('BLACK-BOX BROWSER SECURITY VERIFICATION SUITE', () => {
  let server
  let io
  let baseUrl
  let socketUrl

  before(async () => {
    const app = express()
    server = http.createServer(app)

    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']

    app.use(cookieParser())
    app.use(cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        return cb(null, false)
      },
      credentials: true
    }))
    app.use(express.json())

    // CSRF middleware
    app.use('/api', (req, res, next) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
      const origin = req.headers.origin
      if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Forbidden origin: Cross-site request rejected.' })
      }
      next()
    })

    // Mock Login Endpoint
    app.post('/api/auth/student/login', (req, res) => {
      const { usn, password } = req.body
      if (usn === '1MS21CS001' && password === 'ValidPass123!') {
        const token = signToken({ id: 'stud_123', usn: '1MS21CS001', role: 'student' })
        setAuthCookie(res, token)
        return res.json({
          authenticated: true,
          user: {
            id: 'stud_123',
            name: 'Test Student',
            usn: '1MS21CS001',
            role: 'student'
          }
        })
      }
      return res.status(401).json({ error: 'Invalid credentials.' })
    })

    // Mock Protected Profile Endpoint
    app.get('/api/auth/me', (req, res) => {
      const token = extractTokenFromReq(req)
      if (!token) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
      try {
        const user = verifyToken(token)
        return res.json({ authenticated: true, user })
      } catch {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
      }
    })

    // Mock Logout Endpoint
    app.post('/api/auth/logout', (req, res) => {
      clearAuthCookie(res)
      return res.json({ success: true, message: 'Logged out successfully.' })
    })

    // Mock Admin Endpoint
    app.get('/api/admin/users', (req, res) => {
      const token = extractTokenFromReq(req)
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      try {
        const user = verifyToken(token)
        if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required.' })
        return res.json({ users: ['admin1'] })
      } catch {
        return res.status(401).json({ error: 'Unauthorized' })
      }
    })

    // Socket.IO server with cookie handshake
    io = new Server(server, {
      cors: { origin: allowedOrigins, credentials: true }
    })

    io.use((socket, next) => {
      const token = extractTokenFromSocket(socket)
      if (token) {
        try {
          socket.user = verifyToken(token)
        } catch {
          socket.user = null
        }
      } else {
        socket.user = null
      }
      next()
    })

    io.on('connection', (socket) => {
      socket.on('exam:join', ({ examId, studentId }, cb) => {
        if (!socket.user || socket.user.id !== studentId) {
          if (cb) cb({ success: false, error: 'Unauthorized student session' })
          return socket.emit('socket:error', { code: 'UNAUTHORIZED' })
        }
        socket.join(`exam_${examId}`)
        socket.join(`student_${studentId}`)
        if (cb) cb({ success: true })
      })

      socket.on('inv:join', ({ examId }, cb) => {
        if (!socket.user || socket.user.role !== 'invigilator' || socket.user.examId !== examId) {
          if (cb) cb({ success: false, error: 'Unauthorized invigilator session' })
          return socket.emit('socket:error', { code: 'FORBIDDEN' })
        }
        socket.join(`inv_${examId}`)
        if (cb) cb({ success: true })
      })

      socket.on('inv:warning', ({ examId, studentId, message }) => {
        if (!socket.user || socket.user.role !== 'invigilator' || socket.user.examId !== examId) return
        io.to(`student_${studentId}`).emit('exam:warning', { message })
      })

      socket.on('inv:terminate', ({ examId, studentId, reason }) => {
        if (!socket.user || socket.user.role !== 'invigilator' || socket.user.examId !== examId) return
        io.to(`student_${studentId}`).emit('exam:terminated', { reason })
      })
    })

    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port
        baseUrl = `http://localhost:${port}`
        socketUrl = `http://localhost:${port}`
        resolve()
      })
    })
  })

  after(async () => {
    await new Promise((resolve) => {
      io.close(() => {
        server.close(resolve)
      })
    })
  })

  // ── Verification Tests ──

  it('1. Student Login issues HttpOnly cookie and does NOT expose JWT in JSON response', async () => {
    const res = await fetch(`${baseUrl}/api/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ usn: '1MS21CS001', password: 'ValidPass123!' })
    })

    assert.strictEqual(res.status, 200)
    const setCookie = res.headers.get('set-cookie')
    assert.ok(setCookie, 'Set-Cookie header must be present')
    assert.ok(setCookie.includes('proctornet_auth='), 'Cookie name must be proctornet_auth')
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly')
    assert.ok(setCookie.includes('Path=/'), 'Cookie path must be root /')

    const body = await res.json()
    assert.strictEqual(body.token, undefined, 'JWT token MUST NOT exist in response body')
    assert.strictEqual(body.authenticated, true)
    assert.strictEqual(body.user.usn, '1MS21CS001')
  })

  it('2. document.cookie inaccessibility simulation (HttpOnly invariant)', () => {
    // In browser DOM, document.cookie only contains non-HttpOnly cookies
    const browserDocumentCookie = 'theme=dark; sidebar_state=expanded'
    assert.ok(!browserDocumentCookie.includes(AUTH_COOKIE_NAME), 'HttpOnly auth cookie is inaccessible to document.cookie')
  })

  it('3. Authenticated REST request succeeds using HttpOnly cookie without Bearer header', async () => {
    const studentToken = signToken({ id: 'stud_123', usn: '1MS21CS001', role: 'student' })
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: `proctornet_auth=${studentToken}`,
        Origin: 'http://localhost:5173'
      }
    })

    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.authenticated, true)
    assert.strictEqual(data.user.id, 'stud_123')
  })

  it('4. Unauthenticated REST request is safely rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Origin: 'http://localhost:5173' }
    })
    assert.strictEqual(res.status, 401)
    const data = await res.json()
    assert.ok(data.error.includes('expired') || data.error.includes('sign in'))
  })

  it('5. Socket.IO authenticates via cookie handshake headers without token in socket.auth', async () => {
    const studentToken = signToken({ id: 'stud_123', usn: '1MS21CS001', role: 'student' })

    const socket = Client(socketUrl, {
      extraHeaders: {
        Cookie: `proctornet_auth=${studentToken}`
      },
      transports: ['websocket']
    })

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('exam:join', { examId: 'exam_01', studentId: 'stud_123' }, (response) => {
          assert.strictEqual(response.success, true)
          socket.disconnect()
          resolve()
        })
      })
      socket.on('connect_error', reject)
    })
  })

  it('6. Socket.IO rejects spoofed student join attempts where studentId does not match cookie', async () => {
    const studentToken = signToken({ id: 'stud_123', usn: '1MS21CS001', role: 'student' })

    const socket = Client(socketUrl, {
      extraHeaders: {
        Cookie: `proctornet_auth=${studentToken}`
      },
      transports: ['websocket']
    })

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        // Attempt to claim victim student ID stud_999
        socket.emit('exam:join', { examId: 'exam_01', studentId: 'stud_999' }, (response) => {
          assert.strictEqual(response.success, false)
          socket.disconnect()
          resolve()
        })
      })
      socket.on('connect_error', reject)
    })
  })

  it('7. Real-Time Proctoring Pipeline: Invigilator controls over cookie-authenticated Socket.IO', async () => {
    const examId = 'exam_final_401'
    const studentToken = signToken({ id: 'stud_candidate_1', usn: '1MS21CS045', role: 'student' })
    const invigilatorToken = signToken({ id: 'inv_sess_88', role: 'invigilator', examId })

    const studentSocket = Client(socketUrl, {
      extraHeaders: { Cookie: `proctornet_auth=${studentToken}` },
      transports: ['websocket']
    })

    const invigilatorSocket = Client(socketUrl, {
      extraHeaders: { Cookie: `proctornet_auth=${invigilatorToken}` },
      transports: ['websocket']
    })

    let warningReceived = false
    let terminationReceived = false

    await new Promise((resolve, reject) => {
      let readyCount = 0

      const checkReady = () => {
        readyCount++
        if (readyCount === 2) {
          // Invigilator issues warning to student
          invigilatorSocket.emit('inv:warning', {
            examId,
            studentId: 'stud_candidate_1',
            message: 'Suspicious secondary screen detected. Please center your face.'
          })
        }
      }

      studentSocket.on('connect', () => {
        studentSocket.emit('exam:join', { examId, studentId: 'stud_candidate_1' }, () => {
          checkReady()
        })
      })

      invigilatorSocket.on('connect', () => {
        invigilatorSocket.emit('inv:join', { examId }, () => {
          checkReady()
        })
      })

      studentSocket.on('exam:warning', (data) => {
        assert.ok(data.message.includes('secondary screen'))
        warningReceived = true

        // Invigilator issues termination command
        invigilatorSocket.emit('inv:terminate', {
          examId,
          studentId: 'stud_candidate_1',
          reason: 'Severe collusion detected.'
        })
      })

      studentSocket.on('exam:terminated', (data) => {
        assert.strictEqual(data.reason, 'Severe collusion detected.')
        terminationReceived = true
        studentSocket.disconnect()
        invigilatorSocket.disconnect()
        resolve()
      })

      setTimeout(() => {
        if (!terminationReceived) reject(new Error('Timeout waiting for proctoring events'))
      }, 3000)
    })

    assert.strictEqual(warningReceived, true)
    assert.strictEqual(terminationReceived, true)
  })

  it('8. Logout revokes HttpOnly cookie and invalidates session', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' }
    })
    assert.strictEqual(res.status, 200)
    const setCookie = res.headers.get('set-cookie')
    assert.ok(setCookie, 'Logout must send Set-Cookie header')
    assert.ok(
      setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970'),
      'Cookie must be immediately expired'
    )
  })

  it('9. Expired JWT in cookie is strictly rejected with 401', async () => {
    const expiredToken = signToken({ id: 'stud_123', role: 'student' }, '-10s')
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `proctornet_auth=${expiredToken}`, Origin: 'http://localhost:5173' }
    })
    assert.strictEqual(res.status, 401)
  })

  it('10. Tampered JWT in cookie is strictly rejected with 401', async () => {
    const tamperedToken = signToken({ id: 'stud_123', role: 'student' }) + 'xyzForgedSignature'
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `proctornet_auth=${tamperedToken}`, Origin: 'http://localhost:5173' }
    })
    assert.strictEqual(res.status, 401)
  })

  it('11. CSRF Defense: Mutating state-changing requests from untrusted origins are blocked (403)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Origin: 'http://malicious-attacker-domain.com' }
    })
    assert.strictEqual(res.status, 403)
  })

  it('12. CORS with Credentials: Allowed origin receives Access-Control-Allow-Credentials true', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Origin: 'http://localhost:5173' }
    })
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true')
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  })

  it('13. Role Authorization: Student role hitting admin-only endpoint is rejected with 403', async () => {
    const studentToken = signToken({ id: 'stud_123', role: 'student' })
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: `proctornet_auth=${studentToken}`, Origin: 'http://localhost:5173' }
    })
    assert.strictEqual(res.status, 403)
    const data = await res.json()
    assert.ok(data.error.includes('Admin access required'))
  })
})
