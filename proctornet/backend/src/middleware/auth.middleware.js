/**
 * auth.middleware.js
 * Verification middleware delegating to tokenService (Phase S2 Stabilization).
 */

const { tokenService } = require('../modules/auth/tokenService')
const { normalizeRole } = require('../shared/roles')

async function authenticate(req, res, next) {
  try {
    const token = tokenService.extractAccessToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'UNAUTHORIZED' })
    }

    let decoded
    try {
      decoded = tokenService.verifyAccessToken(token)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'TOKEN_EXPIRED' })
      }
      return res.status(401).json({ error: 'Invalid authentication credentials.', code: 'INVALID_TOKEN' })
    }

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ error: 'Malformed authentication credentials.', code: 'INVALID_TOKEN' })
    }

    const role = normalizeRole(decoded.role)
    if (!role) {
      return res.status(401).json({ error: 'Invalid user role in credentials.', code: 'INVALID_ROLE' })
    }

    if (decoded.sid) {
      const validation = await tokenService.validateSession(decoded.sid, decoded.epoch)
      if (!validation.valid) {
        return res.status(401).json({ error: 'Your session has been terminated or revoked.', code: 'SESSION_REVOKED' })
      }
    }

    req.user = {
      ...decoded,
      role,
      examId: decoded.examId || null
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'UNAUTHORIZED' })
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = tokenService.extractAccessToken(req)
    if (token) {
      req.user = tokenService.verifyAccessToken(token)
    }
  } catch { /* ignore */ }
  next()
}

module.exports = { authenticate, optionalAuth }
