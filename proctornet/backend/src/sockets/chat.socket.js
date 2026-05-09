/**
 * chat.socket.js — Private chat between students and invigilator
 * Full implementation in Step 41
 */
module.exports = function initChatSocket(io) {
  io.on('connection', (socket) => {
    // Student sends chat message
    socket.on('exam:chat', async ({ examId, studentId, message, studentExamId }) => {
      try {
        await global.prisma.chatMessage.create({
          data: { examId, studentId, senderRole: 'student', message },
        })
      } catch (e) { /* */ }
      io.to(`inv:${examId}`).emit('student:chat', { studentId, message, timestamp: new Date() })
    })

    // Invigilator replies
    socket.on('inv:chat', async ({ examId, studentId, message }) => {
      try {
        await global.prisma.chatMessage.create({
          data: { examId, studentId, senderRole: 'invigilator', message },
        })
      } catch (e) { /* */ }
      io.to(`student:${studentId}`).emit('inv:chatReply', { message, timestamp: new Date() })
    })
  })
}
