'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { validateConfig } = require('../src/shared/validateConfig')
const config = require('../src/shared/config')
const { scrubSebString, sanitizeLogPayload, PINO_REDACT_PATHS, logger } = require('../src/shared/logging')
const { toExamDto, examService } = require('../src/modules/exams/exams.service')
const { examWizardService } = require('../src/modules/exams/exam.wizard.service')
const examsSql = require('../src/modules/exams/exams.sql')
const { sanitizeProctoringConfigInput } = require('../src/modules/exams/exams.guard')
const { prisma } = require('../src/infra/postgres/client')
const { errorHandler } = require('../src/middleware/errorHandler')

const VALID_64_HEX_1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const VALID_64_HEX_2 = 'aabbccdd00112233445566778899aabbccddeeff00112233445566778899aabb'
const MASKED_SAMPLE = '••••••••' + VALID_64_HEX_1.slice(-4)

describe('Step 1: Safe Exam Browser (SEB) DTO Security & Config Key Suite', () => {
  let facultyUser = null
  let secondFacultyUser = null
  let studentUser = null
  let adminUser = null
  const createdExamIds = []

  before(async () => {
    const timestamp = Date.now()
    facultyUser = await prisma.user.create({
      data: {
        email: `seb-fac-${timestamp}@proctornet.com`,
        fullName: 'SEB Primary Faculty',
        passwordHash: 'dummyhash',
        role: 'FACULTY',
        status: 'ACTIVE'
      }
    })

    secondFacultyUser = await prisma.user.create({
      data: {
        email: `seb-fac2-${timestamp}@proctornet.com`,
        fullName: 'SEB Non-Owner Faculty',
        passwordHash: 'dummyhash',
        role: 'FACULTY',
        status: 'ACTIVE'
      }
    })

    studentUser = await prisma.user.create({
      data: {
        email: `seb-stud-${timestamp}@proctornet.com`,
        fullName: 'SEB Test Student',
        passwordHash: 'dummyhash',
        role: 'STUDENT',
        status: 'ACTIVE'
      }
    })

    adminUser = await prisma.user.create({
      data: {
        email: `seb-admin-${timestamp}@proctornet.com`,
        fullName: 'SEB Test Admin',
        passwordHash: 'dummyhash',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    })
  })

  after(async () => {
    for (const examId of createdExamIds) {
      await examsSql.deleteExam(examId).catch(() => {})
    }
    const userIds = [facultyUser?.id, secondFacultyUser?.id, studentUser?.id, adminUser?.id].filter(Boolean)
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {})
    }
  })

  describe('1. Environment Configuration & Startup Validation', () => {
    const origEnv = { ...process.env }

    after(() => {
      process.env = { ...origEnv }
    })

    it('accepts valid SEB_MODE values: off, log, enforce', () => {
      for (const mode of ['off', 'log', 'enforce', 'OFF', 'Enforce']) {
        process.env.SEB_MODE = mode
        assert.doesNotThrow(() => validateConfig(), `Expected SEB_MODE=${mode} to be valid`)
      }
    })

    it('rejects invalid SEB_MODE with a fatal error', () => {
      for (const badMode of ['enabled', 'true', 'false', 'invalid', 'on', '1']) {
        process.env.SEB_MODE = badMode
        assert.throws(
          () => validateConfig(),
          /SEB_MODE/i,
          `Expected SEB_MODE=${badMode} to be rejected`
        )
      }
    })

    it('accepts valid 64-hex SEB_CONFIG_KEY and empty/unset key', () => {
      process.env.SEB_MODE = 'off'
      process.env.SEB_CONFIG_KEY = VALID_64_HEX_1
      assert.doesNotThrow(() => validateConfig())

      delete process.env.SEB_CONFIG_KEY
      assert.doesNotThrow(() => validateConfig())

      process.env.SEB_CONFIG_KEY = ''
      assert.doesNotThrow(() => validateConfig())
    })

    it('rejects invalid SEB_CONFIG_KEY (63-char, 65-char, non-hex)', () => {
      process.env.SEB_MODE = 'off'

      process.env.SEB_CONFIG_KEY = VALID_64_HEX_1.slice(0, 63)
      assert.throws(() => validateConfig(), /SEB_CONFIG_KEY must be a 64-character hex string/)

      process.env.SEB_CONFIG_KEY = VALID_64_HEX_1 + 'a'
      assert.throws(() => validateConfig(), /SEB_CONFIG_KEY must be a 64-character hex string/)

      process.env.SEB_CONFIG_KEY = VALID_64_HEX_1.slice(0, 63) + 'Z'
      assert.throws(() => validateConfig(), /SEB_CONFIG_KEY must be a 64-character hex string/)
    })
  })

  describe('2. Input Guard & Proctoring Config Validation', () => {
    it('normalizes valid 64-hex sebConfigKey to trimmed lowercase', () => {
      const upperKey = '  ' + VALID_64_HEX_1.toUpperCase() + '  '
      const sanitized = sanitizeProctoringConfigInput({
        sebRequired: true,
        sebConfigKey: upperKey
      })
      assert.strictEqual(sanitized.sebRequired, true)
      assert.strictEqual(sanitized.sebConfigKey, VALID_64_HEX_1.toLowerCase())
    })

    it('rejects 63-char key with 400 INVALID_SEB_KEY', () => {
      assert.throws(
        () => sanitizeProctoringConfigInput({ sebConfigKey: VALID_64_HEX_1.slice(0, 63) }),
        (err) => err.status === 400 && err.code === 'INVALID_SEB_KEY'
      )
    })

    it('rejects 65-char key with 400 INVALID_SEB_KEY', () => {
      assert.throws(
        () => sanitizeProctoringConfigInput({ sebConfigKey: VALID_64_HEX_1 + 'f' }),
        (err) => err.status === 400 && err.code === 'INVALID_SEB_KEY'
      )
    })

    it('rejects 64-char non-hex string with 400 INVALID_SEB_KEY', () => {
      const nonHex = VALID_64_HEX_1.slice(0, 63) + 'g'
      assert.throws(
        () => sanitizeProctoringConfigInput({ sebConfigKey: nonHex }),
        (err) => err.status === 400 && err.code === 'INVALID_SEB_KEY'
      )
    })

    it('ignores masked key starting with bullet character so existing key is preserved', () => {
      const sanitized = sanitizeProctoringConfigInput({
        sebConfigKey: '••••••••cdef'
      }, { isUpdate: true })
      assert.strictEqual(sanitized.sebConfigKey, undefined, 'Masked key must not overwrite stored key')
    })

    it('handles clearSebConfigKey: true by setting sebConfigKey to null without persisting the flag', () => {
      const sanitized = sanitizeProctoringConfigInput({
        clearSebConfigKey: true
      }, { isUpdate: true })
      assert.strictEqual(sanitized.sebConfigKey, null)
      assert.strictEqual(sanitized.clearSebConfigKey, undefined, 'Flag clearSebConfigKey must not be persisted')
    })

    it('whitelists proctoringConfig fields and strips unknown properties', () => {
      const sanitized = sanitizeProctoringConfigInput({
        sebRequired: true,
        cameraRequired: true,
        unknownMaliciousProp: 'payload',
        hackAttempts: 123
      })
      assert.strictEqual(sanitized.sebRequired, true)
      assert.strictEqual(sanitized.cameraRequired, true)
      assert.strictEqual(sanitized.unknownMaliciousProp, undefined)
      assert.strictEqual(sanitized.hackAttempts, undefined)
    })
  })

  describe('3. toExamDto Role Masking & Immutability', () => {
    const rawExam = {
      id: 'exam-test-dto-1',
      title: 'Security Exam',
      createdBy: 'faculty-owner-123',
      proctoringConfig: {
        sebRequired: true,
        sebConfigKey: VALID_64_HEX_1,
        sebFileKey: 'seb-file-test-hash'
      },
      questions: [{ id: 'q1', text: 'Sample?' }]
    }

    it('STUDENT viewer: zero leakage (never sees sebConfigKey or sebFileKey, preserves sebRequired)', () => {
      const dto = toExamDto(rawExam, { role: 'STUDENT', id: 'student-999' })
      assert.strictEqual(dto.proctoringConfig.sebRequired, true)
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, undefined)
      assert.strictEqual(dto.proctoringConfig.sebFileKey, undefined)
    })

    it('Unauthenticated / Unknown viewer: zero leakage of SEB keys', () => {
      const dtoNull = toExamDto(rawExam, null)
      assert.strictEqual(dtoNull.proctoringConfig.sebRequired, true)
      assert.strictEqual(dtoNull.proctoringConfig.sebConfigKey, undefined)
      assert.strictEqual(dtoNull.proctoringConfig.sebFileKey, undefined)

      const dtoUnknown = toExamDto(rawExam, { role: 'EXTERNAL_AUDITOR' })
      assert.strictEqual(dtoUnknown.proctoringConfig.sebConfigKey, undefined)
      assert.strictEqual(dtoUnknown.proctoringConfig.sebFileKey, undefined)
    })

    it('FACULTY owner viewer: sees masked bullet string + last 4 characters', () => {
      const dto = toExamDto(rawExam, { role: 'FACULTY', id: 'faculty-owner-123' })
      const expectedMask = '••••••••' + VALID_64_HEX_1.slice(-4)
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, expectedMask)
      assert.strictEqual(dto.proctoringConfig.sebRequired, true)
    })

    it('ADMIN viewer: sees masked bullet string + last 4 characters', () => {
      const dto = toExamDto(rawExam, { role: 'ADMIN', id: 'admin-001' })
      const expectedMask = '••••••••' + VALID_64_HEX_1.slice(-4)
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, expectedMask)
      assert.strictEqual(dto.proctoringConfig.sebRequired, true)
    })

    it('FACULTY non-owner viewer: SEB keys stripped, exam access preserved', () => {
      const dto = toExamDto(rawExam, { role: 'FACULTY', id: 'other-faculty-456' })
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, undefined)
      assert.strictEqual(dto.proctoringConfig.sebFileKey, undefined)
      assert.strictEqual(dto.title, 'Security Exam')
    })

    it('Deep copy guarantee: source cached exam object is never mutated', () => {
      const cachedExam = {
        id: 'cached-exam-1',
        title: 'Original Cached Title',
        createdBy: 'fac-1',
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX_1
        }
      }

      const dto = toExamDto(cachedExam, { role: 'STUDENT', id: 'stud-1' })
      // Verify DTO has key removed
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, undefined)
      // Verify source cached object remains pristine
      assert.strictEqual(cachedExam.proctoringConfig.sebConfigKey, VALID_64_HEX_1)

      // Verify mutating DTO does not mutate cached object
      dto.title = 'Mutated Title'
      assert.strictEqual(cachedExam.title, 'Original Cached Title')
    })
  })

  describe('4. Database Operations, Merging & Masked Round-Trip', () => {
    it('stores 64-hex key, preserves it across masked round-trip, merges configs, and clears with flag', async () => {
      const now = Date.now()
      const created = await examService.createExam({
        title: `SEB Round-trip Exam ${now}`,
        courseCode: 'SEB-101',
        durationMinutes: 60,
        startTime: new Date(now + 600000).toISOString(),
        endTime: new Date(now + 7200000).toISOString(),
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX_1,
          cameraRequired: true
        }
      }, facultyUser.id)
      createdExamIds.push(created.id)

      // Direct check in DB: stored as raw 64-hex
      const inDbInitial = await prisma.exam.findUnique({ where: { id: created.id } })
      assert.strictEqual(inDbInitial.proctoringConfig.sebRequired, true)
      assert.strictEqual(inDbInitial.proctoringConfig.sebConfigKey, VALID_64_HEX_1)

      // Faculty owner reads exam -> gets masked key
      const facultyView = await examService.getExamById(created.id, facultyUser)
      assert.strictEqual(facultyView.proctoringConfig.sebConfigKey, MASKED_SAMPLE)

      // Faculty updates title while passing back the masked key (simulating form submission)
      await examService.updateExam(created.id, {
        title: `Updated Title ${now}`,
        proctoringConfig: {
          sebConfigKey: facultyView.proctoringConfig.sebConfigKey,
          cameraRequired: true
        }
      })

      // Check DB: raw key was NOT overwritten with bullet string
      const inDbAfterMaskedUpdate = await prisma.exam.findUnique({ where: { id: created.id } })
      assert.strictEqual(inDbAfterMaskedUpdate.title, `Updated Title ${now}`)
      assert.strictEqual(inDbAfterMaskedUpdate.proctoringConfig.sebConfigKey, VALID_64_HEX_1)

      // Partial merge: updating another field (e.g. allowCalculator) must not wipe SEB config
      await examService.updateExam(created.id, {
        proctoringConfig: {
          allowCalculator: true
        }
      })
      const inDbAfterMerge = await prisma.exam.findUnique({ where: { id: created.id } })
      assert.strictEqual(inDbAfterMerge.proctoringConfig.allowCalculator, true)
      assert.strictEqual(inDbAfterMerge.proctoringConfig.sebRequired, true)
      assert.strictEqual(inDbAfterMerge.proctoringConfig.sebConfigKey, VALID_64_HEX_1)

      // Clearing key with clearSebConfigKey: true
      await examService.updateExam(created.id, {
        clearSebConfigKey: true
      })
      const inDbAfterClear = await prisma.exam.findUnique({ where: { id: created.id } })
      assert.strictEqual(inDbAfterClear.proctoringConfig.sebConfigKey, null)
      assert.strictEqual(inDbAfterClear.proctoringConfig.clearSebConfigKey, undefined)
    })
  })

  describe('5. getSebSettings(examId) Resolution', () => {
    it('resolves per-exam key when set on exam', async () => {
      const now = Date.now()
      const exam = await examsSql.createExam({
        title: `SEB Settings Test 1 ${now}`,
        courseCode: 'SEB-102',
        durationMinutes: 45,
        startTime: new Date(now + 600000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        createdBy: facultyUser.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX_2
        }
      })
      createdExamIds.push(exam.id)

      const settings = await examService.getSebSettings(exam.id)
      assert.strictEqual(settings.sebRequired, true)
      assert.strictEqual(settings.sebConfigKey, VALID_64_HEX_2)
    })

    it('falls back to environment SEB_CONFIG_KEY when exam has sebRequired but no per-exam key', async () => {
      const origKey = process.env.SEB_CONFIG_KEY
      process.env.SEB_CONFIG_KEY = VALID_64_HEX_1

      try {
        const now = Date.now()
        const exam = await examsSql.createExam({
          title: `SEB Fallback Test ${now}`,
          courseCode: 'SEB-103',
          durationMinutes: 45,
          startTime: new Date(now + 600000).toISOString(),
          endTime: new Date(now + 3600000).toISOString(),
          createdBy: facultyUser.id,
          proctoringConfig: {
            sebRequired: true
          }
        })
        createdExamIds.push(exam.id)

        const settings = await examService.getSebSettings(exam.id)
        assert.strictEqual(settings.sebRequired, true)
        assert.strictEqual(settings.sebConfigKey, VALID_64_HEX_1)
      } finally {
        if (origKey !== undefined) process.env.SEB_CONFIG_KEY = origKey
        else delete process.env.SEB_CONFIG_KEY
      }
    })

    it('returns { sebRequired: false, sebConfigKey: null } when exam does not require SEB', async () => {
      const now = Date.now()
      const exam = await examsSql.createExam({
        title: `SEB Non-SEB Test ${now}`,
        courseCode: 'SEB-104',
        durationMinutes: 45,
        startTime: new Date(now + 600000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        createdBy: facultyUser.id,
        proctoringConfig: {
          sebRequired: false
        }
      })
      createdExamIds.push(exam.id)

      const settings = await examService.getSebSettings(exam.id)
      assert.strictEqual(settings.sebRequired, false)
      assert.strictEqual(settings.sebConfigKey, null)
    })
  })

  describe('6. Publish Guards for SEB Exams', () => {
    it('publishExam rejects with 400 SEB_KEY_REQUIRED if sebRequired: true and no per-exam or env key', async () => {
      const origKey = process.env.SEB_CONFIG_KEY
      delete process.env.SEB_CONFIG_KEY

      try {
        const now = Date.now()
        const exam = await examsSql.createExam({
          title: `SEB Guard Test 1 ${now}`,
          courseCode: 'SEB-105',
          durationMinutes: 30,
          startTime: new Date(now + 600000).toISOString(),
          endTime: new Date(now + 3600000).toISOString(),
          createdBy: facultyUser.id,
          proctoringConfig: {
            sebRequired: true
          }
        })
        createdExamIds.push(exam.id)

        await examsSql.addQuestion({
          examId: exam.id,
          questionText: 'Test question',
          options: ['A', 'B'],
          correctOptionIndex: 0
        })

        await assert.rejects(
          async () => examService.publishExam(exam.id),
          (err) => {
            assert.strictEqual(err.status, 400)
            assert.strictEqual(err.code, 'SEB_KEY_REQUIRED')
            return true
          }
        )
      } finally {
        if (origKey !== undefined) process.env.SEB_CONFIG_KEY = origKey
      }
    })

    it('publishWizard rejects with 400 SEB_KEY_REQUIRED if sebRequired: true and no key provided', async () => {
      const origKey = process.env.SEB_CONFIG_KEY
      delete process.env.SEB_CONFIG_KEY

      try {
        const now = Date.now()
        await assert.rejects(
          async () => examWizardService.publishWizard(facultyUser.id, {
            title: `SEB Wizard Guard Test ${now}`,
            courseCode: 'SEB-106',
            durationMinutes: 45,
            startTime: new Date(now + 600000).toISOString(),
            sebRequired: true,
            questions: [
              {
                questionText: 'Sample Q1',
                options: ['Choice 1', 'Choice 2'],
                correctOptionIndex: 0,
                marks: 5
              }
            ],
            invigilatorCredentials: {
              institutionId: `INV-${now}`
            }
          }),
          (err) => {
            assert.strictEqual(err.status, 400)
            assert.strictEqual(err.code, 'SEB_KEY_REQUIRED')
            return true
          }
        )
      } finally {
        if (origKey !== undefined) process.env.SEB_CONFIG_KEY = origKey
      }
    })

    it('publishExam succeeds when valid per-exam key is configured', async () => {
      const now = Date.now()
      const exam = await examsSql.createExam({
        title: `SEB Guard Success Test ${now}`,
        courseCode: 'SEB-107',
        durationMinutes: 30,
        startTime: new Date(now + 600000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        createdBy: facultyUser.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX_1
        }
      })
      createdExamIds.push(exam.id)

      await examsSql.addQuestion({
        examId: exam.id,
        questionText: 'Test question',
        options: ['A', 'B'],
        correctOptionIndex: 0
      })

      const published = await examService.publishExam(exam.id)
      assert.strictEqual(published.status, 'PUBLISHED')
    })
  })

  describe('7. Student Question Omission in Enforce Mode', () => {
    let publishedExam = null

    before(async () => {
      const now = Date.now()
      publishedExam = await examsSql.createExam({
        title: `SEB Question Omission Exam ${now}`,
        courseCode: 'SEB-108',
        durationMinutes: 60,
        startTime: new Date(now + 600000).toISOString(),
        endTime: new Date(now + 7200000).toISOString(),
        createdBy: facultyUser.id,
        status: 'PUBLISHED',
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX_1
        }
      })
      createdExamIds.push(publishedExam.id)

      await examsSql.addQuestion({
        examId: publishedExam.id,
        questionText: 'What is 2 + 2?',
        options: ['3', '4', '5'],
        correctOptionIndex: 1,
        marks: 4
      })

      await examsSql.addQuestion({
        examId: publishedExam.id,
        questionText: 'What is 3 * 3?',
        options: ['6', '9', '12'],
        correctOptionIndex: 1,
        marks: 6
      })

      await examsSql.updateExamStatus(publishedExam.id, 'PUBLISHED')
    })

    it('omits questions but retains questionCount and totalMarks for student when SEB_MODE === enforce', async () => {
      const origMode = process.env.SEB_MODE
      const origConfigMode = config.sebMode
      process.env.SEB_MODE = 'enforce'
      config.sebMode = 'enforce'

      try {
        const studentView = await examService.getExamById(publishedExam.id, studentUser)
        assert.strictEqual(studentView.questions, undefined, 'Questions must be omitted in enforce mode')
        assert.strictEqual(studentView.questionCount, 2)
        assert.strictEqual(studentView.totalMarks, 10)
        assert.strictEqual(studentView.proctoringConfig.sebRequired, true)
        assert.strictEqual(studentView.proctoringConfig.sebConfigKey, undefined)

        // Faculty owner should still see questions even in enforce mode
        const facultyView = await examService.getExamById(publishedExam.id, facultyUser)
        assert.ok(Array.isArray(facultyView.questions))
        assert.strictEqual(facultyView.questions.length, 2)
      } finally {
        process.env.SEB_MODE = origMode
        config.sebMode = origConfigMode
      }
    })

    it('does NOT omit questions for student when SEB_MODE === log or off', async () => {
      for (const mode of ['log', 'off']) {
        const origMode = process.env.SEB_MODE
        const origConfigMode = config.sebMode
        process.env.SEB_MODE = mode
        config.sebMode = mode

        try {
          const studentView = await examService.getExamById(publishedExam.id, studentUser)
          assert.ok(Array.isArray(studentView.questions), `Questions must be present when SEB_MODE is ${mode}`)
          assert.strictEqual(studentView.questions.length, 2)
          assert.strictEqual(studentView.questionCount, 2)
          assert.strictEqual(studentView.totalMarks, 10)
        } finally {
          process.env.SEB_MODE = origMode
          config.sebMode = origConfigMode
        }
      }
    })
  })

  describe('8. Logging Redaction & Credential Scrubbing', () => {
    it('scrubSebString truncates 64-hex strings to first 8 characters + ellipsis', () => {
      const text = `Failed query with key ${VALID_64_HEX_1} at row 5`
      const scrubbed = scrubSebString(text)
      assert.strictEqual(scrubbed, `Failed query with key ${VALID_64_HEX_1.slice(0, 8)}... at row 5`)
    })

    it('scrubSebString leaves non-64-hex strings unchanged', () => {
      const normalText = 'Database error: relation "exams" does not exist'
      assert.strictEqual(scrubSebString(normalText), normalText)
    })

    it('sanitizeLogPayload redacts sebConfigKey in objects and nested structures', () => {
      const payload = {
        examId: 'ex-123',
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX_1
        },
        headers: {
          'x-safeexambrowser-requesthash': VALID_64_HEX_2
        }
      }
      const sanitized = sanitizeLogPayload(payload)
      assert.strictEqual(sanitized.proctoringConfig.sebConfigKey, '[REDACTED]')
      assert.strictEqual(sanitized.headers['x-safeexambrowser-requesthash'], '[REDACTED]')
    })

    it('errorHandler scrubs 64-hex tokens without mutating the original error object', () => {
      const err = new Error(`Connection crashed for key ${VALID_64_HEX_1}`)
      err.status = 500

      let loggedErrorPayload = null
      const originalErrorLog = logger.error
      logger.error = (meta, msg) => {
        loggedErrorPayload = meta
      }

      try {
        const req = {
          requestId: 'req-test-1',
          path: '/api/v1/exams',
          method: 'GET'
        }
        let responseStatus = null
        let responseJson = null
        const res = {
          status: (code) => { responseStatus = code; return res },
          json: (body) => { responseJson = body; return res },
          set: () => {}
        }

        errorHandler(err, req, res, () => {})

        assert.strictEqual(responseStatus, 500)
        assert.ok(loggedErrorPayload, 'Logger should have been called')
        assert.strictEqual(
          loggedErrorPayload.error,
          `Connection crashed for key ${VALID_64_HEX_1.slice(0, 8)}...`
        )
        // Verify original error message was NOT mutated
        assert.strictEqual(err.message, `Connection crashed for key ${VALID_64_HEX_1}`)
      } finally {
        logger.error = originalErrorLog
      }
    })

    it('PINO_REDACT_PATHS includes required wildcard and explicit paths', () => {
      assert.ok(PINO_REDACT_PATHS.includes('req.body.proctoringConfig.sebConfigKey'))
      assert.ok(PINO_REDACT_PATHS.includes('*.proctoringConfig.sebConfigKey'))
      assert.ok(PINO_REDACT_PATHS.includes('sebConfigKey'))
    })
  })
})
