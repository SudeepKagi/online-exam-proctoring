const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const collusionService = require('../src/services/collusionService')
const verificationService = require('../src/services/verificationService')

describe('Collusion Service', () => {
  it('calculates token similarity correctly for identical text', () => {
    const textA = 'The quick brown fox jumps over the lazy dog'
    const textB = 'The quick brown fox jumps over the lazy dog'
    const score = collusionService.calculateSimilarity(textA, textB)
    assert.strictEqual(score, 1)
  })

  it('calculates 0 similarity for completely disjoint strings', () => {
    const textA = 'abc'
    const textB = 'xyz'
    const score = collusionService.calculateSimilarity(textA, textB)
    assert.strictEqual(score, 0)
  })

  it('calculates edit distance correctly', () => {
    const dist = collusionService.editDistance('kitten', 'sitting')
    assert.strictEqual(dist, 3)
  })
})

describe('Verification Service (Fail-Closed Biometrics)', () => {
  it('fails closed when face service is offline or throws error', async () => {
    // When no Python microservice is reachable on bad port or invalid input, must fail closed
    const result = await verificationService.verifyFaceBiometrics({
      studentId: 'nonexistent-student',
      liveFrame: 'data:image/jpeg;base64,invalid'
    })

    assert.strictEqual(result.verified, false, 'Must fail closed (verified: false)')
    assert.strictEqual(result.matchScore, 0, 'Match score must be 0 on service failure')
    assert.ok(result.reason, 'Must provide fail-closed reason message')
  })

  it('fails closed when missing required live frame', async () => {
    const result = await verificationService.verifyFaceBiometrics({
      studentId: 'nonexistent-student',
      liveFrame: null
    })

    assert.strictEqual(result.verified, false)
    assert.strictEqual(result.matchScore, 0)
  })
})
