'use strict'

const { prisma } = require('../postgres/client')
const { presenceManager } = require('./presence')
const { rosterCoalescer } = require('./rosterCoalescer')
const { proctoringService } = require('../../modules/proctoring/proctoring.service')
const { ROLES } = require('../../shared/roles')
const { logger } = require('../../shared/logging')
const { verifyToken } = require('../../utils/jwt')
const { extractTokenFromSocket } = require('../../utils/cookies')
const { handleStaffJoin } = require('./staffHandlers')

function registerSocketEvents(io, socket, latestScreenFrames) {
  if (socket.user?.id) {
    socket.join(`user:${socket.user.id}`)
    if (socket.user.role === ROLES.STUDENT) socket.join(`student:${socket.user.id}`)
  }
  if (socket.user?.sid) socket.join(`sid:${socket.user.sid}`)

  if (socket.user?.exp) {
    const remainingMs = (socket.user.exp * 1000) - Date.now()
    const warningDelayMs = Math.max(remainingMs - 60000, 0)
    if (warningDelayMs > 0 && warningDelayMs < 900000) {
      const warnTimer = setTimeout(() => {
        if (socket.connected) socket.emit('auth:expiring', { expiresInSec: 60, sid: socket.user?.sid })
      }, warningDelayMs)
      socket.on('disconnect', () => clearTimeout(warnTimer))
    }
  }

  if (socket.user?.id) {
    const checkInterval = setInterval(async () => {
      if (!socket.connected) return clearInterval(checkInterval)
      try {
        const user = await prisma.user.findUnique({ where: { id: socket.user.id }, select: { id: true, isSuspended: true } })
        if (!user || user.isSuspended) {
          logger.warn({ userId: socket.user.id }, 'Socket user suspended; disconnecting socket')
          socket.emit('session:revoked', { reason: 'SUSPENDED' })
          socket.disconnect(true)
          clearInterval(checkInterval)
        }
      } catch (err) {
        logger.debug({ err, userId: socket.user?.id }, 'Failed periodic socket user suspension check')
      }
    }, 30000)
    socket.on('disconnect', () => clearInterval(checkInterval))
  }

  socket.on('auth:refresh', async (data, ack) => {
    try {
      const token = data?.token || extractTokenFromSocket(socket)
      if (!token) return typeof ack === 'function' && ack({ success: false, error: 'Token required' })
      const decoded = verifyToken(token)
      if (!decoded || decoded.id !== socket.user?.id) {
        return typeof ack === 'function' && ack({ success: false, error: 'User mismatch' })
      }
      socket.user.exp = decoded.exp
      if (decoded.sid) socket.user.sid = decoded.sid
      if (decoded.epoch !== undefined) socket.user.epoch = decoded.epoch
      if (typeof ack === 'function') ack({ success: true, exp: decoded.exp })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  socket.on('attempt:join', async (data, ack) => {
    try {
      const { attemptId } = data || {}
      if (!attemptId) return typeof ack === 'function' && ack({ success: false, error: 'attemptId required' })
      if (socket.user.role !== ROLES.STUDENT) {
        return typeof ack === 'function' && ack({ success: false, error: 'Student role required' })
      }

      if (!socket.authorizedAttempts.has(attemptId)) {
        const attempt = await prisma.examAttempt.findFirst({
          where: { id: attemptId, studentId: socket.user.id },
          select: { id: true, examId: true, status: true }
        })
        if (!attempt) return typeof ack === 'function' && ack({ success: false, error: 'Unauthorized attempt access' })
        socket.authorizedAttempts.add(attemptId)
        socket.activeAttemptId = attemptId
        socket.activeExamId = attempt.examId
      }

      socket.join(`attempt:${attemptId}`)
      if (socket.activeExamId) {
        await presenceManager.recordHeartbeat(socket.activeExamId, socket.user.id)
        rosterCoalescer.queueDelta(socket.activeExamId, {
          attemptId, studentId: socket.user.id, online: true, lastHeartbeatAt: new Date().toISOString()
        })
      }
      socket.emit('proctor:cadence', { attemptId, cadenceMs: 3000, jitterMs: 500, reason: 'default', durationMs: null })
      if (typeof ack === 'function') ack({ success: true, attemptId })
    } catch (err) {
      logger.error({ error: err.message }, 'Error in attempt:join')
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  socket.on('inv:join', (data, ack) => handleStaffJoin(socket, latestScreenFrames, data, ack))
  socket.on('invigilator:join', (data, ack) => handleStaffJoin(socket, latestScreenFrames, data, ack))

  socket.on('heartbeat', async (data, ack) => {
    try {
      const { attemptId, examId } = data || {}
      if (!attemptId || !examId) return typeof ack === 'function' && ack({ success: false, error: 'attemptId and examId required' })
      if (socket.user.role === ROLES.STUDENT && socket.user.id) {
        if (!socket.authorizedAttempts.has(attemptId)) {
          const attempt = await prisma.examAttempt.findFirst({
            where: { id: attemptId, studentId: socket.user.id, examId },
            select: { id: true, examId: true }
          })
          if (!attempt) return typeof ack === 'function' && ack({ success: false, error: 'Unauthorized attempt/exam heartbeat' })
          socket.authorizedAttempts.add(attemptId)
          socket.activeAttemptId = attemptId
          socket.activeExamId = attempt.examId
        }
        const targetExamId = socket.activeExamId || examId
        await presenceManager.recordHeartbeat(targetExamId, socket.user.id)
        rosterCoalescer.queueDelta(targetExamId, {
          attemptId, studentId: socket.user.id, online: true, lastHeartbeatAt: new Date().toISOString()
        })
      }
      if (typeof ack === 'function') ack({ status: 'ACK', serverTime: new Date().toISOString(), serverEpochMs: Date.now() })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  socket.on('violation', async (data, ack) => {
    try {
      const { attemptId, eventType, metadata, clientTimestamp } = data || {}
      if (!attemptId || !eventType || socket.user.role !== ROLES.STUDENT) {
        return typeof ack === 'function' && ack({ success: false, error: 'Invalid violation parameters or role' })
      }

      if (!socket.authorizedAttempts.has(attemptId)) {
        const attempt = await prisma.examAttempt.findFirst({
          where: { id: attemptId, studentId: socket.user.id },
          select: { id: true, examId: true }
        })
        if (!attempt) return typeof ack === 'function' && ack({ success: false, error: 'Unauthorized attempt access' })
        socket.authorizedAttempts.add(attemptId)
        socket.activeAttemptId = attemptId
        socket.activeExamId = attempt.examId
      }

      const verifiedExamId = socket.activeExamId
      const res = await proctoringService.recordViolation(attemptId, socket.user.id, eventType, metadata, clientTimestamp, io)

      if (res?.recorded && verifiedExamId) {
        io.to(`inv:${verifiedExamId}`).emit('violation:new', {
          attemptId, violationId: res.violationId ? String(res.violationId) : null,
          studentId: socket.user.id, eventType: res.eventType, severity: res.severity, timestamp: new Date().toISOString()
        })
        rosterCoalescer.queueDelta(verifiedExamId, {
          attemptId, studentId: socket.user.id, lastViolation: res.eventType, severity: res.severity
        })
      }
      if (typeof ack === 'function') ack({ success: true, result: res })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  socket.on('screen:frame', async (data) => {
    try {
      if (socket.user?.role !== ROLES.STUDENT) return
      const { attemptId, frame, cameraFrame, frameAt } = data || {}
      if (!attemptId || (!frame && !cameraFrame)) return

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

      const now = frameAt || Date.now()
      const framePayload = { attemptId, screenUrl: frame || null, cameraUrl: cameraFrame || null, frameAt: now, examId: verifiedExamId }
      latestScreenFrames.set(attemptId, framePayload)
      io.to(`inv:${verifiedExamId}`).emit('frame:update', framePayload)
      rosterCoalescer.queueDelta(verifiedExamId, { attemptId, studentId: socket.user.id, frameAt: now })
    } catch (err) {
      logger.warn({ error: err.message }, 'screen:frame handling error')
    }
  })

  socket.on('disconnect', async () => {
    logger.info({ socketId: socket.id, userId: socket.user?.id }, 'Socket client disconnected')
    if (socket.user?.role === ROLES.STUDENT && socket.activeExamId && socket.activeAttemptId) {
      latestScreenFrames.delete(socket.activeAttemptId)
      await presenceManager.markOffline(socket.activeExamId, socket.user.id)
      rosterCoalescer.queueDelta(socket.activeExamId, {
        attemptId: socket.activeAttemptId, studentId: socket.user.id, online: false, lastHeartbeatAt: new Date().toISOString()
      })
    }
    if (socket._focusDecayTimer) {
      clearTimeout(socket._focusDecayTimer)
      socket._focusDecayTimer = null
    }
  })
}

module.exports = { registerSocketEvents }
