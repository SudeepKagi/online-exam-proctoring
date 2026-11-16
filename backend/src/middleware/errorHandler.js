const crypto = require('crypto')
const { toErrorEnvelope } = require('../shared/errors')
const { logger, scrubSebString } = require('../shared/logging')

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || (err.status ? err.status : 500)
  const requestId = req.requestId || req.headers?.['x-request-id'] || crypto.randomUUID()

  // Storage failure mapping
  const rawMsg = err?.message || ''
  const isStorageError =
    err?.isStorageError ||
    err?.code === 'STORAGE_UNAVAILABLE' ||
    err?.name === 'NoSuchBucket' ||
    err?.name === 'EndpointConnectionError' ||
    (err?.code === 'ECONNREFUSED' && (rawMsg.includes('9000') || err?.port === 9000 || rawMsg.includes('s3') || rawMsg.includes('storage'))) ||
    err?.$metadata?.service === 'S3' ||
    (err?.syscall === 'connect' && (err?.address === '127.0.0.1' || err?.port === 9000))

  if (isStorageError) {
    statusCode = 503
    err.code = 'STORAGE_UNAVAILABLE'
    if (!err.retryAfter) {
      err.retryAfter = 5
    }
  }

  if (err.retryAfter) {
    res.set('Retry-After', String(err.retryAfter))
  }

  const safeMessage = scrubSebString(err?.message)
  const safeStack = scrubSebString(err?.stack)

  if (statusCode >= 500) {
    logger.error({
      requestId,
      error: safeMessage,
      stack: safeStack,
      path: req.path,
      method: req.method
    }, 'Internal Server Error')
  } else {
    logger.warn({
      requestId,
      code: err?.code,
      error: safeMessage,
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
