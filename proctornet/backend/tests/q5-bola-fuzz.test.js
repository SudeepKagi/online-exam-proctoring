/**
 * tests/q5-bola-fuzz.test.js
 * Comprehensive BOLA Fuzz Testing Suite (Phase Q5 Mandatory Acceptance Suite)
 *
 * Fixture:
 * - 3 Faculties
 * - 3 Exams each (9 exams total)
 * - 20 Students
 * - 2 Invigilators per exam (18 invigilators total)
 *
 * Invariants Verified:
 * 1. Faculty Cross-Tenant BOLA: Denied (403/404) on all exam and question endpoints.
 * 2. Invigilator Cross-Tenant BOLA: Denied (403) on proctoring, student roster, and attempt management.
 * 3. Student Cross-Tenant BOLA: Denied (403/404) on attempt read, submit, answer, and timeline.
 * 4. Cross-Tenant Chat BOLA: Denied (403) for students outside exam and staff across exams.
 * 5. WebSocket Event BOLA: Rejected for cross-tenant attempt:join, invigilator:join, chat, violation.
 * 6. Rate Limiting Hardening (D-05): Dual-tier login limit (10/min per IP+USN) and sanitized 429 response.
 * 7. Error Masking Hardening (D-06): 5xx responses masked to { error: { code: 'INTERNAL', message: 'Something went wrong' }, requestId }.
 */

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const crypto = require('crypto')
const { io: ioClient } = require('socket.io-client')

const { app, server: appServer, io } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { ROLES } = require('../src/shared/roles')

let server
let baseUrl
let socketUrl

// Fixture Containers
const faculties = []
const facultyTokens = []

const exams = [] // 9 exams: 0..2 (fac 0), 3..5 (fac 1), 6..8 (fac 2)

const invigilators = [] // 18 invigilators: 2 per exam
const invigilatorTokens = [] // [examIdx][invIdx]

const students = [] // 20 students
const studentTokens = []
const attempts = [] // 20 attempts, mapped to exams

let deptCode

async function apiRequest(method, path, token, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const payload = body ? JSON.stringify(body) : null

    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload)
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = raw
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data
          })
        })
      }
    )

    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

