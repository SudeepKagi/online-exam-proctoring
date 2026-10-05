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
  adminToken = signToken({ id: 'admin-rm-1', role: ROLES.ADMIN, email: 'admin@test.edu' })
  facultyToken = signToken({ id: testFacultyId, role: ROLES.FACULTY, email: faculty.email })
  studentAToken = signToken({ id: testStudentAId, role: ROLES.STUDENT, email: studentA.email })
  studentBToken = signToken({ id: testStudentBId, role: ROLES.STUDENT, email: studentB.email })
  invigilatorExam1Token = signToken({ id: 'inv-rm-1', role: ROLES.INVIGILATOR, examId: testExamId })
  invigilatorExam2Token = signToken({ id: 'inv-rm-2', role: ROLES.INVIGILATOR, examId: '00000000-0000-0000-0000-000000000099' })
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

async function apiRequest(method, urlPath, token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' }
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
    { method: 'POST', path: '/api/v1/exam/device-check' }
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
    const noExamToken = signToken({ id: 'inv-no-exam', role: ROLES.INVIGILATOR })
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

  after(() => {
    if (server) server.close()
    setTimeout(() => process.exit(0), 100).unref()
  })
})
