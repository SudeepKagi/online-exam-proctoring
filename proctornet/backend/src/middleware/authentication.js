const jwt = require('jsonwebtoken')
const config = require('../shared/config')
const { UnauthorizedError } = require('../shared/errors')
const { extractTokenFromReq } = require('../utils/cookies')

const { ROLES, normalizeRole } = require('../shared/roles')

function authenticate(req, res, next) {
  try {
    const token = extractTokenFromReq(req)
    if (!token) {
      throw new UnauthorizedError('Authentication token missing or invalid')
    }

    const decoded = jwt.verify(token, config.jwtSecret)
    if (!decoded || !decoded.id || !decoded.role) {
      throw new UnauthorizedError('Malformed authentication credentials')
    }

    const role = normalizeRole(decoded.role)
    if (!role) {
      throw new UnauthorizedError('Invalid user role in credentials')
    }

    req.user = {
      id: decoded.id,
      role,
      email: decoded.email,
      name: decoded.name,
      departmentCode: decoded.departmentCode,
      semester: decoded.semester,
      examId: decoded.examId || null
    }

    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Session expired, please re-authenticate'))
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid authentication signature'))
    }
    next(err)
  }
}

authenticate.isAuthMiddleware = true

module.exports = {
  authenticate,
  requireAuth: authenticate
}
