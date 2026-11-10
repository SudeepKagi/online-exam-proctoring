'use strict'

const crypto = require('crypto')
const config = require('../../shared/config')

function getSecret() {
  const secret = config.sebLinkSecret || process.env.SEB_LINK_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SEB_LINK_SECRET is required in production')
    }
    return 'dev_seb_link_secret_at_least_32_characters_long_for_hmac'
  }
  return secret
}

function generateSebLaunchToken({ userId, role, examId = null, expMinutes = 10 }) {
  if (!userId) throw new Error('userId is required to generate launch token')
  const secret = getSecret()
  const exp = Math.floor(Date.now() / 1000) + (expMinutes * 60)
  const payload = {
    uid: String(userId),
    role: String(role || 'STUDENT').toUpperCase(),
    examId: examId ? String(examId) : null,
    exp
  }

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url')
  return `${payloadStr}.${signature}`
}

function verifySebLaunchToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'MISSING_TOKEN' }
  }

  // Strip .seb suffix if included in token string
  const token = rawToken.replace(/\.seb$/i, '')
  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'MALFORMED_TOKEN' }
  }

  const [payloadStr, signature] = parts
  const secret = getSecret()

  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url')

  const sigBuf = Buffer.from(signature, 'utf8')
  const expBuf = Buffer.from(expectedSignature, 'utf8')

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'INVALID_SIGNATURE' }
  }

  let payload
  try {
    const jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf8')
    payload = JSON.parse(jsonStr)
  } catch (_) {
    return { valid: false, error: 'INVALID_PAYLOAD' }
  }

  if (!payload.exp || (payload.exp * 1000) < Date.now()) {
    return { valid: false, error: 'TOKEN_EXPIRED', payload }
  }

  return { valid: true, payload }
}

module.exports = {
  generateSebLaunchToken,
  verifySebLaunchToken,
  getSecret
}