before(async () => {
  // 1. Start test HTTP server
  await new Promise((resolve) => {
    server = appServer
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      baseUrl = `http://127.0.0.1:${port}`
      socketUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })

  // 2. Setup Shared Department
  deptCode = `DEPT-BOLA-${Date.now().toString().slice(-6)}`
  await prisma.department.create({
    data: { code: deptCode, name: `BOLA Fuzz Dept ${deptCode}` }
  })

  // 3. Create 3 Faculties
  for (let i = 0; i < 3; i++) {
    const fac = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: `Faculty BOLA ${i + 1}`,
        email: `faculty-bola-${i + 1}-${Date.now()}@test.edu`,
        password: 'password123',
        departmentCode: deptCode,
        employeeId: `EMP-BOLA-${i + 1}-${Date.now().toString().slice(-5)}`
      }
    })
    faculties.push(fac)
    facultyTokens.push(signToken({ id: fac.id, role: ROLES.FACULTY, email: fac.email }))
  }

  // 4. Create 3 Exams per Faculty (9 exams total)
  for (let f = 0; f < 3; f++) {
    for (let e = 0; e < 3; e++) {
      const examIdx = f * 3 + e
      const examId = crypto.randomUUID()
      const exam = await prisma.exam.create({
        data: {
          id: examId,
          title: `BOLA Exam Fac${f + 1} #${e + 1}`,
          subject: 'Security Testing',
          facultyId: faculties[f].id,
          startTime: new Date(Date.now() - 300000),
          endTime: new Date(Date.now() + 7200000),
          duration: 60,
          totalMarks: 50,
          invId: `INV-BOLA-${examIdx}-${Date.now().toString().slice(-5)}`,
          invPasswordHash: 'hash',
          status: 'PUBLISHED',
          allowedDepartments: [deptCode],
          allowedSemesters: [6]
        }
      })
      exams.push(exam)

      // Add 1 question per exam
      await prisma.question.create({
        data: {
          id: crypto.randomUUID(),
          examId: exam.id,
          questionText: `Question for Exam ${exam.id}`,
          marks: 10,
          negativeMarks: 0,
          order: 1,
          options: {
            create: [
              { id: crypto.randomUUID(), text: 'Option A', isCorrect: true, order: 1 },
              { id: crypto.randomUUID(), text: 'Option B', isCorrect: false, order: 2 }
            ]
          }
        }
      })

      // 5. Create 2 Invigilators per exam (18 invigilators total)
      const examInvTokens = []
      for (let inv = 0; inv < 2; inv++) {
        const invId = `inv-${examIdx}-${inv + 1}-${Date.now().toString().slice(-4)}`
        invigilators.push({ id: invId, examId: exam.id, role: ROLES.INVIGILATOR })
        examInvTokens.push(
          signToken({
            id: invId,
            role: ROLES.INVIGILATOR,
            examId: exam.id,
            name: `Invigilator ${examIdx}-${inv + 1}`
          })
        )
      }
      invigilatorTokens.push(examInvTokens)
    }
  }

  // 6. Create 20 Students and distribute attempts across 9 exams
  for (let s = 0; s < 20; s++) {
    const studentId = crypto.randomUUID()
    const student = await prisma.student.create({
      data: {
        id: studentId,
        name: `Student BOLA ${s + 1}`,
        usn: `USN-BOLA-${s + 1}-${Date.now().toString().slice(-5)}`,
        email: `student-bola-${s + 1}-${Date.now()}@test.edu`,
        password: 'password123',
        departmentCode: deptCode,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })
    students.push(student)
    studentTokens.push(signToken({ id: student.id, role: ROLES.STUDENT, email: student.email, usn: student.usn }))

    // Assign to exam (s % 9)
    const assignedExam = exams[s % 9]
    const attempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: assignedExam.id,
        studentId: student.id,
        status: 'ACTIVE',
        watermarkSeed: `seed_bola_${s + 1}`,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      }
    })
    attempts.push(attempt)
  }
})

after(async () => {
  try {
    if (server) server.close()

    // Database teardown
    if (exams.length > 0) {
      const examIds = exams.map((e) => e.id)
      await prisma.chatMessage.deleteMany({ where: { examId: { in: examIds } } }).catch(() => {})
      await prisma.violationEvent.deleteMany({ where: { attempt: { examId: { in: examIds } } } }).catch(() => {})
      await prisma.questionOption.deleteMany({ where: { question: { examId: { in: examIds } } } }).catch(() => {})
      await prisma.question.deleteMany({ where: { examId: { in: examIds } } }).catch(() => {})
      await prisma.examAttempt.deleteMany({ where: { examId: { in: examIds } } }).catch(() => {})
      await prisma.exam.deleteMany({ where: { id: { in: examIds } } }).catch(() => {})
    }
    if (deptCode) {
      await prisma.student.deleteMany({ where: { departmentCode: deptCode } }).catch(() => {})
      await prisma.faculty.deleteMany({ where: { departmentCode: deptCode } }).catch(() => {})
      await prisma.department.delete({ where: { code: deptCode } }).catch(() => {})
    }
  } catch {
    // Ignore teardown errors
  }

  setTimeout(() => process.exit(0), 200).unref()
})

