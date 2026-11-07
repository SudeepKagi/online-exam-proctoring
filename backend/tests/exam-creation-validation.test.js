'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { examService } = require('../src/modules/exams/exams.service')

describe('Exam Creation Input & Schedule Window Validation Regression Suite', () => {
  it('1. Rejects creation with empty or missing title with 400 VALIDATION_ERROR', async () => {
    await assert.rejects(
      async () => {
        await examService.createExam({
          title: '',
          durationMinutes: 30,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString()
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /title/i)
        return true
      }
    )
  })

  it('2. Rejects creation with non-positive or NaN duration with 400 INVALID_DURATION', async () => {
    await assert.rejects(
      async () => {
        await examService.createExam({
          title: 'Valid Title',
          durationMinutes: -10,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString()
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'INVALID_DURATION')
        return true
      }
    )
  })

  it('3. Rejects creation when startTime or endTime is missing with 400 INVALID_EXAM_WINDOW', async () => {
    await assert.rejects(
      async () => {
        await examService.createExam({
          title: 'Valid Title',
          durationMinutes: 30
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'INVALID_EXAM_WINDOW')
        return true
      }
    )
  })

  it('4. Rejects creation with invalid Date strings with 400 INVALID_EXAM_WINDOW without 500 crash', async () => {
    await assert.rejects(
      async () => {
        await examService.createExam({
          title: 'Valid Title',
          durationMinutes: 30,
          startTime: 'invalid-date-string',
          endTime: new Date(Date.now() + 3600000).toISOString()
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'INVALID_EXAM_WINDOW')
        return true
      }
    )
  })

  it('5. Rejects creation when endTime <= startTime with 400 INVALID_EXAM_WINDOW', async () => {
    const now = Date.now()
    await assert.rejects(
      async () => {
        await examService.createExam({
          title: 'Valid Title',
          durationMinutes: 30,
          startTime: new Date(now + 3600000).toISOString(),
          endTime: new Date(now).toISOString()
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'INVALID_EXAM_WINDOW')
        return true
      }
    )
  })

  it('6. Rejects creation when duration exceeds scheduled window with 400 DURATION_EXCEEDS_WINDOW', async () => {
    const now = Date.now()
    await assert.rejects(
      async () => {
        await examService.createExam({
          title: 'Valid Title',
          durationMinutes: 90,
          startTime: new Date(now).toISOString(),
          endTime: new Date(now + 1800000).toISOString() // 30 min window
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'DURATION_EXCEEDS_WINDOW')
        return true
      }
    )
  })
})

