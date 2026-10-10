const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class ChatMicroBatcher {
  constructor(maxBatchSize = 100, flushIntervalMs = 100) {
    this.maxBatchSize = maxBatchSize
    this.flushIntervalMs = flushIntervalMs
    this.buffer = []
    this.timer = null
    this.isFlushing = false
  }

  async queue(message) {
    return new Promise((resolve, reject) => {
      this.buffer.push({
        ...message,
        resolve,
        reject
      })

      if (this.buffer.length >= this.maxBatchSize) {
        this.flush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
      }
    })
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.buffer.length === 0 || this.isFlushing) {
      return
    }

    this.isFlushing = true
    const currentBatch = this.buffer.splice(0, this.maxBatchSize)

    try {
      const examIds = currentBatch.map(b => b.examId)
      const studentIds = currentBatch.map(b => b.studentId)
      const roles = currentBatch.map(b => b.senderRole)
      const texts = currentBatch.map(b => b.message.substring(0, 500))

      const insertSql = `
        INSERT INTO chat_messages (exam_id, student_id, sender_role, message, timestamp, is_read)
        SELECT
          u.exam_id,
          u.student_id,
          u.sender_role,
          u.message,
          now(),
          false
        FROM unnest(
          $1::uuid[],
          $2::uuid[],
          $3::text[],
          $4::text[]
        ) AS u(exam_id, student_id, sender_role, message)
        RETURNING id, exam_id, student_id, sender_role, message, timestamp;
      `

      const rows = await prisma.$queryRawUnsafe(insertSql, examIds, studentIds, roles, texts)

      // Broadcast to invigilators room via Redis Emitter (C-06)
      try {
        const { socketEmitter } = require('../../infra/websocket/emitter')
        if (rows) {
          for (const msg of rows) {
            socketEmitter.emitToInvigilators(msg.exam_id, 'chat:new_message', {
              id: msg.id.toString(),
              examId: msg.exam_id,
              studentId: msg.student_id,
              senderRole: msg.sender_role,
              message: msg.message,
              timestamp: msg.timestamp
            })
          }
        }
      } catch (wsErr) {
        logger.warn({ error: wsErr.message }, 'Failed to broadcast chat messages')
      }

      for (let i = 0; i < currentBatch.length; i++) {
        const row = rows[i]
        const formatted = row ? {
          id: row.id != null ? row.id.toString() : null,
          examId: row.exam_id,
          studentId: row.student_id,
          senderRole: row.sender_role,
          message: row.message,
          timestamp: row.timestamp
        } : { success: true }
        currentBatch[i].resolve(formatted)
      }
    } catch (err) {
      logger.error({ error: err.message }, 'Chat micro-batcher failed')
      for (const item of currentBatch) {
        item.reject(err)
      }
    } finally {
      this.isFlushing = false
      if (this.buffer.length > 0) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
      }
    }
  }
}

const chatMicroBatcher = new ChatMicroBatcher()

module.exports = {
  ChatMicroBatcher,
  chatMicroBatcher
}
