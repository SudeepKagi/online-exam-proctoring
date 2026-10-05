const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { prisma } = require('../src/infra/postgres/client')
const { examScheduler } = require('../src/modules/exams/examScheduler')
const { examService } = require('../src/modules/exams/service')
const facultyService = require('../src/modules/faculty/service')

test.describe('Q1.4 Exam Lifecycle Scheduler & Guarded State Transitions (A-07)', () => {
  let facultyId
  let studentId
  let examId
  const deptCode = `DEPT-LC-${Date.now().toString().slice(-6)}`

  test.before(async () => {
    // 1. Create department
    await prisma.department.create({
      data: { code: deptCode, name: `Lifecycle Dept ${deptCode}` }
    })

    // 2. Create faculty
    const faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Lifecycle Faculty',
        email: `lifecycle-fac-${Date.now()}@test.edu`,
        password: 'hashed_password',
        departmentCode: deptCode,
        employeeId: `EMP-LC-${Date.now()}`
      }
    })
    facultyId = faculty.id

    // 3. Create student
    const student = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Lifecycle Student',
        usn: `USN-LC-${Date.now()}`,
        email: `student-lc-${Date.now()}@test.edu`,
        password: 'hashed_password',
        departmentCode: deptCode,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })
    studentId = student.id
  })

  test.after(async () => {
    const { redisClient } = require('../src/infra/redis/client')
    await redisClient.quit().catch(() => {})
    await prisma.$disconnect().catch(() => {})
  })

  test('Exam status is client-immutable via update endpoints (A-07 / B-02)', async () => {
    const now = new Date()
    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'Immutability Guard Exam',
        subject: 'Security',
        facultyId,
        startTime: new Date(now.getTime() + 3600000),
        endTime: new Date(now.getTime() + 7200000),
        duration: 60,
        totalMarks: 50,
        invId: `INV-LC-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'DRAFT'
      }
    })

    // 1. Attempt to set status via v1 updateExam
    await examService.updateExam(exam.id, { title: 'Updated Title', status: 'LIVE' }, facultyId, 'FACULTY')
    const check1 = await prisma.exam.findUnique({ where: { id: exam.id } })
    assert.equal(check1.title, 'Updated Title')
    assert.equal(check1.status, 'DRAFT', 'v1 updateExam must not allow client to change status to LIVE')

    // 2. Attempt to set status via faculty module updateExam
    await facultyService.updateExam(exam.id, { status: 'ENDED' }, facultyId).catch(() => {})
    const check2 = await prisma.exam.findUnique({ where: { id: exam.id } })
    assert.equal(check2.status, 'DRAFT', 'facultyService.updateExam must not allow client to change status to ENDED')
  })

  test('Scheduler transitions PUBLISHED -> LIVE when start_time <= now() < end_time', async () => {
    const pastStart = new Date(Date.now() - 60000) // 1m in past
    const futureEnd = new Date(Date.now() + 3600000) // 1h in future

    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'Start Time Transition Exam',
        subject: 'Operating Systems',
        facultyId,
        startTime: pastStart,
        endTime: futureEnd,
        duration: 60,
        totalMarks: 50,
        invId: `INV-LIVE-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'PUBLISHED'
      }
    })

    // Run scheduler tick with force=true (bypass lock for test)
    const result = await examScheduler.tick(true)
    assert.ok(result.liveCount >= 1, 'Scheduler should transition at least 1 exam to LIVE')

    const updated = await prisma.exam.findUnique({ where: { id: exam.id } })
    assert.equal(updated.status, 'LIVE', 'Exam should be in LIVE status after start_time arrives')
  })

  test('Scheduler transitions LIVE -> ENDED when end_time <= now()', async () => {
    const pastStart = new Date(Date.now() - 7200000) // 2h ago
    const pastEnd = new Date(Date.now() - 60000)     // 1m ago

    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'End Time Transition Exam',
        subject: 'Networking',
        facultyId,
        startTime: pastStart,
        endTime: pastEnd,
        duration: 60,
        totalMarks: 50,
        invId: `INV-END-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'LIVE'
      }
    })

    // Active attempt keeps the exam in ENDED rather than EVALUATED
    await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId,
        status: 'ACTIVE',
        watermarkSeed: 'seed_live_test',
        startedAt: pastStart
      }
    })

    const result = await examScheduler.tick(true)
    assert.ok(result.endedCount >= 1, 'Scheduler should transition at least 1 exam to ENDED')

    const updated = await prisma.exam.findUnique({ where: { id: exam.id } })
    assert.equal(updated.status, 'ENDED', 'Exam should be in ENDED status after end_time passes')
  })

  test('Scheduler transitions ENDED -> EVALUATED only when all attempts have results', async () => {
    const pastStart = new Date(Date.now() - 7200000)
    const pastEnd = new Date(Date.now() - 1000)

    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'Evaluation Guard Exam',
        subject: 'Algorithms',
        facultyId,
        startTime: pastStart,
        endTime: pastEnd,
        duration: 60,
        totalMarks: 50,
        invId: `INV-EVAL-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'ENDED'
      }
    })

    // Create a SUBMITTED attempt without result yet
    const attempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId,
        status: 'SUBMITTED',
        watermarkSeed: 'seed_eval_test',
        startedAt: pastStart,
        submittedAt: pastEnd
      }
    })

    // 1. Tick should NOT transition exam to EVALUATED because attempt has no result row
    await examScheduler.tick(true)
    let check = await prisma.exam.findUnique({ where: { id: exam.id } })
    assert.equal(check.status, 'ENDED', 'Exam must stay in ENDED status while attempts await grading')

    // 2. Grade the attempt (insert examResult)
    await prisma.examResult.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        attemptId: attempt.id,
        score: 45,
        totalMarks: 50,
        percentage: 90,
        status: 'CLEAN'
      }
    })

    // 3. Tick should now transition exam to EVALUATED
    const evalResult = await examScheduler.tick(true)
    assert.ok(evalResult.evaluatedCount >= 1, 'Scheduler should transition exam to EVALUATED')

    check = await prisma.exam.findUnique({ where: { id: exam.id } })
    assert.equal(check.status, 'EVALUATED', 'Exam must transition to EVALUATED when all attempts have results')
  })
})
