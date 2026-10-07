/**
 * route-matrix.test.js
 * Comprehensive automated Route-Matrix test suite (Phase Q2.5 requirement).
 *
 * Verifies:
 * 1. CI Alignment: Zero drift between mounted Express routes and docs/api/ROUTE_INVENTORY.md
 * 2. Auth Matrix: Unauthenticated requests -> 401
 * 3. Role Matrix: Wrong role requests -> 403
 * 4. D-01: Canonical lowercase role normalization
 * 5. D-02: GET /api/v1/attempts/:attemptId/timeline student ownership & staff scoping
 * 6. D-03: Invigilator assertStaffExamAccess fail-closed enforcement (pause/resume/terminate)
 * 7. Right owner / authorized access -> 2xx / handler execution
 */

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const { app, io } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { ROLES } = require('../src/shared/roles')
const { extractRoutes } = require('../../../scripts/ci/generate-route-inventory')

let server
let baseUrl
let testExamId
let testFacultyId
let testStudentAId
let testStudentBId
let testAttemptAId
let testAttemptBId

// Test Tokens
let adminToken
let facultyToken
let studentAToken
let studentBToken
let invigilatorExam1Token
let invigilatorExam2Token

before(async () => {
  // 1. Start ephemeral HTTP server
  await new Promise((resolve) => {
    server = http.createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })

  // 2. Setup database test fixture
  const deptCode = `DEPT-RM-${Date.now().toString().slice(-6)}`
  await prisma.department.create({
    data: { code: deptCode, name: `Route Matrix Dept ${deptCode}` }
  })

  const facId = crypto.randomUUID()
  const faculty = await prisma.faculty.create({
    data: {
      id: facId,
      name: 'Matrix Faculty',
      email: `fac-matrix-${Date.now()}@test.edu`,
      password: 'password',
      departmentCode: deptCode,
      employeeId: `FAC-RM-${Date.now()}`
    }
  })
  testFacultyId = faculty.id

  const stuAId = crypto.randomUUID()
  const studentA = await prisma.student.create({
    data: {
      id: stuAId,
      name: 'Matrix Student A',
      usn: `USN-A-${Date.now()}`,
      email: `studentA-${Date.now()}@test.edu`,
      password: 'password',
      departmentCode: deptCode,
      semester: 6,
      approvalStatus: 'APPROVED'
    }
  })
  testStudentAId = studentA.id

  const stuBId = crypto.randomUUID()
  const studentB = await prisma.student.create({
    data: {
      id: stuBId,
      name: 'Matrix Student B',
      usn: `USN-B-${Date.now()}`,
      email: `studentB-${Date.now()}@test.edu`,
      password: 'password',
      departmentCode: deptCode,
      semester: 6,
      approvalStatus: 'APPROVED'
    }
  })
  testStudentBId = studentB.id

  const exam = await prisma.exam.create({
    data: {
      id: crypto.randomUUID(),
      title: 'Route Matrix Exam',
      subject: 'Security',
      facultyId: testFacultyId,
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() + 3600000),
      duration: 60,
      totalMarks: 10,
      invId: `INV-RM-${Date.now()}`,
      invPasswordHash: 'hash',
      status: 'PUBLISHED'
    }
  })
  testExamId = exam.id

  const attemptA = await prisma.examAttempt.create({
    data: {
      id: crypto.randomUUID(),
      examId: testExamId,
      studentId: testStudentAId,
      status: 'ACTIVE',
      watermarkSeed: 'seed_A_123',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000)
    }
  })
  testAttemptAId = attemptA.id

  const attemptB = await prisma.examAttempt.create({
    data: {
      id: crypto.randomUUID(),
      examId: testExamId,
      studentId: testStudentBId,
      status: 'ACTIVE',
      watermarkSeed: 'seed_B_456',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000)
    }
  })
  testAttemptBId = attemptB.id

  // 3. Generate tokens
  adminToken = signToken({ id: crypto.randomUUID(), role: ROLES.ADMIN, email: 'admin@test.edu' })
  facultyToken = signToken({ id: testFacultyId, role: ROLES.FACULTY, email: faculty.email })
  studentAToken = signToken({ id: testStudentAId, role: ROLES.STUDENT, email: studentA.email })
  studentBToken = signToken({ id: testStudentBId, role: ROLES.STUDENT, email: studentB.email })
  invigilatorExam1Token = signToken({ id: crypto.randomUUID(), role: ROLES.INVIGILATOR, examId: testExamId })
  invigilatorExam2Token = signToken({ id: crypto.randomUUID(), role: ROLES.INVIGILATOR, examId: '00000000-0000-0000-0000-000000000099' })
})

