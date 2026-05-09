const { verifyToken } = require('../utils/jwt')

/**
 * auth.middleware.js
 * Verifies the JWT token from the Authorization header.
 * Attaches decoded payload to req.user.
 */
function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please login.' })
    }

    const token   = header.split(' ')[1]
    const decoded = verifyToken(token)
    req.user = decoded   // { id, role, examId?, iat, exp }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please login again.' })
    }
    return res.status(401).json({ error: 'Invalid token. Please login.' })
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't block if missing.
 * Useful for routes that have slightly different behaviour for logged-in users.
 */
function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      req.user = verifyToken(header.split(' ')[1])
    }
  } catch { /* ignore */ }
  next()
}

module.exports = { authenticate, optionalAuth }
