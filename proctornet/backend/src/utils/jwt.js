const jwt = require('jsonwebtoken')

const SECRET     = process.env.JWT_SECRET || 'fallback_secret'
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/**
 * Sign a JWT token
 * @param {object} payload - { id, role, examId? }
 * @param {string} expiresIn - override default expiry
 */
function signToken(payload, expiresIn = EXPIRES_IN) {
  return jwt.sign(payload, SECRET, { expiresIn })
}

/**
 * Verify a JWT token
 * @returns decoded payload or throws error
 */
function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

/**
 * Decode without verifying (for logging only)
 */
function decodeToken(token) {
  return jwt.decode(token)
}

module.exports = { signToken, verifyToken, decodeToken }
