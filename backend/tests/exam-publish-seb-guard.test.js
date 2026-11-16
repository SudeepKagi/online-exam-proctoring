'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { examWizardService } = require('../src/modules/exams/exam.wizard.service')

describe('Exam Wizard SEB Configuration Guard', () => {
  test('1. publishWizard rejects with 400 and code SEB_KEY_REQUIRED when sebRequired is true but no key exists', async () => {
    const originalEnvKey = process.env.SEB_CONFIG_KEY
    delete process.env.SEB_CONFIG_KEY

    try {
      const payload = {
        title: 'Network Security Midterm',
        subjectCode: 'CS601',
        startTimeUtc: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 60,
        lateEntryMinutes: 15,
        department: 'Computer Science and Engineering',
        semester: 'Sem 6',
        sebRequired: true,
        questions: [
          {
            questionText: 'What layer does TLS operate at?',
            options: ['Application', 'Transport', 'Network', 'Data Link'],
            correctOptionIndex: 1,
            marks: 1
          }
        ]
      }

      await assert.rejects(
        async () => {
          await examWizardService.publishWizard('test-creator-id', payload)
        },
        (err) => {
          const status = err.status || err.statusCode
          assert.strictEqual(status, 400)
          assert.strictEqual(err.code, 'SEB_KEY_REQUIRED')
          assert.ok(err.message.includes('Exam requires Safe Exam Browser but no valid Config Key is configured'))
          return true
        }
      )
    } finally {
      if (originalEnvKey) {
        process.env.SEB_CONFIG_KEY = originalEnvKey
      }
    }
  })
})
