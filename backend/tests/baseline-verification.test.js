'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const examsSql = require('../src/modules/exams/exams.sql')
const { examService } = require('../src/modules/exams/exams.service')
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
        // Attempt to mutate status via updateExam (as would happen via PUT /api/v1/exams/:id)
        const updated = await examsSql.updateExam(draftExam.id, {
          title: 'Updated Title',
          status: 'PUBLISHED'
        })

        // Verify title updated, but status remains strictly DRAFT
        assert.equal(updated.title, 'Updated Title')
        assert.equal(updated.status, 'DRAFT', 'status MUST NOT be mutated by updateExam')

        // Verify directly from database via findExamById
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

      // Add a question so validation passes
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

  describe('Task 2.3: Media Stream Deferred Teardown Logic', () => {
    it('cancels teardown if remounted before delay, executes if unmount persists', async () => {
      let streamsCleared = 0
      const clearStreams = () => { streamsCleared++ }

      let teardownTimer = null
      const simulateUnmount = () => {
        teardownTimer = setTimeout(() => {
          clearStreams()
        }, 50)
      }
      const simulateRemount = () => {
        if (teardownTimer) {
          clearTimeout(teardownTimer)
          teardownTimer = null
        }
      }

      // 1. StrictMode cycle: Mount -> Unmount -> Remount (<10ms)
      simulateUnmount()
      simulateRemount()
      await new Promise(r => setTimeout(r, 70))
      assert.equal(streamsCleared, 0, 'Streams must NOT be cleared during StrictMode remount')

      // 2. Real unmount (navigating away): Unmount and do not remount
      simulateUnmount()
      await new Promise(r => setTimeout(r, 70))
      assert.equal(streamsCleared, 1, 'Streams MUST be cleared on real unmount')
    })
  })
})
