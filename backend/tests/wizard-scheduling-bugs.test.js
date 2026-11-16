'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { examWizardService } = require('../src/modules/exams/exam.wizard.service')
const { examDraftService } = require('../src/modules/exams/exam.draft.service')

describe('Wizard Scheduling, Timezone & Rate Limiting Regression Suite', () => {
  it('1. Rejects exam start within 2 minutes of now with 400 START_TOO_SOON', async () => {
    const now = Date.now()
    const tooSoonUtc = new Date(now + 60 * 1000).toISOString() // 1 minute from now

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Immediate Exam',
          courseCode: 'CS101',
          startTimeUtc: tooSoonUtc,
          durationMinutes: 60,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'START_TOO_SOON')
        assert.match(err.message, /at least 2 minutes/i)
        return true
      }
    )
  })

  it('2. Rejects exam start in the past with 400 START_IN_PAST', async () => {
    const pastUtc = new Date(Date.now() - 3600000).toISOString() // 1 hour ago

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Past Exam',
          courseCode: 'CS101',
          startTimeUtc: pastUtc,
          durationMinutes: 60,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'START_IN_PAST')
        assert.match(err.message, /past/i)
        return true
      }
    )
  })

  it('3. Rejects exam duration <= 0 with 400 INVALID_DURATION', async () => {
    const validFuture = new Date(Date.now() + 600000).toISOString() // 10 minutes from now

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Zero Duration Exam',
          courseCode: 'CS101',
          startTimeUtc: validFuture,
          durationMinutes: 0,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'INVALID_DURATION')
        return true
      }
    )
  })

  it('4. Rejects late entry window greater than or equal to exam duration', async () => {
    const validFuture = new Date(Date.now() + 600000).toISOString()

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Late Entry Overflow',
          courseCode: 'CS101',
          startTimeUtc: validFuture,
          durationMinutes: 10,
          lateEntryMinutes: 10,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'LATE_ENTRY_EXCEEDS_DURATION')
        return true
      }
    )
  })

  it('5. Enforces AI generation rate limit of 5 requests per hour per faculty', async () => {
    const mockFacultyId = `faculty_ratelimit_${Date.now()}`
    const fakePdf = Buffer.from('%PDF-1.4 mock pdf content').toString('base64')

    // Requests 1 to 5 should succeed (falling back to deterministic fallback)
    for (let i = 0; i < 5; i++) {
      const res = await examWizardService.generateFromPdf({
        pdfBase64: fakePdf,
        fileName: 'test.pdf',
        count: 2,
        creatorId: mockFacultyId
      })
      assert.equal(res.status, 'success')
    }

    // 6th request within the same hour MUST fail with 429 RATE_LIMIT_EXCEEDED
    await assert.rejects(
      async () => {
        await examWizardService.generateFromPdf({
          pdfBase64: fakePdf,
          fileName: 'test.pdf',
          count: 2,
          creatorId: mockFacultyId
        })
      },
      (err) => {
        assert.equal(err.status, 429)
        assert.equal(err.code, 'RATE_LIMIT_EXCEEDED')
        assert.match(err.message, /rate limit reached/i)
        return true
      }
    )
  })

  it('6. Allows faculty to read institution SEB status via controller', async () => {
    const examsOpsController = require('../src/modules/exams/exams.ops.controller')
    const req = { user: { id: 'faculty-1', role: 'FACULTY' } }
    let resStatus = 0
    let resJson = null
    const res = {
      status(code) {
        resStatus = code
        return this
      },
      json(payload) {
        resJson = payload
        return this
      }
    }
    await examsOpsController.getInstitutionSebStatus(req, res, (err) => {
      if (err) throw err
    })
    assert.equal(resStatus, 200)
    assert.ok(typeof resJson.configured === 'boolean')
  })
})

