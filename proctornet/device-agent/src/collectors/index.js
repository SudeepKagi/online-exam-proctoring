/**
 * ProctorNet Exam Device Companion
 * Hardware & Telemetry Collector Dispatcher
 * Architecture: Prompt 4 A2 §2
 */

const os = require('os')
const { collectWindowsTelemetry } = require('./windows')
const { collectMacTelemetry } = require('./macos')
const { collectLinuxTelemetry } = require('./linux')

/**
 * Executes OS-appropriate telemetry collector
 * Returns { ok: boolean, errors: string[], data: { processes, displayCount, cameraNames, vmIndicators, isRemoteSession } }
 */
async function collectTelemetry() {
  const platform = os.platform()

  if (platform === 'win32') {
    return collectWindowsTelemetry()
  } else if (platform === 'darwin') {
    return collectMacTelemetry()
  } else {
    return collectLinuxTelemetry()
  }
}

module.exports = {
  collectTelemetry
}
