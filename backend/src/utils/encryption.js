const crypto = require('crypto')

// Master pepper for short-code hashing and session key encryption
const AGENT_SECRET_PEPPER = process.env.AGENT_PEPPER || process.env.JWT_SECRET || 'proctornet-agent-pepper-default-32ch'
const ENCRYPTION_KEY = crypto.createHash('sha256').update(AGENT_SECRET_PEPPER).digest() // 32 bytes for AES-256

/**
 * Generate unambiguous 8-character pairing code (Crockford base32 inspired)
 * Alphabet: [2-9A-HJ-NP-Z] (excludes ambiguous characters 0, O, 1, I, L)
 */
const CROCKFORD_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function generatePairingCode(length = 8) {
  const bytes = crypto.randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CROCKFORD_CHARS[bytes[i] % CROCKFORD_CHARS.length]
  }
  return code
}

/**
 * Hash pairing code with pepper (HMAC-SHA256)
 */
function hashPairingCode(code) {
  const normalized = String(code).trim().toUpperCase()
  return crypto.createHmac('sha256', AGENT_SECRET_PEPPER).update(normalized).digest('hex')
}

/**
 * Encrypt session key at rest with AES-256-GCM
 */
function encryptSessionKey(sessionKeyBase64) {
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(sessionKeyBase64, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

/**
 * Decrypt session key at rest with AES-256-GCM
 */
function decryptSessionKey(encryptedString) {
  const [ivHex, tagHex, encryptedHex] = encryptedString.split(':')
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted session key format')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Compute HMAC-SHA256 signature for agent reports
 */
function computeReportSignature(sessionKeyBase64, method, path, seq, ts, nonce, bodyString) {
  const sessionKey = Buffer.from(sessionKeyBase64, 'base64')
  const bodySha256 = crypto.createHash('sha256').update(bodyString || '').digest('hex')
  const canonical = `${method}\n${path}\n${seq}\n${ts}\n${nonce}\n${bodySha256}`
  return crypto.createHmac('sha256', sessionKey).update(canonical).digest('base64')
}

/**
 * Constant-time signature verification
 */
function verifyReportSignature(sessionKeyBase64, method, path, seq, ts, nonce, bodyString, providedSignature) {
  if (!providedSignature) return false
  const expectedSignature = computeReportSignature(sessionKeyBase64, method, path, seq, ts, nonce, bodyString)
  const expectedBuf = Buffer.from(expectedSignature, 'base64')
  const providedBuf = Buffer.from(providedSignature, 'base64')
  if (expectedBuf.length !== providedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

/**
 * Ed25519 Keypair for Policy Signing
 * Uses env keys in production or stable default keypair in dev/test
 */
const DEFAULT_POLICY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAQGGWKC1CGfTGXuD773U8JsQIQyeoWiO+DnBffmkFJd0=\n-----END PUBLIC KEY-----\n`
const DEFAULT_POLICY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIJ2Tttu9NqOUlzAkAHAbbyGyRV52OWea8E7gX2sTQDn1\n-----END PRIVATE KEY-----\n`

let policyKeyPair = null

function getPolicyKeyPair() {
  if (!policyKeyPair) {
    if (process.env.AGENT_POLICY_PRIVATE_KEY && process.env.AGENT_POLICY_PUBLIC_KEY) {
      policyKeyPair = {
        publicKey: process.env.AGENT_POLICY_PUBLIC_KEY,
        privateKey: process.env.AGENT_POLICY_PRIVATE_KEY
      }
    } else {
      policyKeyPair = {
        publicKey: DEFAULT_POLICY_PUBLIC_KEY,
        privateKey: DEFAULT_POLICY_PRIVATE_KEY
      }
    }
  }
  return policyKeyPair
}

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(obj[k])).join(',') + '}'
}

function signPolicyBundle(bundleObject) {
  const { privateKey } = getPolicyKeyPair()
  const data = Buffer.from(canonicalizeJson(bundleObject), 'utf8')
  return crypto.sign(null, data, privateKey).toString('base64')
}

function verifyPolicySignature(bundleObject, signatureBase64, publicKeyPem) {
  const pubKey = publicKeyPem || getPolicyKeyPair().publicKey
  const data = Buffer.from(canonicalizeJson(bundleObject), 'utf8')
  const signature = Buffer.from(signatureBase64, 'base64')
  return crypto.verify(null, data, pubKey, signature)
}

module.exports = {
  generatePairingCode,
  hashPairingCode,
  encryptSessionKey,
  decryptSessionKey,
  computeReportSignature,
  verifyReportSignature,
  getPolicyKeyPair,
  signPolicyBundle,
  verifyPolicySignature
}
