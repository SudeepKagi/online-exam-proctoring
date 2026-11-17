'use strict'

const multer = require('multer')
const { settingsService } = require('./settings.service')
const { getStorageAdapter } = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')
const { getInstitutionSebState, invalidateInstitutionSebState } = require('../seb/seb.service')
const { inspectSebBuffer, generateStarterSebConfig } = require('../seb/sebConfigChecker')
const { sebDiagnosticsService } = require('../seb/sebDiagnostics.service')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 // 500 KB limit
  }
})

/**
 * Endpoint to inspect an uploaded .seb file without persisting it.
 * POST /api/v1/admin/seb/inspect
 */
async function inspectConfig(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'FILE_REQUIRED', message: 'A .seb configuration file is required.' })
    }

    const originalName = (req.file.originalname || '').toLowerCase()
    if (!originalName.endsWith('.seb')) {
      return res.status(400).json({ code: 'INVALID_FILE_EXTENSION', message: 'File must have a .seb extension.' })
    }

    const sebState = await getInstitutionSebState()
    const inspection = inspectSebBuffer(req.file.buffer, {
      publicOrigin: sebState.publicOrigin,
      s3Host: process.env.S3_BUCKET ? `${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com` : '',
      pastedKey: req.body?.configKey || ''
    })

    return res.status(200).json({
      success: true,
      inspection
    })
  } catch (err) {
    logger.error({ err }, 'Failed to inspect SEB configuration buffer')
    next(err)
  }
}

/**
 * Endpoint to download a pre-configured starter .seb file.
 * GET /api/v1/admin/seb/starter-config
 */
async function getStarterConfig(req, res, next) {
  try {
    const sebState = await getInstitutionSebState()
    const s3Host = process.env.S3_BUCKET ? `${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com` : ''
    const xmlConfig = generateStarterSebConfig({
      publicOrigin: sebState.publicOrigin,
      s3Host
    })

    res.setHeader('Content-Type', 'application/seb')
    res.setHeader('Content-Disposition', 'attachment; filename="proctornet-starter.seb"')
    return res.status(200).send(xmlConfig)
  } catch (err) {
    logger.error({ err }, 'Failed to generate starter SEB configuration')
    next(err)
  }
}

/**
 * Returns recent diagnostic verification attempts.
 * GET /api/v1/admin/seb/attempts
 */
async function getRecentAttempts(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 5
    const attempts = sebDiagnosticsService.getRecentAttempts(limit)
    return res.status(200).json({
      success: true,
      attempts
    })
  } catch (err) {
    logger.error({ err }, 'Failed to fetch SEB verification attempts')
    next(err)
  }
}

/**
 * Uploads and activates institution-wide Safe Exam Browser configuration.
 * POST /api/v1/admin/seb/config
 */
async function uploadSebConfig(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'FILE_REQUIRED', message: 'A .seb configuration file is required.' })
    }

    const originalName = (req.file.originalname || '').toLowerCase()
    if (!originalName.endsWith('.seb')) {
      return res.status(400).json({ code: 'INVALID_FILE_EXTENSION', message: 'File must have a .seb extension.' })
    }

    const rawKey = req.body?.configKey
    const trimmedKey = typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : ''
    if (!trimmedKey || !/^[0-9a-f]{64}$/.test(trimmedKey)) {
      return res.status(400).json({ code: 'INVALID_CONFIG_KEY', message: 'Config Key must be a 64-character hexadecimal string.' })
    }

    const sebState = await getInstitutionSebState()
    const inspection = inspectSebBuffer(req.file.buffer, {
      publicOrigin: sebState.publicOrigin,
      s3Host: process.env.S3_BUCKET ? `${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com` : '',
      pastedKey: trimmedKey
    })

    if (!inspection.valid) {
      return res.status(400).json({ code: 'INVALID_SEB_FILE', message: inspection.error })
    }

    // Save to S3 first (no key stored in metadata)
    const fileKey = 'seb/institution-config.seb'
    const storage = getStorageAdapter()
    try {
      await storage.putObject(fileKey, req.file.buffer, 'application/seb')
    } catch (storageErr) {
      storageErr.isStorageError = true
      throw storageErr
    }

    let saved = null
    try {
      // Upsert into system settings
      const existing = await settingsService.getSebConfig()
      saved = await settingsService.saveSebConfig({
        fileKey,
        configKey: trimmedKey,
        uploadedAt: new Date().toISOString(),
        lastVerifiedAt: existing?.lastVerifiedAt || null,
        requestedMode: existing?.requestedMode || 'off'
      })
      invalidateInstitutionSebState()
    } catch (dbErr) {
      // If DB step fails, delete S3 object to prevent orphaned storage
      try {
        await storage.deleteObject(fileKey)
      } catch (cleanupErr) {
        logger.warn({ cleanupErr: cleanupErr.message }, 'Failed to delete S3 object after DB failure')
      }
      throw dbErr
    }

    return res.status(200).json({
      success: true,
      warning: inspection.keyWarning || inspection.notice || null,
      inspection,
      status: {
        configured: true,
        keyPresent: true,
        filePresent: true,
        uploadedAt: saved.uploadedAt,
        keyLast4: saved.configKey.slice(-4),
        lastVerifiedAt: saved.lastVerifiedAt || null,
        requestedMode: saved.requestedMode || 'off',
        effectiveMode: 'off'
      }
    })
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'Configuration file exceeds the 500 KB limit.' })
    }
    logger.error({ err }, 'Failed to upload institution SEB configuration')
    next(err)
  }
}

