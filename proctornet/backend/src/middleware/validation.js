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
      if (err.errors) {
        const details = err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
        return next(new ValidationError('Request validation failed', details))
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

