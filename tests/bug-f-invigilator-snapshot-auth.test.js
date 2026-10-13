'use strict'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { proctoringService } = require('../proctornet/backend/src/modules/proctoring/service')
const { examIdParamSchema } = require('../proctornet/backend/src/modules/proctoring/validation')
const { prisma } = require('../proctornet/backend/src/infra/postgres/client')
const { redisClient } = require('../proctornet/backend/src/infra/redis/client')

describe('BUG F — Invigilator live feed snapshot authorization & routing', () => {
  after(async () => {
    try {
      if (redisClient?.client) {
        await redisClient.client.quit().catch(() => redisClient.client.disconnect())
      }
    } catch {}
  })

  it('F.1: assertStaffExamAccess throws distinct INV_EXAM_MISMATCH code when invigilator examId mismatches and no active session', async () => {
    const origFindFirst = prisma.invigilatorSession.findFirst
    prisma.invigilatorSession.findFirst = async () => null

    try {
      const invigilatorUser = {
        id: crypto.randomUUID(),
        role: 'INVIGILATOR',
        examId: crypto.randomUUID()
      }

      let error = null
      try {
        await proctoringService.assertStaffExamAccess(
          invigilatorUser,
          crypto.randomUUID()
        )
      } catch (err) {
        error = err
      }

      assert.ok(error, 'Must throw error on exam mismatch')
      assert.strictEqual(error.statusCode, 403)
      assert.strictEqual(error.code, 'INV_EXAM_MISMATCH', 'Must return distinct error code INV_EXAM_MISMATCH')
    } finally {
      prisma.invigilatorSession.findFirst = origFindFirst
    }
  })

  it('F.2: assertStaffExamAccess permits invigilator when user.examId matches', async () => {
    const examId = crypto.randomUUID()
    const invigilatorUser = {
      id: crypto.randomUUID(),
      role: 'INVIGILATOR',
      examId
    }

    const permitted = await proctoringService.assertStaffExamAccess(invigilatorUser, examId)
    assert.strictEqual(permitted, true, 'Must return true when examId matches token claim')
  })

  it('F.3: assertStaffExamAccess throws INV_NOT_AUTHORIZED for unauthorized roles', async () => {
    let error = null
    try {
      await proctoringService.assertStaffExamAccess(
        { id: crypto.randomUUID(), role: 'STUDENT' },
        crypto.randomUUID()
      )
    } catch (err) {
      error = err
    }

    assert.ok(error, 'Must throw error for STUDENT role')
    assert.strictEqual(error.statusCode, 403)
    assert.strictEqual(error.code, 'INV_NOT_AUTHORIZED')
  })

  it('F.4: examIdParamSchema accepts :id or :examId parameter for snapshot read endpoint', () => {
    const validUuid = crypto.randomUUID()
    const parsedWithId = examIdParamSchema.safeParse({ id: validUuid })
    assert.ok(parsedWithId.success, 'examIdParamSchema must successfully validate params with id')

    const parsedWithExamId = examIdParamSchema.safeParse({ examId: validUuid })
    assert.ok(parsedWithExamId.success, 'examIdParamSchema must successfully validate params with examId')
  })
})