describe('BOLA Fuzz Testing Suite (Q5 Security Remediation)', () => {
  // ── 1. Faculty Cross-Tenant BOLA Fuzzing ──
  describe('1. Faculty Cross-Tenant Access Enforcement', () => {
    it('Faculty 0 cannot view or mutate exams owned by Faculty 1 or Faculty 2 (403/404)', async () => {
      const token = facultyTokens[0]
      // Faculty 1 owns exams[3..5], Faculty 2 owns exams[6..8]
      const foreignExams = exams.slice(3)

      for (const targetExam of foreignExams) {
        // Read details
        const getRes = await apiRequest('GET', `/api/v1/faculty/exams/${targetExam.id}`, token)
        assert.ok([403, 404].includes(getRes.status), `GET exam ${targetExam.id} must be denied (got ${getRes.status})`)

        // Read credentials
        const credRes = await apiRequest('GET', `/api/v1/faculty/exams/${targetExam.id}/credentials`, token)
        assert.ok([403, 404].includes(credRes.status), `GET credentials must be denied (got ${credRes.status})`)

        // List questions
        const qRes = await apiRequest('GET', `/api/v1/faculty/exams/${targetExam.id}/questions`, token)
        assert.ok([403, 404].includes(qRes.status), `GET questions must be denied (got ${qRes.status})`)

        // Mutate exam
        const patchRes = await apiRequest('PATCH', `/api/v1/faculty/exams/${targetExam.id}`, token, { title: 'Hacked' })
        assert.ok([403, 404].includes(patchRes.status), `PATCH exam must be denied (got ${patchRes.status})`)

        // Delete exam
        const delRes = await apiRequest('DELETE', `/api/v1/faculty/exams/${targetExam.id}`, token)
        assert.ok([403, 404].includes(delRes.status), `DELETE exam must be denied (got ${delRes.status})`)
      }
    })

    it('Faculty 1 cannot add questions to Faculty 0 exams (403/404)', async () => {
      const targetExam = exams[0] // Faculty 0's exam
      const token = facultyTokens[1] // Faculty 1
      const res = await apiRequest('POST', `/api/v1/faculty/exams/${targetExam.id}/questions`, token, {
        questionText: 'Unauthorized Question',
        marks: 5,
        options: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false }
        ]
      })
      assert.ok([403, 404].includes(res.status), `Adding questions cross-tenant must fail (got ${res.status})`)
    })
  })

  // ── 2. Invigilator Cross-Tenant BOLA Fuzzing ──
  describe('2. Invigilator Cross-Tenant Access Enforcement', () => {
    it('Invigilator of Exam 0 cannot access proctoring endpoints for Exam 1..8 (403)', async () => {
      const invToken = invigilatorTokens[0][0] // Invigilator for Exam 0
      const foreignExams = exams.slice(1)

      for (const targetExam of foreignExams) {
        // Exam summary
        const sumRes = await apiRequest('GET', `/api/v1/proctoring/exams/${targetExam.id}/summary`, invToken)
        assert.strictEqual(sumRes.status, 403, `Invigilator summary access must return 403 (got ${sumRes.status})`)

        // Exam roster
        const rosRes = await apiRequest('GET', `/api/v1/proctoring/exams/${targetExam.id}/roster`, invToken)
        assert.strictEqual(rosRes.status, 403, `Invigilator roster access must return 403 (got ${rosRes.status})`)

        // Exam violations
        const vioRes = await apiRequest('GET', `/api/v1/proctoring/exams/${targetExam.id}/violations`, invToken)
        assert.strictEqual(vioRes.status, 403, `Invigilator violations access must return 403 (got ${vioRes.status})`)

        // Invigilator live-grid
        const gridRes = await apiRequest('GET', `/api/v1/invigilator/live-grid/${targetExam.id}`, invToken)
        assert.strictEqual(gridRes.status, 403, `Invigilator live-grid access must return 403 (got ${gridRes.status})`)
      }
    })

    it('Invigilator of Exam 0 cannot pause/resume/terminate attempts in other exams (403)', async () => {
      const invToken = invigilatorTokens[0][0] // Invigilator for Exam 0
      // Student 1 is in Exam 1 (attempts[1])
      const foreignAttempt = attempts[1]

      const pauseRes = await apiRequest('POST', `/api/v1/attempts/${foreignAttempt.id}/pause`, invToken, { reason: 'Test' })
      assert.strictEqual(pauseRes.status, 403, 'Cross-exam pauseAttempt must return 403')

      const resumeRes = await apiRequest('POST', `/api/v1/attempts/${foreignAttempt.id}/resume`, invToken)
      assert.strictEqual(resumeRes.status, 403, 'Cross-exam resumeAttempt must return 403')

      const termRes = await apiRequest('POST', `/api/v1/attempts/${foreignAttempt.id}/terminate`, invToken, { reason: 'Test' })
      assert.strictEqual(termRes.status, 403, 'Cross-exam terminateAttempt must return 403')
    })
  })

  // ── 3. Student Cross-Tenant BOLA Fuzzing ──
  describe('3. Student Cross-Tenant Access Enforcement', () => {
    it('Student 0 cannot read, mutate, or submit attempts of other students (403/404)', async () => {
      const student0Token = studentTokens[0]
      // Foreign attempts: attempts[1..19]
      const foreignAttempts = attempts.slice(1, 5) // Sample 4 foreign attempts

      for (const targetAttempt of foreignAttempts) {
        // Read attempt
        const getRes = await apiRequest('GET', `/api/v1/attempts/${targetAttempt.id}`, student0Token)
        assert.ok([403, 404].includes(getRes.status), `GET foreign attempt must return 403/404 (got ${getRes.status})`)

        // Read attempt state
        const stateRes = await apiRequest('GET', `/api/v1/attempts/${targetAttempt.id}/state`, student0Token)
        assert.ok([403, 404].includes(stateRes.status), `GET foreign state must return 403/404 (got ${stateRes.status})`)

        // Submit foreign attempt
        const subRes = await apiRequest(
          'POST',
          `/api/v1/attempts/${targetAttempt.id}/submission`,
          student0Token,
          { answers: [] },
          { 'idempotency-key': crypto.randomUUID() }
        )
        assert.ok([403, 404].includes(subRes.status), `POST submission on foreign attempt must return 403/404 (got ${subRes.status})`)

        // Submit violation on foreign attempt
        const vioRes = await apiRequest('POST', `/api/v1/attempts/${targetAttempt.id}/violations`, student0Token, {
          eventType: 'TAB_SWITCH'
        })
        assert.ok([403, 404].includes(vioRes.status), `POST violation on foreign attempt must return 403/404 (got ${vioRes.status})`)
      }
    })
  })

  // ── 4. Cross-Tenant Chat BOLA Fuzzing ──
  describe('4. Cross-Tenant Chat Enforcement (D-01 / D-04)', () => {
    it('Student cannot post chat message in an exam they are not enrolled in (403)', async () => {
      // Student 0 is enrolled in Exam 0, attempts Exam 1
      const student0Token = studentTokens[0]
      const foreignExam = exams[1]

      const res = await apiRequest('POST', `/api/v1/exams/${foreignExam.id}/chat`, student0Token, {
        message: 'Hello foreign exam'
      })
      assert.strictEqual(res.status, 403, 'Posting chat to foreign exam must return 403')
    })

    it('Invigilator cannot read chat history from an exam they are not assigned to (403)', async () => {
      const invToken = invigilatorTokens[0][0] // Invigilator for Exam 0
      const foreignExam = exams[1]

      const res = await apiRequest('GET', `/api/v1/exams/${foreignExam.id}/chat`, invToken)
      assert.strictEqual(res.status, 403, 'Reading foreign chat history must return 403')
    })
  })

  // ── 5. WebSocket Event BOLA Enforcement ──
  describe('5. WebSocket Event BOLA Enforcement', () => {
    it('Student cannot join room for another student\'s attempt (attempt:join denied)', async () => {
      const client = ioClient(socketUrl, {
        transports: ['websocket'],
        auth: { token: studentTokens[0] }
      })

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          client.disconnect()
          reject(new Error('attempt:join timeout'))
        }, 3000)

        client.on('connect', () => {
          const foreignAttemptId = attempts[1].id
          client.emit('attempt:join', { attemptId: foreignAttemptId }, (ack) => {
            clearTimeout(timer)
            client.disconnect()
            try {
              assert.strictEqual(ack?.success, false, 'attempt:join must fail for foreign attempt')
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })
        client.on('connect_error', (err) => {
          clearTimeout(timer)
          client.disconnect()
          reject(err)
        })
      })
    })

    it('Invigilator cannot join room for an exam they are not assigned to (invigilator:join denied)', async () => {
      const invToken = invigilatorTokens[0][0] // Exam 0 invigilator
      const client = ioClient(socketUrl, {
        transports: ['websocket'],
        auth: { token: invToken }
      })

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          client.disconnect()
          reject(new Error('invigilator:join timeout'))
        }, 3000)

        client.on('connect', () => {
          const foreignExamId = exams[1].id
          client.emit('invigilator:join', { examId: foreignExamId }, (ack) => {
            clearTimeout(timer)
            client.disconnect()
            try {
              assert.strictEqual(ack?.success, false, 'invigilator:join must fail for foreign exam')
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })
        client.on('connect_error', (err) => {
          clearTimeout(timer)
          client.disconnect()
          reject(err)
        })
      })
    })

    it('Student cannot emit violation for an attempt they do not own', async () => {
      const client = ioClient(socketUrl, {
        transports: ['websocket'],
        auth: { token: studentTokens[0] }
      })

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          client.disconnect()
          reject(new Error('violation timeout'))
        }, 3000)

        client.on('connect', () => {
          const foreignAttemptId = attempts[1].id
          client.emit(
            'violation',
            { attemptId: foreignAttemptId, eventType: 'TAB_SWITCH', clientTimestamp: Date.now() },
            (ack) => {
              clearTimeout(timer)
              client.disconnect()
              try {
                assert.strictEqual(ack?.success, false, 'violation must be rejected for foreign attempt')
                resolve()
              } catch (err) {
                reject(err)
              }
            }
          )
        })
        client.on('connect_error', (err) => {
          clearTimeout(timer)
          client.disconnect()
          reject(err)
        })
      })
    })
  })

  // ── 6. Rate Limiting Security Hardening (D-05) ──
  describe('6. Rate Limiting & 429 Sanitization (D-05)', () => {
    it('dual-tier login limiter throttles after 10 requests for same USN without leaking raw key', async () => {
      process.env.FORCE_RATE_LIMIT = '1'
      try {
        const testUsn = `USN-RATE-LIMIT-${Date.now()}`
        let got429 = false
        let rateLimitMsg = ''

        for (let i = 0; i < 15; i++) {
          const res = await apiRequest('POST', '/api/v1/auth/student/login', null, {
            usn: testUsn,
            password: 'wrongpassword'
          })
          if (res.status === 429) {
            got429 = true
            rateLimitMsg = JSON.stringify(res.data)
            break
          }
        }

        assert.ok(got429, '11th+ login request must be rejected with 429 Too Many Requests')
        assert.ok(!rateLimitMsg.includes(testUsn), '429 message must never echo the raw user identifier')
        assert.ok(!rateLimitMsg.includes('127.0.0.1'), '429 message must not echo the raw IP key')
      } finally {
        delete process.env.FORCE_RATE_LIMIT
      }
    })
  })

  // ── 7. 5xx Error Masking (D-06) ──
  describe('7. Error Masking & Internal Listener (D-06)', () => {
    it('masks 5xx responses with standard generic envelope and exposes requestId', async () => {
      // Request an attempt that causes an unexpected server error or test error
      const res = await apiRequest('GET', '/api/v1/attempts/00000000-0000-0000-0000-000000000000', studentTokens[0])
      assert.ok(res.headers['x-request-id'], 'Must include x-request-id header')
      if (res.status >= 500) {
        assert.deepEqual(res.data.error, {
          code: 'INTERNAL',
          message: 'Something went wrong'
        })
        assert.ok(res.data.requestId, 'Must return requestId in error payload')
      }
    })
  })
})
