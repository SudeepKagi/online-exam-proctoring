/**
 * socket.server.js
 * Scalable, production-hardened Socket.io plane.
 * - Transport: pure WebSocket only (no polling)
 * - Redis Adapter for multi-process horizontal fan-out with graceful memory fallback
 * - Fail-closed cryptographic handshake authentication
 * - Private student rooms (attempt:{id}) and staff rooms (inv:{examId}) — zero student broadcast rooms
 * - 64 KB buffer cap (events only, zero media)
 * - 500ms roster delta coalescing
 */

const { Server } = require('socket.io')
const { createAdapter } = require('@socket.io/redis-adapter')
const { verifyToken } = require('../../utils/jwt')
const { extractTokenFromSocket } = require('../../utils/cookies')
const { tokenService } = require('../../modules/auth/tokenService')
const { prisma } = require('../postgres/client')
const { redisClient } = require('../redis/client')
const { presenceManager } = require('./presence')
const { rosterCoalescer } = require('./rosterCoalescer')
const { proctoringService } = require('../../modules/proctoring/service')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { logger } = require('../../shared/logging')

function createWebSocketServer(httpServer, options = {}) {
  const envOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
    : []
  const allowedOrigins = [
    ...envOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000'
  ]

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        if (origin.match(/^https?:\/\/(43\.204\.45\.86|.*\.sslip\.io|.*\.nip\.io)(:\d+)?$/)) {
          return callback(null, true)
        }
        if (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
          return callback(null, true)
        }
        return callback(null, false)
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'cookie']
    },
    transports: ['websocket'], // Pure websocket (Task 1)
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 64 * 1024, // 64 KB max payload: events only, NO MEDIA (Task 1)
    perMessageDeflate: false, // Tiny JSON payloads; CPU cost > gain (Task 1)
    // connectionStateRecovery dropped per F-03 / C-06
    ...options
  })

  // ── Redis Adapter for Multi-Process Horizontal Fan-Out (C-05 / C-06) ──
  // When CACHE_DRIVER=memory (single-process mode), use default in-memory adapter
  try {
    const config = require('../../shared/config')
    if (config.cacheDriver === 'memory') {
      logger.info('Socket.io: using default in-memory adapter (CACHE_DRIVER=memory)')
    } else {
      const Redis = require('ioredis')
      const pubClient = redisClient.client
      ? redisClient.client.duplicate()
      : new Redis(config.redisUrl, {
        keyPrefix: config.redisPrefix,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (n) => Math.min(n * 200, 5000)
      })
    const subClient = pubClient.duplicate()

    io.adapter(createAdapter(pubClient, subClient))

      Promise.all([
        pubClient.status === 'ready' ? Promise.resolve() : pubClient.connect().catch(() => {}),
        subClient.status === 'ready' ? Promise.resolve() : subClient.connect().catch(() => {})
      ]).then(() => {
        logger.info('Socket.IO Redis adapter enabled for multi-process scaling')
      }).catch((err) => {
        logger.warn({ error: err.message }, 'Socket.IO Redis adapter connection deferred, ioredis will retry')
      })
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to configure Redis adapter for Socket.IO')
  }

  // Bind coalescer to this IO instance
  rosterCoalescer.setIO(io)

  // ── Fail-Closed Handshake Authentication Middleware (Phase S2 / SES-09) ──
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
      const token = socket.handshake.auth?.token || headerToken || extractTokenFromSocket(socket)

      if (!token) {
        return next(new Error('AUTHENTICATION_FAILED: Missing authentication credentials'))
      }

      let decoded
      try {
        decoded = tokenService.verifyAccessToken(token)
      } catch (err) {
        return next(new Error(`AUTHENTICATION_FAILED: ${err.message || 'Invalid or expired token'}`))
      }

      if (!decoded || !decoded.id) {
        return next(new Error('AUTHENTICATION_FAILED: Malformed token payload'))
      }

      const role = normalizeRole(decoded.role)
      if (!role) {
        return next(new Error('AUTHENTICATION_FAILED: Invalid or unrecognized role in token'))
      }

      // Validate session state against database / bounded cache
      if (decoded.sid) {
        const sessionCheck = await tokenService.validateSession(decoded.sid, decoded.epoch)
        if (!sessionCheck.valid) {
          return next(new Error(`AUTHENTICATION_FAILED: Session ${sessionCheck.reason || 'revoked or expired'}`))
        }
      }

      socket.user = {
        id: decoded.id,
        role,
        sid: decoded.sid || null,
        familyId: decoded.familyId || null,
        epoch: decoded.epoch ?? null,
        exp: decoded.exp ?? null,
        examId: decoded.examId || null,
        name: decoded.name || null,
        usn: decoded.usn || null
      }

      socket.authorizedAttempts = new Set()
      socket.authorizedExams = new Set()
      socket.activeAttemptId = null
      socket.activeExamId = null

      next()
    } catch (err) {
      logger.warn({ error: err.message }, 'Socket handshake authentication rejected (failed closed)')
      return next(new Error(`AUTHENTICATION_FAILED: ${err.message}`))
    }
  })

  // ── Connection Handler & Event Plane ──
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, userId: socket.user?.id, role: socket.user?.role }, 'Socket client connected')

    // Automatically join user and session private rooms
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`)
      if (socket.user.role === ROLES.STUDENT) {
        socket.join(`student:${socket.user.id}`)
      }
    }
    if (socket.user?.sid) {
      socket.join(`sid:${socket.user.sid}`)
    }

    // Schedule auth:expiring notification 60s before token expiration (Phase S2)
    if (socket.user?.exp) {
      const remainingMs = (socket.user.exp * 1000) - Date.now()
      const warningDelayMs = Math.max(remainingMs - 60000, 0)
      if (warningDelayMs > 0 && warningDelayMs < 900000) {
        const warnTimer = setTimeout(() => {
          if (socket.connected) {
            socket.emit('auth:expiring', {
              expiresInSec: 60,
              sid: socket.user?.sid
            })
          }
        }, warningDelayMs)
        socket.on('disconnect', () => clearTimeout(warnTimer))
      }
    }

    // Periodic session liveness check (every 30s) to enforce suspension / logout / revocation
    if (socket.user?.sid) {
      const checkInterval = setInterval(async () => {
        if (!socket.connected) {
          clearInterval(checkInterval)
          return
        }
        try {
          const check = await tokenService.validateSession(socket.user.sid, socket.user.epoch)
          if (!check.valid) {
            logger.warn({ sid: socket.user.sid, userId: socket.user.id, reason: check.reason }, 'Socket session revoked; disconnecting socket')
            socket.emit('session:revoked', { reason: check.reason || 'REVOKED' })
            socket.disconnect(true)
            clearInterval(checkInterval)
          }
        } catch {
          // ignore transient database glitches
        }
      }, 30000)
      socket.on('disconnect', () => clearInterval(checkInterval))
    }

    // ── 1. STUDENT: Join Private Attempt Room (Task 2) ──
    socket.on('attempt:join', async (data, ack) => {
      try {
        const { attemptId } = data || {}
        if (!attemptId) {
          if (typeof ack === 'function') ack({ success: false, error: 'attemptId required' })
          return
        }

        if (socket.user.role !== ROLES.STUDENT) {
          if (typeof ack === 'function') ack({ success: false, error: 'Student role required' })
          return
        }

        // Authorize attempt ownership via SQL
        if (!socket.authorizedAttempts.has(attemptId)) {
          const attempt = await prisma.examAttempt.findFirst({
            where: { id: attemptId, studentId: socket.user.id },
            select: { id: true, examId: true, status: true }
          })

          if (!attempt) {
            if (typeof ack === 'function') ack({ success: false, error: 'Unauthorized attempt access' })
            return
          }

          socket.authorizedAttempts.add(attemptId)
          socket.activeAttemptId = attemptId
          socket.activeExamId = attempt.examId
        }

        // Join private student room: attempt:{attemptId} (NEVER exam:{examId}!)
        socket.join(`attempt:${attemptId}`)

        // Mark online presence
        if (socket.activeExamId) {
          await presenceManager.recordHeartbeat(socket.activeExamId, socket.user.id)
          rosterCoalescer.queueDelta(socket.activeExamId, {
            attemptId,
            studentId: socket.user.id,
            online: true,
            lastHeartbeatAt: new Date().toISOString()
          })
        }

        if (typeof ack === 'function') ack({ success: true, attemptId })
      } catch (err) {
        logger.error({ error: err.message }, 'Error in attempt:join')
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    })

    // ── 2. STAFF: Join Invigilator Exam Room (Task 2) ──
    const handleStaffJoin = async (data, ack) => {
      try {
        const { examId } = data || {}
        if (!examId) {
          if (typeof ack === 'function') ack({ success: false, error: 'examId required' })
          return
        }

        const role = socket.user.role
        if (![ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR].includes(role)) {
          if (typeof ack === 'function') ack({ success: false, error: 'Staff role required' })
          return
        }

        // Authorize exam via SQL if not yet cached
        if (!socket.authorizedExams.has(examId)) {
          let authorized = false

          if (role === ROLES.ADMIN) {
            authorized = true
          } else if (role === ROLES.INVIGILATOR) {
            authorized = (socket.user.examId === examId)
          } else if (role === ROLES.FACULTY) {
            const exam = await prisma.exam.findFirst({
              where: { id: examId, facultyId: socket.user.id },
              select: { id: true }
            })
            authorized = !!exam
          }

          if (!authorized) {
            if (typeof ack === 'function') ack({ success: false, error: 'Unauthorized exam scope' })
            return
          }

          socket.authorizedExams.add(examId)
        }

        socket.join(`inv:${examId}`)
        logger.info({ userId: socket.user.id, role, examId }, 'Staff joined invigilator room')

        if (typeof ack === 'function') ack({ success: true, examId })
      } catch (err) {
        logger.error({ error: err.message }, 'Error in inv:join')
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    }
    socket.on('inv:join', handleStaffJoin)
    socket.on('invigilator:join', handleStaffJoin)

    // ── 3. STUDENT: Heartbeat (Task 4 / D-04 BOLA Fix) ──
    socket.on('heartbeat', async (data, ack) => {
      try {
        const { attemptId, examId } = data || {}
        if (!attemptId || !examId) {
          if (typeof ack === 'function') ack({ success: false, error: 'attemptId and examId required' })
          return
        }

        if (socket.user.role === ROLES.STUDENT && socket.user.id) {
          // Authorize attempt & exam scope (D-04)
          if (!socket.authorizedAttempts.has(attemptId)) {
            const attempt = await prisma.examAttempt.findFirst({
              where: { id: attemptId, studentId: socket.user.id, examId },
              select: { id: true, examId: true }
            })
            if (!attempt) {
              if (typeof ack === 'function') ack({ success: false, error: 'Unauthorized attempt/exam heartbeat' })
              return
            }
            socket.authorizedAttempts.add(attemptId)
            socket.activeAttemptId = attemptId
            socket.activeExamId = attempt.examId
          } else if (socket.activeExamId && socket.activeExamId !== examId) {
            if (typeof ack === 'function') ack({ success: false, error: 'Mismatched examId in heartbeat' })
            return
          }

          const targetExamId = socket.activeExamId || examId
          await presenceManager.recordHeartbeat(targetExamId, socket.user.id)
          rosterCoalescer.queueDelta(targetExamId, {
            attemptId,
            studentId: socket.user.id,
            online: true,
            lastHeartbeatAt: new Date().toISOString()
          })
        }

        if (typeof ack === 'function') {
          ack({ status: 'ACK', serverTime: new Date().toISOString(), serverEpochMs: Date.now() })
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    })

    // ── 4. STUDENT: Real-time Violation Event (Task 3 / D-04 BOLA Fix) ──
    socket.on('violation', async (data, ack) => {
      try {
        const { attemptId, examId, eventType, metadata, clientTimestamp } = data || {}
        if (!attemptId || !eventType || socket.user.role !== ROLES.STUDENT) {
          if (typeof ack === 'function') ack({ success: false, error: 'Invalid violation parameters or role' })
          return
        }

        // Authorize attempt ownership (D-04)
        if (!socket.authorizedAttempts.has(attemptId)) {
          const attempt = await prisma.examAttempt.findFirst({
            where: { id: attemptId, studentId: socket.user.id },
            select: { id: true, examId: true }
          })
          if (!attempt) {
            if (typeof ack === 'function') ack({ success: false, error: 'Unauthorized attempt access' })
            return
          }
          socket.authorizedAttempts.add(attemptId)
          socket.activeAttemptId = attemptId
          socket.activeExamId = attempt.examId
        }

        const verifiedExamId = socket.activeExamId
        const res = await proctoringService.recordViolation(
          attemptId,
          socket.user.id,
          eventType,
          metadata,
          clientTimestamp
        )

        if (res?.recorded && verifiedExamId) {
          // Forward notification to invigilator room (tickets stripped per C-08/C-09)
          io.to(`inv:${verifiedExamId}`).emit('violation:new', {
            attemptId,
            violationId: res.violationId ? String(res.violationId) : null,
            studentId: socket.user.id,
            eventType: res.eventType,
            severity: res.severity,
            timestamp: new Date().toISOString()
          })

          // Push delta update for roster
          rosterCoalescer.queueDelta(verifiedExamId, {
            attemptId,
            studentId: socket.user.id,
            lastViolation: res.eventType,
            severity: res.severity
          })
        }

        if (typeof ack === 'function') ack({ success: true, result: res })
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    })

    // ── 5. STUDENT / PROCTOR: Private Chat (Task 3 / D-01 / D-04 BOLA Fix) ──
    socket.on('chat', async (data, ack) => {
      try {
        const { examId, attemptId, studentId, message } = data || {}
        if (!examId || !message?.trim()) {
          if (typeof ack === 'function') ack({ success: false, error: 'examId and message required' })
          return
        }

        const role = socket.user.role

        if (role === ROLES.STUDENT) {
          // Student chat strictly bound to socket.user.id (D-01)
          if (attemptId && !socket.authorizedAttempts.has(attemptId)) {
            const attempt = await prisma.examAttempt.findFirst({
              where: { id: attemptId, examId, studentId: socket.user.id },
              select: { id: true, examId: true }
            })
            if (!attempt) {
              if (typeof ack === 'function') ack({ success: false, error: 'Unauthorized exam/attempt chat access' })
              return
            }
            socket.authorizedAttempts.add(attempt.id)
            socket.activeAttemptId = attempt.id
            socket.activeExamId = attempt.examId
          }

          const targetStudentId = socket.user.id
          const savedMsg = await proctoringService.postChatMessage(
            examId,
            socket.user,
            message.trim(),
            targetStudentId
          )

          const chatPayload = {
            examId,
            studentId: targetStudentId,
            senderId: socket.user.id,
            senderRole: role,
            senderName: socket.user.name || 'Student',
            message: message.trim(),
            timestamp: new Date().toISOString()
          }

          // Broadcast to invigilators of this exam only
          io.to(`inv:${examId}`).emit('chat:new', chatPayload)

          if (typeof ack === 'function') ack({ success: true, message: savedMsg })
        } else {
          // Staff chat bound to exam scope (D-01 / D-03 / D-04)
          await proctoringService.assertStaffExamAccess(socket.user, examId)

          if (!studentId && !attemptId) {
            if (typeof ack === 'function') ack({ success: false, error: 'studentId or attemptId required for staff chat' })
            return
          }

          const targetAttempt = await prisma.examAttempt.findFirst({
            where: {
              examId,
              ...(attemptId ? { id: attemptId } : { studentId })
            },
            select: { id: true, studentId: true }
          })

          if (!targetAttempt) {
            if (typeof ack === 'function') ack({ success: false, error: 'Target student attempt not found in this exam' })
            return
          }

          const targetStudentId = targetAttempt.studentId
          const targetAttemptId = targetAttempt.id

          const savedMsg = await proctoringService.postChatMessage(
            examId,
            socket.user,
            message.trim(),
            targetStudentId
          )

          const chatPayload = {
            examId,
            studentId: targetStudentId,
            senderId: socket.user.id,
            senderRole: role,
            senderName: socket.user.name || 'Invigilator',
            message: message.trim(),
            timestamp: new Date().toISOString()
          }

          // Send to specific student's attempt room only
          io.to(`attempt:${targetAttemptId}`).emit('proctor:chat', chatPayload)
          // Echo to staff room for co-invigilators
          io.to(`inv:${examId}`).emit('chat:new', chatPayload)

          if (typeof ack === 'function') ack({ success: true, message: savedMsg })
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    })

    // ── 6. Disconnect Handling (Task 4) ──
    socket.on('disconnect', async () => {
      logger.info({ socketId: socket.id, userId: socket.user?.id }, 'Socket client disconnected')

      if (socket.user?.role === ROLES.STUDENT && socket.activeExamId && socket.activeAttemptId) {
        await presenceManager.markOffline(socket.activeExamId, socket.user.id)
        rosterCoalescer.queueDelta(socket.activeExamId, {
          attemptId: socket.activeAttemptId,
          studentId: socket.user.id,
          online: false,
          lastHeartbeatAt: new Date().toISOString()
        })
      }

      // Clear any focused-decay timer for this socket
      if (socket._focusDecayTimer) {
        clearTimeout(socket._focusDecayTimer)
        socket._focusDecayTimer = null
      }
    })

    // ── 7. R3 SNAPSHOT DRIVER: Cadence Events ──────────────────────────────────

    /**
     * attempt:joined → push initial default cadence to student (30 s ± 3 s jitter)
     * Piggybacks on attempt:join success; emitted right after the room join ack.
     */
    socket.on('attempt:join', async (data) => {
      // Note: this second handler fires *after* the first; authorisation already ran.
      const { attemptId } = data || {}
      if (!attemptId || socket.user?.role !== ROLES.STUDENT) return
      // Default cadence: 30 s ± 3 s jitter. Client adds jitter itself; we seed it.
      socket.emit('proctor:cadence', {
        attemptId,
        cadenceMs: 30_000,
        jitterMs: 3_000,
        reason: 'default',
        durationMs: null
      })
    })

    /**
     * proctor:tile_visibility (invigilator → server)
     * Payload: { examId, visibleAttemptIds: string[], focusedAttemptId: string|null }
     * Server computes target cadence per attempt and pushes proctor:cadence to each
     * student's attempt room.  Focused attempt decays back to 5 s after 60 s.
     */
    socket.on('proctor:tile_visibility', async (data) => {
      try {
        const role = socket.user?.role
        if (![ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR].includes(role)) return

        const { examId, visibleAttemptIds = [], focusedAttemptId = null } = data || {}
        if (!examId) return

        // Clear previous focused-decay timer on this socket (invigilators only)
        if (socket._focusDecayTimer) {
          clearTimeout(socket._focusDecayTimer)
          socket._focusDecayTimer = null
        }

        const visibleSet = new Set(visibleAttemptIds)

        // Push cadences: focused > visible > default
        for (const attemptId of visibleSet) {
          if (attemptId === focusedAttemptId) continue // handled separately below
          io.to(`attempt:${attemptId}`).emit('proctor:cadence', {
            attemptId,
            cadenceMs: 5_000,
            jitterMs: 500,
            reason: 'visible',
            durationMs: null
          })
        }

        if (focusedAttemptId) {
          io.to(`attempt:${focusedAttemptId}`).emit('proctor:cadence', {
            attemptId: focusedAttemptId,
            cadenceMs: 1_500,
            jitterMs: 200,
            reason: 'focused',
            durationMs: 60_000
          })

          // After 60 s, decay back to 5 s if still visible, else 30 s
          socket._focusDecayTimer = setTimeout(() => {
            const decayTarget = visibleSet.has(focusedAttemptId) ? 5_000 : 30_000
            io.to(`attempt:${focusedAttemptId}`).emit('proctor:cadence', {
              attemptId: focusedAttemptId,
              cadenceMs: decayTarget,
              jitterMs: decayTarget === 30_000 ? 3_000 : 500,
              reason: 'focus_decay',
              durationMs: null
            })
            socket._focusDecayTimer = null
          }, 60_000)
        }

        logger.debug({ examId, visibleCount: visibleSet.size, focusedAttemptId }, 'Cadence pushed for tile visibility')
      } catch (err) {
        logger.warn({ error: err.message }, 'proctor:tile_visibility handling error')
      }
    })

    /**
     * snapshot:uploaded (student → server)
     * Payload: { attemptId, frameAt: number (epoch ms) }
     * Server fans out frame:update to inv:{examId} for invigilator tiles.
     * Zero bytes of image data — only metadata.
     */
    socket.on('snapshot:uploaded', async (data) => {
      try {
        if (socket.user?.role !== ROLES.STUDENT) return
        const { attemptId, frameAt } = data || {}
        if (!attemptId || !frameAt) return

        // Authorize scope
        if (!socket.authorizedAttempts.has(attemptId)) {
          const attempt = await prisma.examAttempt.findFirst({
            where: { id: attemptId, studentId: socket.user.id },
            select: { id: true, examId: true }
          })
          if (!attempt) return
          socket.authorizedAttempts.add(attemptId)
          socket.activeAttemptId = attemptId
          socket.activeExamId = attempt.examId
        }

        const verifiedExamId = socket.activeExamId
        if (!verifiedExamId) return

        // Fan-out to invigilator room: metadata only, no image bytes
        io.to(`inv:${verifiedExamId}`).emit('frame:update', {
          attemptId,
          frameAt,
          examId: verifiedExamId
        })

        // Queue roster delta (frame freshness)
        rosterCoalescer.queueDelta(verifiedExamId, {
          attemptId,
          studentId: socket.user.id,
          frameAt
        })
      } catch (err) {
        logger.warn({ error: err.message }, 'snapshot:uploaded handling error')
      }
    })
  })

  return io
}

module.exports = {
  createWebSocketServer
}