after(async () => {
  if (io) {
    try { io.close() } catch (_) {}
  }
  const { server: appServer } = require('../src/app')
  if (appServer && typeof appServer.closeAllConnections === 'function') {
    appServer.closeAllConnections()
  }
  if (appServer) {
    await new Promise((resolve) => appServer.close(resolve)).catch(() => {})
  }
  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
    await new Promise((resolve) => server.close(resolve)).catch(() => {})
  }
  const { redisClient } = require('../src/infra/redis/client')
  await redisClient.quit().catch(() => {})
  await prisma.$disconnect().catch(() => {})
  setTimeout(() => process.exit(0), 100)
})

async function apiRequest(method, urlPath, token = null, body = null, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options = {
    method,
    headers
  }
  if (body) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(`${baseUrl}${urlPath}`, options)
  let data = null
  try {
    data = await res.json()
  } catch {
    // empty response
  }
  return { status: res.status, data }
}

describe('Q2.5 Route Matrix CI & Drift Prevention', () => {
  it('every mounted Express route has a corresponding entry in ROUTE_INVENTORY.md', () => {
    const extracted = extractRoutes()
    const inventoryPath = path.resolve(__dirname, '../../../docs/api/ROUTE_INVENTORY.md')
    assert.ok(fs.existsSync(inventoryPath), 'ROUTE_INVENTORY.md must exist')

    const inventoryContent = fs.readFileSync(inventoryPath, 'utf8')
    assert.ok(extracted.length > 0, 'Extracted routes count must be > 0')

    for (const r of extracted) {
      assert.ok(
        inventoryContent.includes(r.path),
        `Route ${r.method} ${r.path} is missing from docs/api/ROUTE_INVENTORY.md! Run scripts/ci/generate-route-inventory.js.`
      )
    }
  })
})

describe('Q2.5 Authentication Matrix (Unauthenticated -> 401)', () => {
  const protectedRoutes = [
    { method: 'GET', path: '/api/v1/admin/dashboard' },
    { method: 'GET', path: '/api/v1/faculty/dashboard' },
    { method: 'GET', path: '/api/v1/student/profile' },
    { method: 'GET', path: '/api/v1/notifications' },
    { method: 'GET', path: '/api/v1/auth/me' },
    { method: 'POST', path: '/api/v1/student/agent/pair' }
  ]

  for (const r of protectedRoutes) {
    it(`rejects unauthenticated request to ${r.method} ${r.path} with 401`, async () => {
      const res = await apiRequest(r.method, r.path, null)
      assert.strictEqual(res.status, 401, `Expected 401 Unauthorized for ${r.path}`)
      assert.strictEqual(res.data?.error?.code, 'UNAUTHORIZED')
    })
  }
})

describe('Q2.5 Role Matrix (Wrong Role -> 403)', () => {
  it('rejects student accessing admin dashboard with 403', async () => {
    const res = await apiRequest('GET', '/api/v1/admin/dashboard', studentAToken)
    assert.strictEqual(res.status, 403)
    assert.strictEqual(res.data?.error?.code, 'FORBIDDEN')
  })

  it('rejects student accessing faculty exams with 403', async () => {
    const res = await apiRequest('GET', '/api/v1/faculty/exams', studentAToken)
    assert.strictEqual(res.status, 403)
    assert.strictEqual(res.data?.error?.code, 'FORBIDDEN')
  })

  it('rejects faculty accessing admin audit logs with 403', async () => {
    const res = await apiRequest('GET', '/api/v1/admin/audit-logs', facultyToken)
    assert.strictEqual(res.status, 403)
    assert.strictEqual(res.data?.error?.code, 'FORBIDDEN')
  })

  it('rejects faculty accessing student exams with 403', async () => {
    const res = await apiRequest('GET', '/api/v1/student/exams', facultyToken)
    assert.strictEqual(res.status, 403)
    assert.strictEqual(res.data?.error?.code, 'FORBIDDEN')
  })

  it('rejects invigilator accessing admin settings with 403', async () => {
    const res = await apiRequest('GET', '/api/v1/admin/settings', invigilatorExam1Token)
    assert.strictEqual(res.status, 403)
    assert.strictEqual(res.data?.error?.code, 'FORBIDDEN')
  })
})

