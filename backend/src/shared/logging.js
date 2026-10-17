/**
 * Standard structured logger
 */
const logger = {
  info: (meta, msg) => console.log(JSON.stringify({ level: 'info', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) })),
  warn: (meta, msg) => console.warn(JSON.stringify({ level: 'warn', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) })),
  error: (meta, msg) => console.error(JSON.stringify({ level: 'error', msg: msg || meta, ...(typeof meta === 'object' ? meta : {}) })),
  debug: () => {}
}

const httpLogger = (req, res, next) => next()
const requestContextMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `req-${Date.now()}`
  next()
}

module.exports = {
  logger,
  httpLogger,
  requestContextMiddleware
}
