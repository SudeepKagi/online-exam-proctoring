/**
 * exam.socket.js
 * Authoritative real-time Socket.io protocol with cryptographic JWT authentication,
 * room isolation, and role-based action gating.
 */

const { verifyToken } = require('../utils/jwt')
const { transitionExamSession, SESSION_STATES } = require('../services/sessionStateMachine')

const CANONICAL_SEVERITY = {
  SECONDARY_DEVICE_DETECTED: 'CRITICAL',
  SCREEN_RECORDING: 'CRITICAL',
  IMPERSONATION_ATTEMPT: 'CRITICAL',
  VPN_DISCONNECT: 'CRITICAL',
  UNAUTHORIZED_APPLICATION: 'CRITICAL',
  MULTIPLE_FACES_DETECTED: 'HIGH',
  FULLSCREEN_EXIT: 'HIGH',
  DEVTOOLS_OPEN: 'HIGH',
  BLUETOOTH_ANOMALY: 'HIGH',
  NO_FACE_DETECTED: 'MEDIUM',
  TAB_SWITCH: 'MEDIUM',
  AUDIO_ANOMALY: 'MEDIUM',
  GAZE_AWAY: 'MEDIUM',
  WINDOW_BLUR: 'LOW',
  LOW_LIGHTING: 'LOW'
}

// ── Rate Limiting for Violation Flags (H-9) ──
const FLAG_COOLDOWNS = {
  TAB_SWITCH: 2000,
  GAZE_AWAY: 3000,
  NO_FACE_DETECTED: 3000,
  MULTIPLE_FACES_DETECTED: 3000,
  AUDIO_ANOMALY: 3000,
  WINDOW_BLUR: 2000,
  LOW_LIGHTING: 5000,
  DEFAULT: 3000
}

const flagRateLimitMap = new Map()

// Periodic cleanup of rate limit entries older than 10 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of flagRateLimitMap.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      flagRateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)
if (cleanupTimer.unref) cleanupTimer.unref()

function requireStudentAuth(socket, targetStudentId) {
  if (!socket.user) {
    socket.emit('socket:error', { code: 'UNAUTHENTICATED', message: 'Authentication token required.' })
    return false
  }
  if (socket.user.role !== 'student') {
    socket.emit('socket:error', { code: 'FORBIDDEN', message: 'Student role required.' })
    return false
  }
  if (targetStudentId && socket.user.id !== targetStudentId) {
    socket.emit('socket:error', { code: 'UNAUTHORIZED', message: 'Identity mismatch.' })
    return false
  }
  return true
}

function requireStaffAuth(socket, targetExamId) {
  if (!socket.user) {
    socket.emit('socket:error', { code: 'UNAUTHENTICATED', message: 'Authentication token required.' })
    return false
  }
  const allowedRoles = ['invigilator', 'faculty', 'admin']
  if (!allowedRoles.includes(socket.user.role)) {
    socket.emit('socket:error', { code: 'FORBIDDEN', message: 'Staff authorization required.' })
    return false
  }
  if (socket.user.role === 'invigilator' && targetExamId && socket.user.examId && socket.user.examId !== targetExamId) {
    socket.emit('socket:error', { code: 'FORBIDDEN', message: 'Not authorized for this examination.' })
    return false
  }
  return true
}

