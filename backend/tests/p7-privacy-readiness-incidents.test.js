/**
 * backend/tests/p7-privacy-readiness-incidents.test.js
 * Verification suite for:
 * 1. Pre-check Consent (GET/POST /exams/:id/consent)
 * 2. Privacy-minimized Student Readiness Telemetry (POST/GET /exams/:id/readiness, CSV export, RBAC)
 * 3. Incident Review Timeline, Notes, Flags & CSV Exports (GET/PATCH /attempts/:attemptId/incidents, RBAC)
 * 4. Admin Privacy Data Export & Evidence Purge (GET /admin/users/:userId/data-export, DELETE evidence, RBAC)
 * 5. Retention Scheduled Worker with Review Hold logic (runRetentionCleanup)
 */

'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { app } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { runRetentionCleanup } = require('../src/jobs/retentionJob')
const config = require('../src/shared/config')

describe('Privacy, Readiness & Incident Review Suite (§Tasks 8 & 9)', () => {
  let server = null
  let port = null
  let adminToken = null
  let facultyToken = null
  let studentToken = null
  let otherStudentToken = null

  let adminUser = null
  let facultyUser = null
  let studentUser = null
  let otherStudentUser = null

  let testExam = null
  let testExamSeb = null
  let testAttempt = null

  function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
      const reqHeaders = { ...headers }
      if (postData) {
        reqHeaders['Content-Type'] = 'application/json'
        reqHeaders['Content-Length'] = Buffer.byteLength(postData)
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: reqHeaders
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            let json = null
            try {
              json = JSON.parse(data)
            } catch (_) {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              rawText: data
            })
          })
        }
      )

      req.on('error', reject)
      if (postData) req.write(postData)
      req.end()
    })
  }

  before(async () => {
    // 1. Clean existing test data
    await prisma.studentConsent.deleteMany({
      where: { consentText: { contains: 'privacy.test' } }
    }).catch(() => {})
    await prisma.studentReadinessReport.deleteMany({
      where: { osFamily: { in: ['WindowsTest', 'LinuxTest'] } }
    }).catch(() => {})
    await prisma.proctoringLog.deleteMany({
      where: { eventType: { in: ['SCREEN_SHARE_ENDED', 'TAB_SWITCH', 'MULTIPLE_FACES'] } }
    }).catch(() => {})
    await prisma.examAttempt.deleteMany({
      where: { exam: { title: { contains: 'Privacy Test Exam' } } }
    }).catch(() => {})
    await prisma.exam.deleteMany({
      where: { title: { contains: 'Privacy Test Exam' } }
    }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: '@privacy.test' } }
    }).catch(() => {})

    // 2. Start HTTP server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        port = server.address().port
        resolve()
      })
    })

    const passwordHash = await bcrypt.hash('Secret#1234', 10)

    // 3. Create test users across all roles
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@privacy.test',
        fullName: 'Admin Privacy Tester',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash
      }
    })

    facultyUser = await prisma.user.create({
      data: {
        email: 'faculty@privacy.test',
        fullName: 'Prof Privacy Tester',
        role: 'FACULTY',
        status: 'ACTIVE',
        passwordHash
      }
    })

    studentUser = await prisma.user.create({
      data: {
        email: 'student1@privacy.test',
        fullName: 'Student Privacy One',
        role: 'STUDENT',
        status: 'ACTIVE',
        institutionId: 'USN-PRIV-001',
        passwordHash
      }
    })

    otherStudentUser = await prisma.user.create({
      data: {
        email: 'student2@privacy.test',
        fullName: 'Student Privacy Two',
        role: 'STUDENT',
        status: 'ACTIVE',
        institutionId: 'USN-PRIV-002',
        passwordHash
      }
    })

    // 4. Generate JWT tokens
    const jwtSecret = config.jwtSecret || process.env.JWT_SECRET || 'test_jwt_secret'
    adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', email: adminUser.email }, jwtSecret)
    facultyToken = jwt.sign({ id: facultyUser.id, role: 'FACULTY', email: facultyUser.email }, jwtSecret)
    studentToken = jwt.sign({ id: studentUser.id, role: 'STUDENT', email: studentUser.email }, jwtSecret)
    otherStudentToken = jwt.sign({ id: otherStudentUser.id, role: 'STUDENT', email: otherStudentUser.email }, jwtSecret)

    // 5. Create test exams
    const nowEpoch = Date.now()
    testExam = await prisma.exam.create({
      data: {
        title: 'Privacy Test Exam Standard',
        courseCode: 'PRIV-101',
        createdById: facultyUser.id,
        startTime: new Date(nowEpoch - 10 * 60 * 1000),
        endTime: new Date(nowEpoch + 120 * 60 * 1000),
        durationMinutes: 60,
        status: 'PUBLISHED'
      }
    })

    testExamSeb = await prisma.exam.create({
      data: {
        title: 'Privacy Test Exam SEB Required',
        courseCode: 'PRIV-102',
        createdById: facultyUser.id,
        startTime: new Date(nowEpoch - 10 * 60 * 1000),
        endTime: new Date(nowEpoch + 120 * 60 * 1000),
        durationMinutes: 60,
        status: 'PUBLISHED',
        proctoringConfig: {
          sebRequired: true
        }
      }
    })

    // Assign student1 to testExam
    await prisma.examAssignment.create({
      data: {
        examId: testExam.id,
        userId: studentUser.id,
        assignedRole: 'STUDENT'
      }
    })

    // 6. Create test attempt and proctoring logs for Incident Review
    testAttempt = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: studentUser.id,
        status: 'IN_PROGRESS',
        score: 45,
        violationCount: 2,
        reviewStatus: 'PENDING'
      }
    })

    // Add proctoring logs (including a legacy violation type)
    await prisma.proctoringLog.create({
      data: {
        attemptId: testAttempt.id,
        eventType: 'SCREEN_SHARE_ENDED',
        severity: 'MEDIUM',
        evidenceKey: 'evidence/test-snapshot-1.webp',
        metadata: { source: 'legacy_bridge' }
      }
    })

    await prisma.proctoringLog.create({
      data: {
        attemptId: testAttempt.id,
        eventType: 'TAB_SWITCH',
        severity: 'HIGH',
        evidenceKey: null,
        metadata: { tabCount: 2 }
      }
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    // Cleanup
    await prisma.studentConsent.deleteMany({
      where: { consentText: { contains: 'privacy.test' } }
    }).catch(() => {})
    await prisma.studentReadinessReport.deleteMany({
      where: { osFamily: { in: ['WindowsTest', 'LinuxTest'] } }
    }).catch(() => {})
    await prisma.proctoringLog.deleteMany({
      where: { attemptId: testAttempt?.id }
    }).catch(() => {})
    await prisma.examAttempt.deleteMany({
      where: { exam: { title: { contains: 'Privacy Test Exam' } } }
    }).catch(() => {})
    await prisma.exam.deleteMany({
      where: { title: { contains: 'Privacy Test Exam' } }
    }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: '@privacy.test' } }
    }).catch(() => {})
  })

  // -------------------------------------------------------------
  // 1. Pre-Check Consent Endpoints (§Task 9)
  // -------------------------------------------------------------
  describe('Pre-Check Consent Lifecycle', () => {
    it('returns consented: false before student agrees', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/exams/${testExam.id}/consent`,
        null,
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.consented, false)
      assert.strictEqual(res.body?.consent, null)
    })

    it('rejects consent creation with empty text (400)', async () => {
      const res = await makeRequest(
        'POST',
        `/api/v1/exams/${testExam.id}/consent`,
        { consentText: '   ' },
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 400)
    })

    it('records student consent with version and server timestamp', async () => {
      const res = await makeRequest(
        'POST',
        `/api/v1/exams/${testExam.id}/consent`,
        {
          consentVersion: 'v1.0',
          consentText: 'I consent to proctoring privacy.test snapshots'
        },
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 201)
      assert.strictEqual(res.body?.status, 'success')
      assert.strictEqual(res.body?.consent?.consentVersion, 'v1.0')
      assert.ok(res.body?.consent?.agreedAt)

      // Query again to confirm consented: true
      const checkRes = await makeRequest(
        'GET',
        `/api/v1/exams/${testExam.id}/consent`,
        null,
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(checkRes.status, 200)
      assert.strictEqual(checkRes.body?.consented, true)
      assert.strictEqual(checkRes.body?.consent?.consentVersion, 'v1.0')
    })

    it('upserts repeat consent without throwing duplicate key errors', async () => {
      const res = await makeRequest(
        'POST',
        `/api/v1/exams/${testExam.id}/consent`,
        {
          consentVersion: 'v1.1',
          consentText: 'I consent to updated proctoring privacy.test snapshots'
        },
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 201)
      assert.strictEqual(res.body?.consent?.consentVersion, 'v1.1')
    })
  })

  // -------------------------------------------------------------
  // 2. Student Readiness Telemetry & Faculty Inspection (§Task 8)
  // -------------------------------------------------------------
  describe('Readiness Telemetry & Faculty View', () => {
    it('accepts minimal telemetry and marks student ready when camera is verified', async () => {
      const res = await makeRequest(
        'POST',
        `/api/v1/exams/${testExam.id}/readiness`,
        {
          osFamily: 'WindowsTest',
          browserFamily: 'Chrome',
          cameraOk: true,
          latencyBucket: 'good',
          sebVerified: false,
          // Attacker injects extra disallowed sensitive fields
          ipAddress: '192.168.1.100',
          macAddress: '00:1A:2B:3C:4D:5E',
          rawImageBase64: 'data:image/jpeg;base64,...'
        },
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.status, 'success')
      assert.strictEqual(res.body?.report?.isReady, true)
      assert.deepStrictEqual(res.body?.report?.reasons, [])

      // Verify privacy minimization in DB: sensitive fields are not stored
      const inDb = await prisma.studentReadinessReport.findUnique({
        where: { examId_studentId: { examId: testExam.id, studentId: studentUser.id } }
      })
      assert.strictEqual(inDb.osFamily, 'WindowsTest')
      assert.strictEqual(inDb.browserFamily, 'Chrome')
      assert.strictEqual(inDb.cameraOk, true)
      assert.strictEqual(inDb.latencyBucket, 'good')
      assert.strictEqual(inDb.ipAddress, undefined)
      assert.strictEqual(inDb.macAddress, undefined)
    })

    it('marks student not ready with reasons when SEB is required but not active', async () => {
      const res = await makeRequest(
        'POST',
        `/api/v1/exams/${testExamSeb.id}/readiness`,
        {
          osFamily: 'LinuxTest',
          browserFamily: 'Firefox',
          cameraOk: true,
          latencyBucket: 'acceptable',
          sebVerified: false
        },
        { Authorization: `Bearer ${otherStudentToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.report?.isReady, false)
      assert.ok(res.body?.report?.reasons.some(r => r.includes('Safe Exam Browser is required')))
      assert.ok(res.body?.report?.reasons.some(r => r.includes('Windows OS')))
    })

    it('blocks students from accessing faculty readiness view (403 Forbidden)', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/exams/${testExam.id}/readiness`,
        null,
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 403)
    })

    it('allows faculty to inspect student readiness list and summary counts', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/exams/${testExam.id}/readiness`,
        null,
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.status, 'success')
      assert.ok(Array.isArray(res.body?.readiness))
      assert.ok(res.body?.summary)
      assert.strictEqual(res.body?.summary?.ready, 1)

      const studentOne = res.body?.readiness.find(r => r.studentId === studentUser.id)
      assert.ok(studentOne)
      assert.strictEqual(studentOne.status, 'READY')
      assert.strictEqual(studentOne.osFamily, 'WindowsTest')
    })

    it('allows faculty to export readiness as CSV attachment', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/exams/${testExam.id}/readiness/export`,
        null,
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.ok(res.headers['content-type'].includes('text/csv'))
      assert.ok(res.rawText.includes('Student Name,Email,USN,Readiness Status'))
      assert.ok(res.rawText.includes('Student Privacy One'))
    })
  })

  // -------------------------------------------------------------
  // 3. Incident Review Timeline, Notes & Flags (§Task 8)
  // -------------------------------------------------------------
  describe('Incident Review & Invigilator Auditing', () => {
    it('blocks students from accessing attempt incident timeline (403 Forbidden)', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/attempts/${testAttempt.id}/incidents`,
        null,
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(res.status, 403)
    })

    it('allows faculty to retrieve incident timeline with formatted legacy labels and snapshots', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/attempts/${testAttempt.id}/incidents`,
        null,
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.status, 'success')
      assert.strictEqual(res.body?.attempt?.id, testAttempt.id)
      assert.strictEqual(res.body?.attempt?.studentName, 'Student Privacy One')
      assert.strictEqual(res.body?.attempt?.reviewStatus, 'PENDING')

      const incidents = res.body?.incidents
      assert.strictEqual(incidents.length, 2)

      // Legacy violation label format check (§Task 8: legacy labels kept)
      const legacyLog = incidents.find(i => i.eventType === 'SCREEN_SHARE_ENDED')
      assert.ok(legacyLog)
      assert.strictEqual(legacyLog.displayLabel, 'Screen share ended (legacy)')
      assert.ok(legacyLog.snapshotUrl, 'Expected presigned URL for snapshot')

      // Canonical active violation pass-through
      const activeLog = incidents.find(i => i.eventType === 'TAB_SWITCH')
      assert.ok(activeLog)
      assert.strictEqual(activeLog.displayLabel, 'TAB_SWITCH')
      assert.strictEqual(activeLog.snapshotUrl, null)
    })

    it('allows faculty to update review status, notes, and flag attempt', async () => {
      const res = await makeRequest(
        'PATCH',
        `/api/v1/attempts/${testAttempt.id}/review`,
        {
          reviewStatus: 'CONFIRMED',
          reviewNotes: 'Multiple window transitions confirmed during timed interval.',
          isFlagged: true
        },
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.attempt?.reviewStatus, 'CONFIRMED')
      assert.strictEqual(res.body?.attempt?.isFlagged, true)
      assert.strictEqual(res.body?.attempt?.reviewNotes, 'Multiple window transitions confirmed during timed interval.')
      assert.strictEqual(res.body?.attempt?.reviewedBy?.fullName, 'Prof Privacy Tester')
      assert.ok(res.body?.attempt?.reviewedAt)
    })

    it('rejects invalid reviewStatus with 400 Bad Request', async () => {
      const res = await makeRequest(
        'PATCH',
        `/api/v1/attempts/${testAttempt.id}/review`,
        { reviewStatus: 'UNKNOWN_STATUS' },
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(res.status, 400)
    })

    it('exports single attempt incidents and full exam incidents as CSV', async () => {
      // Single attempt export
      const attemptRes = await makeRequest(
        'GET',
        `/api/v1/attempts/${testAttempt.id}/incidents/export`,
        null,
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(attemptRes.status, 200)
      assert.ok(attemptRes.headers['content-type'].includes('text/csv'))
      assert.ok(attemptRes.rawText.includes('Screen share ended (legacy)'))

      // Entire exam incidents export
      const examRes = await makeRequest(
        'GET',
        `/api/v1/exams/${testExam.id}/incidents/export`,
        null,
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(examRes.status, 200)
      assert.ok(examRes.headers['content-type'].includes('text/csv'))
      assert.ok(examRes.rawText.includes(testAttempt.id))
      assert.ok(examRes.rawText.includes('CONFIRMED'))
    })
  })

  // -------------------------------------------------------------
  // 4. Admin Privacy Tools (§Task 9)
  // -------------------------------------------------------------
  describe('Admin Privacy & Data Portability Tools', () => {
    it('blocks non-admin users from data export and evidence purge (403 Forbidden)', async () => {
      const exportRes = await makeRequest(
        'GET',
        `/api/v1/admin/users/${studentUser.id}/data-export`,
        null,
        { Authorization: `Bearer ${facultyToken}` }
      )
      assert.strictEqual(exportRes.status, 403)

      const deleteRes = await makeRequest(
        'DELETE',
        `/api/v1/admin/users/${studentUser.id}/evidence`,
        null,
        { Authorization: `Bearer ${studentToken}` }
      )
      assert.strictEqual(deleteRes.status, 403)
    })

    it('allows admin to export one student full record as JSON excluding passwordHash', async () => {
      const res = await makeRequest(
        'GET',
        `/api/v1/admin/users/${studentUser.id}/data-export`,
        null,
        { Authorization: `Bearer ${adminToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.status, 'success')
      assert.strictEqual(res.body?.user?.id, studentUser.id)
      assert.strictEqual(res.body?.user?.email, 'student1@privacy.test')
      assert.strictEqual(res.body?.user?.passwordHash, undefined)
      assert.ok(Array.isArray(res.body?.attempts))
      assert.ok(Array.isArray(res.body?.readinessReports))
      assert.ok(Array.isArray(res.body?.consents))
      assert.strictEqual(res.body?.consents.length, 1)
    })

    it('allows admin to delete one student evidence snapshots and reset DB keys', async () => {
      const res = await makeRequest(
        'DELETE',
        `/api/v1/admin/users/${studentUser.id}/evidence`,
        null,
        { Authorization: `Bearer ${adminToken}` }
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body?.status, 'success')
      assert.ok(res.body?.clearedLogRecords >= 1)

      // Confirm DB row evidenceKey has been set to null
      const log = await prisma.proctoringLog.findFirst({
        where: { attemptId: testAttempt.id, eventType: 'SCREEN_SHARE_ENDED' }
      })
      assert.strictEqual(log.evidenceKey, null)
    })
  })

  // -------------------------------------------------------------
  // 5. Automated Retention Worker & Review Hold (§Task 9)
  // -------------------------------------------------------------
  describe('Automated Retention Cleanup & Review Hold', () => {
    let oldEndedExam = null
    let eligibleAttempt = null
    let heldAttempt = null

    before(async () => {
      // Create ended exam from 100 days ago
      const pastStart = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
      const pastEnd = new Date(Date.now() - 110 * 24 * 60 * 60 * 1000)
      oldEndedExam = await prisma.exam.create({
        data: {
          title: 'Privacy Test Exam 100 Days Old',
          courseCode: 'PRIV-103',
          createdById: facultyUser.id,
          startTime: pastStart,
          endTime: pastEnd,
          durationMinutes: 60,
          status: 'COMPLETED'
        }
      })

      const pastDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)

      // 1. Eligible attempt: REVIEWED with no flags
      eligibleAttempt = await prisma.examAttempt.create({
        data: {
          examId: oldEndedExam.id,
          studentId: otherStudentUser.id,
          status: 'SUBMITTED',
          submittedAt: pastDate,
          reviewStatus: 'REVIEWED',
          isFlagged: false
        }
      })

      await prisma.proctoringLog.create({
        data: {
          attemptId: eligibleAttempt.id,
          eventType: 'WINDOW_BLUR',
          severity: 'LOW',
          evidenceKey: 'evidence/old-eligible-snapshot.webp',
          createdAt: pastDate
        }
      })

      // 2. Held attempt: CONFIRMED violation (must NOT be purged!)
      heldAttempt = await prisma.examAttempt.create({
        data: {
          examId: oldEndedExam.id,
          studentId: studentUser.id,
          status: 'SUBMITTED',
          submittedAt: pastDate,
          reviewStatus: 'CONFIRMED',
          isFlagged: true
        }
      })

      await prisma.proctoringLog.create({
        data: {
          attemptId: heldAttempt.id,
          eventType: 'MULTIPLE_FACES',
          severity: 'HIGH',
          evidenceKey: 'evidence/old-held-snapshot.webp',
          createdAt: pastDate
        }
      })
    })

    after(async () => {
      await prisma.proctoringLog.deleteMany({
        where: { attemptId: { in: [eligibleAttempt?.id, heldAttempt?.id] } }
      }).catch(() => {})
      await prisma.examAttempt.deleteMany({
        where: { examId: oldEndedExam?.id }
      }).catch(() => {})
      await prisma.exam.deleteMany({
        where: { id: oldEndedExam?.id }
      }).catch(() => {})
    })

    it('dryRun mode scans candidate attempts without deleting rows or evidence', async () => {
      const summary = await runRetentionCleanup({ retentionDays: 90, dryRun: true })
      assert.strictEqual(summary.dryRun, true)
      assert.ok(summary.scannedAttempts >= 2)
      assert.ok(summary.heldUnderReviewCount >= 1)
      assert.ok(summary.eligibleAttempts >= 1)

      // Confirm eligible log still exists
      const log = await prisma.proctoringLog.findFirst({
        where: { attemptId: eligibleAttempt.id }
      })
      assert.ok(log, 'Log must remain present after dry run')
    })

    it('purges eligible attempts evidence and logs while preserving attempts under review hold', async () => {
      const summary = await runRetentionCleanup({ retentionDays: 90, dryRun: false })
      assert.strictEqual(summary.dryRun, false)
      assert.ok(summary.deletedLogRowsCount >= 1)
      assert.ok(summary.heldUnderReviewCount >= 1)

      // Eligible attempt logs must be purged from DB
      const eligibleLogs = await prisma.proctoringLog.findMany({
        where: { attemptId: eligibleAttempt.id }
      })
      assert.strictEqual(eligibleLogs.length, 0)

      // Held attempt logs MUST remain intact!
      const heldLogs = await prisma.proctoringLog.findMany({
        where: { attemptId: heldAttempt.id }
      })
      assert.strictEqual(heldLogs.length, 1)
      assert.strictEqual(heldLogs[0].evidenceKey, 'evidence/old-held-snapshot.webp')
    })
  })
})
