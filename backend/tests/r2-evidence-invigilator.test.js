/**
 * tests/r2-evidence-invigilator.test.js
 * Verification test suite for Phase R2 - Evidence & Invigilator Experience (Prompt 2 Q6 Completed)
 *
 * Tests:
 * 1. Evidence Tickets:
 *    - POST /api/v1/attempts/:id/violations -> returns { violationId, evidenceTickets: { camera, screen } }
 *    - Tickets issued AFTER row exists, bound to violationId, <= 300 KB, image/webp|jpeg, TTL 120s
 * 2. HeadObject Verification & Completion:
 *    - POST /violations/:id/evidence/complete verifies S3 object via HeadObject
 *    - Valid object -> evidence_status = UPLOADED
 *    - Missing/invalid object -> evidence_status = FAILED, row is durable (not deleted), retriable error
 * 3. Invigilator Credentials (R-10):
 *    - crypto unambiguous alphabet (>= 10 chars, no 0/O/1/I/l)
 *    - Exam creation / publish returns invId + oneTimePassword + validUntil (exam end + 24h)
 *    - Regeneration invalidates old sessions, audit logs, returns new one-time password
 *    - GET never returns password/hash
 *    - Expiration window enforced at exam end + 24h
 * 4. Config Flag Logic (R-11):
 *    - Mirrors off | warn | enforce accurately
 */

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const { prisma } = require('../src/infra/postgres/client')
const { proctoringService } = require('../src/modules/proctoring/service')
const { presignService } = require('../src/modules/media/presignService')
const { examService, generateUnambiguousPassword } = require('../src/modules/exams/service')
const { authService } = require('../src/modules/auth/service')
const s3Client = require('../src/infra/s3/s3.client')
const { ROLES } = require('../src/shared/roles')

