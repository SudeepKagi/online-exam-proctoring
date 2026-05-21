module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

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
      console.log(`Student ${usn} joined exam ${examId}`)
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
      console.log(`Student ${usn} joined lobby ${examId}`)
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
        const { PrismaClient } = require('@prisma/client')
        const prisma = new PrismaClient()
        // Wait, check the relation fields of EvidenceLog in the active Prisma schema.
        // In active schema: EvidenceLog has studentExamId, which is NOT nullable.
        // Let's check studentExamId. We need to query studentExamId first!
        const studentExam = await prisma.studentExam.findFirst({
          where: { studentId: data.studentId, examId: data.examId }
        })
        if (studentExam) {
          await prisma.evidenceLog.create({
            data: {
              studentExamId: studentExam.id,
              eventType: data.eventType,
              severity: data.severity,
              screenshotUrl: data.screenshotUrl || null,
              cameraFrameUrl: data.cameraFrameUrl || null,
              details: data.details || null
            }
          })
        }
        await prisma.$disconnect()
      } catch(e) {
        console.error('Evidence log error:', e.message)
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
        const { PrismaClient } = require('@prisma/client')
        const prisma = new PrismaClient()
        await prisma.chatMessage.create({
          data: {
            examId,
            studentId,
            senderRole: 'student',
            message
          }
        })
        await prisma.$disconnect()
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
      console.log(`Invigilator joined exam ${data.examId}`)
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
        const { PrismaClient } = require('@prisma/client')
        const prisma = new PrismaClient()
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
        await prisma.$disconnect()
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
        const { PrismaClient } = require('@prisma/client')
        const prisma = new PrismaClient()
        await prisma.chatMessage.create({
          data: {
            examId,
            studentId,
            senderRole: 'invigilator',
            message
          }
        })
        await prisma.$disconnect()
      } catch(e) {}
    })

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
      const { studentId, examId, role } = socket.data || {}
      if(role === 'student' && studentId && examId) {
        io.to(`inv:${examId}`)
          .emit('student:offline', { studentId })
      }
      console.log('Client disconnected:', socket.id)
    })
  })
}
