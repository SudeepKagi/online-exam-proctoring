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

function toErrorEnvelope(err, requestId = null) {
  const code = err.code || (err.statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR')
  const message = err.message || 'An unexpected error occurred'
  const envelope = {
    error: {
      code,
      message
    }
  }

  if (err.details) {
    envelope.error.details = err.details
  }

  if (requestId) {
    envelope.requestId = requestId
  }

  return envelope
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
