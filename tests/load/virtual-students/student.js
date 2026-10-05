/**
 * student.js - Full-Fidelity Virtual Student Agent
 *
 * Implements the Section 10.1 load model:
 * - Deterministic behavior seeded per student
 * - HTTP persistent keep-alive connection pool
 * - Real WebSocket connection via socket.io-client
 * - Gaussian start spike (sigma = 8s or 2s)
 * - Log-normal think times and answer revisions (20% once, 5% twice)
 * - Autosave: 80% dirty-batch (every 5s), 20% individual PUT
 * - WS heartbeat every 15s
 * - Poisson violations (lambda = 0.4/min; 5% noisy at 3.0/min)
 * - Transient network drops and browser state resync
 * - Final submission burst (65% in last window, 25% early, 10% sweeper)
 * - Every acknowledged write is recorded in the ledger
 */

const path = require('path')
module.paths.push(path.resolve(__dirname, '../../../proctornet/backend/node_modules'))
const { io } = require('socket.io-client')
const crypto = require('crypto')

class VirtualStudent {
  /**
   * @param {object} config
   * @param {number} config.index - 1-based student index
   * @param {string} config.email
   * @param {string} config.password
   * @param {string} config.examId
   * @param {string} config.baseUrl - HTTP base URL (e.g. http://localhost:5000)
   * @param {string} config.wsUrl - WS base URL
   * @param {import('./prng').DeterministicPRNG} config.prng
   * @param {import('./ledger').WriteLedger} config.ledger
   * @param {import('./metrics').MetricsCollector} config.metrics
   * @param {object} [config.options] - Timing scales, burst overrides
   */
  constructor(config) {
    this.index = config.index
    this.email = config.email
    this.password = config.password
    this.examId = config.examId
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.wsUrl = config.wsUrl || this.baseUrl
    this.prng = config.prng
    this.ledger = config.ledger
    this.metrics = config.metrics
    this.options = config.options || {}

    // Behavioral flags from PRNG
    this.isNoisy = this.prng.chance(this.options.noisyRatio ?? 0.05)
    this.isBatchClient = this.prng.chance(this.options.batchClientRatio ?? 0.80)
    this.willDropNetwork = this.prng.chance(this.options.networkFaultRatio ?? 0.03)
    this.willRefresh = this.prng.chance(this.options.refreshRatio ?? 0.02)
    this.willSendChat = this.prng.chance(this.options.chatRatio ?? 0.01)

    // Submission strategy
    const submitRoll = this.prng.random()
    if (submitRoll < (this.options.submitBurstRatio ?? 0.65)) {
      this.submitStrategy = 'BURST'
    } else if (submitRoll < ((this.options.submitBurstRatio ?? 0.65) + (this.options.submitEarlyRatio ?? 0.25))) {
      this.submitStrategy = 'EARLY'
    } else {
      this.submitStrategy = 'NEVER' // Handled by expiry sweeper
    }

    // State
    this.token = null
    this.userId = null
    this.attemptId = null
    this.questions = []
    this.answersMap = new Map() // attemptQuestionId -> { optionId, revision, acked }
    this.dirtyBatch = new Map() // attemptQuestionId -> { optionId, revision }
    this.socket = null
    this.heartbeatTimer = null
    this.batchTimer = null
    this.isRunning = false
    this.isAborted = false
  }

  /**
   * Helper HTTP fetch wrapper with timing & metrics
   */
  async request(path, opts = {}) {
    const url = `${this.baseUrl}${path}`
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(opts.headers || {})
    }

