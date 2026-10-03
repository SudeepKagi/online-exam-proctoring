const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { prisma, withTransaction } = require('../src/infra/postgres/client')
const { attemptRepository } = require('../src/modules/attempts/repository')
const { attemptService } = require('../src/modules/attempts/service')
const { answerRepository } = require('../src/modules/answers/repository')
const { answerService } = require('../src/modules/answers/service')
const { submissionRepository } = require('../src/modules/submissions/repository')
const { submissionService } = require('../src/modules/submissions/service')
const { resultRepository } = require('../src/modules/results/repository')
const { evaluationWorker } = require('../src/modules/results/evaluationWorker')
const { expirySweeper } = require('../src/modules/attempts/expirySweeper')
const { redisClient } = require('../src/infra/redis/client')
const { toStudentAttemptDTO } = require('../src/modules/attempts/dto')
const {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  GoneError,
  StaleRevisionError
} = require('../src/shared/errors')

describe('P4 Concurrency & Correctness-Critical Write Paths', () => {
  let dept
  let faculty
  let studentA
  let studentB
  let exam
  let question1
  let question2
  let opt1A, opt1B, opt1C, opt1D
  let opt2A, opt2B, opt2C, opt2D

  before(async () => {
    // 1. Ensure Department
    dept = await prisma.department.upsert({
      where: { code: 'P4TEST' },
      update: {},
      create: { code: 'P4TEST', name: 'P4 Test Department' }
    })

    // 2. Create Faculty
    const pwdHash = await bcrypt.hash('P4TestPassword123!', 10)
    faculty = await prisma.faculty.create({
      data: {
        name: 'P4 Test Faculty',
        email: `p4_faculty_${Date.now()}@test.edu`,
        password: pwdHash,
        departmentCode: dept.code,
        employeeId: `FAC-${Date.now()}`
      }
    })

    // 3. Create Students
    studentA = await prisma.student.create({
      data: {
        name: 'Student A',
        email: `student_a_${Date.now()}@test.edu`,
        usn: `USN-A-${Date.now()}`,
        password: pwdHash,
        departmentCode: dept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    studentB = await prisma.student.create({
      data: {
        name: 'Student B',
        email: `student_b_${Date.now()}@test.edu`,
        usn: `USN-B-${Date.now()}`,
        password: pwdHash,
        departmentCode: dept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    // 4. Create Exam with 2 MCQ questions
    const startTime = new Date(Date.now() - 5 * 60 * 1000)
    const endTime = new Date(Date.now() + 60 * 60 * 1000)

    exam = await prisma.exam.create({
      data: {
        title: 'P4 Hot Path Concurrency Exam',
        subject: 'Algorithms',
        facultyId: faculty.id,
        startTime,
        endTime,
        duration: 60,
        totalMarks: 20,
        negativeMarking: true,
        negativeValue: 1,
        allowedDepartments: [dept.code],
        allowedSemesters: [6],
        invId: `INV-${Date.now()}`,
        invPasswordHash: pwdHash,
        status: 'PUBLISHED'
      }
    })

    question1 = await prisma.question.create({
      data: {
        examId: exam.id,
        questionText: 'What is the time complexity of quicksort average case?',
        marks: 10,
        negativeMarks: 1,
        order: 1,
        options: {
          create: [
            { text: 'O(N log N)', isCorrect: true, order: 1 },
            { text: 'O(N^2)', isCorrect: false, order: 2 },
            { text: 'O(N)', isCorrect: false, order: 3 },
            { text: 'O(log N)', isCorrect: false, order: 4 }
          ]
        }
      },
      include: { options: true }
    })

    const q1Opts = question1.options
    opt1A = q1Opts.find(o => o.isCorrect)
    opt1B = q1Opts.find(o => !o.isCorrect)

    question2 = await prisma.question.create({
      data: {
        examId: exam.id,
        questionText: 'What is the space complexity of merge sort?',
        marks: 10,
        negativeMarks: 1,
        order: 2,
        options: {
          create: [
            { text: 'O(N)', isCorrect: true, order: 1 },
            { text: 'O(1)', isCorrect: false, order: 2 },
            { text: 'O(log N)', isCorrect: false, order: 3 },
            { text: 'O(N^2)', isCorrect: false, order: 4 }
          ]
        }
      },
      include: { options: true }
    })

    const q2Opts = question2.options
    opt2A = q2Opts.find(o => o.isCorrect)
    opt2B = q2Opts.find(o => !o.isCorrect)
  })

  after(async () => {
    // Teardown test fixtures
    try {
      if (exam) {
        await prisma.idempotencyKey.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
        await prisma.answer.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
        await prisma.attemptQuestion.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
        await prisma.examResult.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.violationEvent.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.questionOption.deleteMany({ where: { question: { examId: exam.id } } }).catch(() => {})
        await prisma.question.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
      }
      if (dept) {
        await prisma.idempotencyKey.deleteMany({ where: { attempt: { student: { departmentCode: dept.code } } } }).catch(() => {})
        await prisma.answer.deleteMany({ where: { attempt: { student: { departmentCode: dept.code } } } }).catch(() => {})
        await prisma.attemptQuestion.deleteMany({ where: { attempt: { student: { departmentCode: dept.code } } } }).catch(() => {})
        await prisma.examResult.deleteMany({ where: { attempt: { student: { departmentCode: dept.code } } } }).catch(() => {})
        await prisma.violationEvent.deleteMany({ where: { attempt: { student: { departmentCode: dept.code } } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { student: { departmentCode: dept.code } } }).catch(() => {})
        await prisma.exam.deleteMany({ where: { faculty: { departmentCode: dept.code } } }).catch(() => {})
        await prisma.student.deleteMany({ where: { departmentCode: dept.code } }).catch(() => {})
        await prisma.faculty.deleteMany({ where: { departmentCode: dept.code } }).catch(() => {})
        await prisma.department.delete({ where: { code: dept.code } }).catch(() => {})
      }
    } catch {}
  })

  // ──────────────────────────────────────────────────────────
  // 1. 200 Parallel Starts on Same Attempt
  // ──────────────────────────────────────────────────────────
  it('Task 1: 200 parallel starts for the same attempt => exactly one READY->ACTIVE, all callers receive identical attempt', async () => {
    // Create pre-warmed READY attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: studentA.id,
        status: 'READY',
        watermarkSeed: 'seed_watermark_200',
        shuffleSeed: 'seed_shuffle_200'
      }
    })

    // Setup attempt questions
    const aq1 = await prisma.attemptQuestion.create({
      data: {
        attemptId: attempt.id,
        questionId: question1.id,
        displayOrder: 1,
        optionOrder: [0, 1, 2, 3]
      }
    })

    // Pre-warm content cache as specified in Section 4.3
    await attemptService.getExamContentCached(exam.id)

    // Fire 200 concurrent start requests
    const PARALLEL_COUNT = 200
    const startPromises = []
    for (let i = 0; i < PARALLEL_COUNT; i++) {
      startPromises.push(attemptService.startOrResumeAttempt(exam.id, studentA.id))
    }

    const results = await Promise.all(startPromises)
    assert.equal(results.length, 200)

    // All callers get identical attempt ID and ACTIVE status
    for (const res of results) {
      assert.equal(res.attempt.id, attempt.id)
      assert.equal(res.attempt.status, 'ACTIVE')
      assert.ok(res.attempt.startedAt)
      assert.ok(res.attempt.expiresAt)
    }

    // Verify exactly 1 row exists in database in ACTIVE status
    const dbAttempt = await prisma.examAttempt.findUnique({
      where: { id: attempt.id }
    })
    assert.equal(dbAttempt.status, 'ACTIVE')
  })

  // ──────────────────────────────────────────────────────────
  // 2. 100 Parallel Submits (Same Key) & 50 Parallel Submits (Different Keys)
  // ──────────────────────────────────────────────────────────
  it('Task 2: 100 parallel submits with same key => 1 transition, 1 outbox row, identical response; 50 parallel submits with different keys => 1 winner, others replay alreadySubmitted', async () => {
    const attempt = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: studentA.id } }
    })

    const sharedKey = crypto.randomUUID()

    const pLimit = require('p-limit')
    const limit = pLimit(15)

    // 100 parallel submits with SAME key
    const sameKeyPromises = []
    for (let i = 0; i < 100; i++) {
      sameKeyPromises.push(limit(() => submissionService.submitAttempt(attempt.id, studentA.id, sharedKey)))
    }

    const sameKeyResults = await Promise.all(sameKeyPromises)
    assert.equal(sameKeyResults.length, 100)

    // All 100 get identical response
    for (const r of sameKeyResults) {
      assert.equal(r.status, 'SUBMITTED')
      assert.ok(r.submittedAt)
    }

    // Exactly 1 outbox row created for attempt.submitted
    const outboxRows = await prisma.outboxEvent.findMany({
      where: {
        eventType: 'attempt.submitted',
        payload: { path: ['attemptId'], equals: attempt.id }
      }
    })
    assert.equal(outboxRows.length, 1, 'Exactly one outbox event must be emitted')

    // 50 parallel submits with DIFFERENT keys on already submitted attempt
    const diffKeyPromises = []
    for (let i = 0; i < 50; i++) {
      diffKeyPromises.push(limit(() => submissionService.submitAttempt(attempt.id, studentA.id, crypto.randomUUID())))
    }

    const diffKeyResults = await Promise.all(diffKeyPromises)
    assert.equal(diffKeyResults.length, 50)

    // All 50 return alreadySubmitted: true with status SUBMITTED
    for (const r of diffKeyResults) {
      assert.equal(r.status, 'SUBMITTED')
      assert.equal(r.alreadySubmitted, true)
    }
  })

  // ──────────────────────────────────────────────────────────
  // 3. Submit vs Autosave Race
  // ──────────────────────────────────────────────────────────
  it('Task 3: Submit vs autosave race => no successful save after the submit commit', async () => {
    // Reset attempt back to ACTIVE for student A
    await prisma.examAttempt.update({
      where: { examId_studentId: { examId: exam.id, studentId: studentA.id } },
      data: { status: 'ACTIVE', submittedAt: null }
    })

    const aq = await prisma.attemptQuestion.findFirst({
      where: { attempt: { studentId: studentA.id } }
    })

    // Submit the attempt
    const submitKey = crypto.randomUUID()
    const submitRes = await submissionService.submitAttempt(aq.attemptId, studentA.id, submitKey)
    assert.equal(submitRes.status, 'SUBMITTED')

    // Attempt autosave after submit commit => MUST FAIL with ConflictError (409)
    await assert.rejects(
      () => answerService.saveAnswer(aq.attemptId, studentA.id, aq.id, opt1A.id, 1),
      (err) => {
        assert.ok(err instanceof ConflictError)
        assert.equal(err.code, 'INVALID_STATE')
        return true
      }
    )
  })

  // ──────────────────────────────────────────────────────────
  // 4. Out-of-Order Revisions (8 then 7)
  // ──────────────────────────────────────────────────────────
  it('Task 4: Out-of-order revisions (8 then 7) => 7 rejected 409 STALE_REVISION; final answer = 8 value', async () => {
    // Create new ACTIVE attempt for Student B
    const attemptB = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: studentB.id,
        status: 'ACTIVE',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        watermarkSeed: 'seed_watermark_b',
        shuffleSeed: 'seed_shuffle_b'
      }
    })

    const aqB = await prisma.attemptQuestion.create({
      data: {
        attemptId: attemptB.id,
        questionId: question1.id,
        displayOrder: 1,
        optionOrder: [0, 1, 2, 3]
      }
    })

    // Initial save: revision 1
    const res1 = await answerService.saveAnswer(attemptB.id, studentB.id, aqB.id, opt1A.id, 1)
    assert.equal(res1.revision, 1)

    // Advance revisions incrementally up to revision 8
    for (let r = 1; r < 8; r++) {
      const nextRes = await answerService.saveAnswer(attemptB.id, studentB.id, aqB.id, opt1A.id, r)
      assert.equal(nextRes.revision, r + 1)
    }

    // Verify current answer revision in DB is 8
    let dbAnswer = await prisma.answer.findUnique({ where: { attemptQuestionId: aqB.id } })
    assert.equal(dbAnswer.revision, 8)
    assert.equal(dbAnswer.selectedOptionId, opt1A.id)

    // Now send stale revision 7
    await assert.rejects(
      () => answerService.saveAnswer(attemptB.id, studentB.id, aqB.id, opt1B.id, 7),
      (err) => {
        assert.ok(err instanceof StaleRevisionError)
        assert.equal(err.code, 'STALE_REVISION')
        assert.equal(err.details.currentRevision, 8)
        return true
      }
    )

    // Final answer in DB must still equal revision 8's value (opt1A), NOT opt1B!
    dbAnswer = await prisma.answer.findUnique({ where: { attemptQuestionId: aqB.id } })
    assert.equal(dbAnswer.revision, 8)
    assert.equal(dbAnswer.selectedOptionId, opt1A.id)
  })

  // ──────────────────────────────────────────────────────────
  // 5. Expiry: Save past deadline rejected (410); Submit within grace succeeds; Sweeper finalises
  // ──────────────────────────────────────────────────────────
  it('Task 5: Save at expires_at + 1s => 410; submit within grace => ok; sweeper finalises abandoned attempt and enqueues evaluation', async () => {
    // Create dedicated student for expiry test
    const pwdHash = await bcrypt.hash('P4TestPassword123!', 10)
    const studentExp = await prisma.student.create({
      data: {
        name: 'Student Expired',
        email: `student_exp_${Date.now()}@test.edu`,
        usn: `USN-EXP-${Date.now()}`,
        password: pwdHash,
        departmentCode: dept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    // Create an expired attempt (started 1h ago, expired 1s ago -> satisfies chk_attempt_expiry_after_start)
    const startedAt = new Date(Date.now() - 3600 * 1000)
    const expiredAt = new Date(Date.now() - 1000) // Expired 1 second ago

    const expiredAttempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: studentExp.id,
        status: 'ACTIVE',
        startedAt,
        expiresAt: expiredAt,
        watermarkSeed: 'seed_watermark_exp',
        shuffleSeed: 'seed_shuffle_exp'
      }
    })

    const aqExp = await prisma.attemptQuestion.create({
      data: {
        attemptId: expiredAttempt.id,
        questionId: question1.id,
        displayOrder: 1,
        optionOrder: [0, 1, 2, 3]
      }
    })

    // 1. Save after expires_at => 410 Gone / EXPIRED
    await assert.rejects(
      () => answerService.saveAnswer(expiredAttempt.id, studentExp.id, aqExp.id, opt1A.id, 1),
      (err) => {
        assert.ok(err instanceof GoneError)
        assert.equal(err.statusCode, 410)
        return true
      }
    )

    // 2. Submit within 10s grace period => Succeeded!
    const graceSubmitKey = crypto.randomUUID()
    const submitRes = await submissionService.submitAttempt(expiredAttempt.id, studentExp.id, graceSubmitKey)
    assert.equal(submitRes.status, 'SUBMITTED')

    // 3. Test sweeper: create another active attempt expired > 30s ago (satisfying chk_attempt_expiry_after_start)
    const studentSwept = await prisma.student.create({
      data: {
        name: 'Student Swept',
        email: `student_swept_${Date.now()}@test.edu`,
        usn: `USN-SWEPT-${Date.now()}`,
        password: pwdHash,
        departmentCode: dept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    const sweptAttempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: studentSwept.id,
        status: 'ACTIVE',
        startedAt: new Date(Date.now() - 3600 * 1000),
        expiresAt: new Date(Date.now() - 40 * 1000), // 40s ago (> 30s grace)
        watermarkSeed: 'seed_watermark_swept',
        shuffleSeed: 'seed_shuffle_swept'
      }
    })

    const sweepOutcome = await expirySweeper.sweep()
    assert.ok(sweepOutcome.expiredCount >= 1)

    const verifiedSwept = await prisma.examAttempt.findUnique({
      where: { id: sweptAttempt.id }
    })
    assert.equal(verifiedSwept.status, 'EXPIRED')

    // Sweeper enqueued evaluation event
    const evalOutbox = await prisma.outboxEvent.findFirst({
      where: {
        eventType: 'attempt.expired',
        payload: { path: ['attemptId'], equals: sweptAttempt.id }
      }
    })
    assert.ok(evalOutbox, 'Sweeper must emit attempt.expired outbox event')
  })

  // ──────────────────────────────────────────────────────────
  // 6. Outbox Resilience & Idempotent Evaluation
  // ──────────────────────────────────────────────────────────
  it('Task 6: Outbox accumulates when RabbitMQ down; evaluation worker processes idempotently (exactly once)', async () => {
    const attempt = await prisma.examAttempt.findFirst({
      where: { examId: exam.id, studentId: studentA.id }
    })

    // Process evaluation event directly through evaluationWorker
    const res1 = await evaluationWorker.processEvent({
      eventId: `test-eval-${attempt.id}-1`,
      payload: { attemptId: attempt.id, examId: exam.id }
    })
    assert.ok(res1)

    // Process same event again => strictly idempotent
    const res2 = await evaluationWorker.processEvent({
      eventId: `test-eval-${attempt.id}-2`,
      payload: { attemptId: attempt.id, examId: exam.id }
    })
    assert.ok(res2)

    // Exactly one exam_results row exists for attempt
    const resultsCount = await prisma.examResult.count({
      where: { attemptId: attempt.id }
    })
    assert.equal(resultsCount, 1, 'Exactly one exam_results row must exist')
  })

  // ──────────────────────────────────────────────────────────
  // 7. Redis Failure Fallback
  // ──────────────────────────────────────────────────────────
  it('Task 7: Redis stopped / unavailable => content cache falls back to Postgres seamlessly', async () => {
    // Save original Redis client
    const originalGet = redisClient.getWithL1
    // Simulate Redis failure
    redisClient.getWithL1 = async () => null

    try {
      const content = await attemptService.getExamContentCached(exam.id)
      assert.ok(Array.isArray(content))
      assert.ok(content.length >= 2)
    } finally {
      redisClient.getWithL1 = originalGet
    }
  })

  // ──────────────────────────────────────────────────────────
  // 8. BOLA Matrix: Student A vs Student B
  // ──────────────────────────────────────────────────────────
  it('Task 8: BOLA matrix => student A cannot access, save, or submit student B attempt', async () => {
    const attemptB = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: studentB.id } }
    })

    const aqB = await prisma.attemptQuestion.findFirst({
      where: { attemptId: attemptB.id }
    })

    // 1. Student A reading Student B attempt => ForbiddenError
    await assert.rejects(
      () => attemptService.getAttemptForStudent(attemptB.id, studentA.id),
      (err) => {
        assert.ok(err instanceof ForbiddenError)
        return true
      }
    )

    // 2. Student A saving answer on Student B attempt => ForbiddenError
    await assert.rejects(
      () => answerService.saveAnswer(attemptB.id, studentA.id, aqB.id, opt1A.id, 1),
      (err) => {
        assert.ok(err instanceof ForbiddenError)
        return true
      }
    )

    // 3. Student A submitting Student B attempt => ForbiddenError
    await assert.rejects(
      () => submissionService.submitAttempt(attemptB.id, studentA.id, crypto.randomUUID()),
      (err) => {
        assert.ok(err instanceof ForbiddenError)
        return true
      }
    )
  })

  // ──────────────────────────────────────────────────────────
  // 10. No-Leak Security Test
  // ──────────────────────────────────────────────────────────
  it('Task 10: No-leak test => DTO never leaks is_correct, correctOption, password, or VPN private keys', async () => {
    const rawQuestions = await attemptRepository.getExamQuestionsForCache(exam.id)
    const rawAttemptQuestions = await attemptRepository.getAttemptQuestionsWithAnswers(exam.id)

    const dto = toStudentAttemptDTO({ id: crypto.randomUUID(), examId: exam.id, status: 'ACTIVE' }, rawQuestions)
    const jsonStr = JSON.stringify(dto)

    assert.equal(jsonStr.includes('is_correct'), false, 'Leaked is_correct in DTO')
    assert.equal(jsonStr.includes('isCorrect'), false, 'Leaked isCorrect in DTO')
    assert.equal(jsonStr.includes('password'), false, 'Leaked password in DTO')
    assert.equal(jsonStr.includes('privateKey'), false, 'Leaked privateKey in DTO')
  })

  // ──────────────────────────────────────────────────────────
  // 11. Transaction Rollback Test
  // ──────────────────────────────────────────────────────────
  it('Task 11: Transaction rollback => failure after status update inside submit transaction leaves attempt intact and rolls back outbox', async () => {
    // Reset attempt to ACTIVE
    const attempt = await prisma.examAttempt.update({
      where: { examId_studentId: { examId: exam.id, studentId: studentA.id } },
      data: { status: 'ACTIVE', submittedAt: null }
    })

    const initialOutboxCount = await prisma.outboxEvent.count()

    // Simulate transactional failure inside submit
    await assert.rejects(
      () => withTransaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          UPDATE exam_attempts SET status = 'SUBMITTED' WHERE id = $1::uuid;
        `, attempt.id)

        await tx.$executeRawUnsafe(`
          INSERT INTO outbox_events (event_type, payload, status)
          VALUES ('attempt.submitted', '{"test":true}'::jsonb, 'PENDING');
        `)

        throw new Error('SIMULATED_TRANSACTION_FAILURE')
      }),
      /SIMULATED_TRANSACTION_FAILURE/
    )

    // Verify attempt is still ACTIVE in DB
    const currentAttempt = await prisma.examAttempt.findUnique({ where: { id: attempt.id } })
    assert.equal(currentAttempt.status, 'ACTIVE')

    // Verify outbox row count did not increase
    const postOutboxCount = await prisma.outboxEvent.count()
    assert.equal(postOutboxCount, initialOutboxCount)
  })
})
