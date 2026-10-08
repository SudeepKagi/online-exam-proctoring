/**
 * jwt.js
 * Legacy wrapper delegating exclusively to tokenService (Phase S2 / SES-01).
 * Hardcoded secrets and long-lived 7-day token defaults are removed.
 */

const { tokenService, ACCESS_TOKEN_TTL_SEC } = require('../modules/auth/tokenService')

function signToken(payload, expiresIn = ACCESS_TOKEN_TTL_SEC) {
  return tokenService.signAccessToken(payload, expiresIn)
}

function verifyToken(token) {
  return tokenService.verifyAccessToken(token)
}

function decodeToken(token) {
  const jwt = require('jsonwebtoken')
  return jwt.decode(token)
}

module.exports = {
  signToken,
  verifyToken,
  decodeToken
}
