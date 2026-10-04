/**
 * rosterCoalescer.js
 * Coalesces student roster delta events every 500ms per exam room.
 * Prevents socket buffer exhaustion when thousands of students trigger events simultaneously.
 */

const { logger } = require('../../shared/logging')

class RosterDeltaCoalescer {
  constructor(flushIntervalMs = 500) {
    this.flushIntervalMs = flushIntervalMs
    this.buffers = new Map() // examId -> Map(attemptId -> mergedDelta)
    this.io = null
    this.timer = null
    this.emissionCount = 0 // for testing & telemetry
  }

  /**
   * Bind active Socket.IO server instance
   */
  setIO(io) {
    this.io = io
    this.start()
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.flush()
    }, this.flushIntervalMs)
    if (this.timer.unref) this.timer.unref()
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Queue a delta update for a student attempt
   * @param {string} examId 
   * @param {object} delta { attemptId, studentId, ...fields }
   */
  queueDelta(examId, delta) {
    if (!examId || !delta?.attemptId) return

    if (!this.buffers.has(examId)) {
      this.buffers.set(examId, new Map())
    }

    const examBuffer = this.buffers.get(examId)
    const existing = examBuffer.get(delta.attemptId) || {}

    // Merge changes
    examBuffer.set(delta.attemptId, {
      ...existing,
      ...delta,
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * Flush all buffered deltas across all exams or a specific exam
   */
  flush(targetExamId = null) {
    if (!this.io) return

    const examIds = targetExamId ? [targetExamId] : Array.from(this.buffers.keys())

    for (const examId of examIds) {
      const examBuffer = this.buffers.get(examId)
      if (!examBuffer || examBuffer.size === 0) continue

      const deltas = Array.from(examBuffer.values())
      examBuffer.clear()

      try {
        this.io.to(`inv:${examId}`).emit('roster:delta', {
          examId,
          deltas,
          batchSize: deltas.length,
          timestamp: new Date().toISOString()
        })
        this.emissionCount++
      } catch (err) {
        logger.warn({ error: err.message, examId }, 'Failed to emit roster:delta batch')
      }
    }
  }

  /**
   * Reset telemetry counter for tests
   */
  resetEmissionCount() {
    this.emissionCount = 0
  }
}

const rosterCoalescer = new RosterDeltaCoalescer(500)

module.exports = {
  RosterDeltaCoalescer,
  rosterCoalescer
}
