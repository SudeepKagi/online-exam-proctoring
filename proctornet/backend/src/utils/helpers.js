const crypto = require('crypto')

/**
 * Generate invigilator credentials for an exam.
 * invId     = "INV-" + 6 random uppercase alphanumeric chars
 * invPass   = 8 random alphanumeric chars (shown once to faculty)
 */
function generateInvCredentials() {
  const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const idPart = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')

  const passChars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const password  = Array.from({ length: 8 }, () =>
    passChars[Math.floor(Math.random() * passChars.length)]
  ).join('')

  return {
    invId:       `INV-${idPart}`,
    invPassword: password,
  }
}

/**
 * Generate a cryptographically random watermark seed string.
 */
function generateWatermarkSeed() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Extract IP address from request, handling proxies.
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/**
 * Create a standardised API error object.
 */
function createError(message, statusCode = 400) {
  const err = new Error(message)
  err.status = statusCode
  return err
}

/**
 * Paginate a Prisma query result.
 * @param {number} page   - 1-indexed
 * @param {number} limit  - items per page
 */
function paginate(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page))
  const l = Math.min(100, Math.max(1, parseInt(limit)))
  return { skip: (p - 1) * l, take: l, page: p, limit: l }
}

module.exports = {
  generateInvCredentials,
  generateWatermarkSeed,
  getClientIp,
  createError,
  paginate,
}
