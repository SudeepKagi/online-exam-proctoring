const crypto = require('crypto')
const { logger } = require('../shared/logging')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Get the 32-byte PII encryption key from environment or fallback
 */
function getEncryptionKey() {
  const envKey = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET || 'proctornet_default_pii_encryption_key_32b!'
  return crypto.createHash('sha256').update(envKey).digest()
}

/**
 * Encrypt plaintext string using AES-256-GCM
 * Returns payload format: "iv_hex:authTag_hex:ciphertext_hex"
 */
function encryptText(plainText, key = getEncryptionKey()) {
  if (!plainText || typeof plainText !== 'string') return plainText
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(plainText, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to encrypt sensitive data')
    throw new Error('Encryption failure', { cause: err })
  }
}

/**
 * Decrypt AES-256-GCM payload formatted as "iv_hex:authTag_hex:ciphertext_hex"
 * Returns original plaintext string, or original input if not in encrypted format
 */
function decryptText(payload, key = getEncryptionKey()) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) return payload
  const parts = payload.split(':')
  if (parts.length !== 3) return payload

  try {
    const [ivHex, tagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return payload

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to decrypt text payload; returning raw payload')
    return payload
  }
}

module.exports = {
  encryptText,
  decryptText,
  getEncryptionKey
}