describe('Q2.4 & D-01: Canonical Lowercase Role Normalization', () => {
  it('accepts tokens with uppercase or mixed-case role and normalizes to canonical lowercase', async () => {
    const upperAdminToken = signToken({ id: 'admin-rm-upper', role: 'ADMIN', email: 'upperadmin@test.edu' })
    const res = await apiRequest('GET', '/api/v1/admin/dashboard', upperAdminToken)
    assert.strictEqual(res.status, 200, 'Uppercase ADMIN role should be normalized and accepted')
    assert.ok(res.data?.stats)
  })

  it('rejects invalid or unknown role in JWT payload with 401', async () => {
    const bogusToken = signToken({ id: 'bogus-user', role: 'superhacker' })
    const res = await apiRequest('GET', '/api/v1/auth/me', bogusToken)
    assert.strictEqual(res.status, 401)
  })
})

describe('D-02: GET /api/v1/attempts/:attemptId/timeline Ownership & Scoping', () => {
  it('allows student to view their own attempt timeline (200)', async () => {
    const res = await apiRequest('GET', `/api/v1/attempts/${testAttemptAId}/timeline`, studentAToken)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.data), 'Expected timeline response to be an array')
  })

  it('strictly forbids student from viewing another student attempt timeline (403)', async () => {
    const res = await apiRequest('GET', `/api/v1/attempts/${testAttemptBId}/timeline`, studentAToken)
    assert.strictEqual(res.status, 403, 'Cross-student timeline inspection must return 403 Forbidden')
    assert.strictEqual(res.data?.error?.code, 'FORBIDDEN')
  })

  it('allows authorized invigilator to view timeline for attempt in assigned exam (200)', async () => {
    const res = await apiRequest('GET', `/api/v1/attempts/${testAttemptAId}/timeline`, invigilatorExam1Token)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.data), 'Expected timeline response to be an array')
  })

  it('strictly forbids invigilator from viewing attempt timeline outside their assigned exam (403)', async () => {
    const res = await apiRequest('GET', `/api/v1/attempts/${testAttemptAId}/timeline`, invigilatorExam2Token)
    assert.strictEqual(res.status, 403, 'Cross-exam invigilator timeline access must return 403 Forbidden')
  })
})

describe('D-03: Invigilator Staff Scoping Fail-Closed Enforcement', () => {
  it('assertStaffExamAccess rejects invigilator with mismatched examId on pauseAttempt (403)', async () => {
    const res = await apiRequest('POST', `/api/v1/attempts/${testAttemptAId}/pause`, invigilatorExam2Token, { reason: 'Test' })
    assert.strictEqual(res.status, 403, 'Mismatched examId must return 403')
  })

  it('assertStaffExamAccess rejects invigilator with mismatched examId on resumeAttempt (403)', async () => {
    const res = await apiRequest('POST', `/api/v1/attempts/${testAttemptAId}/resume`, invigilatorExam2Token)
    assert.strictEqual(res.status, 403, 'Mismatched examId must return 403')
  })

  it('assertStaffExamAccess rejects invigilator with mismatched examId on terminateAttempt (403)', async () => {
    const res = await apiRequest('POST', `/api/v1/attempts/${testAttemptAId}/terminate`, invigilatorExam2Token, { reason: 'Test' })
    assert.strictEqual(res.status, 403, 'Mismatched examId must return 403')
  })

  it('assertStaffExamAccess rejects invigilator without examId (fail-closed) (403)', async () => {
    const noExamToken = signToken({ id: crypto.randomUUID(), role: ROLES.INVIGILATOR })
    const res = await apiRequest('POST', `/api/v1/attempts/${testAttemptAId}/pause`, noExamToken, { reason: 'Test' })
    assert.strictEqual(res.status, 403, 'Invigilator without examId must fail-closed with 403')
  })
})

