const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { safeExec } = require('../src/collectors/windows')
const { matchTelemetry } = require('../src/matcher')

describe('Fail-Closed Collector Integrity Tests (Prompt 4 §0.3 & A2)', () => {
  it('reports CMD_MISSING when executed binary does not exist (ENOENT)', async () => {
    const res = await safeExec('non_existent_binary_xyz123.exe', ['--version'])
    assert.equal(res.ok, false)
    assert.equal(res.code, 'CMD_MISSING')
  })

  it('reports CMD_TIMEOUT when command hangs or exceeds explicit timeout window', async () => {
    // Cross-platform timeout test using currently executing Node runtime
    const res = await safeExec(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], 200)
    assert.equal(res.ok, false)
    assert.equal(res.code, 'CMD_TIMEOUT')
  })

  it('fails closed when collector output is degraded: collection.ok is false, never reports clean', () => {
    const degradedCollectorOutput = {
      ok: false,
      errors: ['processes:BUFFER_OVERFLOW', 'cameras:CMD_TIMEOUT'],
      data: {
        processes: new Set(),
        displayCount: 1,
        cameraNames: [],
        vmIndicators: []
      }
    }

    const report = matchTelemetry(degradedCollectorOutput, [])
    assert.equal(report.collection.ok, false)
    assert.deepEqual(report.collection.errors, ['processes:BUFFER_OVERFLOW', 'cameras:CMD_TIMEOUT'])
  })
})
