const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { verifyPolicyBundle, canonicalizeJson } = require('../src/policy')
const { POLICY_PUBLIC_KEYS } = require('../src/config')

// Development private key corresponding to POLICY_PUBLIC_KEYS[0]
const DEV_POLICY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIJ2Tttu9NqOUlzAkAHAbbyGyRV52OWea8E7gX2sTQDn1\n-----END PRIVATE KEY-----\n`

describe('Policy Bundle Cryptographic Verification (Ed25519)', () => {
  it('correctly verifies authentic signed policy bundle against embedded root key', () => {
    const bundle = {
      version: 1,
      issuedAt: '2026-10-07T00:00:00.000Z',
      rules: [
        { id: 'r-remote-anydesk', category: 'REMOTE_ACCESS', name: 'AnyDesk' }
      ],
      heartbeatMs: 15000,
      minAgentVersion: '1.0.0'
    }

    const canonicalData = Buffer.from(canonicalizeJson(bundle), 'utf8')
    const signatureBase64 = crypto.sign(null, canonicalData, DEV_POLICY_PRIVATE_KEY).toString('base64')

    const isValid = verifyPolicyBundle(bundle, signatureBase64, POLICY_PUBLIC_KEYS[0])
    assert.equal(isValid, true, 'Authentic signature must verify')
  })

  it('rejects tampered policy bundle where rules or version was altered', () => {
    const originalBundle = {
      version: 1,
      rules: [{ id: 'r-remote-anydesk' }]
    }
    const signatureBase64 = crypto.sign(null, Buffer.from(canonicalizeJson(originalBundle), 'utf8'), DEV_POLICY_PRIVATE_KEY).toString('base64')

    // Tampered bundle
    const tamperedBundle = {
      version: 1,
      rules: [] // Attacker stripped rules
    }

    const isValid = verifyPolicyBundle(tamperedBundle, signatureBase64, POLICY_PUBLIC_KEYS[0])
    assert.equal(isValid, false, 'Tampered policy bundle must fail verification')
  })

  it('canonicalizeJson provides deterministic ordering regardless of key insertion order', () => {
    const objA = { z: 1, a: 2, m: { y: 3, x: 4 } }
    const objB = { a: 2, z: 1, m: { x: 4, y: 3 } }

    assert.equal(canonicalizeJson(objA), canonicalizeJson(objB))
  })
})
