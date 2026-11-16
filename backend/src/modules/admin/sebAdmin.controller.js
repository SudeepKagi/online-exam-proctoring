'use strict'

const multer = require('multer')
const { settingsService } = require('./settings.service')
const { getStorageAdapter } = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')
const { getInstitutionSebState, invalidateInstitutionSebState } = require('../seb/seb.service')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 // 500 KB limit
  }
})

function inspectSebBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file' }
  }

  // 1. Check for XML plist (unencrypted)
  const prefixStr = buffer.slice(0, 50).toString('utf8').trim()
  const isXml = prefixStr.startsWith('<?xml') || prefixStr.startsWith('<plist')
  if (isXml) {
    return {
      valid: true,
      unencrypted: true,
      warning: 'The uploaded .seb file appears to be unencrypted. For maximum security, protect the configuration with a settings password or encrypt it in the SEB Configuration Tool.'
    }
  }

  // 2. Check for SEB magic bytes / encrypted container
  // Encrypted SEB headers: 'seb\0' (0x73 0x65 0x62 0x00) or gzip (0x1f 0x8b) or binary plist ('bplist00')
  const isSebMagic = buffer[0] === 0x73 && buffer[1] === 0x65 && buffer[2] === 0x62 && buffer[3] === 0x00
  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b
  const isBplist = buffer.slice(0, 8).toString('utf8') === 'bplist00'

  if (isSebMagic || isGzip || isBplist) {
    return {
      valid: true,
      unencrypted: false,
      warning: null
    }
  }

  // Also check if text content inside looks like an XML plist even without standard header
  const sample = buffer.slice(0, 500).toString('utf8')
  if (sample.includes('<plist') || sample.includes('<!DOCTYPE plist')) {
    return {
      valid: true,
      unencrypted: true,
      warning: 'The uploaded .seb file appears to be unencrypted. For maximum security, protect the configuration with a settings password or encrypt it in the SEB Configuration Tool.'
    }
  }

  return {
    valid: false,
    error: 'The uploaded file does not match a valid Safe Exam Browser configuration format.'
  }
}

async function uploadSebConfig(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'FILE_REQUIRED', message: 'A .seb configuration file is required.' })
    }

    const originalName = (req.file.originalname || '').toLowerCase()
    if (!originalName.endsWith('.seb')) {
      return res.status(400).json({ code: 'INVALID_FILE_EXTENSION', message: 'File must have a .seb extension.' })
    }

    const inspection = inspectSebBuffer(req.file.buffer)
    if (!inspection.valid) {
      return res.status(400).json({ code: 'INVALID_SEB_FILE', message: inspection.error })
    }

    const rawKey = req.body?.configKey
    const trimmedKey = typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : ''
    if (!trimmedKey || !/^[0-9a-f]{64}$/.test(trimmedKey)) {
      return res.status(400).json({ code: 'INVALID_CONFIG_KEY', message: 'Config Key must be a 64-character hexadecimal string.' })
    }

    // Save to S3 first (no key stored in metadata)
    const fileKey = 'seb/institution-config.seb'
    const storage = getStorageAdapter()
    await storage.putObject(fileKey, req.file.buffer, 'application/seb')

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
      warning: inspection.warning || null,
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
  deleteSebConfig,
  inspectSebBuffer
}

