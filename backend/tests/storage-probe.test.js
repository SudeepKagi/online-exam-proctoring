'use strict'

const { test, describe, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const {
  runStorageProbe,
  getStorageHealth,
  initStartupStorageProbe
} = require('../src/infra/s3/storageProbe')

describe('Storage Startup Probe and Health Reporting', () => {
  test('1. getStorageHealth returns valid initial health schema', () => {
    const health = getStorageHealth()
    assert.ok(typeof health.ok === 'boolean')
    assert.ok(typeof health.status === 'string')
    assert.ok(health.status === 'OK' || health.status === 'Down' || health.status === 'Pending')
  })

  test('2. runStorageProbe performs probe and updates in-memory status', async () => {
    // In test environment without active AWS credentials or with mock adapter,
    // runStorageProbe runs and gracefully returns health result without throwing uncaught error.
    const result = await runStorageProbe()
    assert.ok(result)
    assert.ok(typeof result.ok === 'boolean')
    assert.ok(result.status === 'OK' || result.status === 'Down')
    assert.ok(result.lastCheckedAt)

    const cached = getStorageHealth()
    assert.strictEqual(cached.status, result.status)
    assert.strictEqual(cached.ok, result.ok)
  })

  test('3. initStartupStorageProbe never throws or crashes the process', async () => {
    assert.doesNotThrow(() => {
      initStartupStorageProbe()
    })
  })
})
