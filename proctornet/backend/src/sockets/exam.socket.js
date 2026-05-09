/**
 * exam.socket.js — Real-time exam event handlers
 * Full implementation in Step 35
 */
module.exports = function initExamSocket(io) {
  const examNs = io.of('/')

  examNs.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`)

    // Student joins exam room
    socket.on('exam:join', ({ studentId, examId, name, usn }) => {
      socket.join(`exam:${examId}`)
      socket.join(`student:${studentId}`)
      io.to(`inv:${examId}`).emit('student:joined', { studentId, name, usn })
      console.log(`[Socket] Student ${usn} joined exam ${examId}`)
    })

    // Student flag event
    socket.on('exam:flag', async (data) => {
      try {
        await global.prisma.evidenceLog.create({
          data: {
            studentExamId: data.studentExamId,
            eventType: data.eventType,
            severity: data.severity || 'LOW',
            screenshotUrl: data.screenshotUrl || null,
            cameraFrameUrl: data.cameraFrameUrl || null,
          },
        })
      } catch (e) { /* DB may not be connected in dev */ }
      io.to(`inv:${data.examId}`).emit('student:flag', data)
    })

    // Invigilator joins
    socket.on('inv:join', ({ examId }) => {
      socket.join(`inv:${examId}`)
      console.log(`[Socket] Invigilator joined exam ${examId}`)
    })

    // Invigilator warns student
    socket.on('inv:warn', ({ studentId, message }) => {
      io.to(`student:${studentId}`).emit('exam:warning', { message })
    })

    // Invigilator terminates student
    socket.on('inv:terminate', async ({ studentId, reason, examId }) => {
      io.to(`student:${studentId}`).emit('exam:terminated', { reason })
      try {
        await global.prisma.studentExam.updateMany({
          where: { studentId, examId },
          data: { status: 'TERMINATED', terminationReason: reason, submittedAt: new Date() },
        })
      } catch (e) { /* */ }
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })
}
