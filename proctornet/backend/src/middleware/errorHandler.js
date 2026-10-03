const { toErrorEnvelope } = require('../shared/errors')
const { logger } = require('../shared/logging')

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status ? err.status : 500)
  const requestId = req.requestId || req.headers['x-request-id'] || null

  if (statusCode >= 500) {
    logger.error({
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    }, 'Internal Server Error')
  } else {
    logger.warn({
      requestId,
      code: err.code,
      error: err.message,
      path: req.path,
      statusCode
    }, 'Handled client request error')
  }

  const envelope = toErrorEnvelope(err, requestId)
  res.status(statusCode).json(envelope)
}

module.exports = {
  errorHandler
}
