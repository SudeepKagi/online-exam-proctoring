/**
 * invigilator.js - Virtual Invigilator Agent
 *
 * Simulates invigilator / proctor behaviors:
 * - 1 per 50 students
 * - Subscribes to inv:{examId} WebSocket room
 * - Fetches keyset paginated roster (12 candidates per page)
 * - Cycles roster pages every 30s (measuring roster_page p95 < 300ms)
 * - Promotes candidate to focus, inspects violation timeline
 * - 10% execute warn / pause actions
 */

const path = require('path')
module.paths.push(path.resolve(__dirname, '../../../proctornet/backend/node_modules'))
const { io } = require('socket.io-client')

class VirtualInvigilator {
  /**
   * @param {object} config
   * @param {number} config.index
   * @param {string} config.email
   * @param {string} config.password
   * @param {string} config.examId
   * @param {string} config.baseUrl
   * @param {string} config.wsUrl
   * @param {import('./prng').DeterministicPRNG} config.prng
   * @param {import('./metrics').MetricsCollector} config.metrics
   */
  constructor(config) {
    this.index = config.index
    this.email = config.email || 'loadtest-faculty@proctornet.test'
    this.password = config.password || 'Faculty123!'
    this.examId = config.examId
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.wsUrl = config.wsUrl || this.baseUrl
    this.prng = config.prng
    this.metrics = config.metrics

    this.token = null
    this.socket = null
    this.isRunning = false
    this.roster = []
    this.activeCursor = null
  }

  async request(path, opts = {}) {
    const url = `${this.baseUrl}${path}`
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(opts.headers || {})
    }

    const start = performance.now()
    const response = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    })

    const duration = performance.now() - start
    this.metrics.recordRequest(response.status)

    let data = null
    try {
      data = await response.json()
    } catch (e) {
      data = null
    }

    return { status: response.status, data, duration }
  }

  async login() {
    const res = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: this.email, password: this.password }
    })

    this.token = res.data.token
    return res.data
  }

  async connectWebSocket() {
    return new Promise((resolve) => {
      this.socket = io(this.wsUrl, {
        transports: ['websocket'],
        auth: { token: this.token },
        forceNew: true
      })

      this.socket.on('connect', () => {
        // Join staff room
        this.socket.emit('inv:join', { examId: this.examId }, (ack) => {
          resolve()
        })
      })

      this.socket.on('roster:delta', (deltas) => {
        // Roster deltas received
      })
    })
  }

  async loadRosterPage(cursor = null) {
    const query = cursor ? `?limit=12&cursor=${encodeURIComponent(cursor)}` : '?limit=12'
    const res = await this.request(`/api/v1/proctoring/exams/${this.examId}/roster${query}`)
    this.metrics.recordTiming('roster_page', res.duration)

    if (res.data && res.data.items) {
      this.roster = res.data.items
      this.activeCursor = res.data.nextCursor
    }
    return res.data
  }

  async sendWarning(attemptId, studentId, message = 'Please maintain examination integrity.') {
    return this.request(`/api/v1/proctoring/attempts/${attemptId}/warn`, {
      method: 'POST',
      body: { message }
    })
  }

  cleanup() {
    this.isRunning = false
    if (this.socket) {
      try { this.socket.disconnect() } catch (e) {}
      this.socket = null
    }
  }

  async runLifecycle(simulationOptions = {}) {
    this.isRunning = true
    const scale = simulationOptions.timeScale || 1.0

    try {
      await this.login()
      await this.connectWebSocket()

      // Initial roster load
      await this.loadRosterPage()

      // Periodic pagination cycle & random focus check
      const cycles = simulationOptions.cycles || 3
      for (let c = 0; c < cycles; c++) {
        if (!this.isRunning) break

        await new Promise(r => setTimeout(r, (30 * 100) * scale)) // Scaled 30s cycle
        await this.loadRosterPage(this.activeCursor)

        // 10% probability to take action on a candidate
        if (this.roster.length > 0 && this.prng.chance(0.10)) {
          const candidate = this.prng.choice(this.roster)
          if (candidate && candidate.attemptId) {
            await this.sendWarning(candidate.attemptId, candidate.studentId).catch(() => {})
          }
        }
      }
    } finally {
      this.cleanup()
    }
  }
}

module.exports = { VirtualInvigilator }
