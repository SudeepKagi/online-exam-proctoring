const proctoringSql = require('./proctoring.sql')
const { socketEmitter } = require('../../infra/websocket/emitter')
const { logger } = require('../../shared/logging')

class ProctoringService {
  constructor(maxBatch = 100, flushIntervalMs = 150) {
    this.buffer = []
    this.maxBatch = maxBatch
    this.flushIntervalMs = flushIntervalMs
    this.timer = null
    this.io = null
  }

  setIO(io) {
    this.io = io
  }

  async recordViolation({ attemptId, examId, eventType, severity = 'MEDIUM', metadata = {}, evidenceS3Key = null }) {
    if (!attemptId || !eventType) {
      const err = new Error('attemptId and eventType are required')
      err.status = 400
      throw err
    }

    return new Promise((resolve, reject) => {
      this.buffer.push({
        attemptId,
        examId,
        eventType,
        severity,
        metadata,
        evidenceS3Key,
        resolve,
        reject
      })

      // Immediate WebSocket broadcast to live invigilator room
      try {
        if (examId) {
          socketEmitter.emitToInvigilators(examId, 'student:violation', {
            attemptId,
            eventType,
            severity,
            metadata,
            timestamp: new Date().toISOString()
          })
        }
      } catch (_) {}

      if (this.buffer.length >= this.maxBatch) {
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

    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, this.maxBatch)
    const logsToInsert = batch.map(b => ({
      attemptId: b.attemptId,
      eventType: b.eventType,
      severity: b.severity,
      metadata: b.metadata,
      evidenceS3Key: b.evidenceS3Key
    }))

    try {
      const inserted = await proctoringSql.batchInsertLogs(logsToInsert)
      batch.forEach((b, idx) => {
        b.resolve(inserted[idx] || { status: 'recorded' })
      })
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to flush proctoring batch to database')
      batch.forEach(b => b.reject(err))
    }
  }

  async getAttemptLogs(attemptId) {
    return proctoringSql.getLogsByAttempt(attemptId)
  }

  async getExamLogs(examId) {
    return proctoringSql.getLogsByExam(examId)
  }
}

const proctoringService = new ProctoringService()
module.exports = { proctoringService, ProctoringService }