/**
 * Returns current status of institution SEB configuration.
 * GET /api/v1/admin/seb/status
 */
async function getSebStatus(req, res, next) {
  try {
    const bypassCache = req?.query?.refresh === 'true'
    const state = await getInstitutionSebState({ bypassCache })
    const sebConfig = await settingsService.getSebConfig().catch(() => null)

    return res.status(200).json({
      configured: state.configured,
      keyPresent: state.keyPresent,
      filePresent: state.filePresent,
      uploadedAt: sebConfig?.uploadedAt || null,
      keyLast4: state.keyLast4,
      lastVerifiedAt: state.lastVerifiedAt,
      lastVerifiedMethod: state.lastVerifiedMethod || sebConfig?.lastVerifiedMethod || null,
      lastVerifiedUserAgent: state.lastVerifiedUserAgent || sebConfig?.lastVerifiedUserAgent || null,
      requestedMode: state.requestedMode,
      effectiveMode: state.effectiveMode,
      enforcementReason: state.enforcementReason,
      publicOrigin: state.publicOrigin
    })
  } catch (err) {
    logger.error({ err }, 'Failed to get SEB configuration status')
    next(err)
  }
}

/**
 * Updates requested enforcement mode (off | audit | enforce).
 * PATCH /api/v1/admin/seb/mode
 */
async function updateSebMode(req, res, next) {
  try {
    const rawMode = req.body?.mode
    const targetMode = typeof rawMode === 'string' ? rawMode.toLowerCase().trim() : ''

    if (!['off', 'audit', 'enforce'].includes(targetMode)) {
      return res.status(400).json({
        code: 'INVALID_MODE',
        message: 'Mode must be one of: "off", "audit", or "enforce".'
      })
    }

    const sebConfig = await settingsService.getSebConfig()
    if (!sebConfig || !sebConfig.configKey) {
      return res.status(400).json({
        code: 'SEB_NOT_CONFIGURED',
        message: 'Safe Exam Browser configuration must be uploaded before changing mode.'
      })
    }

    if (targetMode === 'enforce') {
      const lastVerifiedAt = sebConfig.lastVerifiedAt
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const isVerifiedRecent = lastVerifiedAt && new Date(lastVerifiedAt).getTime() >= sevenDaysAgo
      if (!isVerifiedRecent) {
        return res.status(400).json({
          code: 'SEB_NOT_VERIFIED',
          message: 'Cannot enable enforcement: Safe Exam Browser setup has not been verified within the last 7 days. Complete "Test my setup" first.'
        })
      }
    }

    await settingsService.saveSebConfig({
      ...sebConfig,
      requestedMode: targetMode
    })
    invalidateInstitutionSebState()

    const state = await getInstitutionSebState({ bypassCache: true })
    return res.status(200).json({
      success: true,
      requestedMode: state.requestedMode,
      effectiveMode: state.effectiveMode,
      enforcementReason: state.enforcementReason
    })
  } catch (err) {
    logger.error({ err }, 'Failed to update SEB mode')
    next(err)
  }
}

/**
 * Removes institution SEB configuration.
 * DELETE /api/v1/admin/seb/config
 */
async function deleteSebConfig(_req, res, next) {
  try {
    const existing = await settingsService.getSebConfig()
    if (existing?.fileKey) {
      try {
        const storage = getStorageAdapter()
        await storage.deleteObject(existing.fileKey)
      } catch (storageErr) {
        logger.warn({ storageErr }, 'Could not delete .seb file from storage adapter')
      }
    }

    await settingsService.deleteSebConfig()
    invalidateInstitutionSebState()
    return res.status(200).json({ success: true })
  } catch (err) {
    logger.error({ err }, 'Failed to delete SEB configuration')
    next(err)
  }
}

module.exports = {
  upload,
  uploadSebConfig,
  getSebStatus,
  updateSebMode,
  deleteSebConfig,
  inspectSebBuffer,
  inspectConfig,
  getStarterConfig,
  getRecentAttempts
}
