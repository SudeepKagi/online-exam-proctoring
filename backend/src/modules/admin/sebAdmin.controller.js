'use strict'

const multer = require('multer')
const { settingsService } = require('./settings.service')
const { getStorageAdapter } = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')

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

    // Save to S3 (no key stored in metadata)
    const fileKey = 'seb/institution-config.seb'
    const storage = getStorageAdapter()
    await storage.putObject(fileKey, req.file.buffer, 'application/seb')

    // Upsert into system settings
    const existing = await settingsService.getSebConfig()
    const saved = await settingsService.saveSebConfig({
      fileKey,
      configKey: trimmedKey,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: existing?.lastVerifiedAt || null
    })

    return res.status(200).json({
      success: true,
      warning: inspection.warning || null,
      status: {
        configured: true,
        uploadedAt: saved.uploadedAt,
        keyLast4: saved.configKey.slice(-4),
        lastVerifiedAt: saved.lastVerifiedAt || null
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

async function getSebStatus(_req, res, next) {
  try {
    const sebConfig = await settingsService.getSebConfig()
    if (sebConfig && sebConfig.configKey) {
      return res.status(200).json({
        configured: true,
        uploadedAt: sebConfig.uploadedAt || null,
        keyLast4: sebConfig.configKey.slice(-4),
        lastVerifiedAt: sebConfig.lastVerifiedAt || null
      })
    }

    // Fallback: check environment variable SEB_CONFIG_KEY
    const envKey = process.env.SEB_CONFIG_KEY ? process.env.SEB_CONFIG_KEY.trim() : null
    if (envKey && /^[0-9a-fA-F]{64}$/.test(envKey)) {
      return res.status(200).json({
        configured: true,
        uploadedAt: null,
        keyLast4: envKey.slice(-4),
        lastVerifiedAt: null
      })
    }

    return res.status(200).json({
      configured: false,
      uploadedAt: null,
      keyLast4: null,
      lastVerifiedAt: null
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