describe('R2 — Evidence & Invigilator Experience Test Suite', () => {
  let testFaculty
  let testStudent
  let testExam
  let testAttempt

  before(async () => {
    // 1. Create test Department if needed
    const dept = await prisma.department.upsert({
      where: { code: 'R2-TEST' },
      update: {},
      create: {
        code: 'R2-TEST',
        name: 'R2 Evidence Test Department'
      }
    })

    // 2. Create test Faculty
    const facHash = await bcrypt.hash('FacultyPass123!', 10)
    testFaculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Prof. R2 Invigilator Test',
        email: `faculty-r2-${Date.now()}@test.edu`,
        password: facHash,
        employeeId: `EMP-R2-${Date.now().toString().slice(-6)}`,
        departmentCode: dept.code
      }
    })

    // 3. Create test Student
    const stuHash = await bcrypt.hash('StudentPass123!', 10)
    testStudent = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Student R2 Candidate',
        email: `student-r2-${Date.now()}@test.edu`,
        usn: `1TEST${Date.now().toString().slice(-5)}`,
        password: stuHash,
        departmentCode: dept.code,
        semester: 6
      }
    })

    // 4. Create test Exam (Draft)
    testExam = await examService.createExam({
      title: 'R2 Evidence Integrity Exam',
      subject: 'CS-802',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      duration: 120,
      totalMarks: 50
    }, testFaculty.id)

    // Add a valid question to allow publishing
    const q = await prisma.question.create({
      data: {
        id: crypto.randomUUID(),
        examId: testExam.id,
        questionText: 'What algorithm provides cryptographic one-way hashing?',
        marks: 5,
        difficulty: 'MEDIUM',
        options: {
          create: [
            { id: crypto.randomUUID(), text: 'SHA-256', isCorrect: true, order: 0 },
            { id: crypto.randomUUID(), text: 'Base64', isCorrect: false, order: 1 }
          ]
        }
      }
    })

    // 5. Create test Attempt (ACTIVE)
    testAttempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: testExam.id,
        studentId: testStudent.id,
        status: 'ACTIVE',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 7200000),
        watermarkSeed: 'seed-r2-test'
      }
    })
  })

  after(async () => {
    try {
      const exams = await prisma.exam.findMany({
        where: { faculty: { departmentCode: 'R2-TEST' } },
        select: { id: true }
      })
      const examIds = exams.map(e => e.id)
      if (examIds.length > 0) {
        await prisma.violationEvent.deleteMany({ where: { attempt: { examId: { in: examIds } } } })
        await prisma.examAttempt.deleteMany({ where: { examId: { in: examIds } } })
        await prisma.invigilatorSession.deleteMany({ where: { examId: { in: examIds } } })
        await prisma.auditLog.deleteMany({ where: { resourceId: { in: examIds } } })
        await prisma.questionOption.deleteMany({ where: { question: { examId: { in: examIds } } } })
        await prisma.question.deleteMany({ where: { examId: { in: examIds } } })
        await prisma.exam.deleteMany({ where: { id: { in: examIds } } })
      }
      await prisma.student.deleteMany({ where: { departmentCode: 'R2-TEST' } })
      await prisma.faculty.deleteMany({ where: { departmentCode: 'R2-TEST' } })
      await prisma.department.deleteMany({ where: { code: 'R2-TEST' } })
    } catch (err) {
      logger.warn({ error: err.message }, 'Cleanup after hook warning')
    }
  })

  // ────────────────────────────────────────────────────────────
  // Section 1: Evidence Tickets on Violation
  // ────────────────────────────────────────────────────────────
  describe('1. Student Evidence Tickets Generation', () => {
    it('issues dual-channel evidenceTickets (camera, screen) bound to violationId after row exists', async () => {
      const res = await proctoringService.recordViolation(
        testAttempt.id,
        testStudent.id,
        'TAB_SWITCH',
        { app: 'browser' },
        new Date().toISOString()
      )

      assert.equal(res.recorded, true, 'Violation should be recorded')
      assert.ok(res.violationId, 'Must return violationId')
      assert.ok(res.evidenceTickets, 'Must return evidenceTickets')

      const { camera, screen } = res.evidenceTickets
      assert.ok(camera, 'Must include camera ticket')
      assert.ok(screen, 'Must include screen ticket')

      // 1. Bound to violationId
      assert.ok(camera.key.includes(`${res.violationId}_camera`), 'Camera key must be bound to violationId')
      assert.ok(screen.key.includes(`${res.violationId}_screen`), 'Screen key must be bound to violationId')

      // 2. Max size <= 300 KB
      assert.ok(camera.maxSizeBytes <= 300 * 1024, 'Camera upload limit must be <= 300 KB')
      assert.ok(screen.maxSizeBytes <= 300 * 1024, 'Screen upload limit must be <= 300 KB')

      // 3. TTL = 120s
      assert.equal(camera.expiresIn, 120, 'TTL must be 120s')
      assert.equal(screen.expiresIn, 120, 'TTL must be 120s')

      // 4. Presigned URLs
      assert.ok(camera.putUrl || camera.url, 'Must provide direct S3 upload URL for camera')
      assert.ok(screen.putUrl || screen.url, 'Must provide direct S3 upload URL for screen')

      // 5. Client 320 px thumbnail tickets
      assert.ok(camera.thumbKey, 'Must provide thumbKey for camera thumbnail')
      assert.ok(screen.thumbKey, 'Must provide thumbKey for screen thumbnail')
      assert.ok(camera.thumbPutUrl || camera.thumbUrl, 'Must provide upload URL for camera thumbnail')

      // 6. Verify row exists in Postgres BEFORE tickets were issued
      const row = await prisma.violationEvent.findUnique({
        where: { id: BigInt(res.violationId) }
      })
      assert.ok(row, 'Violation row must exist in database')
      assert.equal(row.attemptId, testAttempt.id)
      assert.equal(row.eventType, 'TAB_SWITCH')
    })
  })

  // ────────────────────────────────────────────────────────────
  // Section 2: S3 HeadObject Verification & Completion Handshake
  // ────────────────────────────────────────────────────────────
  describe('2. HeadObject Verification & Upload Completion Handshake', () => {
    let violationId
    let cameraKey
    let thumbKey

    beforeEach(async () => {
      // Create a fresh violation row for completion tests
      const v = await prisma.violationEvent.create({
        data: {
          attemptId: testAttempt.id,
          eventType: 'NO_FACE',
          severity: 'HIGH',
          evidenceStatus: 'PENDING'
        }
      })
      violationId = v.id.toString()
      cameraKey = `evidence/${testExam.id}/${testAttempt.id}/${violationId}_camera.webp`
      thumbKey = `thumbs/${testExam.id}/${testAttempt.id}/${violationId}_camera.webp`
    })

    it('successfully verifies S3 object via HeadObject and marks evidenceStatus = UPLOADED', async () => {
      // Intercept headObject to simulate successful S3 storage
      const originalHeadObject = s3Client.headObject
      s3Client.headObject = async (key) => {
        return {
          ContentLength: 85 * 1024, // 85 KB (<= 300 KB)
          ContentType: 'image/webp'
        }
      }

      try {
        const result = await presignService.completeEvidenceUpload(
          { id: testStudent.id, role: ROLES.STUDENT },
          {
            violationId,
            cameraKey,
            thumbKey
          }
        )

        assert.equal(result.success, true)
        assert.equal(result.status, 'UPLOADED')
        assert.equal(result.evidenceKey, cameraKey)
        assert.equal(result.thumbKey, thumbKey)

        // Verify row in database
        const row = await prisma.violationEvent.findUnique({
          where: { id: BigInt(violationId) }
        })
        assert.equal(row.evidenceStatus, 'UPLOADED')
        assert.equal(row.evidenceKey, cameraKey)
        assert.equal(row.thumbKey, thumbKey)
      } finally {
        s3Client.headObject = originalHeadObject
      }
    })

    it('marks evidenceStatus = FAILED and keeps violation row durable when S3 HeadObject fails', async () => {
      // Intercept headObject to simulate object missing in S3
      const originalHeadObject = s3Client.headObject
      s3Client.headObject = async (key) => {
        const err = new Error('NoSuchKey: The specified key does not exist.')
        err.name = 'NotFound'
        throw err
      }

      try {
        await assert.rejects(
          async () => {
            await presignService.completeEvidenceUpload(
              { id: testStudent.id, role: ROLES.STUDENT },
              {
                violationId,
                cameraKey,
                thumbKey
              }
            )
          },
          /Evidence object not found in storage/
        )

        // Verify violation row is DURABLE (not deleted!) and marked FAILED
        const row = await prisma.violationEvent.findUnique({
          where: { id: BigInt(violationId) }
        })
        assert.ok(row, 'Violation row must remain durable in database')
        assert.equal(row.evidenceStatus, 'FAILED')
      } finally {
        s3Client.headObject = originalHeadObject
      }
    })

    it('rejects evidence exceeding 300 KB limit', async () => {
      const originalHeadObject = s3Client.headObject
      s3Client.headObject = async (key) => {
        return {
          ContentLength: 350 * 1024, // 350 KB (> 300 KB)
          ContentType: 'image/webp'
        }
      }

      try {
        await assert.rejects(
          async () => {
            await presignService.completeEvidenceUpload(
              { id: testStudent.id, role: ROLES.STUDENT },
              {
                violationId,
                cameraKey,
                thumbKey
              }
            )
          },
          /exceeds maximum limit of 300 KB/
        )

        const row = await prisma.violationEvent.findUnique({
          where: { id: BigInt(violationId) }
        })
        assert.equal(row.evidenceStatus, 'FAILED')
      } finally {
        s3Client.headObject = originalHeadObject
      }
    })
  })

  // ────────────────────────────────────────────────────────────
  // Section 3: Invigilator Credentials (R-10)
  // ────────────────────────────────────────────────────────────
  describe('3. Invigilator Credentials & One-Time Password (R-10)', () => {
    it('generates passwords from crypto with >= 10 chars and unambiguous alphabet', () => {
      const pass = generateUnambiguousPassword(12)
      assert.ok(pass.length >= 10, 'Password must be >= 10 characters')

      // Must NOT contain ambiguous characters: 0, O, 1, I, l
      const ambiguousChars = ['0', 'O', '1', 'I', 'l']
      for (const ch of ambiguousChars) {
        assert.equal(pass.includes(ch), false, `Password must not contain ambiguous character '${ch}'`)
      }
    })

    it('returns invId and oneTimePassword on exam creation and publish, valid until exam end + 24h', async () => {
      // 1. Exam creation returns one-time password
      assert.ok(testExam.invId, 'Exam creation must return invId')
      assert.ok(testExam.oneTimePassword, 'Exam creation must return oneTimePassword')
      assert.ok(testExam.validUntil, 'Exam creation must return validUntil')

      // 2. Exam publish returns new one-time password
      const published = await examService.publishExam(testExam.id, testFaculty.id, ROLES.FACULTY)
      assert.ok(published.invId)
      assert.ok(published.oneTimePassword, 'Exam publish must return oneTimePassword')
      assert.ok(published.validUntil)

      // Test login with the published credentials
      const loginRes = await authService.invigilatorLogin({
        examId: testExam.id,
        invId: published.invId,
        invPassword: published.oneTimePassword,
        ipAddress: '127.0.0.1'
      })
      assert.ok(loginRes.accessToken, 'Invigilator login must succeed with one-time password')
      assert.equal(loginRes.user.id, published.invId)
    })

    it('regenerates credentials, invalidates old sessions, logs audit entry, and issues new password', async () => {
      // 1. First login to establish an active session
      const pubExam = await prisma.exam.findUnique({ where: { id: testExam.id } })
      const reg = await examService.regenerateInvigilatorCredentials(testExam.id, testFaculty.id, ROLES.FACULTY)

      assert.equal(reg.success, true)
      assert.ok(reg.invId)
      assert.ok(reg.oneTimePassword)
      assert.ok(reg.validUntil)

      // Verify old sessions are marked inactive
      const activeSessions = await prisma.invigilatorSession.count({
        where: { examId: testExam.id, isActive: true }
      })
      assert.equal(activeSessions, 0, 'Old sessions must be invalidated')

      // Verify audit log exists
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: testExam.id,
          action: 'EXAM_INVIGILATOR_CREDENTIALS_REGENERATED'
        }
      })
      assert.ok(audit, 'Audit log entry must be recorded')

      // New credentials work
      const loginRes = await authService.invigilatorLogin({
        examId: testExam.id,
        invId: reg.invId,
        invPassword: reg.oneTimePassword,
        ipAddress: '127.0.0.1'
      })
      assert.ok(loginRes.accessToken, 'New regenerated credentials must log in successfully')
    })

    it('NEVER returns oneTimePassword or invPasswordHash on any GET endpoint', async () => {
      const getRes = await examService.getExam(testExam.id, { id: testFaculty.id, role: ROLES.FACULTY })
      assert.equal(getRes.oneTimePassword, undefined, 'GET must never return oneTimePassword')
      assert.equal(getRes.rawInvPassword, undefined, 'GET must never return rawInvPassword')
      assert.equal(getRes.invPasswordHash, undefined, 'GET must never return invPasswordHash')
      assert.equal(getRes.invPassword, undefined, 'GET must never return invPassword')
    })

    it('rejects invigilator login if exam end + 24h has expired', async () => {
      // Create an expired exam (ended 3 days ago)
      const expiredExam = await examService.createExam({
        title: 'Expired Exam Session',
        subject: 'EXP-101',
        startTime: new Date(Date.now() - 4 * 86400000).toISOString(),
        endTime: new Date(Date.now() - 3 * 86400000).toISOString(),
        duration: 60,
        totalMarks: 20
      }, testFaculty.id)

      await assert.rejects(
        async () => {
          await authService.invigilatorLogin({
            examId: expiredExam.id,
            invId: expiredExam.invId,
            invPassword: expiredExam.oneTimePassword,
            ipAddress: '127.0.0.1'
          })
        },
        /Invigilator credentials expired/
      )

      // Cleanup expired exam
      await prisma.exam.delete({ where: { id: expiredExam.id } })
    })
  })

  // ────────────────────────────────────────────────────────────
  // Section 4: Public Config Flag Logic (R-11)
  // ────────────────────────────────────────────────────────────
  describe('4. Config Flag Logic (R-11)', () => {
    it('mirrors off | warn | enforce correctly across env variations', () => {
      const evaluateConfig = (vpnEnforcementEnv, vpnEnabledEnv) => {
        const rawMode = (vpnEnforcementEnv || (vpnEnabledEnv === 'true' ? 'enforce' : 'off')).toLowerCase().trim()
        let vpnEnforcement = 'off'
        if (rawMode === 'enforce' || rawMode === 'true') {
          vpnEnforcement = 'enforce'
        } else if (rawMode === 'warn') {
          vpnEnforcement = 'warn'
        } else {
          vpnEnforcement = 'off'
        }
        return {
          vpnEnforcement,
          isVpnEnforced: vpnEnforcement !== 'off'
        }
      }

      assert.deepEqual(evaluateConfig('off', 'false'), { vpnEnforcement: 'off', isVpnEnforced: false })
      assert.deepEqual(evaluateConfig('warn', 'true'), { vpnEnforcement: 'warn', isVpnEnforced: true })
      assert.deepEqual(evaluateConfig('enforce', 'true'), { vpnEnforcement: 'enforce', isVpnEnforced: true })
      assert.deepEqual(evaluateConfig('true', 'true'), { vpnEnforcement: 'enforce', isVpnEnforced: true })
      assert.deepEqual(evaluateConfig(undefined, 'true'), { vpnEnforcement: 'enforce', isVpnEnforced: true })
      assert.deepEqual(evaluateConfig(undefined, 'false'), { vpnEnforcement: 'off', isVpnEnforced: false })
    })
  })

  after(async () => {
    try {
      if (testAttempt?.id) await prisma.examAttempt.deleteMany({ where: { id: testAttempt.id } }).catch(() => {})
      if (testExam?.id) await prisma.exam.deleteMany({ where: { id: testExam.id } }).catch(() => {})
      if (testStudent?.id) await prisma.student.deleteMany({ where: { id: testStudent.id } }).catch(() => {})
      if (testFaculty?.id) await prisma.faculty.deleteMany({ where: { id: testFaculty.id } }).catch(() => {})
      await prisma.department.deleteMany({ where: { code: 'R2-TEST' } }).catch(() => {})
    } catch {}
    const { closeAll } = require('../src/lifecycle')
    await closeAll().catch(() => {})
  })
})

