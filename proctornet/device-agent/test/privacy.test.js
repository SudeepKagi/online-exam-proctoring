const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  FORBIDDEN_PRIVACY_KEYS,
  PrivacyContractViolationError,
  assertPrivacyCompliance,
  validateOutboundReport
} = require('../src/privacy/schema')

describe('Device Companion Privacy Contract Guard (Prompt 4 A2 & AGENT_PRIVACY.md)', () => {
  it('passes for clean, compliant outbound report payloads', () => {
    const compliantReport = {
      seq: 1,
      findings: [
        { ruleId: 'r-remote-anydesk', evidence: 'AnyDesk Remote Desktop' }
      ],
      display: { count: 1 },
      session: { remote: false },
      vm: { indicators: [] },
      cameras: { virtual: [] },
      collection: { ok: true, errors: [] }
    }

    assert.doesNotThrow(() => validateOutboundReport(compliantReport))
  })

  it('rejects any payload containing forbidden telemetry keys directly', () => {
    for (const forbiddenKey of FORBIDDEN_PRIVACY_KEYS) {
      const payload = {
        seq: 1,
        findings: [],
        display: { count: 1 },
        session: { remote: false },
        vm: { indicators: [] },
        cameras: { virtual: [] },
        collection: { ok: true, errors: [] },
        [forbiddenKey]: 'violating_data'
      }

      assert.throws(
        () => validateOutboundReport(payload),
        (err) => {
          assert.ok(err instanceof PrivacyContractViolationError)
          assert.equal(err.key, forbiddenKey)
          return true
        },
        `Expected rejection for forbidden key: ${forbiddenKey}`
      )
    }
  })

  it('rejects forbidden keys nested deeply inside child objects or arrays', () => {
    const sneakyPayload = {
      seq: 1,
      findings: [],
      display: { count: 1 },
      session: { remote: false },
      vm: { indicators: [] },
      cameras: { virtual: [] },
      collection: { ok: true, errors: [] },
      extraMetadata: {
        debug: {
          windowTitle: 'Exam Question 1 - Google Chrome'
        }
      }
    }

    assert.throws(
      () => validateOutboundReport(sneakyPayload),
      /Privacy contract violation: forbidden telemetry key 'windowTitle'/i
    )
  })

  it('rejects malformed or invalid report structures', () => {
    assert.throws(() => validateOutboundReport(null), /must be an object/i)
    assert.throws(() => validateOutboundReport({ seq: 0 }), /positive integer/i)
    assert.throws(() => validateOutboundReport({ seq: 1, findings: 'invalid' }), /findings must be an array/i)
  })
})
