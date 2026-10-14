const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { ExamService } = require('../src/modules/exams/service')
const { invigilatorExamSettingsSchema } = require('../src/modules/exams/validation')
const { ROLES } = require('../src/shared/roles')
const {
  ValidationError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} = require('../src/shared/errors')

test.describe('Invigilator Exam Settings & Safe Rescheduling (R-10 / P3)', () => {
  const examId = crypto.randomUUID()
  const otherExamId = crypto.randomUUID()
  const facultyId = crypto.randomUUID()

  // ── 1. Strict Whitelist Schema Validation ──
  test('Schema strictly allows only valid operational and scheduling settings', () => {
    const validPayload = {
      startTime: new Date(Date.now() + 10000).toISOString(),
      endTime: new Date(Date.now() + 50000).toISOString(),
      duration: 45,
      cameraRequired: false,
      micRequired: true,
      browserLock: true,
      fullScreenMode: false,
      watermarkRequired: true,
      tabSwitchLimit: 5,
      aiReverifyInterval: 15,
      deviceAgentPolicy: 'OPTIONAL',
      vpnRequired: true,
    }

    const parsed = invigilatorExamSettingsSchema.safeParse(validPayload)
    assert.equal(parsed.success, true, 'Valid payload must pass schema')

    // Disallowed fields must be strictly rejected by .strict()
    const forbiddenFields = [
      { title: 'Hacked Title' },
      { subject: 'Hacked Subject' },
      { questions: [{ text: 'New Question' }] },
      { totalMarks: 500 },
      { status: 'LIVE' },
      { facultyId: crypto.randomUUID() },
      { invId: 'INV-HACKED' },
      { invPasswordHash: 'newhash' },
    ]

    for (const badField of forbiddenFields) {
      const res = invigilatorExamSettingsSchema.safeParse({
        ...validPayload,
        ...badField,
      })
      assert.equal(
        res.success,
        false,
        `Forbidden field ${Object.keys(badField)[0]} must be rejected by .strict()`
      )
    }
  })

  test('Schema enforces value bounds and enum constraints', () => {
    // Duration out of bounds
    assert.equal(invigilatorExamSettingsSchema.safeParse({ duration: 0 }).success, false)
    assert.equal(invigilatorExamSettingsSchema.safeParse({ duration: 500 }).success, false)

    // Tab switch limit out of bounds
    assert.equal(invigilatorExamSettingsSchema.safeParse({ tabSwitchLimit: -1 }).success, false)
    assert.equal(invigilatorExamSettingsSchema.safeParse({ tabSwitchLimit: 51 }).success, false)

    // AI reverify interval out of bounds
    assert.equal(invigilatorExamSettingsSchema.safeParse({ aiReverifyInterval: 2 }).success, false)
    assert.equal(
      invigilatorExamSettingsSchema.safeParse({ aiReverifyInterval: 200 }).success,
      false
    )

    // Device agent policy invalid enum
    assert.equal(
      invigilatorExamSettingsSchema.safeParse({ deviceAgentPolicy: 'INVALID' }).success,
      false
    )
    assert.equal(
      invigilatorExamSettingsSchema.safeParse({ deviceAgentPolicy: 'REQUIRED' }).success,
      true
    )
    assert.equal(
      invigilatorExamSettingsSchema.safeParse({ deviceAgentPolicy: 'OPTIONAL' }).success,
      true
    )
    assert.equal(
      invigilatorExamSettingsSchema.safeParse({ deviceAgentPolicy: 'OFF' }).success,
      true
    )
  })

  // ── 2. In-Memory Service Logic & Authorization Tests ──
  test('getExamSettings authorizes assigned invigilator and denies mismatched exam or unauthorized role', async () => {
    const service = new ExamService()
    const mockExam = {
      id: examId,
      title: 'Operating Systems',
      subject: 'CS301',
      facultyId,
      startTime: new Date('2026-11-01T10:00:00.000Z'),
      endTime: new Date('2026-11-01T11:00:00.000Z'),
      duration: 60,
      status: 'PUBLISHED',
      cameraRequired: true,
      micRequired: false,
      browserLock: true,
      fullScreenMode: true,
      watermarkRequired: true,
      tabSwitchLimit: 3,
      aiReverifyInterval: 10,
      deviceAgentPolicy: 'REQUIRED',
      vpnRequired: false,
      invPasswordHash: 'secret_hash',
    }

    // Mock examRepository.findById
    const { examRepository } = require('../src/modules/exams/repository')
    const originalFindById = examRepository.findById
    examRepository.findById = async id => (id === examId ? mockExam : null)

    try {
      // 1. Authorized invigilator
      const invUser = { id: 'inv-1', role: ROLES.INVIGILATOR, examId }
      const res = await service.getExamSettings(examId, invUser)
      assert.equal(res.id, examId)
      assert.equal(res.cameraRequired, true)
      assert.equal(res.invPasswordHash, undefined, 'Must sanitize password hash')

      // 2. Mismatched invigilator (assigned to other exam)
      const otherInvUser = { id: 'inv-2', role: ROLES.INVIGILATOR, examId: otherExamId }
      await assert.rejects(
        () => service.getExamSettings(examId, otherInvUser),
        err => err instanceof ForbiddenError
      )

      // 3. Faculty owner
      const facultyOwner = { id: facultyId, role: ROLES.FACULTY }
      const facRes = await service.getExamSettings(examId, facultyOwner)
      assert.equal(facRes.id, examId)

      // 4. Non-owner faculty
      const strangerFaculty = { id: crypto.randomUUID(), role: ROLES.FACULTY }
      await assert.rejects(
        () => service.getExamSettings(examId, strangerFaculty),
        err => err instanceof ForbiddenError
      )

      // 5. Admin
      const admin = { id: 'admin-1', role: ROLES.ADMIN }
      const adminRes = await service.getExamSettings(examId, admin)
      assert.equal(adminRes.id, examId)

      // 6. Student (unauthorized)
      const student = { id: 'student-1', role: ROLES.STUDENT }
      await assert.rejects(
        () => service.getExamSettings(examId, student),
        err => err instanceof ForbiddenError
      )
    } finally {
      examRepository.findById = originalFindById
    }
  })

  test('updateExamSettings enforces scheduling invariants and updates valid settings', async () => {
    const service = new ExamService()
    const now = Date.now()
    const mockExam = {
      id: examId,
      title: 'Operating Systems',
      subject: 'CS301',
      facultyId,
      startTime: new Date(now + 7200000), // +2 hours
      endTime: new Date(now + 10800000), // +3 hours
      duration: 60,
      status: 'PUBLISHED',
      cameraRequired: true,
      micRequired: false,
      browserLock: true,
      fullScreenMode: true,
      watermarkRequired: true,
      tabSwitchLimit: 3,
      aiReverifyInterval: 10,
      deviceAgentPolicy: 'REQUIRED',
      vpnRequired: false,
    }

    const { examRepository } = require('../src/modules/exams/repository')
    const originalFindById = examRepository.findById
    const originalUpdate = examRepository.update
    let updatedPayload = null

    examRepository.findById = async id => (id === examId ? mockExam : null)
    examRepository.update = async (id, data) => {
      updatedPayload = data
      return { ...mockExam, ...data }
    }

    try {
      const invUser = { id: 'inv-1', role: ROLES.INVIGILATOR, examId }

      // Invariant 1: endTime <= startTime is rejected
      await assert.rejects(
        () =>
          service.updateExamSettings(
            examId,
            {
              startTime: new Date(now + 60000).toISOString(),
              endTime: new Date(now + 30000).toISOString(),
            },
            invUser,
            null
          ),
        err => err instanceof ValidationError
      )

      // Invariant 2: Concluded exam cannot be edited
      mockExam.status = 'ENDED'
      await assert.rejects(
        () => service.updateExamSettings(examId, { duration: 90 }, invUser, null),
        err => err instanceof ConflictError
      )
      mockExam.status = 'PUBLISHED'

      // Invariant 3: Valid update succeeds and applies whitelisted properties
      const newEndTime = new Date(now + 14400000).toISOString()
      const result = await service.updateExamSettings(
        examId,
        {
          endTime: newEndTime,
          duration: 90,
          cameraRequired: false,
          micRequired: true,
          tabSwitchLimit: 8,
          deviceAgentPolicy: 'OPTIONAL',
        },
        invUser,
        null
      )

      assert.equal(result.success, true)
      assert.equal(result.settings.duration, 90)
      assert.equal(result.settings.cameraRequired, false)
      assert.equal(result.settings.micRequired, true)
      assert.equal(result.settings.tabSwitchLimit, 8)
      assert.equal(result.settings.deviceAgentPolicy, 'OPTIONAL')
      assert.equal(updatedPayload.duration, 90)
      assert.equal(updatedPayload.micRequired, true)
    } finally {
      examRepository.findById = originalFindById
      examRepository.update = originalUpdate
    }
  })

  test.after(async () => {
    try {
      const { redisClient } = require('../src/infra/redis/client')
      if (redisClient) {
        await redisClient.quit().catch(() => redisClient.disconnect?.())
      }
    } catch (_) {}
  })
})
