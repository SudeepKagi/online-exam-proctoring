module.exports = (io) => {
  io.on('connection', (socket) => {

    // ── STUDENT joins exam ──
    socket.on('exam:join', (data) => {
      const { examId, studentId, name, usn } = data
      socket.join(`exam:${examId}`)
      socket.join(`student:${studentId}`)
      socket.data = { studentId, examId, role: 'student' }
      
      io.to(`inv:${examId}`).emit('student:joined', {
        studentId, name, usn,
        joinedAt: new Date().toISOString()
      })
    })

    // ── STUDENT joins lobby ──
    socket.on('lobby:join', (data) => {
      const { examId, studentId, name, usn } = data
      socket.join(`lobby:${examId}`)
      socket.join(`student:${studentId}`)
      socket.data = { studentId, examId, role: 'student' }
      
      io.to(`inv:${examId}`).emit('student:joined', {
        studentId, name, usn,
        joinedAt: new Date().toISOString()
      })
    })

    // ── STUDENT sends camera frame ──
    socket.on('exam:frame', (data) => {
      io.to(`inv:${data.examId}`).emit('student:cameraFrame', {
        studentId: data.studentId,
        frame: data.frame
      })
    })

    // ── STUDENT sends screen frame ──
    socket.on('exam:screenFrame', (data) => {
      io.to(`inv:${data.examId}`).emit('student:screenFrame', {
        studentId: data.studentId,
        frame: data.frame
      })
    })

    // ── WebRTC Signaling Events ──
    socket.on('webrtc:request-stream', (data) => {
      const { studentId, examId } = data
      io.to(`student:${studentId}`).emit('webrtc:request-stream', {
        invId: socket.id,
        examId
      })
    })

    socket.on('webrtc:offer', (data) => {
      const { offer, invId, studentId } = data
      io.to(invId).emit('webrtc:offer', {
        offer,
        studentId,
        senderId: socket.id
      })
    })

    socket.on('webrtc:answer', (data) => {
      const { answer, studentId } = data
      io.to(`student:${studentId}`).emit('webrtc:answer', {
        answer,
        invId: socket.id
      })
    })

    socket.on('webrtc:ice-candidate', (data) => {
      const { candidate, targetId } = data
      if (socket.data?.role === 'student') {
        io.to(targetId).emit('webrtc:ice-candidate', {
          candidate,
          senderId: socket.id,
          studentId: socket.data.studentId
        })
      } else {
        io.to(`student:${targetId}`).emit('webrtc:ice-candidate', {
          candidate,
          senderId: socket.id
        })
      }
    })

    // ── STUDENT sends flag/violation ──
    socket.on('exam:flag', async (data) => {
      // Forward to invigilator immediately
      io.to(`inv:${data.examId}`).emit('student:flag', {
        studentId: data.studentId,
        studentName: data.studentName,
        studentUsn: data.studentUsn,
        eventType: data.eventType,
        severity: data.severity,
        screenshotUrl: data.screenshotUrl || null,
        cameraFrameUrl: data.cameraFrameUrl || null,
        timestamp: new Date().toISOString()
      })
      
      // Save to DB
      try {
        const prisma = global.prisma
        const studentExam = await prisma.studentExam.findFirst({
          where: { studentId: data.studentId, examId: data.examId }
        })
        if (studentExam) {
          await prisma.studentExam.update({
            where: { id: studentExam.id },
            data: { flagCount: { increment: 1 } }
          }).catch(() => {})

          await prisma.verificationAuditLog.create({
            data: {
              studentId: data.studentId,
              studentExamId: studentExam.id,
              checkType: data.eventType || 'EXAM_VIOLATION',
              status: 'FLAGGED',
              details: typeof data.details === 'string' ? data.details : JSON.stringify(data),
              timestamp: new Date()
            }
          }).catch(() => {})
        }
      } catch(e) {
        console.warn('Socket flag log warning:', e.message)
      }
    })

    // ── STUDENT sends progress ──
    socket.on('student:progress', (data) => {
      socket.to(`inv:${data.examId}`)
        .emit('student:progress', {
          studentId: data.studentId,
          answered: data.answered,
          total: data.total
        })
    })

    // ── STUDENT sends chat ──
    socket.on('exam:chat', async (data) => {
      const { examId, studentId, studentName, message } 
        = data
      
      io.to(`inv:${examId}`).emit('student:chat', {
        studentId,
        studentName,
        message,
        timestamp: new Date().toISOString()
      })
      
      try {
        const prisma = global.prisma
        await prisma.chatMessage.create({
          data: {
            examId,
            studentId,
            senderRole: 'student',
            message
          }
        })
      } catch(e) {
        console.error('Chat save error:', e.message)
      }
    })

    // ── INVIGILATOR joins ──
    socket.on('inv:join', (data) => {
      socket.join(`inv:${data.examId}`)
      socket.data = { 
        examId: data.examId, role: 'invigilator' 
      }
    })

    // ── INVIGILATOR warns student ──
    socket.on('inv:warn', (data) => {
      io.to(`student:${data.studentId}`)
        .emit('exam:warning', {
          message: data.message,
          timestamp: new Date().toISOString()
        })
    })

    // ── INVIGILATOR terminates student ──
    socket.on('inv:terminate', async (data) => {
      io.to(`student:${data.studentId}`)
        .emit('exam:terminated', {
          reason: data.reason
        })
      
      try {
        const prisma = global.prisma
        await prisma.studentExam.updateMany({
          where: {
            studentId: data.studentId,
            examId: data.examId
          },
          data: {
            status: 'TERMINATED',
            terminationReason: data.reason,
            submittedAt: new Date()
          }
        })
      } catch(e) {}
    })

    // ── INVIGILATOR sends chat reply ──
    socket.on('inv:chat', async (data) => {
      const { examId, studentId, message } = data
      
      io.to(`student:${studentId}`)
        .emit('inv:chatReply', {
          message,
          timestamp: new Date().toISOString()
        })
      
      try {
        const prisma = global.prisma
        await prisma.chatMessage.create({
          data: {
            examId,
            studentId,
            senderRole: 'invigilator',
            message
          }
        })
      } catch(e) {}
    })

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
      const { studentId, examId, role } = socket.data || {}
      if(role === 'student' && studentId && examId) {
        io.to(`inv:${examId}`)
          .emit('student:offline', { studentId })
      }
    })
  })
}
