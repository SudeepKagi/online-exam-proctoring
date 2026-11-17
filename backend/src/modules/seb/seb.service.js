'use strict'

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
  const fileKey = sebConfig?.fileKey || 'seb/institution-config.seb'
  try {
    const storage = getStorageAdapter()
    const head = await storage.headObject(fileKey)
    filePresent = Boolean(head)
  } catch (_) {
    filePresent = false
  }

  // 3. Configured requires both key and file
  const configured = Boolean(keyPresent && filePresent)

  // 4. Verification and Enforcement Modes
  const lastVerifiedAt = sebConfig?.lastVerifiedAt || null
  const requestedMode = (sebConfig?.requestedMode || process.env.SEB_MODE || config.sebMode || 'off').toLowerCase().trim()

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
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    const isVerifiedRecent = lastVerifiedAt && new Date(lastVerifiedAt).getTime() >= sevenDaysAgo
    if (isVerifiedRecent) {
      effectiveMode = 'enforce'
    } else {
      effectiveMode = 'audit'
      enforcementReason = lastVerifiedAt
        ? 'Enforcement suspended: Last verified setup ping was over 7 days ago. Re-verify in Admin to re-enable.'
        : 'Enforcement suspended: Safe Exam Browser has not been verified yet. Complete "Test my setup" in Admin to enable enforcement.'
    }
  } else if (requestedMode === 'audit') {
    effectiveMode = 'audit'
  } else {
    effectiveMode = 'off'
  }

  const cleanPublicOrigin = config.publicOrigin || process.env.PUBLIC_ORIGIN || 'https://proctornet.duckdns.org'

  const state = {
    configured,
    keyPresent,
    filePresent,
    lastVerifiedAt,
    lastVerifiedMethod: sebConfig?.lastVerifiedMethod || null,
    lastVerifiedUserAgent: sebConfig?.lastVerifiedUserAgent || null,
    requestedMode,
    effectiveMode,
    enforcementReason,
    keyLast4: keyPresent ? resolvedKey.slice(-4) : null,
    configKey: keyPresent ? resolvedKey : null,
    fileKey: filePresent ? fileKey : null,
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
