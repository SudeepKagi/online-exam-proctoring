/**
 * chat.socket.js
 * Handles private proctoring chat between students and invigilators with authentication,
 * rate limiting, exam authorization, and message length enforcement (D-5).
 */

const chatRateLimitMap = new Map() // key: userId -> { count, resetTime }

// Periodic cleanup of chat rate limit map
const chatCleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, record] of chatRateLimitMap.entries()) {
    if (now > record.resetTime) {
      chatRateLimitMap.delete(key)
    }
  }
}, 60 * 1000)
if (chatCleanupInterval.unref) chatCleanupInterval.unref()

function initChatSocket(io) {
  io.on('connection', (socket) => {
    
    // Send message (Student -> Invigilator or vice versa)
    socket.on('chat:send', async (data) => {
      const { examId, studentId, message, senderRole, senderName } = data || {}
      if (!examId || !studentId || !message?.trim()) return

      // 1. Authentication validation
      if (!socket.user) {
        return socket.emit('socket:error', { code: 'UNAUTHENTICATED', message: 'Authentication required.' })
      }

      // 2. Message length limit (max 1000 characters)
      const trimmedMessage = message.trim()
      if (trimmedMessage.length > 1000) {
        return socket.emit('socket:error', { code: 'INVALID_PAYLOAD', message: 'Message exceeds maximum length (1000 characters).' })
      }

      // 3. Rate limiting (max 5 messages per 3 seconds per user)
      const userId = socket.user.id
      const now = Date.now()
      let userLimit = chatRateLimitMap.get(userId)
      if (!userLimit || now > userLimit.resetTime) {
        userLimit = { count: 1, resetTime: now + 3000 }
        chatRateLimitMap.set(userId, userLimit)
      } else {
        userLimit.count++
        if (userLimit.count > 5) {
          return socket.emit('socket:ratelimit', {
            event: 'chat:send',
            message: 'Chat message rate limit exceeded. Please wait a moment.'
          })
        }
      }

      const role = socket.user.role || senderRole

      // 4. Invigilator exam scope check
      if (role === 'invigilator' && socket.user.examId && socket.user.examId !== examId) {
        return socket.emit('socket:error', { code: 'FORBIDDEN', message: 'Not authorized to chat in this examination.' })
      }

      const effectiveStudentId = role === 'student' ? socket.user.id : studentId

      const payload = {
        studentId: effectiveStudentId,
        message: trimmedMessage,
        senderRole: role,
        senderName: senderName || socket.user.name || 'User',
        timestamp: new Date()
      }

      // 5. Broadcast to appropriate recipients
      if (role === 'student') {
        io.to(`inv:${examId}`).emit('chat:receive', payload)
      } else if (['invigilator', 'faculty', 'admin'].includes(role)) {
        io.to(`student:${studentId}`).emit('chat:receive', payload)
      }

      // 6. Asynchronously record in database for audit trail
      try {
        if (global.prisma?.chatMessage) {
          await global.prisma.chatMessage.create({
            data: {
              examId,
              studentId: effectiveStudentId,
              senderRole: role,
              senderId: socket.user.id,
              message: trimmedMessage,
              timestamp: payload.timestamp
            }
          })
        }
      } catch (err) {
        console.warn('[chat.socket] Message logging note:', err.message)
      }
    })

    // Join chat room
    socket.on('chat:join', ({ roomId }) => {
      if (!roomId) return
      if (!socket.user) {
        return socket.emit('socket:error', { code: 'UNAUTHENTICATED', message: 'Authentication required.' })
      }
      socket.join(`chat:${roomId}`)
    })
  })
}

module.exports = initChatSocket

