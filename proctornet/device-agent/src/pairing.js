/**
 * ProctorNet Exam Device Companion
 * Pairing Service: Short-code exchange & Credential Acquisition
 * Architecture: ADR A-003
 */

const os = require('os')
const crypto = require('crypto')
const fs = require('fs')
const { AGENT_VERSION } = require('./config')
const { verifyPolicyBundle } = require('./policy')

/**
 * Derives normalized OS string
 */
function getNormalizedOs() {
  const platform = os.platform()
  if (platform === 'win32') return 'win'
  if (platform === 'darwin') return 'mac'
  return 'linux'
}

/**
 * Derives non-PII pseudonymous device hash
 */
function getPseudonymousDeviceId() {
  const seed = `${os.platform()}-${os.arch()}-${os.cpus().length}-${os.totalmem()}`
  return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 32)
}

/**
 * Computes agent binary build hash
 */
function getBuildHash() {
  try {
    const target = process.execPath || __filename
    const buf = fs.readFileSync(target)
    return crypto.createHash('sha256').update(buf).digest('hex')
  } catch {
    return 'companion-build-hash-dev'
  }
}

/**
 * Pairs companion agent with server using 8-character Crockford code
 */
async function pair(transport, code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Pairing code is required')
  }

  const cleanCode = code.trim().toUpperCase()
  if (cleanCode.length !== 8) {
    throw new Error('Pairing code must be exactly 8 characters')
  }

  const payload = {
    code: cleanCode,
    agentVersion: AGENT_VERSION,
    os: getNormalizedOs(),
    arch: os.arch(),
    buildHash: getBuildHash(),
    deviceId: getPseudonymousDeviceId()
  }

  const res = await transport.request('POST', '/api/v1/agent/pair', payload)

  if (res.status !== 200) {
    const errorMsg = res.body?.error?.message || res.body?.message || `Pairing failed with HTTP ${res.status}`
    const err = new Error(errorMsg)
    err.status = res.status
    err.code = res.body?.error?.code || 'PAIRING_FAILED'
    throw err
  }

  const { sessionToken, sessionKey, policy, heartbeatMs, serverTime } = res.body

  if (!sessionToken || !sessionKey) {
    throw new Error('Server returned invalid session credentials')
  }

  // Adjust clock skew
  if (serverTime) {
    transport.adjustClockOffset(serverTime)
  }

  // Verify policy Ed25519 signature
  let isPolicyValid = false
  if (policy && policy.signature) {
    const { signature, publicKey, ...unsignedBundle } = policy
    isPolicyValid = verifyPolicyBundle(unsignedBundle, signature, publicKey)
  }

  return {
    sessionToken,
    sessionKey,
    policy,
    isPolicyValid,
    heartbeatMs: heartbeatMs || 15000,
    serverTime
  }
}

module.exports = {
  getNormalizedOs,
  getPseudonymousDeviceId,
  getBuildHash,
  pair
}
