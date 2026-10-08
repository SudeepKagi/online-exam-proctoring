'use strict'

const assert = require('node:assert/strict')

/**
 * Handle & Resource Leak Detector (§1 CI-D, C1.4)
 *
 * Inspects `process.getActiveResourcesInfo()` to verify that no TCP sockets,
 * persistent timers, or child processes remain open after test teardown.
 */

// Permitted runtime handles (stdout, IPC, runner essentials)
const DEFAULT_ALLOWED = new Set([
  'TTYWrap',
  'PipeWrap',
  'FSReqCallback',
  'StatWatcher',
  'FileHandle',
  'Immediate'
])

function getActiveLeaks(ignoreTypes = []) {
  if (typeof process.getActiveResourcesInfo !== 'function') {
    return []
  }

  const allowed = new Set([...DEFAULT_ALLOWED, ...ignoreTypes])
  const active = process.getActiveResourcesInfo()

  return active.filter((res) => !allowed.has(res))
}

function assertNoLeakedResources(message = 'Resource leak detected after test teardown', ignoreTypes = []) {
  const leaks = getActiveLeaks(ignoreTypes)
  if (leaks.length > 0) {
    const errorDetails = `Active unclosed handles: [${leaks.join(', ')}]`
    assert.fail(`${message}: ${errorDetails}`)
  }
}

module.exports = {
  getActiveLeaks,
  assertNoLeakedResources
}
