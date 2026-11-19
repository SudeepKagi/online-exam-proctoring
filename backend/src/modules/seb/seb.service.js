'use strict'

const crypto = require('crypto')
const { settingsService } = require('../admin/settings.service')
const { getStorageAdapter } = require('../../infra/s3/s3.client')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

const CACHE_TTL_MS = 5000 // 5 seconds short TTL, avoids long-lived negative caching
let cachedState = null
let cacheExpiresAt = 0

function invalidateInstitutionSebState() {
  cachedState = null
  cacheExpiresAt = 0
}

/**
 * Returns unified institution-level Safe Exam Browser state:
 * - configured: boolean (both filePresent and keyPresent must be true)
 * - keyPresent: boolean (valid 64-hex hex string in DB or env)
 * - filePresent: boolean (.seb file exists in S3)
 * - lastVerifiedAt: string | null (ISO timestamp)
 * - requestedMode: 'off' | 'audit' | 'enforce'
 * - effectiveMode: 'off' | 'audit' | 'enforce' (enforce requires lastVerifiedAt within 7 days)
 */
async function getInstitutionSebState({ bypassCache = false } = {}) {
  const now = Date.now()
  if (!bypassCache && cachedState && cacheExpiresAt > now) {
    return cachedState
  }

  let sebConfig = null
  try {
    sebConfig = await settingsService.getSebConfig()
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to query SEB config from database')
  }

  // 1. Key presence check
  const dbKey = sebConfig?.configKey ? String(sebConfig.configKey).trim().toLowerCase() : null
  const envKey = process.env.SEB_CONFIG_KEY ? String(process.env.SEB_CONFIG_KEY).trim().toLowerCase() : null
  const resolvedKey = (dbKey && /^[0-9a-f]{64}$/.test(dbKey))
    ? dbKey
    : ((envKey && /^[0-9a-f]{64}$/.test(envKey)) ? envKey : null)
  const keyPresent = Boolean(resolvedKey)

  // 2. S3 File presence check
  let filePresent
  let fileEtag = null
  let storageUnavailable = false
  const fileKey = sebConfig?.fileKey || 'seb/institution-config.seb'
  try {
    const storage = getStorageAdapter()
    const head = await storage.headObject(fileKey)
    filePresent = Boolean(head)
    if (head) {
      fileEtag = head.ETag ? String(head.ETag).replace(/["']/g, '') : (head.LastModified ? String(new Date(head.LastModified).getTime()) : (head.size ? String(head.size) : 'active_file'))
    }
  } catch (err) {
    filePresent = false
    if (err && err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404 && err.code !== 'ENOENT') {
      storageUnavailable = true
    }
  }

  // 3. Configured requires both key and file
  const configured = Boolean(keyPresent && filePresent)
  const cleanPublicOrigin = config.publicOrigin || process.env.PUBLIC_ORIGIN || 'https://proctornet.duckdns.org'

  // 4. Config Versioning
  const configVersion = (keyPresent && filePresent)
    ? crypto.createHash('sha256').update(`${fileEtag || 'noetag'}:${resolvedKey}:${cleanPublicOrigin}`).digest('hex').slice(0, 16)
    : null
  const verifiedConfigVersion = sebConfig?.verifiedConfigVersion || null

  // 5. Verification and Enforcement Modes
  const lastVerifiedAt = sebConfig?.lastVerifiedAt || null
  const requestedMode = (sebConfig?.requestedMode || process.env.SEB_MODE || config.sebMode || 'off').toLowerCase().trim()

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const isTimeValid = Boolean(lastVerifiedAt && new Date(lastVerifiedAt).getTime() >= sevenDaysAgo)
  const isVersionValid = verifiedConfigVersion ? Boolean(configVersion && verifiedConfigVersion === configVersion) : true
  const isVerifiedRecent = isTimeValid && isVersionValid

  let effectiveMode
  let enforcementReason = null

  if (!configured) {
    effectiveMode = 'off'
    if (!keyPresent && !filePresent) {
      enforcementReason = 'Safe Exam Browser configuration file and Config Key are not uploaded.'
    } else if (!filePresent) {
      enforcementReason = 'Safe Exam Browser configuration file (.seb) is missing in object storage.'
    } else {
      enforcementReason = 'Safe Exam Browser 64-hex Config Key is not configured.'
    }
  } else if (requestedMode === 'enforce') {
    if (isVerifiedRecent) {
      effectiveMode = 'enforce'
    } else {
      effectiveMode = 'audit'
      if (!isVersionValid && verifiedConfigVersion) {
        enforcementReason = 'Enforcement suspended: Configuration file or key changed since last verification. Complete "Test my setup" in Admin to re-verify.'
      } else if (!isTimeValid && lastVerifiedAt) {
        enforcementReason = 'Enforcement suspended: Last verified setup ping was over 7 days ago. Re-verify in Admin to re-enable.'
      } else {
        enforcementReason = 'Enforcement suspended: Safe Exam Browser has not been verified yet. Complete "Test my setup" in Admin to enable enforcement.'
      }
    }
  } else if (requestedMode === 'audit') {
    effectiveMode = 'audit'
  } else {
    effectiveMode = 'off'
  }

  // Environment ceiling and emergency override (Phase 3 Requirement 5)
  // If the env explicitly specifies SEB_MODE, it acts as a ceiling and emergency override
  const rawEnvMode = process.env.SEB_MODE ? process.env.SEB_MODE.toLowerCase().trim() : null
  if (rawEnvMode === 'off') {
    effectiveMode = 'off'
    enforcementReason = 'Safe Exam Browser is disabled by server environment override (SEB_MODE=off).'
  } else if ((rawEnvMode === 'log' || rawEnvMode === 'audit') && effectiveMode === 'enforce') {
    effectiveMode = 'audit'
    enforcementReason = `Strict enforcement is restricted to audit mode by server environment ceiling (SEB_MODE=${rawEnvMode}).`
  }

  const state = {
    configured,
    keyPresent,
    filePresent,
    storageUnavailable,
    lastVerifiedAt,
    lastVerifiedMethod: sebConfig?.lastVerifiedMethod || null,
    lastVerifiedUserAgent: sebConfig?.lastVerifiedUserAgent || null,
    configVersion,
    verifiedConfigVersion,
    isVerifiedRecent,
    isVersionValid,
    requestedMode,
    effectiveMode,
    enforcementReason,
    keyLast4: keyPresent ? resolvedKey.slice(-4) : null,
    configKey: keyPresent ? resolvedKey : null,
    fileKey: filePresent ? fileKey : null,
    fileEtag,
    publicOrigin: cleanPublicOrigin
  }

  cachedState = state
  cacheExpiresAt = now + CACHE_TTL_MS

  return state
}

async function getInstitutionSebKey() {
  const state = await getInstitutionSebState()
  return state.configKey || null
}

module.exports = {
  getInstitutionSebState,
  invalidateInstitutionSebState,
  getInstitutionSebKey
}
