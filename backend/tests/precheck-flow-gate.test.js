const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { prisma } = require('../src/infra/postgres/client')
const { redisClient } = require('../src/infra/redis/client')
const { attemptService } = require('../src/modules/attempts/attempts.service')
const { mediaService } = require('../src/modules/media/media.service')
const { sebTokenService } = require('../src/modules/seb/sebToken.service')

describe('Phase 2: Pre-Check Flow & Server-Side Identity Verification Gate', () => {
  let facultyUser
  let studentUser
  let invigilatorUser
  let proctoredExam
  let testAttempt

  before(async () => {
    const randomSuffix = crypto.randomBytes(4).toString('hex')

    facultyUser = await prisma.user.create({
      data: {
        email: `faculty-gate-${randomSuffix}@test.local`,
        fullName: 'Faculty Gate Tester',
        passwordHash: 'hashed_password_placeholder',
        role: 'FACULTY'
      }
    })

    studentUser = await prisma.user.create({
      data: {
        email: `student-gate-${randomSuffix}@test.local`,
        fullName: 'Student Gate Tester',
        passwordHash: 'hashed_password_placeholder',
        role: 'STUDENT',
        institutionId: `STU-GATE-${randomSuffix}`
      }
    })

    invigilatorUser = await prisma.user.create({
      data: {
        email: `inv-gate-${randomSuffix}@test.local`,
        fullName: 'Invigilator Gate Tester',
        passwordHash: 'hashed_password_placeholder',
        role: 'INVIGILATOR'
      }
    })

    const now = new Date()
    proctoredExam = await prisma.exam.create({
      data: {
        title: `Proctored Gate Exam ${randomSuffix}`,
        courseCode: `GATE-${randomSuffix}`,
        createdById: facultyUser.id,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 7200000),
        durationMinutes: 60,
        status: 'PUBLISHED',
        proctoringConfig: {
          cameraRequired: true,
          sebRequired: true
        },
        questions: {
          create: [
            {
              questionText: 'What is 5 x 5?',
              options: ['20', '25', '30'],
              correctOptionIndex: 1,
              marks: 1
            }
          ]
        }
      }
    })

    testAttempt = await prisma.examAttempt.create({
      data: {
        examId: proctoredExam.id,
        studentId: studentUser.id,
        status: 'NOT_STARTED',
        faceVerified: false,
        faceStatus: 'NOT_VERIFIED'
      }
    })
  })

  after(async () => {
    try {
      if (testAttempt?.id) {
        await prisma.attemptAnswer.deleteMany({ where: { attemptId: testAttempt.id } })
        await prisma.examAttempt.deleteMany({ where: { id: testAttempt.id } })
      }
      if (proctoredExam?.id) {
        await prisma.question.deleteMany({ where: { examId: proctoredExam.id } })
        await prisma.exam.deleteMany({ where: { id: proctoredExam.id } })
      }
      if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } })
      if (facultyUser?.id) await prisma.user.deleteMany({ where: { id: facultyUser.id } })
      if (invigilatorUser?.id) await prisma.user.deleteMany({ where: { id: invigilatorUser.id } })
      if (redisClient) await redisClient.disconnect()
      await prisma.$disconnect()
    } catch (_) {}
    setTimeout(() => process.exit(0), 200)
  })

  it('1. Server Gate: Refuses attempt start when identity is not verified (403 IDENTITY_NOT_VERIFIED)', async () => {
    await assert.rejects(
      async () => {
        await attemptService.startAttempt(proctoredExam.id, studentUser.id)
      },
      (err) => {
        assert.equal(err.status, 403)
        assert.equal(err.code, 'IDENTITY_NOT_VERIFIED')
        assert.ok(err.message.includes('Identity verification required'))
        return true
      }
    )
  })

  it('2. Pre-Check: Verifying face with MATCH marks faceVerified: true and allows startAttempt', async () => {
    // Add reference photo
    await prisma.user.update({
      where: { id: studentUser.id },
      data: {
        profileMetadata: {
          facePhotoDataUrl: 'data:image/jpeg;base64,cmVmZXJlbmNlLXBob3RvLWRhdGE='
        }
      }
    })

    const matchPhoto = 'data:image/jpeg;base64,' + Buffer.from('match-sample-photo-data-long-enough-for-test-size-check-12345678901234567890').toString('base64')
    const verifyRes = await mediaService.verifyLiveFaceAgainstReference({
      studentId: studentUser.id,
      examId: proctoredExam.id,
      attemptId: testAttempt.id,
      imageBase64: matchPhoto
    })

    assert.equal(verifyRes.status, 'MATCH')
    assert.equal(verifyRes.verified, true)

    // Check attempt in DB
    const checkAttempt = await prisma.examAttempt.findUnique({ where: { id: testAttempt.id } })
    assert.equal(checkAttempt.faceVerified, true)
    assert.equal(checkAttempt.faceStatus, 'MATCH')

    // Now startAttempt MUST succeed!
    const started = await attemptService.startAttempt(proctoredExam.id, studentUser.id)
    assert.ok(started.attempt)
    assert.equal(started.attempt.status, 'IN_PROGRESS')
  })

  it('3. Invigilator Manual Approval: Enables attempt start even if automated match failed', async () => {
    // Create another candidate with NO_MATCH
    const unverifiedStudent = await prisma.user.create({
      data: {
        email: `stu-manual-${Date.now()}@test.local`,
        fullName: 'Manual Approval Student',
        passwordHash: 'hashed_pw',
        role: 'STUDENT'
      }
    })

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: proctoredExam.id,
        studentId: unverifiedStudent.id,
        status: 'NOT_STARTED',
        faceVerified: false,
        faceStatus: 'NO_MATCH'
      }
    })

    // Start must fail initially
    await assert.rejects(
      async () => attemptService.startAttempt(proctoredExam.id, unverifiedStudent.id),
      (err) => err.code === 'IDENTITY_NOT_VERIFIED'
    )

    // Invigilator approves
    await attemptService.approveIdentity(attempt.id, invigilatorUser.id)

    // Start succeeds
    const started = await attemptService.startAttempt(proctoredExam.id, unverifiedStudent.id)
    assert.ok(started.attempt)
    assert.equal(started.attempt.status, 'IN_PROGRESS')

    // Cleanup
    await prisma.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } })
    await prisma.examAttempt.deleteMany({ where: { id: attempt.id } })
    await prisma.user.deleteMany({ where: { id: unverifiedStudent.id } })
  })

  it('4. SEB Launch Token Service: Single-use launch link & fallback 6-digit PIN', async () => {
    const tokenResult = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: studentUser.role,
      examId: proctoredExam.id,
      purpose: 'exam'
    })

    assert.ok(tokenResult.launchToken)
    assert.ok(tokenResult.downloadToken)
    assert.ok(tokenResult.pin)
    assert.equal(tokenResult.pin.length, 6)
    assert.equal(/^\d{6}$/.test(tokenResult.pin), true)

    // Token is valid and can be consumed
    const consumed = sebTokenService.consumeLaunchToken(tokenResult.launchToken)
    assert.equal(consumed.status, 'SUCCESS')
    assert.equal(consumed.record.userId, studentUser.id)

    // Replay attack is blocked (single use)
    const replayed = sebTokenService.consumeLaunchToken(tokenResult.launchToken)
    assert.equal(replayed.status, 'ALREADY_USED')
  })
})
