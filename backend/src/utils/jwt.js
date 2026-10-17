const { authService } = require('../modules/auth/auth.service')
const jwt = require('jsonwebtoken')

function signToken(payload, expiresIn = '15m') {
  const secret = process.env.JWT_SECRET || 'proctornet_super_secret_jwt_key_local_development_fallback_2026'
  return jwt.sign(payload, secret, { expiresIn })
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