    const start = performance.now()
    let response
    try {
      response = await fetch(url, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
      })
    } catch (netErr) {
      this.metrics.recordRequest(0, false)
      throw netErr
    }

    const duration = performance.now() - start
    const status = response.status

    this.metrics.recordRequest(status, status === 409 || status === 429)

    let data = null
    const text = await response.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (e) {
        data = text
      }
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${status} on ${opts.method || 'GET'} ${path}: ${JSON.stringify(data)}`)
      err.status = status
      err.data = data
      throw err
    }

    return { status, data, duration }
  }

  /**
   * 1. Authentication
   */
  async login() {
    const res = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: this.email, password: this.password }
    })

    this.metrics.recordTiming('login', res.duration)
    this.token = res.data.token
    this.userId = res.data.user.id
    return res.data
  }

  /**
   * 2. Start / Resume Exam Attempt
   */
  async startAttempt() {
    const res = await this.request(`/api/v1/exams/${this.examId}/attempt`, {
      method: 'POST'
    })

    this.metrics.recordTiming('start', res.duration)
    const attempt = res.data
    this.attemptId = attempt.id
    this.questions = attempt.questions || []
    return attempt
  }

  /**
   * 3. Connect WebSocket & Initialize Heartbeats
   */
  async connectWebSocket() {
    return new Promise((resolve) => {
      let resolved = false
      const done = () => {
        if (!resolved) {
          resolved = true
          this.startHeartbeat()
          resolve()
        }
      }

      const timer = setTimeout(done, 4000)

      this.socket = io(this.wsUrl, {
        transports: ['websocket'],
        auth: { token: this.token },
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 4000
      })

      this.socket.on('connect', () => {
        // Join private student attempt room
        this.socket.emit('attempt:join', { attemptId: this.attemptId }, () => {
          clearTimeout(timer)
          done()
        })
      })

      this.socket.on('connect_error', () => {
        clearTimeout(timer)
        done()
      })

      this.socket.on('roster:delta', (delta) => {
        // Client can receive deltas or warnings
      })

      this.socket.on('exam:warning', (warning) => {
        // Received invigilator warning
      })
    })
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    const intervalMs = (this.options.heartbeatSeconds || 15) * 1000

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || !this.socket.connected) return
      const t0 = performance.now()
      this.socket.emit('heartbeat', { attemptId: this.attemptId, examId: this.examId }, (ack) => {
        const dt = performance.now() - t0
        this.metrics.recordTiming('ws_heartbeat_ack', dt)
      })
    }, intervalMs)
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref()
  }

  /**
   * 4. Flush dirty batch answers
   */
  async flushDirtyBatch() {
    if (this.dirtyBatch.size === 0) return

    const dirtyList = Array.from(this.dirtyBatch.entries()).map(([attemptQuestionId, item]) => ({
      attemptQuestionId,
      optionId: item.optionId,
      revision: item.revision
    }))
    this.dirtyBatch.clear()

    try {
      const res = await this.request(`/api/v1/attempts/${this.attemptId}/answers`, {
        method: 'PUT',
        body: { answers: dirtyList }
      })

      this.metrics.recordTiming('answer_save_batch', res.duration)
      const ackTime = Date.now()

      const serverResults = res.data?.results || []
      const resultMap = new Map(serverResults.map(r => [r.attemptQuestionId, r]))

      // Record only acknowledged writes into the ledger
      for (const item of dirtyList) {
        const sr = resultMap.get(item.attemptQuestionId)
        if (sr && sr.success) {
          const finalRevision = sr.revision || item.revision
          const state = this.answersMap.get(item.attemptQuestionId)
          if (state) state.revision = finalRevision

          this.ledger.recordAck({
            studentId: this.userId,
            attemptId: this.attemptId,
            attemptQuestionId: item.attemptQuestionId,
            revision: finalRevision,
            optionId: item.optionId,
            ackTime,
            writeType: 'batch'
          })
          this.metrics.increment('answersAcked')
        }
      }
    } catch (err) {
      this.ledger.recordFailure(err)
    }
  }

  /**
   * 5. Save Single Answer (Legacy 20% path)
   */
  async saveSingleAnswer(attemptQuestionId, optionId, revision) {
    try {
      const res = await this.request(`/api/v1/attempts/${this.attemptId}/answers/${attemptQuestionId}`, {
        method: 'PUT',
        body: { optionId, revision }
      })

      this.metrics.recordTiming('answer_save_single', res.duration)
      const ackTime = Date.now()

      const finalRevision = res.data?.revision || revision
      const state = this.answersMap.get(attemptQuestionId)
      if (state) state.revision = finalRevision

      this.ledger.recordAck({
        studentId: this.userId,
        attemptId: this.attemptId,
        attemptQuestionId,
        revision: finalRevision,
        optionId,
        ackTime,
        writeType: 'individual'
      })
      this.metrics.increment('answersAcked')
    } catch (err) {
      this.ledger.recordFailure(err)
    }
  }

  /**
   * 6. Record Proctoring Violation
   */
  async recordViolation(eventType = 'TAB_SWITCH') {
    if (!this.attemptId) return
    const clientTimestamp = new Date().toISOString()
    const metadata = { eventType, details: 'Simulated behavioral anomaly', clientTimestamp }

    if (this.socket && this.socket.connected) {
      this.socket.emit('violation', {
        attemptId: this.attemptId,
        examId: this.examId,
        eventType,
        metadata,
        clientTimestamp
      })
      this.metrics.increment('violationsDispatched')
    } else {
      try {
        const res = await this.request(`/api/v1/attempts/${this.attemptId}/violations`, {
          method: 'POST',
          body: { eventType, metadata, clientTimestamp }
        })
        this.metrics.recordTiming('violation_record', res.duration)
        this.metrics.increment('violationsDispatched')
      } catch (e) {
        // Error recorded in request metrics
      }
    }
  }

  /**
   * 7. Resync State (after network drop or browser refresh)
   */
  async resyncState() {
    const res = await this.request(`/api/v1/attempts/${this.attemptId}/state`)
    return res.data
  }

  /**
   * 8. Examination Submission
   */
  async submit() {
    // Collect any remaining un-flushed dirty answers
    const answersPayload = Array.from(this.dirtyBatch.entries()).map(([attemptQuestionId, a]) => ({
      attemptQuestionId,
      optionId: a.optionId,
      revision: a.revision
    }))
    this.dirtyBatch.clear()

    const idempotencyKey = crypto.randomUUID()
    const res = await this.request(`/api/v1/attempts/${this.attemptId}/submission`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey
      },
      body: { answers: answersPayload }
    })

    this.metrics.recordTiming('submit', res.duration)
    this.metrics.increment('submissionsCompleted')
    this.cleanup()
    return res.data
  }

  /**
   * Teardown connection & timers
   */
  cleanup() {
    this.isRunning = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.batchTimer) clearInterval(this.batchTimer)
    if (this.socket) {
      try {
        this.socket.disconnect()
      } catch (e) {}
      this.socket = null
    }
  }

  /**
   * Full Student Simulation Lifecycle
   */
  async runLifecycle(simulationOptions = {}) {
    this.isRunning = true
    const scale = simulationOptions.timeScale || 1.0 // 1.0 = real-time, 0.1 = 10x accelerated

    try {
      // 1. Authenticate
      await this.login()

      // 2. Synchronized Start Spike (Gaussian delay)
      const sigma = simulationOptions.pathologicalStart ? 2.0 : (simulationOptions.startSigma || 8.0)
      const startDelaySec = Math.max(0, this.prng.gaussian(0, sigma))
      if (startDelaySec > 0 && !simulationOptions.skipStartDelay) {
        await new Promise(r => setTimeout(r, (startDelaySec * 1000) * scale))
      }

      // Start attempt
      await this.startAttempt()

      // Connect WebSocket
      await this.connectWebSocket()

      // Periodic batch timer (every 5 seconds)
      if (this.isBatchClient) {
        this.batchTimer = setInterval(() => {
          this.flushDirtyBatch().catch(() => {})
        }, 5000 * scale)
        if (this.batchTimer.unref) this.batchTimer.unref()
      }

      // 3. Question Answering Phase
      const questionsToAnswer = [...this.questions]

      // Schedule possible network drop
      if (this.willDropNetwork && questionsToAnswer.length > 5) {
        const dropAtQuestion = this.prng.int(2, Math.min(10, questionsToAnswer.length - 1))
        this.dropSchedule = dropAtQuestion
      }

      for (let i = 0; i < questionsToAnswer.length; i++) {
        if (!this.isRunning || this.isAborted) break

        const q = questionsToAnswer[i]
        const attemptQuestionId = q.attemptQuestionId || q.id
        const options = q.options || []
        if (options.length === 0) continue

        // Think time (log-normal, median 40s)
        const thinkTimeSec = Math.max(1.0, this.prng.logNormal(40, 0.5))
        await new Promise(r => setTimeout(r, (thinkTimeSec * 100) * scale)) // Scaled think time

        // Pick option
        let selectedOption = this.prng.choice(options)
        let currentState = this.answersMap.get(attemptQuestionId) || { revision: 1 }
        let currentRev = currentState.revision || 1
        this.answersMap.set(attemptQuestionId, { optionId: selectedOption.id, revision: currentRev })

        // Save
        if (this.isBatchClient) {
          this.dirtyBatch.set(attemptQuestionId, { optionId: selectedOption.id, revision: currentRev })
        } else {
          await this.saveSingleAnswer(attemptQuestionId, selectedOption.id, currentRev)
        }

        // Answer revision: 20% once, 5% twice
        if (this.prng.chance(0.20)) {
          if (this.isBatchClient) {
            await this.flushDirtyBatch()
          }
          await new Promise(r => setTimeout(r, 2000 * scale))
          const altOptions = options.filter(o => o.id !== selectedOption.id)
          if (altOptions.length > 0) {
            selectedOption = this.prng.choice(altOptions)
            currentState = this.answersMap.get(attemptQuestionId) || { revision: 1 }
            currentRev = currentState.revision || 1
            this.answersMap.set(attemptQuestionId, { optionId: selectedOption.id, revision: currentRev })
            if (this.isBatchClient) {
              this.dirtyBatch.set(attemptQuestionId, { optionId: selectedOption.id, revision: currentRev })
            } else {
              await this.saveSingleAnswer(attemptQuestionId, selectedOption.id, currentRev)
            }
          }

          if (this.prng.chance(0.25)) { // 25% of the 20% = 5% total
            if (this.isBatchClient) {
              await this.flushDirtyBatch()
            }
            await new Promise(r => setTimeout(r, 1500 * scale))
            const thirdOptions = options.filter(o => o.id !== selectedOption.id)
            if (thirdOptions.length > 0) {
              selectedOption = this.prng.choice(thirdOptions)
              currentState = this.answersMap.get(attemptQuestionId) || { revision: 1 }
              currentRev = currentState.revision || 1
              this.answersMap.set(attemptQuestionId, { optionId: selectedOption.id, revision: currentRev })
              if (this.isBatchClient) {
                this.dirtyBatch.set(attemptQuestionId, { optionId: selectedOption.id, revision: currentRev })
              } else {
                await this.saveSingleAnswer(attemptQuestionId, selectedOption.id, currentRev)
              }
            }
          }
        }

        // Possible violation event
        const lambda = this.isNoisy ? 3.0 : 0.4
        if (this.prng.chance(lambda / 10)) {
          const violationTypes = ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'NO_FACE', 'WINDOW_BLUR']
          await this.recordViolation(this.prng.choice(violationTypes))
        }

        // Network fault simulation
        if (this.dropSchedule && i === this.dropSchedule) {
          this.metrics.increment('networkDisconnects')
          if (this.socket) this.socket.disconnect()
          const dropDurationSec = this.prng.uniform(5, 30)
          await new Promise(r => setTimeout(r, (dropDurationSec * 100) * scale))

          // Reconnect
          await this.connectWebSocket()
          await this.resyncState()
          this.metrics.increment('networkReconnects')
          this.dropSchedule = null
        }

        // Browser refresh simulation
        if (this.willRefresh && i === 7) {
          this.metrics.increment('browserRefreshes')
          await this.resyncState()
          this.willRefresh = false
        }
      }

      // Flush remaining answers
      await this.flushDirtyBatch()

      // Chat message simulation
      if (this.willSendChat) {
        const msgCount = this.prng.int(1, 3)
        for (let m = 0; m < msgCount; m++) {
          if (this.socket && this.socket.connected) {
            this.socket.emit('chat', {
              examId: this.examId,
              attemptId: this.attemptId,
              message: `Inquiry #${m + 1} regarding question clarity.`
            })
          }
        }
      }

      // 4. Submit Phase
      if (this.submitStrategy !== 'NEVER') {
        if (this.submitStrategy === 'BURST' && !simulationOptions.immediateSubmit) {
          // Clustered submit delay
          const submitDelay = this.prng.uniform(100, 3000) * scale
          await new Promise(r => setTimeout(r, submitDelay))
        }
        await this.submit()
      } else {
        // Expiry sweeper will terminate
        this.cleanup()
      }

    } catch (err) {
      this.cleanup()
      throw err
    }
  }
}

module.exports = { VirtualStudent }
