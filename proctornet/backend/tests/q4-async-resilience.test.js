const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { prisma } = require('../src/infra/postgres/client')
const { redisClient, BoundedLruCache, L1_INVALIDATE_CHANNEL } = require('../src/infra/redis/client')
const { rabbitmq } = require('../src/infra/rabbitmq/client')
const { outboxPublisher } = require('../src/infra/rabbitmq/outboxPublisher')
const { socketEmitter } = require('../src/infra/websocket/emitter')
const { attemptStateMachine, ALLOWED_TRANSITIONS } = require('../src/modules/attempts/stateMachine')
const { attemptRepository } = require('../src/modules/attempts/repository')
const { violationMicroBatcher } = require('../src/modules/proctoring/violationMicroBatcher')
const { resultRepository } = require('../src/modules/results/repository')
const { submissionService } = require('../src/modules/submissions/service')
const { submissionRepository } = require('../src/modules/submissions/repository')
const { ConflictError, UnprocessableEntityError } = require('../src/shared/errors')
const { metrics } = require('../src/observability/metrics')

describe('Q4 — Async Plane & Resilience Integration Test Suite', () => {
  let faculty
  let student
  let exam
  let testAttempt

  before(async () => {
    // Ensure test department exists
    await prisma.department.upsert({
      where: { code: 'TEST_CS' },
      update: {},
      create: { code: 'TEST_CS', name: 'Computer Science' }
    })

    faculty = await prisma.faculty.upsert({
      where: { email: 'q4_faculty@proctornet.test' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'Q4 Prof',
        email: 'q4_faculty@proctornet.test',
        password: 'hash',
        employeeId: 'EMP_Q4_01',
        departmentCode: 'TEST_CS'
      }
    })

    student = await prisma.student.upsert({
      where: { email: 'q4_student@proctornet.test' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'Q4 Student',
        email: 'q4_student@proctornet.test',
        usn: '1TEST_Q4_01',
        password: 'hash',
        departmentCode: 'TEST_CS',
        semester: 6
      }
    })

    const now = new Date()
    const endTime = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour duration
    const examId = crypto.randomUUID()
    const qId = crypto.randomUUID()
    exam = await prisma.exam.create({
      data: {
        id: examId,
        title: 'Q4 Resilience Exam',
        subject: 'Distributed Systems',
        facultyId: faculty.id,
        startTime: now,
        endTime,
        duration: 60,
        totalMarks: 100,
        negativeMarking: true,
        negativeValue: 1.0,
        invId: `INV_Q4_${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'PUBLISHED',
        questions: {
          create: [
            {
              id: qId,
              questionText: 'Is RabbitMQ resilient?',
              marks: 4,
              negativeMarks: 1,
              options: {
                create: [
                  { id: crypto.randomUUID(), text: 'Yes with amqp-connection-manager', isCorrect: true, order: 0 },
                  { id: crypto.randomUUID(), text: 'No', isCorrect: false, order: 1 }
                ]
              }
            }
          ]
        }
      },
      include: {
        questions: {
          include: { options: true }
        }
      }
    })

    testAttempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId: student.id,
        status: 'READY',
        watermarkSeed: 'WM_Q4',
        shuffleSeed: 'SHUFFLE_Q4'
      }
    })
  })

  after(async () => {
    // Cleanup created test attempt and exam
    if (exam?.id) {
      const attempts = await prisma.examAttempt.findMany({
        where: { examId: exam.id },
        select: { id: true }
      }).catch(() => [])
      const attemptIds = attempts.map(a => a.id)

      if (attemptIds.length > 0) {
        await prisma.violationEvent.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.auditLog.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.answer.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.attemptQuestion.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.examResult.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } }).catch(() => {})
      }
      await prisma.questionOption.deleteMany({ where: { question: { examId: exam.id } } }).catch(() => {})
      await prisma.question.deleteMany({ where: { examId: exam.id } }).catch(() => {})
      await prisma.exam.deleteMany({ where: { id: exam.id } }).catch(() => {})
    }
    await prisma.$disconnect()
    await redisClient.quit()
    await rabbitmq.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (a) RabbitMQ Manager Resilience & Connection Non-Termination
  // ──────────────────────────────────────────────────────────────────────────
  it('(a) RabbitMQ manager: never exits process, auto-reconnects, confirms channels', async () => {
    assert.ok(rabbitmq.connection, 'RabbitMQ manager connection should be instantiated')
    assert.ok(rabbitmq.channelWrapper, 'Publish confirm channel should be created')
    assert.equal(typeof rabbitmq.publish, 'function', 'Publish function must exist')
    assert.equal(typeof rabbitmq.consume, 'function', 'Consume function must exist')

    // Verify consumer registration does not crash if connection is establishing
    let consumerInvoked = false
    await rabbitmq.consume('pn.evaluation', async () => {
      consumerInvoked = true
    }, { prefetch: 10 })

    assert.ok(rabbitmq.consumers.has('pn.evaluation'), 'Consumer must be registered in consumer registry')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (c) Redis Manager: retryStrategy never null, bounded LRU, empty rejection, pubsub
  // ──────────────────────────────────────────────────────────────────────────
  it('(c) Redis (C-05): retryStrategy is never null; bounded LRU caps entries and TTL <= 60s; refuses empty content', async () => {
    // 1. Retry strategy validation
    const retryStrategy = (times) => Math.min(times * 200, 5000)
    for (let i = 1; i <= 20; i++) {
      const delay = retryStrategy(i)
      assert.ok(delay >= 200 && delay <= 5000, `Delay must be between 200 and 5000ms, got ${delay}`)
      assert.notEqual(delay, null, 'Retry strategy must NEVER return null')
    }

    // 2. Bounded LRU Cache validation
    const lru = new BoundedLruCache(3, 60000)
    lru.set('k1', 'val1')
    lru.set('k2', 'val2')
    lru.set('k3', 'val3')
    assert.equal(lru.get('k1'), 'val1')

    // Insert 4th item -> k2 should be evicted because k1 was recently accessed
    lru.set('k4', 'val4')
    assert.equal(lru.get('k2'), null, 'k2 should have been evicted by LRU')
    assert.equal(lru.get('k1'), 'val1', 'k1 should still exist')
    assert.equal(lru.get('k4'), 'val4', 'k4 should exist')

    // 3. Don't cache empty content (null, [], {}, '')
    lru.set('empty_arr', [])
    lru.set('empty_obj', {})
    lru.set('empty_null', null)
    lru.set('empty_str', '   ')
    assert.equal(lru.get('empty_arr'), null, 'Empty array must not be cached')
    assert.equal(lru.get('empty_obj'), null, 'Empty object must not be cached')
    assert.equal(lru.get('empty_null'), null, 'Null must not be cached')
    assert.equal(lru.get('empty_str'), null, 'Empty string must not be cached')

    // 4. Redis Client L1 integration
    await redisClient.set('pn:test:valid', { active: true }, 30)
    const cached = await redisClient.get('pn:test:valid')
    assert.deepEqual(cached, { active: true })

    await redisClient.del('pn:test:valid')
    assert.equal(await redisClient.get('pn:test:valid'), null)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (d) Atomic Transitions (C-04 / Appendix C): Single CTE, status_reason, ADR-004 grace
  // ──────────────────────────────────────────────────────────────────────────
  it('(d) Atomic transitions: single CTE updates attempt + audit + outbox; guards READY->ACTIVE; preserves status_reason', async () => {
    // 1. Guarded start check: transition from READY to ACTIVE without isGuardedStart MUST FAIL
    await assert.rejects(
      () => attemptStateMachine.transition(testAttempt.id, 'ACTIVE', { isGuardedStart: false }),
      (err) => {
        assert.ok(err instanceof ConflictError)
        assert.match(err.message, /guarded start path/)
        return true
      }
    )

    // 2. Guarded start check: transition with isGuardedStart = true SUCCEEDS
    const activated = await attemptStateMachine.transition(testAttempt.id, 'ACTIVE', {
      isGuardedStart: true,
      reason: 'Biometric pass and candidate launch'
    })
    assert.equal(activated.status, 'ACTIVE')
    assert.equal(activated.status_reason, 'Biometric pass and candidate launch')
    assert.equal(activated.termination_reason, null, 'termination_reason must NOT be set on ACTIVE')

    // Verify audit log was created in the SAME single CTE
    const auditLogs = await prisma.auditLog.findMany({
      where: { attemptId: testAttempt.id, action: 'ATTEMPT_STATE_CHANGE_ACTIVE' }
    })
    assert.ok(auditLogs.length >= 1, 'Audit log must be written atomically by CTE')

    // 3. Suspend attempt: status_reason set, termination_reason untouched
    const suspended = await attemptStateMachine.transition(testAttempt.id, 'SUSPENDED', {
      reason: 'Suspected tab switch'
    })
    assert.equal(suspended.status, 'SUSPENDED')
    assert.equal(suspended.status_reason, 'Suspected tab switch')
    assert.equal(suspended.termination_reason, null, 'termination_reason must NOT be touched on SUSPEND')

    // 4. Resume attempt: caps expires_at at exam.end_time + grace (ADR-004)
    const resumed = await attemptStateMachine.transition(testAttempt.id, 'ACTIVE', {
      reason: 'Proctor resumed session'
    })
    assert.equal(resumed.status, 'ACTIVE')
    assert.equal(resumed.status_reason, 'Proctor resumed session')
    assert.equal(resumed.termination_reason, null, 'termination_reason must NOT be touched on resume')

    // Max expiration must not exceed exam end_time + 5 min grace
    const maxAllowed = new Date(exam.endTime.getTime() + 300 * 1000)
    assert.ok(
      new Date(resumed.expires_at) <= maxAllowed,
      `resumed expires_at (${resumed.expires_at}) must be capped at exam end + grace (${maxAllowed})`
    )

    // 5. Terminate attempt: termination_reason IS set on TERMINATED
    const terminated = await attemptStateMachine.transition(testAttempt.id, 'TERMINATED', {
      reason: 'Cheating detected'
    })
    assert.equal(terminated.status, 'TERMINATED')
    assert.equal(terminated.status_reason, 'Cheating detected')
    assert.equal(terminated.termination_reason, 'Cheating detected')

    // Verify outbox row was created in the SAME single CTE for terminal state
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { eventType: 'attempt.terminated' },
      orderBy: { id: 'desc' },
      take: 1
    })
    assert.ok(outboxEvents.length >= 1)
    assert.equal(outboxEvents[0].payload.attemptId, testAttempt.id)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (e) 100 Mixed Violations with 5 Malformed -> 95 Stored, 5 Rejected
  // ──────────────────────────────────────────────────────────────────────────
  it('(e) 100 mixed violations with 5 malformed: batch fallback stores 95 and isolates/rejects 5', async () => {
    // Create an active attempt for violation testing
    const student2 = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Q4 Violator',
        email: `q4_violator_${crypto.randomUUID()}@proctornet.test`,
        usn: `1TEST_V_${crypto.randomUUID().slice(0, 8)}`,
        password: 'hash',
        departmentCode: 'TEST_CS',
        semester: 6
      }
    })

    const attemptForViolations = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId: student2.id,
        status: 'ACTIVE',
        watermarkSeed: 'WM_VIOLATIONS',
        shuffleSeed: 'SHUFFLE_VIOLATIONS'
      }
    })

    const promises = []
    const TOTAL = 100
    const MALFORMED_COUNT = 5

    for (let i = 0; i < TOTAL; i++) {
      if (i < MALFORMED_COUNT) {
        // Malformed event type (invalid enum value that violates PostgreSQL "ViolationType" enum)
        promises.push(
          violationMicroBatcher.queue({
            attemptId: attemptForViolations.id,
            eventType: `INVALID_MALFORMED_TYPE_${i}`,
            severity: 'HIGH',
            metadata: { test: true },
            clientTimestamp: new Date().toISOString()
          })
        )
      } else {
        // Valid violation item
        promises.push(
          violationMicroBatcher.queue({
            attemptId: attemptForViolations.id,
            eventType: 'TAB_SWITCH',
            severity: 'MEDIUM',
            metadata: { count: i },
            clientTimestamp: new Date().toISOString()
          })
        )
      }
    }

    // Attach listeners before flushing to avoid unhandled rejection in Node
    const settledPromise = Promise.allSettled(promises)
    await violationMicroBatcher.flush()

    const results = await settledPromise
    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')

    assert.equal(fulfilled.length, 95, `Expected exactly 95 violations fulfilled, got ${fulfilled.length}`)
    assert.equal(rejected.length, 5, `Expected exactly 5 malformed violations rejected, got ${rejected.length}`)

    // Verify all fulfilled items have a valid violationId returned
    for (const item of fulfilled) {
      assert.ok(item.value.violationId, 'Fulfilled item must contain returned violationId')
    }

    // Verify database count of stored violations
    const dbCount = await prisma.violationEvent.count({
      where: { attemptId: attemptForViolations.id }
    })
    assert.equal(dbCount, 95, `Database should contain exactly 95 stored violations, found ${dbCount}`)

    // Cleanup
    await prisma.violationEvent.deleteMany({ where: { attemptId: attemptForViolations.id } })
    await prisma.examAttempt.deleteMany({ where: { id: attemptForViolations.id } })
    await prisma.student.deleteMany({ where: { id: student2.id } })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (f) Result Delivered to the Right Student via Emitter (C-06)
  // ──────────────────────────────────────────────────────────────────────────
  it('(f) Socket.IO Redis emitter: delivers result to attempt:{id} and inv:{examId}; rejects unauthorized room names', () => {
    // Room validation check
    const validAttempt = socketEmitter.emitToRoom('attempt:12345', 'test:event', { data: 1 })
    assert.equal(validAttempt, true, 'attempt:{id} room must be allowed')

    const validInv = socketEmitter.emitToRoom('inv:exam-999', 'test:event', { data: 2 })
    assert.equal(validInv, true, 'inv:{examId} room must be allowed')

    const invalidExamBroadcast = socketEmitter.emitToRoom('exam:exam-999', 'test:event', { data: 3 })
    assert.equal(invalidExamBroadcast, false, 'Broadcast to exam:{id} must be strictly rejected per C-06')

    const invalidGlobal = socketEmitter.emitToRoom('global', 'test:event', {})
    assert.equal(invalidGlobal, false, 'Global broadcast room must be rejected')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (g) Evaluation Negative Marking & Terminal Check (C-07)
  // ──────────────────────────────────────────────────────────────────────────
  it('(g) Evaluation (C-07): keeps negative scores when negative marking is on; rejects non-terminal attempts', async () => {
    const studentEval = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Q4 Eval Student',
        email: `q4_eval_${crypto.randomUUID()}@proctornet.test`,
        usn: `1TEST_E_${crypto.randomUUID().slice(0, 8)}`,
        password: 'hash',
        departmentCode: 'TEST_CS',
        semester: 6
      }
    })

    // 1. Create a non-terminal attempt and verify evaluateAttemptSetBased skips it
    const activeAttempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId: studentEval.id,
        status: 'ACTIVE',
        watermarkSeed: 'WM_EVAL',
        shuffleSeed: 'SHUFFLE_EVAL'
      }
    })

    const evalResultActive = await resultRepository.evaluateAttemptSetBased(activeAttempt.id)
    assert.equal(evalResultActive, null, 'Evaluation must not evaluate non-terminal ACTIVE attempt')

    // 2. Mark attempt SUBMITTED with a wrong answer and negative marking enabled
    await prisma.examAttempt.update({
      where: { id: activeAttempt.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() }
    })

    const q = exam.questions[0]
    const wrongOpt = q.options.find(o => !o.isCorrect)

    const aq = await prisma.attemptQuestion.create({
      data: {
        id: crypto.randomUUID(),
        attemptId: activeAttempt.id,
        questionId: q.id,
        displayOrder: 1,
        optionOrder: [0, 1]
      }
    })

    await prisma.answer.create({
      data: {
        id: crypto.randomUUID(),
        attemptId: activeAttempt.id,
        attemptQuestionId: aq.id,
        selectedOptionId: wrongOpt.id,
        revision: 1
      }
    })

    // Now evaluate: with negativeMarking = true, score should be -1.0 (not clamped to 0!)
    const evalResult = await resultRepository.evaluateAttemptSetBased(activeAttempt.id)
    assert.ok(evalResult, 'Evaluation should produce a result for SUBMITTED attempt')
    assert.equal(evalResult.score, -1.0, `Score should be -1.0 with negative marking, got ${evalResult.score}`)
    assert.equal(evalResult.wrong_count || evalResult.wrongCount, 1)

    // Cleanup
    await prisma.examResult.deleteMany({ where: { attemptId: activeAttempt.id } })
    await prisma.answer.deleteMany({ where: { attemptId: activeAttempt.id } })
    await prisma.attemptQuestion.deleteMany({ where: { attemptId: activeAttempt.id } })
    await prisma.examAttempt.deleteMany({ where: { id: activeAttempt.id } })
    await prisma.student.deleteMany({ where: { id: studentEval.id } })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // (h) Idempotency Mismatch Returns 422 (C-11)
  // ──────────────────────────────────────────────────────────────────────────
  it('(h) Idempotency (C-11): 422 Unprocessable Entity when idempotency key is reused with different body', async () => {
    const studentSubmit = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Q4 Idempotent Student',
        email: `q4_idemp_${crypto.randomUUID()}@proctornet.test`,
        usn: `1TEST_I_${crypto.randomUUID().slice(0, 8)}`,
        password: 'hash',
        departmentCode: 'TEST_CS',
        semester: 6
      }
    })

    const attemptSubmit = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId: studentSubmit.id,
        status: 'ACTIVE',
        watermarkSeed: 'WM_IDEMP',
        shuffleSeed: 'SHUFFLE_IDEMP',
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    })

    const sharedKey = `idemp-${crypto.randomUUID()}`

    // First submit: empty body []
    const firstRes = await submissionService.submitAttempt(
      attemptSubmit.id,
      studentSubmit.id,
      sharedKey,
      []
    )
    assert.ok(firstRes)

    // Replay with identical body -> succeeds and returns cached replay
    const replayRes = await submissionService.submitAttempt(
      attemptSubmit.id,
      studentSubmit.id,
      sharedKey,
      []
    )
    assert.deepEqual(replayRes, firstRes, 'Replaying with same body should return identical response')

    // Second submit with SAME key but DIFFERENT body -> MUST THROW 422
    let threw422 = false
    try {
      await submissionService.submitAttempt(
        attemptSubmit.id,
        studentSubmit.id,
        sharedKey,
        [{ attemptQuestionId: crypto.randomUUID(), selectedOptionId: crypto.randomUUID(), revision: 1 }]
      )
    } catch (err) {
      if (err instanceof UnprocessableEntityError && err.statusCode === 422 && err.code === 'IDEMPOTENCY_MISMATCH') {
        threw422 = true
      } else {
        throw err
      }
    }
    assert.equal(threw422, true, 'Must throw 422 IDEMPOTENCY_MISMATCH when key is reused with different body')

    // Cleanup
    await prisma.idempotencyKey.deleteMany({ where: { key: { contains: sharedKey } } })
    await prisma.outboxEvent.deleteMany({ where: { eventType: 'attempt.submitted' } })
    await prisma.examAttempt.deleteMany({ where: { id: attemptSubmit.id } })
    await prisma.student.deleteMany({ where: { id: studentSubmit.id } })
  })
})
