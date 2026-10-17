const pino = require('pino')
const pinoHttp = require('pino-http')
const crypto = require('crypto')
const { asyncLocalStorage } = require('./context')

const isProduction = process.env.NODE_ENV === 'production'

const SENSITIVE_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-agent-signature"]',
  'req.headers["x-agent-session"]',
  'req.headers["x-agent-nonce"]',
  'req.headers["x-agent-ts"]',
  'req.body.password',
  'req.body.token',
  'req.body.sessionToken',
  'req.body.sessionKey',
  'req.body.code',
  '*.password',
  '*.token',
  '*.sessionToken',
  '*.sessionKey',
  '*.sessionKeyEnc',
  '*.code',
  '*.pairingCode',
  '*.signature'
]

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: SENSITIVE_REDACT_PATHS,
    censor: '[REDACTED]'
  },
  formatters: {
    level(label) {
      return { level: label }
    },
  },
})

const httpLogger = pinoHttp({
  logger,
  redact: {
    paths: SENSITIVE_REDACT_PATHS,
    censor: '[REDACTED]'
  },
  genReqId(req) {
    return req.headers['x-request-id'] || req.headers['x-correlation-id'] || crypto.randomUUID()
  },
  customProps(req) {
    return {
      requestId: req.id,
      userId: req.user?.id || null,
      role: req.user?.role || null,
    }
  },
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return 'error'
    if (res.statusCode >= 400) return 'warn'
    if (req.url === '/health' || req.url === '/metrics') return 'silent'
    return 'info'
  },
})

function requestContextMiddleware(req, res, next) {
  httpLogger(req, res)
  const requestId = req.id || req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('X-Request-Id', requestId)

  const store = {
    requestId,
    startTime: Date.now(),
    url: req.originalUrl || req.url,
    method: req.method,
  }

  asyncLocalStorage.run(store, () => {
    next()
  })
}

module.exports = {
  logger,
  httpLogger,
  requestContextMiddleware,
  SENSITIVE_REDACT_PATHS
}
