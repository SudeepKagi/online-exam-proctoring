const { verifyToken } = require('../utils/jwt')
const { extractTokenFromReq } = require('../utils/cookies')

/**
 * auth.middleware.js
 * Verifies authentication JWT from secure HttpOnly cookie (or Bearer header fallback).
 * Attaches decoded payload to req.user.
 */
function authenticate(req, res, next) {
  try {
    const token = extractTokenFromReq(req)
    if (!token) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }

    const decoded = verifyToken(token)
    req.user = decoded   // { id, role, examId?, iat, exp }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't block if missing.
 * Useful for routes that have slightly different behaviour for logged-in users.
 */
function optionalAuth(req, res, next) {
  try {
    const token = extractTokenFromReq(req)
    if (token) {
      req.user = verifyToken(token)
    }
  } catch { /* ignore */ }
  next()
}

module.exports = { authenticate, optionalAuth }

