/**
 * chat.socket.js
 * Handles private proctoring chat between students and invigilators.
 */
function initChatSocket(io) {
  io.on('connection', (socket) => {
    
    // Send message (Student -> Invigilator or vice versa)
    socket.on('chat:send', (data) => {
      const { examId, studentId, message, senderRole, senderName } = data
      
      const payload = {
        studentId,
        message,
        senderRole,
        senderName,
        timestamp: new Date()
      }

      if (senderRole === 'student') {
        // Broadcast to invigilators
        io.to(`inv:${examId}`).emit('chat:receive', payload)
      } else if (senderRole === 'invigilator') {
        // Send to specific student
        io.to(`student:${studentId}`).emit('chat:receive', payload)
      }
    })

    // Join chat room
    socket.on('chat:join', ({ roomId }) => {
      socket.join(`chat:${roomId}`)
    })
  })
}

module.exports = initChatSocket
