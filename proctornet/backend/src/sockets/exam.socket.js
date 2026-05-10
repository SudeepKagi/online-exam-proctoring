/**
 * exam.socket.js
 * Handles real-time proctoring events between students and invigilators.
 */
function initExamSocket(io) {
  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id)

    // Student joins exam room
    socket.on('exam:join', ({ studentId, examId, name, usn }) => {
      console.log(`Student ${usn} joining exam ${examId}`)
      socket.join(`exam:${examId}`)
      socket.join(`student:${studentId}`)
      
      // Notify all invigilators in this exam
      io.to(`inv:${examId}`).emit('student:online', { studentId, name, usn, socketId: socket.id })
    })

    // Student sends a flag (violation)
    socket.on('exam:flag', (data) => {
      const { examId, studentId, usn, eventType, severity, timestamp } = data
      console.log(`Violation: [${severity}] ${eventType} from ${usn}`)
      
      // Broadcast to all invigilators for this exam
      io.to(`inv:${examId}`).emit('student:violation', {
        studentId,
        usn,
        eventType,
        severity,
        timestamp: timestamp || new Date(),
        details: data.details || {}
      })
    })

    // Student sends periodic camera frame
    socket.on('exam:frame', ({ examId, studentId, frame }) => {
      io.to(`inv:${examId}`).emit('student:frame', { studentId, frame })
    })

    // Invigilator joins
    socket.on('inv:join', ({ examId }) => {
      console.log(`Invigilator joining monitor for exam ${examId}`)
      socket.join(`inv:${examId}`)
    })

    // Invigilator sends a warning to a student
    socket.on('inv:warn', ({ studentId, message }) => {
      console.log(`Warning student ${studentId}: ${message}`)
      io.to(`student:${studentId}`).emit('exam:warning', { message })
    })

    // Invigilator terminates a student's exam
    socket.on('inv:terminate', ({ studentId, reason }) => {
      console.log(`Terminating student ${studentId}: ${reason}`)
      io.to(`student:${studentId}`).emit('exam:terminated', { reason })
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id)
    })
  })
}

module.exports = initExamSocket
