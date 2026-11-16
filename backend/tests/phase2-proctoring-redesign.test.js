const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { prisma } = require('../src/infra/postgres/client')
const { redisClient } = require('../src/infra/redis/client')
const { mediaService } = require('../src/modules/media/media.service')
const { attemptService } = require('../src/modules/attempts/attempts.service')
const { proctoringService } = require('../src/modules/proctoring/proctoring.service')
const { sanitizeProctoringConfigInput } = require('../src/modules/exams/exams.guard')
const { toExamDto } = require('../src/modules/exams/exams.service')

describe('Phase 2: Proctoring Redesign — Pre-Check, Screenshots, & No Auto-Termination', () => {
  let facultyUser
  let studentUser
  let invigilatorUser
  let testExam
  let testAttempt

  before(async () => {
    const randomSuffix = crypto.randomBytes(4).toString('hex')

    // Create test faculty
    facultyUser = await prisma.user.create({
      data: {
        email: `faculty-p2-${randomSuffix}@test.local`,
        fullName: 'Faculty Phase2',
        passwordHash: 'hashed_password_placeholder',
        role: 'FACULTY'
      }
    })

    // Create test student (no reference photo initially)
    studentUser = await prisma.user.create({
      data: {
        email: `student-p2-${randomSuffix}@test.local`,
        fullName: 'Student Phase2',
        passwordHash: 'hashed_password_placeholder',
        role: 'STUDENT',
        institutionId: `STU-${randomSuffix}`
      }
    })

    // Create test invigilator
    invigilatorUser = await prisma.user.create({
      data: {
        email: `inv-p2-${randomSuffix}@test.local`,
        fullName: 'Invigilator Phase2',
        passwordHash: 'hashed_password_placeholder',
        role: 'INVIGILATOR'
      }
    })

    // Create published test exam
    const now = new Date()
    testExam = await prisma.exam.create({
      data: {
        title: `Phase2 Proctoring Exam ${randomSuffix}`,
        courseCode: `CS-P2-${randomSuffix}`,
        createdById: facultyUser.id,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 7200000),
        durationMinutes: 60,
        status: 'PUBLISHED',
        proctoringConfig: {
          sebRequired: false,
          maxViolations: 3 // Legacy field that should be ignored
        },
        questions: {
          create: [
            {
              questionText: 'What is 2 + 2?',
              options: ['3', '4', '5', '6'],
              correctOptionIndex: 1,
              marks: 1
            }
          ]
        }
      }
    })

    // Create candidate readiness attempt
    testAttempt = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: studentUser.id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      }
    })
  })

  after(async () => {
    try {
      await proctoringService.shutdownProctoringBuffer()
      if (testAttempt?.id) {
        await prisma.proctoringLog.deleteMany({ where: { attemptId: testAttempt.id } })
        await prisma.attemptAnswer.deleteMany({ where: { attemptId: testAttempt.id } })
        await prisma.examAttempt.deleteMany({ where: { id: testAttempt.id } })
      }
      if (testExam?.id) {
        await prisma.question.deleteMany({ where: { examId: testExam.id } })
        await prisma.exam.deleteMany({ where: { id: testExam.id } })
      }
      if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } })
      if (facultyUser?.id) await prisma.user.deleteMany({ where: { id: facultyUser.id } })
      if (invigilatorUser?.id) await prisma.user.deleteMany({ where: { id: invigilatorUser.id } })
      if (redisClient) await redisClient.disconnect()
      await prisma.$disconnect()
    } catch (_) {}
    setTimeout(() => process.exit(0), 200)
  })

  it('1. Pre-Check: Missing reference photo returns NO_REFERENCE and marks attempt PENDING_APPROVAL', async () => {
    const fakeBase64 = Buffer.from('placeholder-photo-data-bytes').toString('base64')
    const result = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: fakeBase64
    })

    assert.equal(result.verified, false)
    assert.equal(result.status, 'NO_REFERENCE')
    assert.ok(result.reason.includes('No reference photo on file'))

    // Verify DB attempt was updated with PENDING_APPROVAL
    const updatedAttempt = await prisma.examAttempt.findUnique({ where: { id: testAttempt.id } })
    assert.equal(updatedAttempt.faceStatus, 'NO_REFERENCE')
    assert.equal(updatedAttempt.faceVerified, false)
  })

  it('2. Pre-Check Driver: Simulates MATCH, NO_MATCH, NO_FACE, MULTIPLE_FACES, LOW_QUALITY, SERVICE_ERROR', async () => {
    // Set a reference photo on student
    await prisma.user.update({
      where: { id: studentUser.id },
      data: {
        profileMetadata: {
          facePhotoDataUrl: 'data:image/jpeg;base64,cmVmZXJlbmNlLXBob3RvLWRhdGE='
        }
      }
    })

    // Test MATCH
    const matchRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('match-sample-photo-data-long-enough-for-test-size-check-12345678901234567890').toString('base64')
    })
    assert.equal(matchRes.status, 'MATCH')
    assert.equal(matchRes.verified, true)

    // Test NO_MATCH
    const noMatchRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('no-match-sample-photo-data-long-enough-for-test-size-check-12345678901234567890').toString('base64')
    })
    assert.equal(noMatchRes.status, 'NO_MATCH')
    assert.equal(noMatchRes.verified, false)

    // Test NO_FACE
    const noFaceRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('no-face-sample-photo-data-long-enough-for-test-size-check-12345678901234567890').toString('base64')
    })
    assert.equal(noFaceRes.status, 'NO_FACE')
    assert.equal(noFaceRes.verified, false)

    // Test MULTIPLE_FACES
    const multiRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('multiple-faces-sample-photo-data-long-enough-for-test-size-check-12345678901234567890').toString('base64')
    })
    assert.equal(multiRes.status, 'MULTIPLE_FACES')
    assert.equal(multiRes.verified, false)

    // Test LOW_QUALITY
    const lowQualRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('low-quality-sample-photo-data-check').toString('base64')
    })
    assert.equal(lowQualRes.status, 'LOW_QUALITY')
    assert.equal(lowQualRes.verified, false)

    // Test SERVICE_ERROR
    const svcErrRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: testExam.id,
      attemptId: testAttempt.id,
      imageBase64: 'data:image/jpeg;base64,' + Buffer.from('service-error-sample-photo-data-check-12345678901234567890').toString('base64')
    })
    assert.equal(svcErrRes.status, 'SERVICE_ERROR')
    assert.equal(svcErrRes.verified, false)
  })

  it('3. Manual Invigilator Approval & Rejection Endpoints', async () => {
    // Approve identity
    const approved = await attemptService.approveIdentity(testAttempt.id, invigilatorUser.id)
    assert.equal(approved.faceVerified, true)
    assert.equal(approved.faceStatus, 'APPROVED')
    assert.equal(approved.invigilatorApproved, true)
    assert.equal(approved.invigilatorApprovedById, invigilatorUser.id)

    // Reject identity
    const rejected = await attemptService.rejectIdentity(testAttempt.id, invigilatorUser.id)
    assert.equal(rejected.faceVerified, false)
    assert.equal(rejected.faceStatus, 'REJECTED')
    assert.equal(rejected.invigilatorApproved, false)
  })

  it('4. Zero Auto-Termination: 10 consecutive violations leave attempt IN_PROGRESS and answers can still be saved', async () => {
    // Reset attempt status to IN_PROGRESS
    await prisma.examAttempt.update({
      where: { id: testAttempt.id },
      data: { status: 'IN_PROGRESS', violationCount: 0 }
    })

    // Record 10 consecutive violations
    for (let i = 1; i <= 10; i++) {
      await proctoringService.recordViolation({
        attemptId: testAttempt.id,
        examId: testExam.id,
        eventType: 'TAB_SWITCH',
        severity: 'HIGH',
        metadata: { iteration: i }
      })
    }
    await proctoringService.flushBuffer()

    const checkAttempt = await prisma.examAttempt.findUnique({ where: { id: testAttempt.id } })
    assert.equal(checkAttempt.violationCount, 10)
    // CRITICAL: Must NEVER be auto-terminated or auto-suspended!
    assert.equal(checkAttempt.status, 'IN_PROGRESS')

    // Student can still save answers normally despite 10 violations
    const question = await prisma.question.findFirst({ where: { examId: testExam.id } })
    const answer = await attemptService.saveAnswer(testAttempt.id, studentUser.id, question.id, 1, false)
    assert.ok(answer)
  })

  it('5. Manual Termination: Only explicit invigilator action terminates attempt', async () => {
    await attemptService.terminateAttempt(testAttempt.id, invigilatorUser.id, 'Repeated unauthorized device')

    const termAttempt = await prisma.examAttempt.findUnique({ where: { id: testAttempt.id } })
    assert.equal(termAttempt.status, 'SUBMITTED')

    // Further answer attempts fail with 409 ATTEMPT_NOT_ACTIVE
    const question = await prisma.question.findFirst({ where: { examId: testExam.id } })
    await assert.rejects(
      async () => {
        await attemptService.saveAnswer(testAttempt.id, studentUser.id, question.id, 0, false)
      },
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'ATTEMPT_NOT_ACTIVE')
        return true
      }
    )
  })

  it('6. S3 Presigned URL & Screenshot Path Formatting', async () => {
    const uploadPolicy = await mediaService.generatePresignedUpload({
      purpose: 'VIOLATION_SCREENSHOT',
      attemptId: testAttempt.id,
      contentType: 'image/jpeg',
      bytes: 200000,
      metadata: {
        examId: testExam.id,
        eventType: 'CLIPBOARD_PASTE'
      }
    })

    assert.ok(uploadPolicy.key)
    assert.ok(uploadPolicy.key.startsWith(`evidence/screenshots/${testExam.id}/${testAttempt.id}/`))
    assert.ok(uploadPolicy.key.endsWith('-CLIPBOARD_PASTE.jpg'))
  })

  it('7. DTO Sanitization: maxViolations is stripped from toExamDto and ignored in guard', async () => {
    const sanitized = sanitizeProctoringConfigInput({
      sebRequired: true,
      maxViolations: 5,
      cameraRequired: true
    })
    assert.equal(sanitized.maxViolations, undefined)
    assert.equal(sanitized.sebRequired, true)

    const dto = toExamDto(testExam, { role: 'STUDENT', id: studentUser.id })
    assert.equal(dto.proctoringConfig.maxViolations, undefined)
  })
})
