'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const http = require('http')

const config = require('../src/shared/config')
const { app, server: appServer } = require('../src/app')
const { signToken } = require('../src/utils/jwt')
const {
  verifySebNonBlocking,
  inspectSebRequest,
  clearAllSebCaches,
  invalidateExamSebCache
} = require('../src/middleware/seb')
const examsSql = require('../src/modules/exams/exams.sql')
const { examService, toExamDto } = require('../src/modules/exams/exams.service')
const { prisma } = require('../src/infra/postgres/client')

const VALID_64_HEX = '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'

describe('Step 3: Safe Exam Browser (SEB) UI, Status Endpoint & Modal Suite', () => {
  let server = null
  let serverPort = null
  let serverBaseUrl = null

  let facultyUser = null
  let studentUser = null
  let facultyToken = null
  let studentToken = null

  let nonSebExam = null
  let sebExam = null
  const createdExamIds = []

  before(async () => {
    // 1. Start ephemeral HTTP server on random port
    await new Promise((resolve) => {
      server = appServer.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port
        serverBaseUrl = `http://127.0.0.1:${serverPort}`
        config.publicOrigin = serverBaseUrl
        resolve()
      })
    })

    // 2. Locate or seed faculty and student
    facultyUser = await prisma.user.findUnique({ where: { email: 'faculty@proctornet.com' } })
    if (!facultyUser) {
      facultyUser = await prisma.user.findFirst({ where: { role: 'FACULTY', email: { not: { contains: 'load' } } } })
    }
    if (!facultyUser) {
      facultyUser = await prisma.user.create({
        data: {
          email: `seb3-fac-${Date.now()}@proctornet.com`,
          fullName: 'SEB3 Faculty',
          passwordHash: 'dummyhash',
          role: 'FACULTY',
          status: 'ACTIVE'
        }
      })
    }
    facultyToken = signToken({ id: facultyUser.id, role: 'FACULTY', email: facultyUser.email })

    studentUser = await prisma.user.findUnique({ where: { email: 'student1@proctornet.com' } })
    if (!studentUser) {
      studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT', email: { not: { contains: 'load' } } } })
    }
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          email: `seb3-stud-${Date.now()}@proctornet.com`,
          fullName: 'SEB3 Student',
          passwordHash: 'dummyhash',
          role: 'STUDENT',
          status: 'ACTIVE'
        }
      })
    }
    studentToken = signToken({ id: studentUser.id, role: 'STUDENT', email: studentUser.email })

    // 3. Create non-SEB exam
    const now = Date.now()
    nonSebExam = await examService.createExam(
      {
        title: 'Non-SEB Test Exam Step 3',
        courseCode: 'CS301',
        startTime: new Date(now + 60000),
        endTime: new Date(now + 7200000),
        durationMinutes: 60,
        proctoringConfig: { sebRequired: false }
      },
      facultyUser.id
    )
    createdExamIds.push(nonSebExam.id)
    await examService.addQuestion(nonSebExam.id, {
      questionText: 'Sample Non-SEB Question',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 0
    })
    await examService.publishExam(nonSebExam.id)

    // 4. Create SEB exam
    sebExam = await examService.createExam(
      {
        title: 'SEB Verified Test Exam Step 3',
        courseCode: 'CS302',
        startTime: new Date(now + 60000),
        endTime: new Date(now + 7200000),
        durationMinutes: 60,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX
        }
      },
      facultyUser.id
    )
    createdExamIds.push(sebExam.id)
    await examService.addQuestion(sebExam.id, {
      questionText: 'Sample SEB Question',
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctOptionIndex: 0
    })
    await examService.publishExam(sebExam.id)
  })

  after(async () => {
    clearAllSebCaches()
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    for (const id of createdExamIds) {
      try {
        await prisma.question.deleteMany({ where: { examId: id } })
        await prisma.examAttempt.deleteMany({ where: { examId: id } })
        await prisma.exam.delete({ where: { id } })
      } catch (_) {}
    }
  })

  describe('1. GET /api/v1/attempts/exams/:examId/seb-status endpoint', () => {
    it('under SEB_MODE=off: returns 200 without blocking', async () => {
      const origMode = config.sebMode
      config.sebMode = 'off'
      try {
        clearAllSebCaches()
        const res = await fetch(`${serverBaseUrl}/api/v1/attempts/exams/${sebExam.id}/seb-status`, {
          headers: {
            Authorization: `Bearer ${studentToken}`
          }
        })
        assert.strictEqual(res.status, 200)
        const body = await res.json()
        assert.strictEqual(body.status, 'success')
        assert.strictEqual(body.required, true)
        assert.strictEqual(body.mode, 'off')
        assert.strictEqual(body.verified, false)
      } finally {
        config.sebMode = origMode
      }
    })

    it('under SEB_MODE=log: returns 200 with verified:false when header missing', async () => {
      const origMode = config.sebMode
      config.sebMode = 'log'
      try {
        clearAllSebCaches()
        const res = await fetch(`${serverBaseUrl}/api/v1/attempts/exams/${sebExam.id}/seb-status`, {
          headers: {
            Authorization: `Bearer ${studentToken}`
          }
        })
        assert.strictEqual(res.status, 200)
        const body = await res.json()
        assert.strictEqual(body.status, 'success')
        assert.strictEqual(body.required, true)
        assert.strictEqual(body.mode, 'log')
        assert.strictEqual(body.verified, false)
      } finally {
        config.sebMode = origMode
      }
    })

    it('under SEB_MODE=log: returns 200 with verified:true when header is valid', async () => {
      const origMode = config.sebMode
      config.sebMode = 'log'
      try {
        clearAllSebCaches()
        const statusPath = `/api/v1/attempts/exams/${sebExam.id}/seb-status`
        const expectedUrl = `${config.publicOrigin}${statusPath}`
        const validHash = crypto.createHash('sha256').update(expectedUrl + VALID_64_HEX).digest('hex').toLowerCase()

        const res = await fetch(`${serverBaseUrl}${statusPath}`, {
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'X-SafeExamBrowser-ConfigKeyHash': validHash
          }
        })
        assert.strictEqual(res.status, 200)
        const body = await res.json()
        assert.strictEqual(body.status, 'success')
        assert.strictEqual(body.required, true)
        assert.strictEqual(body.mode, 'log')
        assert.strictEqual(body.verified, true)
      } finally {
        config.sebMode = origMode
      }
    })

    it('under SEB_MODE=enforce: NEVER blocks with 403 on missing header, returns 200 verified:false', async () => {
      const origMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        clearAllSebCaches()
        const res = await fetch(`${serverBaseUrl}/api/v1/attempts/exams/${sebExam.id}/seb-status`, {
          headers: {
            Authorization: `Bearer ${studentToken}`
          }
        })
        // Crucial invariant: GET seb-status NEVER blocks with 403
        assert.strictEqual(res.status, 200)
        const body = await res.json()
        assert.strictEqual(body.status, 'success')
        assert.strictEqual(body.required, true)
        assert.strictEqual(body.mode, 'enforce')
        assert.strictEqual(body.verified, false)
      } finally {
        config.sebMode = origMode
      }
    })

    it('under SEB_MODE=enforce: returns 200 verified:true on valid header', async () => {
      const origMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        clearAllSebCaches()
        const statusPath = `/api/v1/attempts/exams/${sebExam.id}/seb-status`
        const expectedUrl = `${config.publicOrigin}${statusPath}`
        const validHash = crypto.createHash('sha256').update(expectedUrl + VALID_64_HEX).digest('hex').toLowerCase()

        const res = await fetch(`${serverBaseUrl}${statusPath}`, {
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'X-SafeExamBrowser-ConfigKeyHash': validHash
          }
        })
        assert.strictEqual(res.status, 200)
        const body = await res.json()
        assert.strictEqual(body.status, 'success')
        assert.strictEqual(body.required, true)
        assert.strictEqual(body.mode, 'enforce')
        assert.strictEqual(body.verified, true)
      } finally {
        config.sebMode = origMode
      }
    })

    it('for non-SEB exam: returns required:false', async () => {
      clearAllSebCaches()
      const res = await fetch(`${serverBaseUrl}/api/v1/attempts/exams/${nonSebExam.id}/seb-status`, {
        headers: {
          Authorization: `Bearer ${studentToken}`
        }
      })
      assert.strictEqual(res.status, 200)
      const body = await res.json()
      assert.strictEqual(body.status, 'success')
      assert.strictEqual(body.required, false)
      assert.strictEqual(body.verified, false)
    })
  })

  describe('2. Modal Masked Round-Trip & Clear Key Operations', () => {
    let modalTestExam = null

    before(async () => {
      modalTestExam = await examService.createExam(
        {
          title: 'Modal Masked Test Exam',
          courseCode: 'CS303',
          startTime: new Date(Date.now() + 60000),
          endTime: new Date(Date.now() + 7200000),
          durationMinutes: 60,
          proctoringConfig: {
            sebRequired: true,
            sebConfigKey: VALID_64_HEX
          }
        },
        facultyUser.id
      )
      createdExamIds.push(modalTestExam.id)
    })

    it('shows masked value "••••••••1f8c" for faculty owner', async () => {
      const dto = toExamDto(modalTestExam, facultyUser)
      assert.strictEqual(dto.proctoringConfig.sebRequired, true)
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, '••••••••1f8c')
    })

    it('never exposes key to students', async () => {
      const dto = toExamDto(modalTestExam, studentUser)
      assert.strictEqual(dto.proctoringConfig.sebRequired, true)
      assert.strictEqual(dto.proctoringConfig.sebConfigKey, undefined)
    })

    it('preserves existing key when modal submits masked value unchanged', async () => {
      const maskedDto = toExamDto(modalTestExam, facultyUser)
      const maskedKey = maskedDto.proctoringConfig.sebConfigKey

      // Modal sends title update with maskedKey unchanged
      const updated = await examService.updateExam(modalTestExam.id, {
        title: 'Modal Masked Test Exam - Updated Title',
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: maskedKey
        }
      })

      // The underlying database record still retains the real 64-hex key
      const inDb = await examsSql.findExamById(modalTestExam.id)
      assert.strictEqual(inDb.proctoringConfig.sebConfigKey, VALID_64_HEX)

      // DTO still presents the same masked format
      const newDto = toExamDto(updated, facultyUser)
      assert.strictEqual(newDto.proctoringConfig.sebConfigKey, '••••••••1f8c')
    })

    it('updates key when faculty enters a new 64-hex key', async () => {
      const newKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
      const updated = await examService.updateExam(modalTestExam.id, {
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: newKey
        }
      })

      const inDb = await examsSql.findExamById(modalTestExam.id)
      assert.strictEqual(inDb.proctoringConfig.sebConfigKey, newKey)

      const newDto = toExamDto(updated, facultyUser)
      assert.strictEqual(newDto.proctoringConfig.sebConfigKey, '••••••••6789')
    })

    it('clears key when clearSebConfigKey:true is sent via Remove Key action', async () => {
      const updated = await examService.updateExam(modalTestExam.id, {
        clearSebConfigKey: true
      })

      const inDb = await examsSql.findExamById(modalTestExam.id)
      assert.strictEqual(inDb.proctoringConfig.sebConfigKey, null)

      const newDto = toExamDto(updated, facultyUser)
      assert.strictEqual(newDto.proctoringConfig.sebConfigKey, null)
    })
  })
})
