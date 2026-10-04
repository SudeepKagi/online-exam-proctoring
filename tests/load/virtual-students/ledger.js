/**
 * ledger.js - High-Throughput Write Ledger for Acknowledged Answer State
 *
 * Records every acknowledged answer write:
 * (attemptQuestionId, revision, optionId, ackTime, attemptId, studentId)
 * Outputs newline-delimited JSON (ndjson) to reports/load/<run-id>/ledger.ndjson
 * for post-test integrity reconciliation against PostgreSQL.
 */

const fs = require('fs')
const path = require('path')

class WriteLedger {
  /**
   * @param {string} runId - Unique load run identifier
   * @param {string} baseReportDir - Root directory for load test artifacts
   */
  constructor(runId, baseReportDir) {
    this.runId = runId || `run-${Date.now()}`
    this.reportDir = path.resolve(baseReportDir || path.join(__dirname, '../../../reports/load'), this.runId)

    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true })
    }

    this.ledgerPath = path.join(this.reportDir, 'ledger.ndjson')
    this.stream = fs.createWriteStream(this.ledgerPath, { flags: 'a', encoding: 'utf8' })

    // Latest state per attempt question: key = `${attemptId}:${attemptQuestionId}`
    this.latestByQuestion = new Map()
    this.totalAckedCount = 0
    this.totalFailedCount = 0
  }

  /**
   * Record an acknowledged answer write
   * @param {object} entry
   * @param {string} entry.studentId
   * @param {string} entry.attemptId
   * @param {string} entry.attemptQuestionId
   * @param {number} entry.revision
   * @param {string} entry.optionId
   * @param {number} entry.ackTime - Timestamp (Date.now())
   * @param {string} [entry.writeType] - 'batch' or 'individual'
   */
  recordAck(entry) {
    const record = {
      runId: this.runId,
      studentId: entry.studentId,
      attemptId: entry.attemptId,
      attemptQuestionId: entry.attemptQuestionId,
      revision: entry.revision,
      optionId: entry.optionId,
      ackTime: entry.ackTime || Date.now(),
      writeType: entry.writeType || 'batch'
    }

    this.totalAckedCount++
    this.latestByQuestion.set(`${entry.attemptId}:${entry.attemptQuestionId}`, record)

    const line = JSON.stringify(record) + '\n'
    if (!this.stream.write(line)) {
      // Buffer backpressure handled automatically by Node streams
    }
  }

  /**
   * Record a failed write attempt (for error accounting)
   */
  recordFailure(entry) {
    this.totalFailedCount++
  }

  /**
   * Get all latest acknowledged records as an array
   */
  getLatestRecords() {
    return Array.from(this.latestByQuestion.values())
  }

  /**
   * Flush and safely close the stream
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.stream.end((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

module.exports = { WriteLedger }
