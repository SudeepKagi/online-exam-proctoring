const crypto = require('crypto')

function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id']
  const requestId = (existingId && typeof existingId === 'string' && existingId.trim())
    ? existingId.trim()
    : crypto.randomUUID()

  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

module.exports = {
  requestIdMiddleware
}
