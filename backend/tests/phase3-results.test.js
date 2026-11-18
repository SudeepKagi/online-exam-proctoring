const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { prisma } = require('../src/infra/postgres/client')
const { attemptService } = require('../src/modules/attempts/attempts.service')

describe('Phase 3: Student Results & Score Breakdown Suite', () => {
  let facultyUser
  let studentUser
  let studentOther
  let immediateExam
  let windowExam

  before(async () => {
    const randomSuffix = crypto.randomBytes(4).toString('hex')

    facultyUser = await prisma.user.create({
      data: {
        email: `faculty-res-${randomSuffix}@test.local`,
        fullName: 'Faculty Results',
        passwordHash: 'hashed_password_placeholder',
        role: 'FACULTY'
      }
    })

    studentUser = await prisma.user.create({
      data: {
        email: `student-res-${randomSuffix}@test.local`,
        fullName: 'Student Results',
        passwordHash: 'hashed_password_placeholder',
        role: 'STUDENT',
        institutionId: `STU-RES-${randomSuffix}`
      }
    })

    studentOther = await prisma.user.create({
      data: {
        email: `student-other-${randomSuffix}@test.local`,
        fullName: 'Student Other',
        passwordHash: 'hashed_password_placeholder',
        role: 'STUDENT',
        institutionId: `STU-OTH-${randomSuffix}`
      }
    })

    const now = new Date()
    immediateExam = await prisma.exam.create({
      data: {
        title: `Immediate Results Exam ${randomSuffix}`,
        courseCode: `CS-IMM-${randomSuffix}`,
        createdById: facultyUser.id,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 7200000),
        durationMinutes: 60,
        status: 'PUBLISHED',
        proctoringConfig: {
          sebRequired: false,
          resultsReleasePolicy: 'IMMEDIATE'
        },
        questions: {
          create: [
            {
              questionText: 'What is 2 + 2?',
              options: ['3', '4', '5', '6'],
              correctOptionIndex: 1,
              marks: 2,
              negativeMarks: 0.5,
              displayOrder: 0
            },
            {
              questionText: 'Which protocol is secure?',
              options: ['HTTP', 'HTTPS', 'FTP', 'Telnet'],
              correctOptionIndex: 1,
              marks: 3,
              negativeMarks: 1,
              displayOrder: 1
            }
          ]
        }
      },
      include: { questions: true }
    })

    windowExam = await prisma.exam.create({
      data: {
        title: `Window Results Exam ${randomSuffix}`,
        courseCode: `CS-WIN-${randomSuffix}`,
        createdById: facultyUser.id,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 7200000), // In the future
        durationMinutes: 60,
        status: 'PUBLISHED',
        proctoringConfig: {
          sebRequired: false,
          resultsReleasePolicy: 'AFTER_WINDOW'
        },
        questions: {
          create: [
            {
              questionText: 'Secret question?',
              options: ['Secret A', 'Secret B', 'Secret C', 'Secret D'],
              correctOptionIndex: 2,
              marks: 5,
              displayOrder: 0
            }
          ]
        }
      },
      include: { questions: true }
    })
  })

  after(async () => {
    try {
      if (immediateExam?.id) {
        await prisma.attemptAnswer.deleteMany({ where: { attempt: { examId: immediateExam.id } } })
        await prisma.examAttempt.deleteMany({ where: { examId: immediateExam.id } })
        await prisma.question.deleteMany({ where: { examId: immediateExam.id } })
        await prisma.exam.delete({ where: { id: immediateExam.id } })
      }
      if (windowExam?.id) {
        await prisma.attemptAnswer.deleteMany({ where: { attempt: { examId: windowExam.id } } })
        await prisma.examAttempt.deleteMany({ where: { examId: windowExam.id } })
        await prisma.question.deleteMany({ where: { examId: windowExam.id } })
        await prisma.exam.delete({ where: { id: windowExam.id } })
      }
      if (studentUser?.id) await prisma.user.delete({ where: { id: studentUser.id } })
      if (studentOther?.id) await prisma.user.delete({ where: { id: studentOther.id } })
      if (facultyUser?.id) await prisma.user.delete({ where: { id: facultyUser.id } })
    } catch (_) {}
    try {
      await prisma.$disconnect()
    } catch (_) {}
  })

  it('1. Rejects unfinalized attempt with 400 ATTEMPT_NOT_FINALIZED', async () => {
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: immediateExam.id,
        studentId: studentUser.id,
        status: 'IN_PROGRESS'
      }
    })

    await assert.rejects(
      async () => {
        await attemptService.getAttemptResults(attempt.id, studentUser.id, 'STUDENT')
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'ATTEMPT_NOT_FINALIZED')
        return true
      }
    )

    await prisma.examAttempt.delete({ where: { id: attempt.id } })
  })

  it('2. Rejects cross-student access with 403 Access denied', async () => {
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: immediateExam.id,
        studentId: studentUser.id,
        status: 'SUBMITTED',
        score: 5
      }
    })

    await assert.rejects(
      async () => {
        await attemptService.getAttemptResults(attempt.id, studentOther.id, 'STUDENT')
      },
      (err) => {
        assert.equal(err.status, 403)
        return true
      }
    )

    await prisma.examAttempt.delete({ where: { id: attempt.id } })
  })

  it('3. Immediate policy: returns detailed question breakdown with scores and correct options', async () => {
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: immediateExam.id,
        studentId: studentUser.id,
        status: 'SUBMITTED',
        score: 2,
        submittedAt: new Date()
      }
    })

    // Add student answer: question 1 correct (opt 1), question 2 wrong (opt 0)
    const q1 = immediateExam.questions[0]
    const q2 = immediateExam.questions[1]
    await prisma.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: q1.id,
        selectedOptionIndex: 1
      }
    })
    await prisma.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: q2.id,
        selectedOptionIndex: 0
      }
    })

    const results = await attemptService.getAttemptResults(attempt.id, studentUser.id, 'STUDENT')

    assert.equal(results.resultsReleased, true)
    assert.equal(results.attempt.id, attempt.id)
    assert.equal(results.attempt.score, 2)
    assert.equal(results.attempt.totalMarks, 5) // 2 + 3
    assert.equal(results.attempt.questionsCount, 2)
    assert.equal(results.attempt.attemptedCount, 2)
    assert.equal(results.attempt.unattemptedCount, 0)
    assert.ok(Array.isArray(results.questions))
    assert.equal(results.questions.length, 2)

    // Check Question 1
    const resQ1 = results.questions.find(q => q.id === q1.id)
    assert.equal(resQ1.selectedOptionIndex, 1)
    assert.equal(resQ1.correctOptionIndex, 1)
    assert.equal(resQ1.isCorrect, true)
    assert.equal(resQ1.scoreAwarded, 2)

    // Check Question 2
    const resQ2 = results.questions.find(q => q.id === q2.id)
    assert.equal(resQ2.selectedOptionIndex, 0)
    assert.equal(resQ2.correctOptionIndex, 1)
    assert.equal(resQ2.isCorrect, false)
    assert.equal(resQ2.scoreAwarded, -1) // -1 negative mark

    await prisma.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } })
    await prisma.examAttempt.delete({ where: { id: attempt.id } })
  })

  it('4. Zero Answer Leakage Invariant: AFTER_WINDOW policy hides question breakdown while window is open', async () => {
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: windowExam.id,
        studentId: studentUser.id,
        status: 'SUBMITTED',
        score: 5,
        submittedAt: new Date()
      }
    })

    const results = await attemptService.getAttemptResults(attempt.id, studentUser.id, 'STUDENT')

    assert.equal(results.resultsReleased, false)
    assert.equal(results.questions, null)
    assert.ok(results.releaseNotice.includes('closes'))
    assert.equal(results.attempt.score, 5)
    assert.equal(results.attempt.totalMarks, 5)

    await prisma.examAttempt.delete({ where: { id: attempt.id } })
  })

  it('5. getStudentExamResult finds student attempt by examId', async () => {
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: immediateExam.id,
        studentId: studentUser.id,
        status: 'SUBMITTED',
        score: 2,
        submittedAt: new Date()
      }
    })

    const results = await attemptService.getStudentExamResult(immediateExam.id, studentUser.id)
    assert.equal(results.attempt.id, attempt.id)
    assert.equal(results.attempt.score, 2)

    await prisma.examAttempt.delete({ where: { id: attempt.id } })
  })
})
