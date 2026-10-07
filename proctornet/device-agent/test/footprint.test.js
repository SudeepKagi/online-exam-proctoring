const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { matchTelemetry } = require('../src/matcher')
const { validateOutboundReport } = require('../src/privacy/schema')

describe('Footprint Budget Verification (Prompt 4 A2 §6)', () => {
  it('RSS memory consumption is under 80 MB budget', () => {
    const memoryUsage = process.memoryUsage()
    const rssMb = memoryUsage.rss / (1024 * 1024)
    console.log(`[Footprint] Current Agent RSS: ${rssMb.toFixed(2)} MB (Budget: < 80 MB)`)
    assert.ok(rssMb < 80, `Agent RSS (${rssMb.toFixed(2)} MB) must be strictly less than 80 MB`)
  })

  it('outbound report payload size is under 4 KB budget', () => {
    const mockCollectorOutput = {
      ok: true,
      data: {
        processes: new Set(['chrome', 'code']),
        displayCount: 1,
        cameraNames: ['Integrated Webcam'],
        vmIndicators: []
      }
    }

    const report = matchTelemetry(mockCollectorOutput, [
      { id: 'r-remote-anydesk', category: 'REMOTE_ACCESS', name: 'AnyDesk', matchers: { type: 'exeName', value: 'anydesk' } }
    ])
    report.seq = 1

    validateOutboundReport(report)

    const payloadJson = JSON.stringify(report)
    const byteSize = Buffer.byteLength(payloadJson, 'utf8')
    console.log(`[Footprint] Report JSON Payload: ${byteSize} bytes (Budget: < 4096 bytes)`)

    assert.ok(byteSize < 4096, `Report payload (${byteSize} bytes) must be less than 4 KB`)
  })

  it('cold start load time is well under 2 second budget', () => {
    const start = performance.now()
    // Require core modules
    require('../src/main')
    require('../src/matcher')
    require('../src/transport')
    require('../src/pairing')
    const elapsedMs = performance.now() - start
    console.log(`[Footprint] Module Cold Load: ${elapsedMs.toFixed(2)} ms (Budget: < 2000 ms)`)
    assert.ok(elapsedMs < 2000, `Module load (${elapsedMs} ms) must be less than 2000 ms`)
  })
})
