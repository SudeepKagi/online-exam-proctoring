class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.status = statusCode
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', details = null) {
    super(message, 404, code, details)
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict or state violation', code = 'CONFLICT', details = null) {
    super(message, 409, code, details)
  }
}

class StaleRevisionError extends ConflictError {
  constructor(currentRevision, message = 'Revision conflict: optimistic lock failed') {
    super(message, 'STALE_REVISION', { currentRevision })
  }
}

class GoneError extends AppError {
  constructor(message = 'Examination window has expired', code = 'EXAM_EXPIRED', details = null) {
    super(message, 410, code, details)
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED', details = null) {
    super(message, 401, code, details)
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN', details = null) {
    super(message, 403, code, details)
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details = null) {
    super(message, 400, code, details)
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity', code = 'UNPROCESSABLE_ENTITY', details = null) {
    super(message, 422, code, details)
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please slow down', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter })
    this.retryAfter = retryAfter
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily overloaded, load shedding active', retryAfter = 5) {
    super(message, 503, 'SERVICE_UNAVAILABLE', { retryAfter })
    this.retryAfter = retryAfter
  }
}

const crypto = require('crypto')

function toErrorEnvelope(err, requestId = null) {
  const statusCode = err.statusCode || (err.status ? err.status : 500)
  const reqId = requestId || err.requestId || crypto.randomUUID()
  const isProd = process.env.NODE_ENV === 'production'

  const rawMsg = err.message || ''
  const isStorageError =
    err.isStorageError ||
    err.code === 'STORAGE_UNAVAILABLE' ||
    err.name === 'NoSuchBucket' ||
    err.name === 'EndpointConnectionError' ||
    (err.code === 'ECONNREFUSED' && (rawMsg.includes('9000') || err.port === 9000 || rawMsg.includes('s3') || rawMsg.includes('storage'))) ||
    err.$metadata?.service === 'S3' ||
    (err.syscall === 'connect' && (err.address === '127.0.0.1' || err.port === 9000))

  let code = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST')
  let message = err.message || (statusCode >= 500 ? 'An unexpected internal error occurred. Please try again.' : 'An error occurred')
  const details = err.details || (err.retryAfter ? { retryAfter: err.retryAfter } : [])

  if (isStorageError) {
    code = 'STORAGE_UNAVAILABLE'
    message = 'Storage service is temporarily unavailable. Please try again.'
  } else if (isProd && statusCode >= 500) {
    // In production, 5xx responses are generic and never include internal addresses, ports, or raw stacks
    code = err.code && !err.code.includes('ECONN') ? err.code : 'INTERNAL_SERVER_ERROR'
    message = 'An unexpected internal error occurred. Please try again.'
  } else if (statusCode === 503 || err.code === 'SERVICE_UNAVAILABLE') {
    code = err.code || 'SERVICE_UNAVAILABLE'
    message = isProd ? 'Service temporarily unavailable, please retry' : (err.message || 'Service temporarily unavailable, please retry')
  }

  return {
    code,
    message,
    details,
    error: {
      code,
      message,
      details
    },
    requestId: reqId
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ConflictError,
  StaleRevisionError,
  GoneError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  ValidationError,
  UnprocessableEntityError,
  TooManyRequestsError,
  ServiceUnavailableError,
  toErrorEnvelope
}
