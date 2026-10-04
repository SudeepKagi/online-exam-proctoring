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
const { prisma } = require('../postgres/client')
const { redisClient } = require('../redis/client')
const { presenceManager } = require('./presence')
const { rosterCoalescer } = require('./rosterCoalescer')
const { proctoringService } = require('../../modules/proctoring/service')
const { logger } = require('../../shared/logging')

function createWebSocketServer(httpServer, options = {}) {
  const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000']

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'cookie']
    },
    transports: ['websocket'], // Pure websocket (Task 1)
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 64 * 1024, // 64 KB max payload: events only, NO MEDIA (Task 1)
    perMessageDeflate: false, // Tiny JSON payloads; CPU cost > gain (Task 1)
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true
    },
    ...options
  })

  // ── Redis Adapter for Multi-Process Horizontal Fan-Out (Task 1) ──
  if (redisClient.client && redisClient.isReady) {
    try {
      const pubClient = redisClient.client.duplicate()
      const subClient = redisClient.client.duplicate()
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient))
        logger.info('Socket.IO Redis adapter enabled for multi-process scaling')
      }).catch((err) => {
        logger.warn({ error: err.message }, 'Socket.IO Redis adapter connection failed, using default memory adapter')
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to configure Redis adapter for Socket.IO')
    }
  }

  // Bind coalescer to this IO instance
  rosterCoalescer.setIO(io)

  // ── Fail-Closed Handshake Authentication Middleware (Task 1) ──
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
      const token = socket.handshake.auth?.token || headerToken || extractTokenFromSocket(socket)

      if (!token) {
        return next(new Error('AUTHENTICATION_FAILED: Missing authentication credentials'))
      }

      const decoded = verifyToken(token)
      if (!decoded || !decoded.id) {
        return next(new Error('AUTHENTICATION_FAILED: Invalid or expired token'))
      }

      socket.user = {
        id: decoded.id,
        role: (decoded.role || 'student').toLowerCase(),
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

    // ── 1. STUDENT: Join Private Attempt Room (Task 2) ──
    socket.on('attempt:join', async (data, ack) => {
      try {
        const { attemptId } = data || {}
        if (!attemptId) {
          if (typeof ack === 'function') ack({ success: false, error: 'attemptId required' })
          return
        }

        if (socket.user.role !== 'student') {
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
    socket.on('inv:join', async (data, ack) => {
      try {
        const { examId } = data || {}
        if (!examId) {
          if (typeof ack === 'function') ack({ success: false, error: 'examId required' })
          return
        }

        const role = socket.user.role
        if (!['admin', 'faculty', 'invigilator'].includes(role)) {
          if (typeof ack === 'function') ack({ success: false, error: 'Staff role required' })
          return
        }

        // Authorize exam via SQL if not yet cached
        if (!socket.authorizedExams.has(examId)) {
          let authorized = false

          if (role === 'admin') {
            authorized = true
          } else if (role === 'invigilator') {
            authorized = (socket.user.examId === examId)
          } else if (role === 'faculty') {
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
    })

    // ── 3. STUDENT: Heartbeat (Task 4) ──
    socket.on('heartbeat', async (data, ack) => {
      try {
        const { attemptId, examId } = data || {}
        if (!attemptId || !examId) return

        if (socket.user.role === 'student' && socket.user.id) {
          await presenceManager.recordHeartbeat(examId, socket.user.id)
          rosterCoalescer.queueDelta(examId, {
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
        // Heartbeat errors should never throw unhandled
      }
    })

    // ── 4. STUDENT: Real-time Violation Event (Task 3) ──
    socket.on('violation', async (data, ack) => {
      try {
        const { attemptId, examId, eventType, metadata, clientTimestamp } = data || {}
        if (!attemptId || !eventType || socket.user.role !== 'student') return

        const res = await proctoringService.recordViolation(
          attemptId,
          socket.user.id,
          eventType,
          metadata,
          clientTimestamp
        )

        if (res?.recorded) {
          const currentExamId = examId || socket.activeExamId
          if (currentExamId) {
            // Forward notification to invigilator room (Task 3)
            io.to(`inv:${currentExamId}`).emit('violation:new', {
              attemptId,
              studentId: socket.user.id,
              eventType,
              severity: res.severity,
              evidenceUpload: res.evidenceUpload,
              timestamp: new Date().toISOString()
            })

            // Push delta update for roster
            rosterCoalescer.queueDelta(currentExamId, {
              attemptId,
              studentId: socket.user.id,
              lastViolation: eventType,
              severity: res.severity
            })
          }
        }

        if (typeof ack === 'function') ack({ success: true, result: res })
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    })

    // ── 5. STUDENT / PROCTOR: Private Chat (Task 3) ──
    socket.on('chat', async (data, ack) => {
      try {
        const { examId, attemptId, studentId, message } = data || {}
        if (!examId || !message?.trim()) return

        const role = socket.user.role
        const targetStudentId = role === 'student' ? socket.user.id : (studentId || socket.user.id)

        const savedMsg = await proctoringService.postChatMessage(
          examId,
          socket.user.id,
          role.toUpperCase(),
          message.trim(),
          targetStudentId
        )

        const chatPayload = {
          examId,
          studentId: targetStudentId,
          senderId: socket.user.id,
          senderRole: role.toUpperCase(),
          senderName: socket.user.name || (role === 'student' ? 'Student' : 'Invigilator'),
          message: message.trim(),
          timestamp: new Date().toISOString()
        }

        if (role === 'student') {
          // Send to invigilator room
          io.to(`inv:${examId}`).emit('chat:new', chatPayload)
        } else {
          // Send to specific student's attempt room
          if (attemptId) {
            io.to(`attempt:${attemptId}`).emit('proctor:chat', chatPayload)
          }
        }

        if (typeof ack === 'function') ack({ success: true, message: savedMsg })
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message })
      }
    })

    // ── 6. Disconnect Handling (Task 4) ──
    socket.on('disconnect', async () => {
      logger.info({ socketId: socket.id, userId: socket.user?.id }, 'Socket client disconnected')

      if (socket.user?.role === 'student' && socket.activeExamId && socket.activeAttemptId) {
        await presenceManager.markOffline(socket.activeExamId, socket.user.id)
        rosterCoalescer.queueDelta(socket.activeExamId, {
          attemptId: socket.activeAttemptId,
          studentId: socket.user.id,
          online: false,
          lastHeartbeatAt: new Date().toISOString()
        })
      }
    })
  })

  return io
}

module.exports = {
  createWebSocketServer
}
