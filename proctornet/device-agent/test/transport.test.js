const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { Transport } = require('../src/transport')

describe('Transport & HMAC-SHA256 Signing Vectors', () => {
  const sessionKey = crypto.randomBytes(32).toString('base64')
  const transport = new Transport('http://127.0.0.1:5000')

  it('computes HMAC signature matching the server specification', () => {
    const method = 'POST'
    const path = '/api/v1/agent/report'
    const seq = 1
    const ts = 1791364969072
    const nonce = 'b3c8a91f7028c544'
    const body = { seq: 1, findings: [] }
    const bodyStr = JSON.stringify(body)

    const sig = transport.computeSignature(sessionKey, method, path, seq, ts, nonce, bodyStr)
    assert.ok(sig)
    assert.equal(typeof sig, 'string')
    assert.ok(sig.length > 20)

    // Verify manually
    const keyBuffer = Buffer.from(sessionKey, 'base64')
    const bodySha256 = crypto.createHash('sha256').update(bodyStr).digest('hex')
    const expectedPayload = `${method}\n${path}\n${seq}\n${ts}\n${nonce}\n${bodySha256}`
    const expectedSig = crypto.createHmac('sha256', keyBuffer).update(expectedPayload, 'utf8').digest('base64')

    assert.equal(sig, expectedSig)
  })

  it('adjusts clock offset when server reports CLOCK_SKEW with authoritative serverTime', () => {
    const pastServerTime = new Date(Date.now() - 120000).toISOString() // Server is 2 mins behind
    transport.adjustClockOffset(pastServerTime)

    assert.ok(transport.clockOffsetMs <= -110000 && transport.clockOffsetMs >= -130000)

    const correctedTs = transport.getSkewCorrectedTimestamp()
    assert.ok(Math.abs(correctedTs - new Date(pastServerTime).getTime()) < 1000)
  })
})
