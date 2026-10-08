const { ValidationError } = require('../shared/errors')

/**
 * Validates request body, query, and params against provided Zod schemas
 */
function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params)
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query)
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body)
      }
      if (schemas.headers) {
        schemas.headers.parse(req.headers)
      }
      next()
    } catch (err) {
      const issues = err.issues || err.errors
      if (Array.isArray(issues) && issues.length > 0) {
        const details = issues.map(e => ({
          path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
          message: e.message
        }))
        const summary = details.map(d => `${d.path ? d.path + ': ' : ''}${d.message}`).join(', ')
        return next(new ValidationError(summary || 'Request validation failed', details))
      }
      if (typeof err.message === 'string' && err.message.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(err.message)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const details = parsed.map(e => ({
              path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
              message: e.message
            }))
            const summary = details.map(d => `${d.path ? d.path + ': ' : ''}${d.message}`).join(', ')
            return next(new ValidationError(summary || 'Request validation failed', details))
          }
        } catch {}
      }
      next(new ValidationError(err.message || 'Validation failed'))
    }
  }
}

function validateBody(schema) {
  return validate({ body: schema })
}

function validateParams(schema) {
  return validate({ params: schema })
}

function validateQuery(schema) {
  return validate({ query: schema })
}

function validateHeaders(schema) {
  return validate({ headers: schema })
}

module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders
}

