/**
 * authentication.js
 * Primary authentication middleware for ProctorNet API routes (Phase S2 Stabilization).
 * Validates access token and verifies active session state via tokenService.
 */

const { tokenService } = require('../modules/auth/tokenService')
const { UnauthorizedError } = require('../shared/errors')
const { normalizeRole } = require('../shared/roles')

async function authenticate(req, res, next) {
  try {
    const token = tokenService.extractAccessToken(req)
    if (!token) {
      throw new UnauthorizedError('Authentication token missing or invalid')
    }

    let decoded
    try {
      decoded = tokenService.verifyAccessToken(token)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const error = new UnauthorizedError('Session expired, please re-authenticate')
        error.code = 'TOKEN_EXPIRED'
        return next(error)
      }
      return next(new UnauthorizedError('Invalid authentication signature'))
    }

    if (!decoded || !decoded.id || !decoded.role) {
      throw new UnauthorizedError('Malformed authentication credentials')
    }

    const role = normalizeRole(decoded.role)
    if (!role) {
      throw new UnauthorizedError('Invalid user role in credentials')
    }

    // Fast-path server-side session revocation & epoch check (TTL <= 30s)
    if (decoded.sid) {
      const validation = await tokenService.validateSession(decoded.sid, decoded.epoch)
      if (!validation.valid) {
        const error = new UnauthorizedError('Session has been revoked or expired')
        error.code = 'SESSION_REVOKED'
        return next(error)
      }
    }

    req.user = {
      id: decoded.id,
      role,
      sid: decoded.sid || null,
      familyId: decoded.familyId || null,
      email: decoded.email,
      name: decoded.name,
      departmentCode: decoded.departmentCode,
      semester: decoded.semester,
      examId: decoded.examId || null
    }

    next()
  } catch (err) {
    next(err)
  }
}

authenticate.isAuthMiddleware = true

module.exports = {
  authenticate,
  requireAuth: authenticate
}
