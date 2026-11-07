'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const examsSql = require('../src/modules/exams/exams.sql')
const { examService } = require('../src/modules/exams/exams.service')
const { attemptService } = require('../src/modules/attempts/attempts.service')
const { assertTestDatabase } = require('../src/infra/postgres/assertNonProduction')
const { prisma } = require('../src/infra/postgres/client')

async function getOrCreateFaculty() {
  let user = await prisma.user.findFirst({ where: { role: 'FACULTY' } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `faculty-test-${Date.now()}@proctornet.com`,
        fullName: 'Test Faculty',
        passwordHash: 'dummyhash',
        role: 'FACULTY',
        status: 'ACTIVE'
      }
    })
  }
  return user
}

async function getOrCreateStudent() {
  let user = await prisma.user.findFirst({ where: { role: 'STUDENT' } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `student-test-${Date.now()}@proctornet.com`,
        fullName: 'Test Student',
        passwordHash: 'dummyhash',
        role: 'STUDENT',
        status: 'ACTIVE'
      }
    })
  }
  return user
}

async function getOrCreateAdmin() {
  let user = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `admin-test-${Date.now()}@proctornet.com`,
        fullName: 'Test Admin',
        passwordHash: 'dummyhash',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    })
  }
  return user
}

describe('Baseline Review Tasks Verification Suite', () => {
  describe('Task 2.1: Mass Assignment Prevention on updateExam', () => {
    it('calling updateExam with status: PUBLISHED does not mutate exam status in database', async () => {
      const faculty = await getOrCreateFaculty()
      const now = Date.now()
      const draftExam = await examsSql.createExam({
        title: `Draft Exam For Mass Assignment Test ${now}`,
        courseCode: 'SEC-101',
        startTime: new Date(now + 3600000).toISOString(),
        endTime: new Date(now + 7200000).toISOString(),
        durationMinutes: 60,
        createdBy: faculty.id
      })
      assert.equal(draftExam.status, 'DRAFT')

      try {
        const updated = await examsSql.updateExam(draftExam.id, {
          title: 'Updated Title',
          status: 'PUBLISHED'
        })

        assert.equal(updated.title, 'Updated Title')
        assert.equal(updated.status, 'DRAFT', 'status MUST NOT be mutated by updateExam')

        examsSql.invalidateExamCache(draftExam.id)
        const fetched = await examsSql.findExamById(draftExam.id)
        assert.equal(fetched.status, 'DRAFT', 'Database record status must remain DRAFT')
      } finally {
        await examsSql.deleteExam(draftExam.id).catch(() => {})
      }
    })

    it('publishExam properly updates status to PUBLISHED via updateExamStatus', async () => {
      const faculty = await getOrCreateFaculty()
      const now = Date.now()
      const draftExam = await examsSql.createExam({
        title: `Publishable Exam ${now}`,
        courseCode: 'SEC-102',
        startTime: new Date(now + 600000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        durationMinutes: 45,
        createdBy: faculty.id
      })

      await examsSql.addQuestion({
        examId: draftExam.id,
        questionText: 'Is this secure?',
        options: ['Yes', 'No', 'Maybe', 'Always'],
        correctOptionIndex: 3
      })

      try {
        const published = await examService.publishExam(draftExam.id)
        assert.equal(published.status, 'PUBLISHED', 'publishExam must successfully update status to PUBLISHED')

        examsSql.invalidateExamCache(draftExam.id)
        const fetched = await examsSql.findExamById(draftExam.id)
        assert.equal(fetched.status, 'PUBLISHED')
      } finally {
        await examsSql.deleteExam(draftExam.id).catch(() => {})
      }
    })
  })

  describe('Task 4: Cleanroom Wipe Safety Guard', () => {
    it('refuses to wipe when database name does not end in _test', () => {
      const unsafeUrls = [
        'postgresql://postgres:pass@localhost:5432/proctornet',
        'postgresql://postgres:pass@127.0.0.1:5432/proctornet_production',
        'postgresql://postgres:pass@127.0.0.1:5432/proctornet_dev',
        'postgresql://postgres:pass@127.0.0.1:5432/prod_database',
        'postgresql://postgres:pass@127.0.0.1:5432/documind',
        'postgresql://postgres:pass@127.0.0.1:5433/proctornet'
      ]

      for (const url of unsafeUrls) {
        assert.throws(
          () => assertTestDatabase(url),
          (err) => {
            assert.match(err.message, /SAFETY REFUSAL/i)
            assert.match(err.message, /must end in '_test'/i)
            return true
          },
          `Expected refusal for URL: ${url}`
        )
      }
    })

    it('allows database URLs strictly ending in _test', () => {
      const safeUrls = [
        'postgresql://proctornet:pass@127.0.0.1:5433/proctornet_e2e_test?schema=public',
        'postgresql://proctornet:pass@127.0.0.1:5432/proctornet_test',
        'postgresql://proctornet:pass@localhost:5432/unit_test'
      ]

      for (const url of safeUrls) {
        assert.doesNotThrow(() => assertTestDatabase(url), `Expected allow for URL: ${url}`)
      }
    })
  })

  describe('Task C: Cache TTL Configuration and Dual Environment Guard', () => {
    it('refuses EXAM_CACHE_TTL_MS override if NODE_ENV is production', () => {
      const origEnv = process.env.NODE_ENV
      const origTtl = process.env.EXAM_CACHE_TTL_MS
      try {
        process.env.NODE_ENV = 'production'
        process.env.EXAM_CACHE_TTL_MS = '500'
        assert.throws(
          () => examsSql.getExamCacheTtlMs(),
          /SAFETY REFUSAL: EXAM_CACHE_TTL_MS override is only allowed in non-production environments/
        )
      } finally {
        process.env.NODE_ENV = origEnv
        if (origTtl !== undefined) process.env.EXAM_CACHE_TTL_MS = origTtl
        else delete process.env.EXAM_CACHE_TTL_MS
      }
    })

    it('refuses EXAM_CACHE_TTL_MS override if database host is production (external host)', () => {
      const origUrl = process.env.DATABASE_URL
      const origTtl = process.env.EXAM_CACHE_TTL_MS
      try {
        process.env.DATABASE_URL = 'postgresql://proctornet:pass@db.production-cloud.internal:5432/proctornet_prod'
        process.env.EXAM_CACHE_TTL_MS = '500'
        assert.throws(
          () => examsSql.getExamCacheTtlMs(),
          /SAFETY REFUSAL: EXAM_CACHE_TTL_MS override is only allowed in non-production environments/
        )
      } finally {
        process.env.DATABASE_URL = origUrl
        if (origTtl !== undefined) process.env.EXAM_CACHE_TTL_MS = origTtl
        else delete process.env.EXAM_CACHE_TTL_MS
      }
    })

    it('allows EXAM_CACHE_TTL_MS override in non-production environment with test database', () => {
      const origTtl = process.env.EXAM_CACHE_TTL_MS
      try {
        process.env.EXAM_CACHE_TTL_MS = '7500'
        assert.equal(examsSql.getExamCacheTtlMs(), 7500)
      } finally {
        if (origTtl !== undefined) process.env.EXAM_CACHE_TTL_MS = origTtl
        else delete process.env.EXAM_CACHE_TTL_MS
      }
    })
  })

  describe('Task B: Draft Exam Guard and Cache Invalidation', () => {
    it('student cannot start a draft exam (returns 403 EXAM_NOT_PUBLISHED)', async () => {
      const faculty = await getOrCreateFaculty()
      const student = await getOrCreateStudent()
      const now = Date.now()

      const draftExam = await examsSql.createExam({
        title: `Draft Exam For Student Start Block ${now}`,
        courseCode: 'SEC-201',
        startTime: new Date(now - 60000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        durationMinutes: 60,
        createdBy: faculty.id
      })

      try {
        await assert.rejects(
          async () => {
            await attemptService.startAttempt(draftExam.id, student.id)
          },
          (err) => {
            assert.equal(err.status, 403)
            assert.equal(err.code, 'EXAM_NOT_PUBLISHED')
            return true
          }
        )
      } finally {
        await examsSql.deleteExam(draftExam.id).catch(() => {})
      }
    })

    it('student cannot fetch a draft exam via getExamById (returns 404 EXAM_NOT_FOUND)', async () => {
      const faculty = await getOrCreateFaculty()
      const now = Date.now()

      const draftExam = await examsSql.createExam({
        title: `Draft Exam For Question Leak Check ${now}`,
        courseCode: 'SEC-202',
        startTime: new Date(now - 60000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        durationMinutes: 60,
        createdBy: faculty.id
      })

      await examsSql.addQuestion({
        examId: draftExam.id,
        questionText: 'Secret question in draft',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0
      })

      try {
        await assert.rejects(
          async () => {
            await examService.getExamById(draftExam.id, 'STUDENT')
          },
          (err) => {
            assert.equal(err.status, 404)
            assert.equal(err.code, 'EXAM_NOT_FOUND')
            return true
          }
        )
      } finally {
        await examsSql.deleteExam(draftExam.id).catch(() => {})
      }
    })

    it('faculty and admin can read draft exams with questions and answers', async () => {
      const faculty = await getOrCreateFaculty()
      const now = Date.now()

      const draftExam = await examsSql.createExam({
        title: `Draft Exam For Faculty/Admin Read ${now}`,
        courseCode: 'SEC-203',
        startTime: new Date(now + 60000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        durationMinutes: 60,
        createdBy: faculty.id
      })

      await examsSql.addQuestion({
        examId: draftExam.id,
        questionText: 'Draft question visible to faculty',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 1
      })

      try {
        const facultyView = await examService.getExamById(draftExam.id, 'FACULTY')
        assert.equal(facultyView.id, draftExam.id)
        assert.equal(facultyView.questions.length, 1)
        assert.equal(facultyView.questions[0].correctOptionIndex, 1)

        const adminView = await examService.getExamById(draftExam.id, 'ADMIN')
        assert.equal(adminView.id, draftExam.id)
        assert.equal(adminView.questions.length, 1)
        assert.equal(adminView.questions[0].correctOptionIndex, 1)
      } finally {
        await examsSql.deleteExam(draftExam.id).catch(() => {})
      }
    })

    it('student can read published exam with questions (correct options stripped)', async () => {
      const faculty = await getOrCreateFaculty()
      const now = Date.now()

      const exam = await examsSql.createExam({
        title: `Published Exam For Student Read ${now}`,
        courseCode: 'SEC-204',
        startTime: new Date(now + 60000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        durationMinutes: 60,
        createdBy: faculty.id
      })

      await examsSql.addQuestion({
        examId: exam.id,
        questionText: 'Published question for student',
        options: ['Opt 1', 'Opt 2'],
        correctOptionIndex: 0
      })

      await examService.publishExam(exam.id)

      try {
        const studentView = await examService.getExamById(exam.id, 'STUDENT')
        assert.equal(studentView.id, exam.id)
        assert.equal(studentView.status, 'PUBLISHED')
        assert.equal(studentView.questions.length, 1)
        assert.equal(studentView.questions[0].correctOptionIndex, undefined, 'Student must not see correctOptionIndex')
      } finally {
        await examsSql.deleteExam(exam.id).catch(() => {})
      }
    })

    it('publishExam invalidates 10s production TTL cache immediately so student start works without delay', async () => {
      const faculty = await getOrCreateFaculty()
      const student = await getOrCreateStudent()
      const origTtl = process.env.EXAM_CACHE_TTL_MS

      delete process.env.EXAM_CACHE_TTL_MS // enforce default production TTL (10,000ms)
      assert.equal(examsSql.getExamCacheTtlMs(), 10000, 'Must be testing with real 10s TTL')

      const now = Date.now()
      const exam = await examsSql.createExam({
        title: `TTL Cache Invalidation Test ${now}`,
        courseCode: 'SEC-205',
        startTime: new Date(now - 5000).toISOString(), // currently open
        endTime: new Date(now + 3600000).toISOString(),
        durationMinutes: 60,
        createdBy: faculty.id
      })

      await examsSql.addQuestion({
        examId: exam.id,
        questionText: 'Question for TTL test',
        options: ['A', 'B'],
        correctOptionIndex: 0
      })

      try {
        // 1. Student attempts start on DRAFT exam -> fails with 403, and exam is cached as DRAFT with 10s TTL
        await assert.rejects(
          async () => attemptService.startAttempt(exam.id, student.id),
          (err) => err.code === 'EXAM_NOT_PUBLISHED'
        )

        // 2. Immediately publish the exam (must invalidate cache)
        const published = await examService.publishExam(exam.id)
        assert.equal(published.status, 'PUBLISHED')

        // 3. Immediately start attempt without sleeping 10s:
        // If cache was not invalidated, startAttempt would see cached status DRAFT and throw EXAM_NOT_PUBLISHED.
        // Because publishExam invalidated cache, startAttempt succeeds immediately!
        const result = await attemptService.startAttempt(exam.id, student.id)
        assert.ok(result.attempt)
        assert.equal(result.exam.status, 'PUBLISHED')
        assert.equal(result.attempt.status, 'IN_PROGRESS')
      } finally {
        if (origTtl !== undefined) process.env.EXAM_CACHE_TTL_MS = origTtl
        await examsSql.deleteExam(exam.id).catch(() => {})
      }
    })
  })
})
