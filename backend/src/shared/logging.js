/**
 * Standard structured logger with SEB credential scrubbing & redaction
 */

const PINO_REDACT_PATHS = [
  'req.body.proctoringConfig.sebConfigKey',
  '*.proctoringConfig.sebConfigKey',
  'body.proctoringConfig.sebConfigKey',
  'proctoringConfig.sebConfigKey',
  'sebConfigKey',
  'req.headers.x-safeexambrowser-requesthash',
  'req.headers.x-safeexambrowser-configkeyhash',
  'headers.x-safeexambrowser-requesthash',
  'headers.x-safeexambrowser-configkeyhash'
]

function canLogFullSebHashes() {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.SEB_DEBUG_LOG_HASHES === 'true'
}

function scrubSebString(str) {
  if (typeof str !== 'string') return str
  if (canLogFullSebHashes()) return str
  return str.replace(/\b([0-9a-fA-F]{8})[0-9a-fA-F]{56}\b/g, '$1...')
}

function sanitizeLogPayload(obj) {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? scrubSebString(obj) : obj
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLogPayload(item))
  }
  const copy = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'sebconfigkey') {
      copy[key] = '[REDACTED]'
    } else if (lowerKey.startsWith('x-safeexambrowser-')) {
      copy[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      copy[key] = sanitizeLogPayload(value)
    } else if (typeof value === 'string') {
      copy[key] = scrubSebString(value)
    } else {
      copy[key] = value
    }
  }
  return copy
}

const logger = {
  info: (meta, msg) => console.log(JSON.stringify(sanitizeLogPayload({ level: 'info', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) }))),
  warn: (meta, msg) => console.warn(JSON.stringify(sanitizeLogPayload({ level: 'warn', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) }))),
  error: (meta, msg) => console.error(JSON.stringify(sanitizeLogPayload({ level: 'error', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) }))),
  debug: (meta, msg) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify(sanitizeLogPayload({ level: 'debug', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) })))
    }
  }
}

const httpLogger = (req, res, next) => next()
const requestContextMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `req-${Date.now()}`
  next()
}

module.exports = {
  logger,
  httpLogger,
  requestContextMiddleware,
  PINO_REDACT_PATHS,
  scrubSebString,
  sanitizeLogPayload
}
