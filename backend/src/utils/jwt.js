const config = require('../shared/config')
const { authService } = require('../modules/auth/auth.service')
const jwt = require('jsonwebtoken')

function signToken(payload, expiresIn = '15m') {
  return jwt.sign(payload, config.jwtSecret, { expiresIn })
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
