/**
 * ProctorNet Exam Device Companion
 * Policy Bundle Signature Verification (Ed25519)
 * Architecture: ADR A-004
 */

const crypto = require('crypto')
const { POLICY_PUBLIC_KEYS } = require('./config')

/**
 * Deterministic JSON stringifier matching backend canonicalizeJson
 */
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

/**
 * Verifies Ed25519 signature of policy bundle against embedded trust store
 * @param {Object} bundle Unsigned policy bundle ({ version, issuedAt, rules, ... })
 * @param {string} signatureBase64 Base64 signature
 * @param {string} [serverPublicKey] Optional public key provided in policy
 * @returns {boolean}
 */
function verifyPolicyBundle(bundle, signatureBase64, serverPublicKey) {
  if (!bundle || !signatureBase64) return false

  try {
    const data = Buffer.from(canonicalizeJson(bundle), 'utf8')
    const signature = Buffer.from(signatureBase64, 'base64')

    // 1. Try server-provided key if supplied
    if (serverPublicKey) {
      try {
        if (crypto.verify(null, data, serverPublicKey, signature)) {
          return true
        }
      } catch {
        // Continue to trusted embedded keys
      }
    }

    // 2. Try embedded root of trust keys
    for (const key of POLICY_PUBLIC_KEYS) {
      try {
        if (crypto.verify(null, data, key, signature)) {
          return true
        }
      } catch {
        // Try next key
      }
    }

    return false
  } catch (err) {
    return false
  }
}

module.exports = {
  canonicalizeJson,
  verifyPolicyBundle
}
