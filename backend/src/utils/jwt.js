const config = require('../shared/config')
const { authService } = require('../modules/auth/auth.service')
const jwt = require('jsonwebtoken')

function signToken(payload, expiresIn = '15m') {
  const secret = config.jwtSecret || process.env.JWT_SECRET || 'proctornet_super_secret_jwt_key_local_development_fallback_2026'
  const tokenPayload = (payload && payload.id && (payload.passwordHash || payload.profile || payload.createdAt))
    ? { sub: payload.id, id: payload.id, email: payload.email, role: payload.role, name: payload.name || payload.fullName }
    : payload
  return jwt.sign(tokenPayload, secret, { expiresIn })
}

function verifyToken(token) {
  return authService.verifyToken(token)
}

function decodeToken(token) {
  return jwt.decode(token)
}

module.exports = {
  signToken,
  verifyToken,
  decodeToken
}
