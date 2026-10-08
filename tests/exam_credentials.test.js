const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const bcrypt = require(path.join(__dirname, '../proctornet/node_modules/bcrypt'))

const { examService } = require(path.join(__dirname, '../proctornet/backend/src/modules/exams/service'))
const { examRepository } = require(path.join(__dirname, '../proctornet/backend/src/modules/exams/repository'))
const { prisma } = require(path.join(__dirname, '../proctornet/backend/src/infra/postgres/client'))
const { ValidationError, ForbiddenError } = require(path.join(__dirname, '../proctornet/backend/src/shared/errors'))
const { ROLES } = require(path.join(__dirname, '../proctornet/backend/src/shared/roles'))

const TEST_EXAM_ID = '11111111-1111-1111-1111-111111111111'
const TEST_FACULTY_ID = '22222222-2222-2222-2222-222222222222'

describe('BUG-B07: Cryptographic Invigilator Credentials & Publish Guard', () => {
  it('rejects publishing an exam with invalid MCQ questions', async () => {
    const origFind = examRepository.findById
    try {
      examRepository.findById = async () => ({
        id: TEST_EXAM_ID,
        title: 'Algorithms',
        facultyId: TEST_FACULTY_ID,
        status: 'DRAFT',
        duration: 60,
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        questions: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            marks: 2,
            negativeMarks: 0,
            options: [
              { id: 'o1', text: 'Opt 1', isCorrect: false },
              { id: 'o2', text: 'Opt 2', isCorrect: false }
            ]
          }
        ]
      })

      await assert.rejects(
        async () => {
          await examService.publishExam(TEST_EXAM_ID, TEST_FACULTY_ID, ROLES.FACULTY)
        },
        (err) => {
          assert.ok(err instanceof ValidationError)
          assert.match(err.message, /must have exactly 1 correct option/i)
          return true
        }
      )
    } finally {
      examRepository.findById = origFind
    }
  })

  it('generates unambiguous one-time credentials upon successful publish', async () => {
    const origFind = examRepository.findById
    const origUpdate = examRepository.update
    const origUpdateStatus = examRepository.updateStatus

    try {
      let savedHash = null
      examRepository.findById = async () => ({
        id: TEST_EXAM_ID,
        title: 'Algorithms',
        invId: 'INV-ALGO-101',
        facultyId: TEST_FACULTY_ID,
        status: 'DRAFT',
        duration: 60,
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        questions: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            marks: 2,
            negativeMarks: 0,
            options: [
              { id: 'o1', text: 'Opt 1', isCorrect: true },
              { id: 'o2', text: 'Opt 2', isCorrect: false }
            ]
          }
        ]
      })

      examRepository.update = async (id, data) => {
        if (data.invPasswordHash) savedHash = data.invPasswordHash
        return { id }
      }

      examRepository.updateStatus = async (id, status) => ({
        id,
        status,
        invId: 'INV-ALGO-101',
        title: 'Algorithms'
      })

      const res = await examService.publishExam(TEST_EXAM_ID, TEST_FACULTY_ID, ROLES.FACULTY)
      assert.equal(res.status, 'PUBLISHED')
      assert.ok(res.oneTimePassword, 'oneTimePassword should be generated')
      assert.ok(res.validUntil, 'validUntil should be present')
      assert.ok(savedHash, 'Password hash should be saved to repository')

      const passwordMatches = await bcrypt.compare(res.oneTimePassword, savedHash)
      assert.ok(passwordMatches, 'Hash in repository must match returned one-time password')
    } finally {
      examRepository.findById = origFind
      examRepository.update = origUpdate
      examRepository.updateStatus = origUpdateStatus
    }
  })

  it('regenerates invigilator credentials and enforces faculty ownership', async () => {
    const origFind = examRepository.findById
    const origUpdate = examRepository.update
    const origUpdateMany = prisma.invigilatorSession.updateMany
    const origCreateAudit = prisma.auditLog.create

    try {
      examRepository.findById = async () => ({
        id: TEST_EXAM_ID,
        title: 'OS',
        invId: 'INV-OLD-1',
        facultyId: TEST_FACULTY_ID,
        endTime: new Date(Date.now() + 3600000)
      })

      // Ownership mismatch throws ForbiddenError
      await assert.rejects(
        async () => {
          await examService.regenerateInvigilatorCredentials(TEST_EXAM_ID, '99999999-9999-9999-9999-999999999999', ROLES.FACULTY)
        },
        (err) => err instanceof ForbiddenError
      )

      let sessionsInvalidated = false
      prisma.invigilatorSession.updateMany = async () => {
        sessionsInvalidated = true
        return { count: 1 }
      }
      prisma.auditLog.create = async () => ({ id: 'a1' })

      let updatedData = null
      examRepository.update = async (id, data) => {
        updatedData = data
        return { id, ...data }
      }

      const res = await examService.regenerateInvigilatorCredentials(TEST_EXAM_ID, TEST_FACULTY_ID, ROLES.FACULTY)
      assert.ok(sessionsInvalidated, 'Active invigilator sessions must be invalidated')
      assert.ok(res.invId.startsWith('INV-'), 'New invId must start with INV-')
      assert.ok(res.oneTimePassword, 'Must return new oneTimePassword')

      const hashValid = await bcrypt.compare(res.oneTimePassword, updatedData.invPasswordHash)
      assert.ok(hashValid, 'Stored hash must match new regenerated password')
    } finally {
      examRepository.findById = origFind
      examRepository.update = origUpdate
      prisma.invigilatorSession.updateMany = origUpdateMany
      prisma.auditLog.create = origCreateAudit
    }
  })

  after(async () => {
    try {
      const { redis } = require('../proctornet/backend/src/infra/redis/client')
      if (redis && redis.disconnect) redis.disconnect()
    } catch {}
    setTimeout(() => process.exit(0), 50).unref()
  })
})
