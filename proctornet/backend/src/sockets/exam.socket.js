/**
 * exam.socket.js
 * Real-time proctoring socket — handles student ↔ invigilator communication.
 * Event contract is carefully documented; frontend must match these names exactly.
 */
function initExamSocket(io) {
  io.on('connection', (socket) => {
    // ── Student: Join exam room ──────────────────────────────────────
    socket.on('exam:join', ({ studentId, examId, name, usn }) => {
      if (!examId || !studentId) return

      socket.join(`exam:${examId}`)
      socket.join(`student:${studentId}`)
      socket.data = { studentId, examId, name, usn, role: 'student' }

      // Notify all invigilators watching this exam
      io.to(`inv:${examId}`).emit('student:joined', {
        studentId,
        name,
        usn,
        socketId: socket.id,
        joinedAt: new Date().toISOString()
      })

      console.log(`[SOCKET] Student ${usn} joined exam ${examId}`)
    })

    // ── Student: Report a violation/flag ────────────────────────────
    socket.on('exam:flag', (data) => {
      const { examId, studentId, studentName, eventType, severity, screenshotUrl, cameraFrameUrl } = data

      console.log(`[SOCKET] Flag: [${severity}] ${eventType} from student ${studentId}`)

      // Forward to all invigilators in this exam room
      io.to(`inv:${examId}`).emit('student:flag', {
        studentId,
        studentName,
        eventType,
        severity,
        screenshotUrl,
        cameraFrameUrl,
        timestamp: new Date().toISOString()
      })
    })

    // ── Student: Periodic camera frame ──────────────────────────────
    socket.on('exam:frame', ({ examId, studentId, frame }) => {
      // Forward low-res frame to invigilators (no logging to DB)
      io.to(`inv:${examId}`).emit('student:cameraFrame', { studentId, frame })
    })

    // ── Student: Progress update ─────────────────────────────────────
    socket.on('exam:progress', ({ examId, studentId, answered, total }) => {
      io.to(`inv:${examId}`).emit('student:progress', {
        studentId,
        progress: { answered, total }
      })
    })

    // ── Student: Chat message to invigilator ────────────────────────
    socket.on('exam:chat', ({ examId, studentId, message }) => {
      if (!message?.trim()) return

      io.to(`inv:${examId}`).emit('student:chat', {
        studentId,
        message: message.trim(),
        timestamp: new Date().toISOString()
      })
    })

    // ── Student: Lobby join (pre-exam) ───────────────────────────────
    socket.on('lobby:join', ({ examId, studentId }) => {
      socket.join(`lobby:${examId}`)
      io.to(`inv:${examId}`).emit('student:lobby', { studentId, joinedAt: new Date().toISOString() })
    })

    // ── Invigilator: Join monitoring room ───────────────────────────
    socket.on('inv:join', ({ examId }) => {
      if (!examId) return
      socket.join(`inv:${examId}`)
      socket.data = { examId, role: 'invigilator' }
      console.log(`[SOCKET] Invigilator joined monitor for exam ${examId}`)
    })

    // ── Invigilator: Send warning to specific student ────────────────
    socket.on('inv:warn', ({ studentId, message, examId }) => {
      if (!studentId || !message) return
      console.log(`[SOCKET] Warning → student ${studentId}: ${message}`)
      io.to(`student:${studentId}`).emit('exam:warning', {
        message,
        from: 'Invigilator',
        timestamp: new Date().toISOString()
      })
    })

    // ── Invigilator: Terminate student's exam ───────────────────────
    socket.on('inv:terminate', ({ studentId, reason, examId }) => {
      if (!studentId) return
      console.log(`[SOCKET] Terminating student ${studentId}: ${reason}`)
      io.to(`student:${studentId}`).emit('exam:terminated', {
        reason,
        timestamp: new Date().toISOString()
      })
    })

    // ── Invigilator: Reply to student chat ──────────────────────────
    socket.on('inv:chat', ({ studentId, message, examId }) => {
      if (!message?.trim() || !studentId) return
      io.to(`student:${studentId}`).emit('inv:chatReply', {
        message: message.trim(),
        timestamp: new Date().toISOString()
      })
    })

    // ── Disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const { studentId, examId, role } = socket.data || {}

      if (role === 'student' && studentId && examId) {
        io.to(`inv:${examId}`).emit('student:offline', {
          studentId,
          timestamp: new Date().toISOString()
        })
        console.log(`[SOCKET] Student ${studentId} went offline`)
      }
    })
  })
}

module.exports = initExamSocket
