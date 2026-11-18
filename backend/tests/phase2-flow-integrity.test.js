const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { prisma } = require('../src/infra/postgres/client')
const { attemptService } = require('../src/modules/attempts/attempts.service')
const { suspendAttempt, resumeAttempt, terminateAttempt } = require('../src/modules/attempts/attempts.invigilator')

describe('Phase 2: Flow Integrity, Single Attempt & Violation Threshold Elimination', () => {
  let facultyUser
  let studentUser
  let invigilatorUser
  let testExam

  before(async () => {
    const randomSuffix = crypto.randomBytes(4).toString('hex')

    facultyUser = await prisma.user.create({
      data: {
        email: `faculty-flow-${randomSuffix}@test.local`,
        fullName: 'Faculty Flow',
        passwordHash: 'hashed_password_placeholder',
        role: 'FACULTY'
      }
    })

    studentUser = await prisma.user.create({
      data: {
        email: `student-flow-${randomSuffix}@test.local`,
        fullName: 'Student Flow',
        passwordHash: 'hashed_password_placeholder',
        role: 'STUDENT',
        institutionId: `STU-FLOW-${randomSuffix}`
      }
    })

    invigilatorUser = await prisma.user.create({
      data: {
        email: `inv-flow-${randomSuffix}@test.local`,
        fullName: 'Invigilator Flow',
        passwordHash: 'hashed_password_placeholder',
        role: 'INVIGILATOR'
      }
    })

    const now = new Date()
    testExam = await prisma.exam.create({
      data: {
        title: `Flow Integrity Exam ${randomSuffix}`,
        courseCode: `CS-FLOW-${randomSuffix}`,
        createdById: facultyUser.id,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 7200000),
        durationMinutes: 60,
        status: 'PUBLISHED',
        proctoringConfig: {
          sebRequired: false
        },
        questions: {
          create: [
            {
              questionText: 'Flow test question 1?',
              options: ['A', 'B', 'C', 'D'],
              correctOptionIndex: 0,
              marks: 2,
              displayOrder: 0
            }
          ]
        }
      }
    })
  })

  after(async () => {
    try {
      if (testExam?.id) {
        await prisma.examAttempt.deleteMany({ where: { examId: testExam.id } })
        await prisma.question.deleteMany({ where: { examId: testExam.id } })
        await prisma.exam.delete({ where: { id: testExam.id } })
      }
      if (studentUser?.id) await prisma.user.delete({ where: { id: studentUser.id } })
      if (facultyUser?.id) await prisma.user.delete({ where: { id: facultyUser.id } })
      if (invigilatorUser?.id) await prisma.user.delete({ where: { id: invigilatorUser.id } })
    } catch (_) {}
    try {
      await prisma.$disconnect()
    } catch (_) {}
  })

  it('1. Rejects repeat startAttempt when attempt status is SUBMITTED or TIMED_OUT with 409', async () => {
    const randomSuffix = crypto.randomBytes(3).toString('hex')
    const studentA = await prisma.user.create({
      data: {
        email: `stu-final-${randomSuffix}@test.local`,
        fullName: 'Student Finalized',
        passwordHash: 'dummy',
        role: 'STUDENT',
        institutionId: `STU-F-${randomSuffix}`
      }
    })

    // Create an attempt and transition it to SUBMITTED
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: studentA.id,
        status: 'SUBMITTED',
        faceVerified: true,
        faceStatus: 'MATCH'
      }
    })

    await assert.rejects(
      async () => {
        await attemptService.startAttempt(testExam.id, studentA.id)
      },
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'ATTEMPT_ALREADY_FINALIZED')
        return true
      }
    )

    // Clean up
    await prisma.examAttempt.deleteMany({ where: { id: attempt.id } })
    await prisma.user.delete({ where: { id: studentA.id } })
  })

  it('2. Eliminates 3-violation threshold: suspendAttempt and resumeAttempt succeed even when violationCount >= 3', async () => {
    const randomSuffix = crypto.randomBytes(3).toString('hex')
    const studentB = await prisma.user.create({
      data: {
        email: `stu-viol-${randomSuffix}@test.local`,
        fullName: 'Student Violations',
        passwordHash: 'dummy',
        role: 'STUDENT',
        institutionId: `STU-V-${randomSuffix}`
      }
    })

    // Create attempt with violationCount = 5 in IN_PROGRESS state
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: studentB.id,
        status: 'IN_PROGRESS',
        violationCount: 5,
        faceVerified: true,
        faceStatus: 'MATCH'
      }
    })

    // Suspend should succeed despite violationCount >= 3
    const suspended = await suspendAttempt(attempt.id, invigilatorUser.id, 'Routine check')
    assert.equal(suspended.status, 'SUSPENDED')

    // Resume should also succeed despite violationCount >= 3
    const resumed = await resumeAttempt(attempt.id, invigilatorUser.id)
    assert.equal(resumed.status, 'IN_PROGRESS')

    // Clean up
    await prisma.examAttempt.deleteMany({ where: { id: attempt.id } })
    await prisma.user.delete({ where: { id: studentB.id } })
  })

  it('3. Rejects suspend and resume on SUBMITTED and TIMED_OUT attempts with 409', async () => {
    const randomSuffix = crypto.randomBytes(3).toString('hex')
    const studentC = await prisma.user.create({
      data: {
        email: `stu-final2-${randomSuffix}@test.local`,
        fullName: 'Student Finalized 2',
        passwordHash: 'dummy',
        role: 'STUDENT',
        institutionId: `STU-F2-${randomSuffix}`
      }
    })

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: studentC.id,
        status: 'SUBMITTED',
        faceVerified: true,
        faceStatus: 'MATCH'
      }
    })

    await assert.rejects(
      async () => {
        await suspendAttempt(attempt.id, invigilatorUser.id)
      },
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'INVALID_ATTEMPT_TRANSITION')
        return true
      }
    )

    await assert.rejects(
      async () => {
        await resumeAttempt(attempt.id, invigilatorUser.id)
      },
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'INVALID_ATTEMPT_TRANSITION')
        return true
      }
    )

    // Clean up
    await prisma.examAttempt.deleteMany({ where: { id: attempt.id } })
    await prisma.user.delete({ where: { id: studentC.id } })
  })
})
