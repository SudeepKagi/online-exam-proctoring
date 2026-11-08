'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const config = require('../src/shared/config')
const { logger } = require('../src/shared/logging')
const { verifySeb, clearAllSebCaches } = require('../src/middleware/seb')

describe('SEB Debug Log Hashes Behavior', () => {
  const originalEnv = { ...process.env }
  const originalConfigMode = config.sebMode
  const originalConfigDebug = config.sebDebugLogHashes
  const originalConfigNodeEnv = config.nodeEnv
  const originalConfigIsProd = config.isProd

  it('includes full expectedHash and receivedHash when SEB_DEBUG_LOG_HASHES=true on pilot/test database', async () => {
    let capturedLog = null
    const originalInfo = logger.info
    logger.info = (payload, msg) => {
      capturedLog = { payload, msg }
    }

    try {
      process.env.SEB_MODE = 'log'
      config.sebMode = 'log'
      process.env.SEB_DEBUG_LOG_HASHES = 'true'
      config.sebDebugLogHashes = true
      process.env.NODE_ENV = 'test'
      config.nodeEnv = 'test'
      config.isProd = false
      process.env.DATABASE_URL = 'postgresql://proctornet_app:secret@localhost:5434/proctornet_pilot'

      const examId = 'test-exam-pilot-1'
      const { examService } = require('../src/modules/exams/exams.service')
      const originalGetSebSettings = examService.getSebSettings
      examService.getSebSettings = async () => ({
        sebRequired: true,
        sebConfigKey: 'a'.repeat(64)
      })

      const req = {
        params: { examId },
        originalUrl: `/api/v1/attempts/exams/${examId}/start`,
        headers: {
          'x-safeexambrowser-configkeyhash': 'b'.repeat(64)
        },
        user: { role: 'STUDENT' }
      }
      const res = {
        status: () => res,
        json: () => res
      }

      await new Promise((resolve) => {
        verifySeb(req, res, () => resolve())
      })

      examService.getSebSettings = originalGetSebSettings

      assert.ok(capturedLog, 'Logger.info must be called in log mode')
      assert.strictEqual(capturedLog.msg, 'SEB request verification check (log mode)')
      assert.strictEqual(capturedLog.payload.receivedPrefix8, 'b'.repeat(8))
      assert.ok(capturedLog.payload.expectedPrefix8, 'Must have expectedPrefix8')
      assert.strictEqual(capturedLog.payload.receivedHash, 'b'.repeat(64), 'Must include full receivedHash')
      assert.strictEqual(typeof capturedLog.payload.expectedHash, 'string', 'Must include full expectedHash')
      assert.strictEqual(capturedLog.payload.expectedHash.length, 64, 'expectedHash must be 64 characters')
    } finally {
      logger.info = originalInfo
      process.env = { ...originalEnv }
      config.sebMode = originalConfigMode
      config.sebDebugLogHashes = originalConfigDebug
      config.nodeEnv = originalConfigNodeEnv
      config.isProd = originalConfigIsProd
      clearAllSebCaches()
    }
  })

  it('refuses full debug hashes in production (only prefixes logged)', async () => {
    let capturedLog = null
    const originalInfo = logger.info
    logger.info = (payload, msg) => {
      capturedLog = { payload, msg }
    }

    try {
      process.env.SEB_MODE = 'log'
      config.sebMode = 'log'
      process.env.SEB_DEBUG_LOG_HASHES = 'true'
      config.sebDebugLogHashes = true
      process.env.NODE_ENV = 'production'
      config.nodeEnv = 'production'
      config.isProd = true
      process.env.DATABASE_URL = 'postgresql://proctornet_app:secret@localhost:5434/proctornet_pilot'

      const examId = 'test-exam-prod-1'
      const { examService } = require('../src/modules/exams/exams.service')
      const originalGetSebSettings = examService.getSebSettings
      examService.getSebSettings = async () => ({
        sebRequired: true,
        sebConfigKey: 'c'.repeat(64)
      })

      const req = {
        params: { examId },
        originalUrl: `/api/v1/attempts/exams/${examId}/start`,
        headers: {
          'x-safeexambrowser-configkeyhash': 'd'.repeat(64)
        },
        user: { role: 'STUDENT' }
      }
      const res = {
        status: () => res,
        json: () => res
      }

      await new Promise((resolve) => {
        verifySeb(req, res, () => resolve())
      })

      examService.getSebSettings = originalGetSebSettings

      assert.ok(capturedLog, 'Logger.info must be called in log mode')
      assert.strictEqual(capturedLog.payload.receivedPrefix8, 'd'.repeat(8))
      assert.ok(capturedLog.payload.expectedPrefix8, 'Must have expectedPrefix8')
      assert.strictEqual(capturedLog.payload.receivedHash, undefined, 'Must NOT include full receivedHash in production')
      assert.strictEqual(capturedLog.payload.expectedHash, undefined, 'Must NOT include full expectedHash in production')
    } finally {
      logger.info = originalInfo
      process.env = { ...originalEnv }
      config.sebMode = originalConfigMode
      config.sebDebugLogHashes = originalConfigDebug
      config.nodeEnv = originalConfigNodeEnv
      config.isProd = originalConfigIsProd
      clearAllSebCaches()
    }
  })

  it('refuses full debug hashes on remote production database hosts', async () => {
    let capturedLog = null
    const originalInfo = logger.info
    logger.info = (payload, msg) => {
      capturedLog = { payload, msg }
    }

    try {
      process.env.SEB_MODE = 'log'
      config.sebMode = 'log'
      process.env.SEB_DEBUG_LOG_HASHES = 'true'
      config.sebDebugLogHashes = true
      process.env.NODE_ENV = 'development'
      config.nodeEnv = 'development'
      config.isProd = false
      // Remote host not in allowlist and dbName not ending in safe regex
      process.env.DATABASE_URL = 'postgresql://app:pass@db.production.aws.com:5432/proctornet_live'

      const examId = 'test-exam-remote-1'
      const { examService } = require('../src/modules/exams/exams.service')
      const originalGetSebSettings = examService.getSebSettings
      examService.getSebSettings = async () => ({
        sebRequired: true,
        sebConfigKey: 'e'.repeat(64)
      })

      const req = {
        params: { examId },
        originalUrl: `/api/v1/attempts/exams/${examId}/start`,
        headers: {
          'x-safeexambrowser-configkeyhash': 'f'.repeat(64)
        },
        user: { role: 'STUDENT' }
      }
      const res = {
        status: () => res,
        json: () => res
      }

      await new Promise((resolve) => {
        verifySeb(req, res, () => resolve())
      })

      examService.getSebSettings = originalGetSebSettings

      assert.ok(capturedLog, 'Logger.info must be called in log mode')
      assert.strictEqual(capturedLog.payload.receivedPrefix8, 'f'.repeat(8))
      assert.ok(capturedLog.payload.expectedPrefix8, 'Must have expectedPrefix8')
      assert.strictEqual(capturedLog.payload.receivedHash, undefined, 'Must NOT include full receivedHash on remote database')
      assert.strictEqual(capturedLog.payload.expectedHash, undefined, 'Must NOT include full expectedHash on remote database')
    } finally {
      logger.info = originalInfo
      process.env = { ...originalEnv }
      config.sebMode = originalConfigMode
      config.sebDebugLogHashes = originalConfigDebug
      config.nodeEnv = originalConfigNodeEnv
      config.isProd = originalConfigIsProd
      clearAllSebCaches()
    }
  })
})
