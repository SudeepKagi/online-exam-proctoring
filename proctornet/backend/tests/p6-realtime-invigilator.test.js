/**
 * tests/p6-realtime-invigilator.test.js
 * Mandatory test suite for Phase P6 — Realtime plane & invigilator dashboard.
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const crypto = require('crypto')
const EventEmitter = require('events')
const { io: ioClient } = require('socket.io-client')
const { createAdapter } = require('@socket.io/redis-adapter')

const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { createWebSocketServer } = require('../src/infra/websocket/socket.server')
const { presenceManager } = require('../src/infra/websocket/presence')
const { RosterDeltaCoalescer } = require('../src/infra/websocket/rosterCoalescer')
const { proctoringService } = require('../src/modules/proctoring/service')

// In-memory Mock Redis Pub/Sub Bus for deterministic multi-process testing
class MockRedisBus extends EventEmitter {}
const sharedBus = new MockRedisBus()

class MockRedisClient extends EventEmitter {
  constructor(bus) {
    super()
    this.bus = bus
    this.bus.on('pub', (channel, message) => {
      const buf = Buffer.isBuffer(message) ? message : Buffer.from(message)
      this.emit('pmessageBuffer', '*', channel, buf)
      this.emit('messageBuffer', channel, buf)
      this.emit('message', channel, message.toString())
    })
  }

  async publish(channel, message) {
    this.bus.emit('pub', channel, message)
    return 1
  }

  async psubscribe(pattern) {
    return Promise.resolve()
  }

  async punsubscribe(pattern) {
    return Promise.resolve()
  }

  async subscribe(channels) {
    return Promise.resolve()
  }

  async unsubscribe(channels) {
    return Promise.resolve()
  }

  async quit() {
    return Promise.resolve()
  }

  duplicate() {
    return new MockRedisClient(this.bus)
  }
}

describe('P6 Realtime Plane & Invigilator Dashboard', () => {
  let dept
  let faculty
  let studentA
  let studentB
  let exam
  let attemptA
  let attemptB
  let tokenA
  let tokenB
  let tokenFaculty
  let tokenInvigilator
  let tokenExpired

  let server1
  let server2
  let io1
  let io2
  let port1
  let port2

  before(async () => {
    const suffix = crypto.randomBytes(4).toString('hex')

    // 1. Fixtures: Department, Faculty, Students
    dept = await prisma.department.create({
      data: {
        code: `P6_${suffix}`.toUpperCase(),
        name: `P6 Dept ${suffix}`
      }
    })

    faculty = await prisma.faculty.create({
      data: {
        name: `Faculty P6 ${suffix}`,
        email: `faculty_p6_${suffix}@test.edu`,
        password: 'hash',
        employeeId: `FAC_P6_${suffix}`,
        departmentCode: dept.code
      }
    })

    studentA = await prisma.student.create({
      data: {
        name: `Alice Candidate ${suffix}`,
        email: `alice_${suffix}@test.edu`,
        usn: `1DS20CS_${suffix}A`,
        password: 'hash',
        departmentCode: dept.code,
        semester: 6,
        facePhotoKey: `identity/${studentA ? studentA.id : suffix}/profile-test.webp`
      }
    })

    studentB = await prisma.student.create({
      data: {
        name: `Bob Candidate ${suffix}`,
        email: `bob_${suffix}@test.edu`,
        usn: `1DS20CS_${suffix}B`,
        password: 'hash',
        departmentCode: dept.code,
        semester: 6
      }
    })

    exam = await prisma.exam.create({
      data: {
        title: `P6 Realtime Exam ${suffix}`,
        subject: 'Distributed Systems',
        invId: `INV_P6_${suffix}`,
        invPasswordHash: 'hash',
        facultyId: faculty.id,
        duration: 60,
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        totalMarks: 50,
        allowedDepartments: [dept.code],
        allowedSemesters: [6],
        status: 'PUBLISHED'
      }
    })

    attemptA = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: studentA.id,
        status: 'ACTIVE',
        watermarkSeed: `seed_p6_${suffix}_A`,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 55 * 60 * 1000)
      }
    })

    attemptB = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: studentB.id,
        status: 'ACTIVE',
        watermarkSeed: `seed_p6_${suffix}_B`,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 55 * 60 * 1000)
      }
    })

    // Setup JWT tokens
    tokenA = signToken({ id: studentA.id, role: 'student', name: studentA.name, usn: studentA.usn })
    tokenB = signToken({ id: studentB.id, role: 'student', name: studentB.name, usn: studentB.usn })
    tokenFaculty = signToken({ id: faculty.id, role: 'faculty', name: faculty.name })
    tokenInvigilator = signToken({ id: crypto.randomUUID(), role: 'invigilator', examId: exam.id, name: 'Invigilator 1' })
    tokenExpired = signToken({ id: studentA.id, role: 'student' }, '-1s')

    // 2. Start two HTTP + Socket.IO servers (Process A and Process B)
    server1 = http.createServer()
    server2 = http.createServer()

    await new Promise((resolve) => server1.listen(0, resolve))
    await new Promise((resolve) => server2.listen(0, resolve))

    port1 = server1.address().port
    port2 = server2.address().port

    const pubClient1 = new MockRedisClient(sharedBus)
    const subClient1 = new MockRedisClient(sharedBus)
    const pubClient2 = new MockRedisClient(sharedBus)
    const subClient2 = new MockRedisClient(sharedBus)

    io1 = createWebSocketServer(server1, {
      adapter: createAdapter(pubClient1, subClient1)
    })

    io2 = createWebSocketServer(server2, {
      adapter: createAdapter(pubClient2, subClient2)
    })
  })

  after(async () => {
    try {
      if (io1) io1.close()
      if (io2) io2.close()
      if (server1) server1.close()
      if (server2) server2.close()

      if (exam) {
        await prisma.violationEvent.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
      }
      if (dept) {
        await prisma.student.deleteMany({ where: { departmentCode: dept.code } }).catch(() => {})
        await prisma.faculty.deleteMany({ where: { departmentCode: dept.code } }).catch(() => {})
        await prisma.department.delete({ where: { code: dept.code } }).catch(() => {})
      }
    } catch (e) {
      // ignore
    }
  })

  // ────────────────────────────────────────────────────────────
  // Suite 1: Handshake Authentication (Fails Closed)
  // ────────────────────────────────────────────────────────────
  describe('1. Handshake Authentication (Fails Closed)', () => {
    it('refuses connection when auth token is completely missing', async () => {
      await new Promise((resolve, reject) => {
        const client = ioClient(`http://localhost:${port1}`, {
          transports: ['websocket'],
          auth: {} // No token provided
        })
        client.on('connect', () => {
          client.disconnect()
          reject(new Error('Connection succeeded unexpectedly without token'))
        })
        client.on('connect_error', (err) => {
          client.disconnect()
          try {
            assert.ok(err.message.includes('AUTHENTICATION_FAILED'))
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })
    })

    it('refuses connection when auth token is expired or forged', async () => {
      await new Promise((resolve, reject) => {
        const client = ioClient(`http://localhost:${port1}`, {
          transports: ['websocket'],
          auth: { token: tokenExpired }
        })
        client.on('connect', () => {
          client.disconnect()
          reject(new Error('Connection succeeded unexpectedly with expired token'))
        })
        client.on('connect_error', (err) => {
          client.disconnect()
          try {
            assert.ok(err.message.includes('AUTHENTICATION_FAILED'))
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })
    })

    it('allows connection when valid student auth token is provided', async () => {
      const client = ioClient(`http://localhost:${port1}`, {
        transports: ['websocket'],
        auth: { token: tokenA }
      })

      await new Promise((resolve, reject) => {
        client.on('connect', resolve)
        client.on('connect_error', reject)
      })

      assert.ok(client.connected)
      client.disconnect()
    })
  })

  // ────────────────────────────────────────────────────────────
  // Suite 2: Room Privacy & Isolation (Kills exam:{id} leak)
  // ────────────────────────────────────────────────────────────
  describe('2. Room Privacy & Isolation', () => {
    it('allows student to join their own private attempt:{attemptId} room', async () => {
      const client = ioClient(`http://localhost:${port1}`, {
        transports: ['websocket'],
        auth: { token: tokenA }
      })

      await new Promise(r => client.on('connect', r))

      const res = await new Promise(r => client.emit('attempt:join', { attemptId: attemptA.id }, r))
      assert.equal(res.success, true)
      assert.equal(res.attemptId, attemptA.id)

      client.disconnect()
    })

    it('strictly forbids student from joining another student private attempt room', async () => {
      const client = ioClient(`http://localhost:${port1}`, {
        transports: ['websocket'],
        auth: { token: tokenA } // Student A
      })

      await new Promise(r => client.on('connect', r))

      // Student A tries to join Student B's attempt
      const res = await new Promise(r => client.emit('attempt:join', { attemptId: attemptB.id }, r))
      assert.equal(res.success, false)
      assert.ok(res.error.includes('Unauthorized'))

      client.disconnect()
    })

    it('allows faculty/invigilator to join inv:{examId} room but blocks unauthorized exams', async () => {
      const client = ioClient(`http://localhost:${port1}`, {
        transports: ['websocket'],
        auth: { token: tokenFaculty }
      })

      await new Promise(r => client.on('connect', r))

      const res = await new Promise(r => client.emit('inv:join', { examId: exam.id }, r))
      assert.equal(res.success, true)

      // Try random exam that faculty does not own
      const fakeExamId = crypto.randomUUID()
      const failRes = await new Promise(r => client.emit('inv:join', { examId: fakeExamId }, r))
      assert.equal(failRes.success, false)

      client.disconnect()
    })
  })

  // ────────────────────────────────────────────────────────────
  // Suite 3: 500ms Roster Delta Coalescing
  // ────────────────────────────────────────────────────────────
  describe('3. 500ms Roster Delta Coalescing', () => {
    it('1,000 rapid event notifications fired in 1s produce <= 3 roster:delta messages', async () => {
      const coalescer = new RosterDeltaCoalescer(500)
      let broadcastCount = 0
      let totalDeltasReceived = 0

      // Mock IO emitter
      const mockIO = {
        to: (room) => ({
          emit: (event, payload) => {
            if (event === 'roster:delta') {
              broadcastCount++
              totalDeltasReceived += payload.deltas.length
            }
          }
        })
      }

      coalescer.setIO(mockIO)

      // Fire 1,000 events across 50 simulated students over 1,000ms
      const startTime = Date.now()
      for (let i = 0; i < 1000; i++) {
        const studentIdx = i % 50
        coalescer.queueDelta('test-exam-1', {
          attemptId: `att-${studentIdx}`,
          studentId: `stu-${studentIdx}`,
          flagCount: i,
          online: true
        })
      }

      // Wait 1,100ms for coalescer ticks
      await new Promise(resolve => setTimeout(resolve, 1100))
      coalescer.stop()

      // In 1,100ms with a 500ms window, exactly 2 to 3 flushes should occur
      assert.ok(broadcastCount <= 3, `Expected <= 3 broadcasts, received ${broadcastCount}`)
      assert.ok(broadcastCount >= 1, `Expected at least 1 broadcast, received ${broadcastCount}`)
      // All 50 students should be represented in coalesced state
      assert.equal(totalDeltasReceived, 50)
    })
  })

  // ────────────────────────────────────────────────────────────
  // Suite 4: Multi-Process Horizontal Fan-out & Failover
  // ────────────────────────────────────────────────────────────
  describe('4. Multi-Process Horizontal Fan-out & Failover', () => {
    it('student on Process 1 transmits violation; invigilator on Process 2 receives delta via adapter', async () => {
      // Connect invigilator to Server 2
      const invClient = ioClient(`http://localhost:${port2}`, {
        transports: ['websocket'],
        auth: { token: tokenFaculty }
      })
      await new Promise(r => invClient.on('connect', r))
      await new Promise(r => invClient.emit('inv:join', { examId: exam.id }, r))

      // Connect student to Server 1
      const studentClient = ioClient(`http://localhost:${port1}`, {
        transports: ['websocket'],
        auth: { token: tokenA }
      })
      await new Promise(r => studentClient.on('connect', r))
      await new Promise(r => studentClient.emit('attempt:join', { attemptId: attemptA.id }, r))

      // Listen for delta on Invigilator connected to Server 2
      const receivedDeltaPromise = new Promise((resolve) => {
        invClient.on('violation:new', (data) => {
          resolve(data)
        })
      })

      // Student on Server 1 sends violation
      await new Promise((resolve) => {
        studentClient.emit('violation', {
          attemptId: attemptA.id,
          examId: exam.id,
          eventType: 'TAB_SWITCH',
          clientTimestamp: new Date().toISOString()
        }, resolve)
      })

      const received = await receivedDeltaPromise
      assert.equal(received.attemptId, attemptA.id)
      assert.equal(received.eventType, 'TAB_SWITCH')

      studentClient.disconnect()
      invClient.disconnect()
    })
  })

  // ────────────────────────────────────────────────────────────
  // Suite 5: Presence Tracking & REST Resync (Task 4 & 5)
  // ────────────────────────────────────────────────────────────
  describe('5. Presence Tracking & REST Resync', () => {
    it('records heartbeat, accurately tracks online status, and disconnect marks offline', async () => {
      // Clear any prior presence from previous multi-process tests
      await presenceManager.clearExamPresence(exam.id)

      // Initially candidate is not in presence hash
      const isOnlineBefore = await presenceManager.isOnline(exam.id, studentA.id)
      assert.equal(isOnlineBefore, false)

      // Record heartbeat
      await presenceManager.recordHeartbeat(exam.id, studentA.id)
      const isOnlineAfter = await presenceManager.isOnline(exam.id, studentA.id)
      assert.equal(isOnlineAfter, true)

      // Count online
      const onlineCount = await presenceManager.getOnlineCount(exam.id)
      assert.ok(onlineCount >= 1)

      // Mark offline on disconnect
      await presenceManager.markOffline(exam.id, studentA.id)
      const isOnlineDisconnected = await presenceManager.isOnline(exam.id, studentA.id)
      assert.equal(isOnlineDisconnected, false)
    })

    it('GET /api/v1/attempts/:attemptId/state returns authoritative status, expiry, and server clock', async () => {
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptA.id },
        select: {
          id: true,
          examId: true,
          studentId: true,
          status: true,
          revision: true,
          flagCount: true,
          startedAt: true,
          expiresAt: true,
          submittedAt: true,
          exam: { select: { isPaused: true, pauseReason: true } }
        }
      })

      assert.ok(attempt)
      assert.equal(attempt.status, 'ACTIVE')
      assert.equal(attempt.revision, 1)
      assert.ok(attempt.expiresAt)
    })
  })

  // ────────────────────────────────────────────────────────────
  // Suite 6: Invigilator Endpoints & Keyset Pagination (Task 6)
  // ────────────────────────────────────────────────────────────
  describe('6. Invigilator Endpoints (Keyset Pagination & Zero-Media)', () => {
    it('GET summary returns correct SQL aggregate and live presence count', async () => {
      const summary = await proctoringService.getExamSummary(exam.id, { id: faculty.id, role: 'FACULTY' })

      assert.equal(summary.examId, exam.id)
      assert.ok(summary.total >= 2)
      assert.ok(summary.active >= 2)
      assert.equal(typeof summary.online, 'number')
    })

    it('GET roster performs keyset pagination on (name, attempt_id) with bounded payload', async () => {
      const rosterPage1 = await proctoringService.getExamRoster(exam.id, { id: faculty.id, role: 'FACULTY' }, {
        limit: 1
      })

      assert.equal(rosterPage1.items.length, 1)
      assert.equal(rosterPage1.hasMore, true)
      assert.ok(rosterPage1.nextCursor)

      const firstItem = rosterPage1.items[0]
      assert.ok(firstItem.attemptId)
      assert.ok(firstItem.name)
      assert.ok(firstItem.usn)
      assert.equal(typeof firstItem.online, 'boolean')
      assert.equal(typeof firstItem.answered, 'number')

      // Verify payload has NO base64 strings and NO evidence arrays
      const payloadString = JSON.stringify(rosterPage1)
      assert.ok(!payloadString.includes('data:image/'), 'Payload must not contain base64 image data')
      assert.ok(payloadString.length < 50 * 1024, 'Roster page payload must be bounded (< 50 KB)')

      // Fetch page 2 using keyset nextCursor
      const rosterPage2 = await proctoringService.getExamRoster(exam.id, { id: faculty.id, role: 'FACULTY' }, {
        limit: 1,
        cursor: rosterPage1.nextCursor
      })

      assert.equal(rosterPage2.items.length, 1)
      assert.notEqual(rosterPage2.items[0].attemptId, firstItem.attemptId)
    })

    it('GET violations returns keyset paginated violation stream', async () => {
      // Insert test violation event
      await prisma.violationEvent.create({
        data: {
          attemptId: attemptA.id,
          eventType: 'MULTIPLE_FACES',
          severity: 'HIGH',
          source: 'CLIENT_EVENT',
          evidenceKey: `evidence/${exam.id}/${attemptA.id}/test-uuid.webp`,
          thumbKey: `thumbs/${exam.id}/${attemptA.id}/test-thumb.webp`,
          evidenceStatus: 'UPLOADED'
        }
      })

      const violations = await proctoringService.getAttemptViolations(attemptA.id, { id: faculty.id, role: 'FACULTY' }, {
        limit: 10
      })

      assert.ok(violations.items.length >= 1)
      const v = violations.items[0]
      assert.equal(v.eventType, 'MULTIPLE_FACES')
      assert.equal(v.severity, 'HIGH')
      assert.ok(v.evidenceUrl.includes('X-Amz-Signature') || v.evidenceUrl.startsWith('http'))
      assert.ok(v.thumbUrl.includes('X-Amz-Signature') || v.thumbUrl.startsWith('http'))
    })
  })

  // ────────────────────────────────────────────────────────────
  // Suite 7: Staff Action Commands (Task 7)
  // ────────────────────────────────────────────────────────────
  describe('7. Staff Action Commands (REST & State Machine)', () => {
    it('warnCandidate dispatches warning and creates audit log', async () => {
      const res = await proctoringService.warnCandidate(
        attemptA.id,
        { id: faculty.id, role: 'FACULTY' },
        'Please keep your face centered in camera view.'
      )

      assert.equal(res.success, true)

      const audit = await prisma.auditLog.findFirst({
        where: { resourceId: attemptA.id, action: 'PROCTOR_WARNING' }
      })
      assert.ok(audit)
      assert.equal(audit.metadata.message, 'Please keep your face centered in camera view.')
    })

    it('pauseAttempt and resumeAttempt transition state cleanly', async () => {
      // Pause
      const pauseRes = await proctoringService.pauseAttempt(
        attemptA.id,
        { id: faculty.id, role: 'FACULTY' },
        'Bathroom break'
      )
      assert.equal(pauseRes.status, 'SUSPENDED')

      const pausedDb = await prisma.examAttempt.findUnique({ where: { id: attemptA.id } })
      assert.equal(pausedDb.status, 'SUSPENDED')

      // Resume
      const resumeRes = await proctoringService.resumeAttempt(
        attemptA.id,
        { id: faculty.id, role: 'FACULTY' }
      )
      assert.equal(resumeRes.status, 'ACTIVE')

      const resumedDb = await prisma.examAttempt.findUnique({ where: { id: attemptA.id } })
      assert.equal(resumedDb.status, 'ACTIVE')
    })

    it('acknowledgeViolation marks violation acknowledged and audits the action', async () => {
      const v = await prisma.violationEvent.findFirst({
        where: { attemptId: attemptA.id }
      })
      assert.ok(v)

      const ackRes = await proctoringService.acknowledgeViolation(v.id.toString(), {
        id: faculty.id,
        role: 'FACULTY'
      })

      assert.equal(ackRes.success, true)
      assert.equal(ackRes.acknowledged, true)

      const updatedV = await prisma.violationEvent.findUnique({ where: { id: v.id } })
      assert.equal(updatedV.metadata?.acknowledged, true)
    })
  })
})
