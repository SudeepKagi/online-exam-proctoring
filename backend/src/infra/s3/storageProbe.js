'use strict'

const crypto = require('crypto')
const { getStorageAdapter } = require('./s3.client')
const { logger } = require('../../shared/logging')

let latestStorageHealth = {
  status: 'Pending',
  ok: false,
  bucket: process.env.S3_BUCKET || 'unknown',
  region: process.env.AWS_REGION || 'unknown',
  lastCheckedAt: null,
  error: null
}

/**
 * Runs a put, get, delete probe under probe/
 * Never throws — returns a structured health status object.
 */
async function runStorageProbe() {
  const storage = getStorageAdapter()
  const bucket = storage.bucket || process.env.S3_BUCKET || 'unknown'
  const region = storage.region || process.env.AWS_REGION || 'unknown'
  const probeId = crypto.randomUUID().slice(0, 8)
  const probeKey = `probe/startup-${Date.now()}-${probeId}.json`
  const probePayload = JSON.stringify({ probe: true, timestamp: Date.now(), probeId })

  try {
    // 1. Put tiny probe object
    await storage.putObject(probeKey, Buffer.from(probePayload, 'utf8'), 'application/json')

    // 2. Read back and verify
    const fetchedBuf = await storage.getObjectBuffer(probeKey)
    const parsed = JSON.parse(fetchedBuf.toString('utf8'))
    if (!parsed || parsed.probeId !== probeId) {
      throw new Error('Storage probe verification mismatch: fetched data did not match written probe.')
    }

    // 3. Clean up probe object
    await storage.deleteObject(probeKey)

    latestStorageHealth = {
      status: 'OK',
      ok: true,
      bucket,
      region,
      lastCheckedAt: new Date().toISOString(),
      error: null
    }

    return latestStorageHealth
  } catch (err) {
    // Try best-effort cleanup
    try { await storage.deleteObject(probeKey) } catch (_) {}

    latestStorageHealth = {
      status: 'Down',
      ok: false,
      bucket,
      region,
      lastCheckedAt: new Date().toISOString(),
      error: err.message || 'Storage probe encountered an error'
    }

    return latestStorageHealth
  }
}

function getStorageHealth() {
  return latestStorageHealth
}

/**
 * Startup hook executed when the backend boots.
 * In production: runs probe immediately, logs OK or FAILED, never crashes the app.
 */
function initStartupStorageProbe() {
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd && process.env.ENABLE_STORAGE_PROBE !== 'true') {
    latestStorageHealth = {
      status: 'OK',
      ok: true,
      bucket: process.env.S3_BUCKET || 'local-mock',
      region: process.env.AWS_REGION || 'local',
      lastCheckedAt: new Date().toISOString(),
      error: null
    }
    return Promise.resolve(latestStorageHealth)
  }

  return runStorageProbe()
    .then((health) => {
      if (health.ok) {
        logger.info({ bucket: health.bucket, region: health.region }, 'Storage startup probe: OK')
      } else {
        logger.error({ bucket: health.bucket, error: health.error }, '🚨 Storage startup probe: FAILED')
      }
      return health
    })
    .catch((err) => {
      // Defensive fallback — startup probe must NEVER crash the server
      logger.error({ err: err.message }, '🚨 Storage startup probe error handler caught exception')
      latestStorageHealth = {
        status: 'Down',
        ok: false,
        bucket: process.env.S3_BUCKET || 'unknown',
        region: process.env.AWS_REGION || 'unknown',
        lastCheckedAt: new Date().toISOString(),
        error: err.message
      }
      return latestStorageHealth
    })
}

module.exports = {
  runStorageProbe,
  getStorageHealth,
  initStartupStorageProbe
}