module.exports = (io) => {
  // ── Cryptographic Socket Authentication Middleware ──
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1]
      if (token) {
        const decoded = verifyToken(token)
        socket.user = decoded // { id, role, examId? }
      } else {
        socket.user = null
      }
      next()
    } catch (err) {
      console.warn('[exam.socket] Handshake token verification note:', err.message)
      socket.user = null
      next()
    }
  })

  io.on('connection', (socket) => {

    // ── STUDENT: Join Active Exam Room ──
    socket.on('exam:join', async (data) => {
      const { examId, studentId, name, usn } = data || {}
      if (!examId || !studentId) return

      if (!requireStudentAuth(socket, studentId)) return

      socket.join(`exam:${examId}`)
      socket.join(`student:${studentId}`)
      socket.data = { studentId, examId, role: 'student', name, usn }

      // Notify active invigilator room
      io.to(`inv:${examId}`).emit('student:joined', {
        studentId,
        name: name || socket.data.name,
        usn: usn || socket.data.usn,
        joinedAt: new Date().toISOString()
      })
    })

    // ── STUDENT: Join Lobby ──
    socket.on('lobby:join', (data) => {
      const { examId, studentId, name, usn } = data || {}
      if (!examId || !studentId) return

      if (!requireStudentAuth(socket, studentId)) return

      socket.join(`lobby:${examId}`)
      socket.join(`student:${studentId}`)
      socket.data = { studentId, examId, role: 'student', name, usn }

      io.to(`inv:${examId}`).emit('student:joined', {
        studentId,
        name: name || socket.data.name,
        usn: usn || socket.data.usn,
        joinedAt: new Date().toISOString()
      })
    })

    // ── STUDENT: Send Camera Fallback Frame (D-4: Rate/Size Governed) ──
    socket.on('exam:frame', (data) => {
      if (!data?.examId || !data?.studentId || !data?.frame) return
      if (!requireStudentAuth(socket, data.studentId)) return

      // Max frame payload limit: 500KB
      if (typeof data.frame === 'string' && data.frame.length > 500 * 1024) return

      // Throttle fallback frames to max 1 frame per 800ms
      const throttleKey = `${data.studentId}:camera`
      const now = Date.now()
      const lastTime = flagRateLimitMap.get(throttleKey) || 0
      if (now - lastTime < 800) return
      flagRateLimitMap.set(throttleKey, now)

      global.latestLiveFrames = global.latestLiveFrames || new Map()
      const existing = global.latestLiveFrames.get(data.studentId) || {}
      global.latestLiveFrames.set(data.studentId, { ...existing, camera: data.frame, updatedAt: now })

      io.to(`inv:${data.examId}`).to(`exam:${data.examId}`).emit('student:cameraFrame', {
        studentId: data.studentId,
        frame: data.frame,
        timestamp: new Date().toISOString()
      })
    })

    // ── STUDENT: Send Screen Fallback Frame (D-4: Rate/Size Governed) ──
    socket.on('exam:screenFrame', (data) => {
      if (!data?.examId || !data?.studentId || !data?.frame) return
      if (!requireStudentAuth(socket, data.studentId)) return

      // Max frame payload limit: 500KB
      if (typeof data.frame === 'string' && data.frame.length > 500 * 1024) return

      // Throttle fallback frames to max 1 frame per 800ms
      const throttleKey = `${data.studentId}:screen`
      const now = Date.now()
      const lastTime = flagRateLimitMap.get(throttleKey) || 0
      if (now - lastTime < 800) return
      flagRateLimitMap.set(throttleKey, now)

      global.latestLiveFrames = global.latestLiveFrames || new Map()
      const existing = global.latestLiveFrames.get(data.studentId) || {}
      global.latestLiveFrames.set(data.studentId, { ...existing, screen: data.frame, updatedAt: now })

      io.to(`inv:${data.examId}`).to(`exam:${data.examId}`).emit('student:screenFrame', {
        studentId: data.studentId,
        frame: data.frame,
        timestamp: new Date().toISOString()
      })
    })

    // ── WebRTC Signaling Events ──
    socket.on('webrtc:request-stream', (data) => {
      const { studentId, examId } = data || {}
      const targetExamId = examId || socket.data?.examId || socket.user?.examId
      if (!studentId) return
      if (!requireStaffAuth(socket, targetExamId)) return

      io.to(`student:${studentId}`).emit('webrtc:request-stream', {
        invId: socket.id,
        examId: targetExamId
      })
    })

    socket.on('webrtc:offer', (data) => {
      const { offer, invId, studentId, streamMap } = data || {}
      if (!socket.user || !invId || !offer) return

      io.to(invId).emit('webrtc:offer', {
        offer,
        studentId: studentId || socket.user.id,
        senderId: socket.id,
        streamMap
      })
    })

    socket.on('webrtc:answer', (data) => {
      const { answer, studentId } = data || {}
      if (!socket.user || !studentId || !answer) return

      io.to(`student:${studentId}`).emit('webrtc:answer', {
        answer,
        invId: socket.id
      })
    })

    socket.on('webrtc:ice-candidate', (data) => {
      const { candidate, targetId } = data || {}
      if (!socket.user || !candidate || !targetId) return

      if (socket.data?.role === 'student' || socket.user.role === 'student') {
        io.to(targetId).emit('webrtc:ice-candidate', {
          candidate,
          senderId: socket.id,
          studentId: socket.user.id
        })
      } else {
        io.to(`student:${targetId}`).emit('webrtc:ice-candidate', {
          candidate,
          senderId: socket.id
        })
      }
    })

    // ── STUDENT: Report Proctoring Flag / Violation (Server-Authoritative) ──
    socket.on('exam:flag', async (data) => {
      if (!data?.examId || !data?.studentId) return

      // Security C-10: Reject unauthenticated flag events or student identity mismatch
      if (!requireStudentAuth(socket, data.studentId)) return

      const eventType = data.type || data.eventType || 'VIOLATION'

      // Security H-9: Rate limiting by studentId + examId + eventType
      const rateLimitKey = `${data.studentId}:${data.examId}:${eventType}`
      const now = Date.now()
      const cooldown = FLAG_COOLDOWNS[eventType] || FLAG_COOLDOWNS.DEFAULT
      const lastFlagTime = flagRateLimitMap.get(rateLimitKey) || 0

      if (now - lastFlagTime < cooldown) {
        socket.emit('socket:ratelimit', {
          event: 'exam:flag',
          eventType,
          retryAfterMs: cooldown - (now - lastFlagTime)
        })
        return
      }

      flagRateLimitMap.set(rateLimitKey, now)

      const authoritativeSeverity = CANONICAL_SEVERITY[eventType] || 'MEDIUM'
      const serverTimestamp = new Date()

      const flagPayload = {
        studentId: data.studentId,
        studentName: data.studentName || socket.data?.name || socket.user.name,
        studentUsn: data.studentUsn || data.usn || socket.data?.usn,
        type: eventType,
        eventType: eventType,
        severity: authoritativeSeverity,
        details: data.details || eventType,
        screenshotUrl: data.screenshotUrl || null,
        cameraFrameUrl: data.cameraFrameUrl || null,
        timestamp: serverTimestamp.toISOString()
      }

      // Forward immediately to invigilator room
      io.to(`inv:${data.examId}`).emit('student:flag', flagPayload)
      io.to(`inv:${data.examId}`).emit('exam:flag', flagPayload)

      // Persist evidence and increment violation counters in database
      try {
        const prisma = global.prisma
        if (prisma) {
          const studentExam = await prisma.studentExam.findFirst({
            where: { studentId: data.studentId, examId: data.examId }
          })
          if (studentExam) {
            await prisma.$transaction([
              prisma.studentExam.update({
                where: { id: studentExam.id },
                data: { flagCount: { increment: 1 } }
              }),
              prisma.evidenceLog.create({
                data: {
                  studentExamId: studentExam.id,
                  eventType: flagPayload.eventType,
                  severity: flagPayload.severity,
                  details: typeof flagPayload.details === 'string' ? flagPayload.details : JSON.stringify(flagPayload.details),
                  screenshotUrl: flagPayload.screenshotUrl,
                  cameraFrameUrl: flagPayload.cameraFrameUrl,
                  timestamp: serverTimestamp
                }
              })
            ])
          }
        }
      } catch (e) {
        console.warn('[exam.socket] Evidence persistence note:', e.message)
      }
    })

    // ── STUDENT: Send Progress ──
    socket.on('student:progress', (data) => {
      if (!data?.examId || !data?.studentId) return
      if (!requireStudentAuth(socket, data.studentId)) return

      socket.to(`inv:${data.examId}`).emit('student:progress', {
        studentId: data.studentId,
        answered: data.answered,
        total: data.total
      })
    })

    // ── STUDENT: Send Chat ──
    socket.on('exam:chat', async (data) => {
      const { examId, studentId, studentName, message } = data || {}
      if (!examId || !studentId || !message?.trim()) return
      if (!requireStudentAuth(socket, studentId)) return

      io.to(`inv:${examId}`).emit('student:chat', {
        studentId,
        studentName: studentName || socket.data?.name || socket.user.name,
        message,
        timestamp: new Date().toISOString()
      })

      try {
        const prisma = global.prisma
        if (prisma) {
          await prisma.chatMessage.create({
            data: { examId, studentId, senderRole: 'student', message }
          })
        }
      } catch (e) {
        console.warn('[exam.socket] Chat save note:', e.message)
      }
    })

    // ── INVIGILATOR: Join Dashboard Room (Gated) ──
    socket.on('inv:join', (data, ack) => {
      const { examId } = data || {}
      if (!examId) {
        ack?.({ ok: false, message: 'Missing examId' })
        return
      }

      if (!requireStaffAuth(socket, examId)) {
        ack?.({ ok: false, message: 'Unauthorized for this examination' })
        return
      }

      socket.join(`inv:${examId}`)
      socket.data = { examId, role: socket.user.role || 'invigilator' }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SOCKET:INV] Invigilator joined room inv:${examId} (socket: ${socket.id})`)
      }
      ack?.({ ok: true, examId })
    })

    // ── INVIGILATOR: Warn Student (Gated with Ack) ──
    const handleWarn = async (data, ack) => {
      if (!data?.studentId) {
        ack?.({ ok: false, message: 'Missing studentId' })
        return
      }

      const examId = data.examId || socket.data?.examId || socket.user?.examId
      if (!requireStaffAuth(socket, examId)) {
        ack?.({ ok: false, message: 'Unauthorized' })
        return
      }

      const warnPayload = {
        message: data.message || 'Please maintain focus on the examination.',
        from: 'Invigilator',
        timestamp: new Date().toISOString()
      }

      io.to(`student:${data.studentId}`).emit('exam:warning', warnPayload)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CONTROL:WARN] Warning sent to student:${data.studentId} in exam:${examId}`)
      }
      ack?.({ ok: true, message: 'Warning dispatched' })
    }
    socket.on('inv:warn', handleWarn)
    socket.on('exam:warning', handleWarn)

    // ── INVIGILATOR: Pause Student Session (Gated with Ack) ──
    const handlePause = async (data, ack) => {
      if (!data?.studentId) {
        ack?.({ ok: false, message: 'Missing studentId' })
        return
      }

      const examId = data.examId || socket.data?.examId || socket.user?.examId
      if (!requireStaffAuth(socket, examId)) {
        ack?.({ ok: false, message: 'Unauthorized' })
        return
      }

      try {
        const prisma = global.prisma
        if (prisma && examId) {
          const session = await prisma.studentExam.findFirst({
            where: { studentId: data.studentId, examId }
          })

          if (session) {
            await transitionExamSession({
              studentExamId: session.id,
              targetStatus: SESSION_STATES.SUSPENDED,
              reason: data.reason || 'Session paused by proctor.',
              reqUser: socket.user,
              io
            })
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[CONTROL:PAUSE] Student ${data.studentId} paused in exam:${examId}`)
            }
            ack?.({ ok: true, message: 'Session paused' })
            return
          }
        }
        ack?.({ ok: false, message: 'Candidate session not found' })
      } catch (err) {
        console.warn('[exam.socket] Pause transition error:', err.message)
        ack?.({ ok: false, message: err.message })
      }
    }
    socket.on('inv:pause', handlePause)
    socket.on('exam:pause', handlePause)

    // ── INVIGILATOR: Resume Student Session (Gated with Ack) ──
    const handleResume = async (data, ack) => {
      if (!data?.studentId) {
        ack?.({ ok: false, message: 'Missing studentId' })
        return
      }

      const examId = data.examId || socket.data?.examId || socket.user?.examId
      if (!requireStaffAuth(socket, examId)) {
        ack?.({ ok: false, message: 'Unauthorized' })
        return
      }

      try {
        const prisma = global.prisma
        if (prisma && examId) {
          const session = await prisma.studentExam.findFirst({
            where: { studentId: data.studentId, examId }
          })

          if (session) {
            await transitionExamSession({
              studentExamId: session.id,
              targetStatus: SESSION_STATES.ACTIVE,
              reason: 'Session resumed by proctor.',
              reqUser: socket.user,
              io
            })
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[CONTROL:RESUME] Student ${data.studentId} resumed in exam:${examId}`)
            }
            ack?.({ ok: true, message: 'Session resumed' })
            return
          }
        }
        ack?.({ ok: false, message: 'Candidate session not found' })
      } catch (err) {
        console.warn('[exam.socket] Resume transition error:', err.message)
        ack?.({ ok: false, message: err.message })
      }
    }
    socket.on('inv:resume', handleResume)
    socket.on('exam:resume', handleResume)

    // ── INVIGILATOR: Terminate Student (Gated & Atomic State Transition) ──
    const handleTerminate = async (data, ack) => {
      if (!data?.studentId) {
        ack?.({ ok: false, message: 'Missing studentId' })
        return
      }

      const examId = data.examId || socket.data?.examId || socket.user?.examId
      if (!requireStaffAuth(socket, examId)) {
        ack?.({ ok: false, message: 'Unauthorized' })
        return
      }

      try {
        const prisma = global.prisma
        if (prisma && examId) {
          const session = await prisma.studentExam.findFirst({
            where: { studentId: data.studentId, examId }
          })

          if (session) {
            await transitionExamSession({
              studentExamId: session.id,
              targetStatus: SESSION_STATES.TERMINATED,
              reason: data.reason || 'Terminated by Invigilator for academic integrity violation.',
              reqUser: socket.user,
              io
            })
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[CONTROL:TERMINATE] Student ${data.studentId} terminated in exam:${examId}`)
            }
            ack?.({ ok: true, message: 'Termination completed' })
            return
          }
        }
        ack?.({ ok: false, message: 'Candidate session not found' })
      } catch (err) {
        console.warn('[exam.socket] Terminate transition error:', err.message)
        ack?.({ ok: false, message: err.message })
      }
    }
    socket.on('inv:terminate', handleTerminate)
    socket.on('exam:terminate', handleTerminate)

    // ── INVIGILATOR: Chat Reply ──
    socket.on('inv:chat', async (data) => {
      const { examId, studentId, message } = data || {}
      if (!studentId || !message?.trim()) return

      const targetExamId = examId || socket.data?.examId || socket.user?.examId
      if (!requireStaffAuth(socket, targetExamId)) return

      io.to(`student:${studentId}`).emit('inv:chatReply', {
        message,
        timestamp: new Date().toISOString()
      })

      try {
        const prisma = global.prisma
        if (prisma && targetExamId) {
          await prisma.chatMessage.create({
            data: { examId: targetExamId, studentId, senderRole: socket.user.role || 'invigilator', message }
          })
        }
      } catch (err) {
        console.warn('[exam.socket] inv:chat error:', err.message)
      }
    })

    // ── STUDENT: Send Chat to Invigilator ──
    socket.on('student:chat', async (data) => {
      const { examId, message } = data || {}
      if (!message?.trim() || !socket.user) return

      const targetExamId = examId || socket.data?.examId
      if (!requireStudentAuth(socket, socket.user.id)) return

      io.to(`inv:${targetExamId}`).emit('student:chat', {
        studentId: socket.user.id,
        studentName: socket.user.name,
        studentUsn: socket.user.usn,
        message: message.trim(),
        timestamp: new Date().toISOString()
      })

      try {
        const prisma = global.prisma
        if (prisma && targetExamId) {
          await prisma.chatMessage.create({
            data: {
              examId: targetExamId,
              studentId: socket.user.id,
              senderRole: 'student',
              message: message.trim()
            }
          }).catch(() => {})
        }
      } catch (err) {
        console.warn('[exam.socket] student:chat note:', err.message)
      }
    })

    // ── Clean Disconnect Handling ──
    socket.on('disconnect', () => {
      const { studentId, examId, role } = socket.data || {}
      if (role === 'student' && studentId && examId) {
        io.to(`inv:${examId}`).emit('student:offline', {
          studentId,
          timestamp: new Date().toISOString()
        })
      }
    })
  })
}
