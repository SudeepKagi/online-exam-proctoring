const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { prisma } = require('../src/infra/postgres/client')
const { attemptPrewarmJob } = require('../src/modules/attempts/prewarmJob')

test.describe('Q1.5 Pre-warming Scalability & Idempotency Gate (500 READY Attempts)', () => {
  let examId
  let facultyId
  const BATCH_STUDENTS_COUNT = 500
  const uniqueDept = `D${Math.floor(Math.random() * 90000 + 10000)}`

  test.before(async () => {
    // 1. Create a dedicated test department
    await prisma.department.create({
      data: { code: uniqueDept, name: `Prewarm Dept ${uniqueDept}` }
    })

    // 2. Create faculty
    const faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Prewarm Faculty',
        email: `prewarm-fac-${Date.now()}@test.edu`,
        password: 'hashed_password',
        departmentCode: uniqueDept,
        employeeId: `EMP-PRE-${Date.now()}`
      }
    })
    facultyId = faculty.id

    // 3. Create exam with questions
    const now = new Date()
    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: '500 Candidate Scalability Exam',
        subject: 'Distributed Systems',
        facultyId,
        startTime: new Date(now.getTime() + 1800000), // +30m
        endTime: new Date(now.getTime() + 7200000),   // +2h
        duration: 90,
        totalMarks: 20,
        allowedDepartments: [uniqueDept],
        allowedSemesters: [6],
        invId: `INV-PW-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'PUBLISHED',
        questions: {
          create: [
            {
              id: crypto.randomUUID(),
              questionText: 'What ensures database serializability?',
              marks: 10,
              negativeMarks: 2,
              difficulty: 'MEDIUM',
              order: 1,
              options: {
                create: [
                  { id: crypto.randomUUID(), text: 'Strict Two-Phase Locking', isCorrect: true, order: 1 },
                  { id: crypto.randomUUID(), text: 'Dirty Reads', isCorrect: false, order: 2 },
                  { id: crypto.randomUUID(), text: 'Eventual Consistency', isCorrect: false, order: 3 },
                  { id: crypto.randomUUID(), text: 'Optimistic reads only', isCorrect: false, order: 4 }
                ]
              }
            },
            {
              id: crypto.randomUUID(),
              questionText: 'Which data structure supports O(1) average lookup?',
              marks: 10,
              negativeMarks: 0,
              difficulty: 'EASY',
              order: 2,
              options: {
                create: [
                  { id: crypto.randomUUID(), text: 'Hash Table', isCorrect: true, order: 1 },
                  { id: crypto.randomUUID(), text: 'Red-Black Tree', isCorrect: false, order: 2 },
                  { id: crypto.randomUUID(), text: 'B-Tree', isCorrect: false, order: 3 },
                  { id: crypto.randomUUID(), text: 'Skip List', isCorrect: false, order: 4 }
                ]
              }
            }
          ]
        }
      }
    })
    examId = exam.id

    // 4. Bulk insert 500 approved, eligible students
    const studentsData = []
    const baseUsn = `USN${Date.now().toString().slice(-6)}`
    for (let i = 1; i <= BATCH_STUDENTS_COUNT; i++) {
      studentsData.push({
        id: crypto.randomUUID(),
        name: `Student Scale ${i}`,
        usn: `${baseUsn}-${i.toString().padStart(4, '0')}`,
        email: `student-${baseUsn}-${i}@test.edu`,
        password: 'hashed_password_placeholder',
        departmentCode: uniqueDept,
        semester: 6,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        facePhotoKey: 'photos/test-scale.jpg',
        isSuspended: false
      })
    }

    await prisma.student.createMany({
      data: studentsData
    })
  })

  test('Pre-warm job creates exactly 500 READY attempts before exam start', async () => {
    const startTime = Date.now()
    const result = await attemptPrewarmJob.prewarmExam(examId)
    const durationMs = Date.now() - startTime

    assert.equal(result.prewarmedCount, 500, `Expected 500 prewarmed attempts, got ${result.prewarmedCount}`)

    // Verify DB count of READY attempts
    const attemptsCount = await prisma.examAttempt.count({
      where: {
        examId,
        status: 'READY'
      }
    })
    assert.equal(attemptsCount, 500, `Database should contain exactly 500 READY attempts, found ${attemptsCount}`)

    // Verify attempt_questions exist for attempts
    const aqCount = await prisma.attemptQuestion.count({
      where: {
        attempt: { examId }
      }
    })
    assert.equal(aqCount, 1000, `Each of 500 attempts should have 2 questions (expected 1000, found ${aqCount})`)

    console.log(`Pre-warmed 500 student attempts (1,000 questions) in ${durationMs}ms`)
  })

  test('Pre-warm job is strictly idempotent (second run adds 0 duplicates)', async () => {
    const secondResult = await attemptPrewarmJob.prewarmExam(examId)
    assert.equal(secondResult.prewarmedCount, 0, `Idempotent second run should prewarm 0 new attempts, got ${secondResult.prewarmedCount}`)

    const attemptsCount = await prisma.examAttempt.count({
      where: {
        examId,
        status: 'READY'
      }
    })
    assert.equal(attemptsCount, 500, `Database should still have exactly 500 READY attempts after rerun`)
  })

  test.after(async () => {
    const { redisClient } = require('../src/infra/redis/client')
    await redisClient.quit().catch(() => {})
    await prisma.$disconnect().catch(() => {})
  })
})