describe('Authorized Access (Right Role/Owner -> 2xx)', () => {
  it('admin can access dashboard (200)', async () => {
    const res = await apiRequest('GET', '/api/v1/admin/dashboard', adminToken)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data?.success, true)
  })

  it('faculty can access dashboard (200)', async () => {
    const res = await apiRequest('GET', '/api/v1/faculty/dashboard', facultyToken)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data?.success, true)
  })

  it('student can access profile (200)', async () => {
    const res = await apiRequest('GET', '/api/v1/student/profile', studentAToken)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data?.success, true)
    assert.strictEqual(res.data?.student?.id, testStudentAId)
  })

  it('public health check is accessible without token (200)', async () => {
    const res = await apiRequest('GET', '/api/v1/health')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data?.status, 'ok')
  })
})

describe('Contract Tests: Observable Effects & Negative Effects', () => {
  it('POST /api/v1/admin/announcements creates announcement DB row; rejected call mutates zero rows', async () => {
    const initialCount = await prisma.announcement.count()

    // Negative-effect: Unauthorized request mutates zero rows
    const negRes = await apiRequest('POST', '/api/v1/admin/announcements', studentAToken, {
      title: 'Hacked Announcement',
      content: 'Should not exist'
    })
    assert.strictEqual(negRes.status, 403)
    const countAfterNeg = await prisma.announcement.count()
    assert.strictEqual(countAfterNeg, initialCount, 'Negative-effect: 403 request must mutate 0 rows')

    // Positive-effect: Authorized admin request creates DB row
    const posRes = await apiRequest('POST', '/api/v1/admin/announcements', adminToken, {
      title: 'Contract Test Announcement',
      message: 'Observable effect verified',
      target: 'ALL'
    })
    assert.strictEqual(posRes.status, 201)
    const countAfterPos = await prisma.announcement.count()
    assert.strictEqual(countAfterPos, initialCount + 1, 'Observable effect: DB row must be created')

    // Cleanup
    if (posRes.data?.announcement?.id) {
      await prisma.announcement.delete({ where: { id: posRes.data.announcement.id } })
    }
  })

  it('PUT /api/v1/attempts/:attemptId/answers saves answer DB row; rejected call mutates zero rows', async () => {
    // Setup question
    const q = await prisma.question.create({
      data: {
        id: crypto.randomUUID(),
        examId: testExamId,
        questionText: 'Contract effect question?',
        marks: 2,
        negativeMarks: 0,
        options: {
          create: [
            { id: crypto.randomUUID(), text: 'Option 1', isCorrect: true, order: 0 },
            { id: crypto.randomUUID(), text: 'Option 2', isCorrect: false, order: 1 }
          ]
        }
      },
      include: { options: true }
    })
    const optId = q.options[0].id

    const aq = await prisma.attemptQuestion.create({
      data: {
        id: crypto.randomUUID(),
        attemptId: testAttemptAId,
        questionId: q.id,
        displayOrder: 1,
        optionOrder: [0, 1]
      }
    })

    const initialAnswerCount = await prisma.answer.count({ where: { attemptId: testAttemptAId } })

    // Negative-effect: BOLA Student B trying to answer Student A attempt mutates zero rows
    const negRes = await apiRequest('PUT', `/api/v1/attempts/${testAttemptAId}/answers`, studentBToken, {
      answers: [{ attemptQuestionId: aq.id, optionId: optId, revision: 1 }]
    })
    assert.ok(negRes.status === 403 || negRes.status === 404, 'Negative-effect: BOLA request must be rejected (403 or 404)')
    const countAfterNeg = await prisma.answer.count({ where: { attemptId: testAttemptAId } })
    assert.strictEqual(countAfterNeg, initialAnswerCount, 'Negative-effect: BOLA must mutate 0 answers')

    // Positive-effect: Student A saving answer creates DB row
    const posRes = await apiRequest('PUT', `/api/v1/attempts/${testAttemptAId}/answers`, studentAToken, {
      answers: [{ attemptQuestionId: aq.id, optionId: optId, revision: 1 }]
    })
    assert.strictEqual(posRes.status, 200)
    const countAfterPos = await prisma.answer.count({ where: { attemptId: testAttemptAId } })
    assert.strictEqual(countAfterPos, initialAnswerCount + 1, 'Observable effect: Answer DB row created')
  })

  it('POST /api/v1/attempts/:attemptId/submission updates attempt status & creates outbox row; rejected call mutates zero rows', async () => {
    const initialOutboxCount = await prisma.outboxEvent.count({
      where: { eventType: 'attempt.submitted' }
    })

    // Negative-effect: BOLA Student B submit attempt A mutates zero outbox rows
    const negRes = await apiRequest('POST', `/api/v1/attempts/${testAttemptAId}/submission`, studentBToken, {
      answers: []
    }, {
      'Idempotency-Key': crypto.randomUUID()
    })
    assert.strictEqual(negRes.status, 403)
    const outboxAfterNeg = await prisma.outboxEvent.count({
      where: { eventType: 'attempt.submitted' }
    })
    assert.strictEqual(outboxAfterNeg, initialOutboxCount, 'Negative-effect: BOLA submit must create 0 outbox events')

    // Positive-effect: Student A submit transitions attempt to SUBMITTED and creates outbox row
    const idempKey = crypto.randomUUID()
    const posRes = await apiRequest('POST', `/api/v1/attempts/${testAttemptAId}/submission`, studentAToken, {
      answers: []
    }, {
      'Idempotency-Key': idempKey
    })
    assert.strictEqual(posRes.status, 200)
    assert.strictEqual(posRes.data?.status, 'SUBMITTED')

    const outboxAfterPos = await prisma.outboxEvent.count({
      where: { eventType: 'attempt.submitted' }
    })
    assert.strictEqual(outboxAfterPos, initialOutboxCount + 1, 'Observable effect: attempt.submitted outbox event created')
  })

  it('POST /api/v1/attempts/:attemptId/pause updates attempt status to SUSPENDED; unauthorized mutates zero rows', async () => {
    // Negative-effect: Cross-exam invigilator cannot pause
    const negRes = await apiRequest('POST', `/api/v1/attempts/${testAttemptBId}/pause`, invigilatorExam2Token, {
      reason: 'Cross exam pause'
    })
    assert.strictEqual(negRes.status, 403)
    const attemptB = await prisma.examAttempt.findUnique({ where: { id: testAttemptBId } })
    assert.strictEqual(attemptB.status, 'ACTIVE', 'Negative-effect: Unauthorized pause must leave status unchanged')

    // Positive-effect: Authorized invigilator pauses attempt
    const posRes = await apiRequest('POST', `/api/v1/attempts/${testAttemptBId}/pause`, invigilatorExam1Token, {
      reason: 'Staff pause command'
    })
    assert.strictEqual(posRes.status, 200)
    const attemptBAfterPos = await prisma.examAttempt.findUnique({ where: { id: testAttemptBId } })
    assert.strictEqual(attemptBAfterPos.status, 'SUSPENDED', 'Observable effect: Attempt status updated to SUSPENDED')
  })

  it('POST /api/v1/staff/attempts/:attemptId/agent/waiver grants waiver; unauthorized mutates zero rows', async () => {
    const initialWaivers = await prisma.deviceAgentWaiver.count({
      where: { attemptId: testAttemptBId }
    })
    // Negative-effect: Unauthorized invigilator (wrong exam) cannot grant waiver
    const negRes = await apiRequest('POST', `/api/v1/staff/attempts/${testAttemptBId}/agent/waiver`, invigilatorExam2Token, {
      reason: 'BOLA waiver attempt'
    })
    assert.strictEqual(negRes.status, 403)
    const waiversAfterNeg = await prisma.deviceAgentWaiver.count({
      where: { attemptId: testAttemptBId }
    })
    assert.strictEqual(waiversAfterNeg, initialWaivers, 'Negative-effect: Unauthorized waiver must mutate zero rows')

    // Positive-effect: Authorized invigilator grants waiver
    const posRes = await apiRequest('POST', `/api/v1/staff/attempts/${testAttemptBId}/agent/waiver`, invigilatorExam1Token, {
      reason: 'School-approved BYOD accommodation waiver'
    })
    assert.strictEqual(posRes.status, 200)
    assert.strictEqual(posRes.data?.success, true)
    const waiversAfterPos = await prisma.deviceAgentWaiver.count({
      where: { attemptId: testAttemptBId }
    })
    assert.strictEqual(waiversAfterPos, initialWaivers + 1, 'Observable effect: deviceAgentWaiver row created')
  })

  after(() => {
    if (server) server.close()
    setTimeout(() => process.exit(0), 100).unref()
  })
})
