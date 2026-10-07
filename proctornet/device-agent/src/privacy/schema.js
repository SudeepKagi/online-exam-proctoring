/**
 * ProctorNet Exam Device Companion
 * Outbound Privacy Contract & Schema Enforcement
 * Architecture: ADR A-004 & AGENT_PRIVACY.md
 */

const FORBIDDEN_PRIVACY_KEYS = [
  'processes',
  'processlist',
  'process_list',
  'cmdline',
  'cmd_line',
  'args',
  'arguments',
  'path',
  'paths',
  'windowtitle',
  'window_title',
  'screenshot',
  'keystrokes',
  'clipboard',
  'url',
  'urls',
  'browserhistory',
  'history',
  'username',
  'user_name'
]

class PrivacyContractViolationError extends Error {
  constructor(key) {
    super(`Privacy contract violation: forbidden telemetry key '${key}' detected in outbound payload`)
    this.name = 'PrivacyContractViolationError'
    this.key = key
  }
}

/**
 * Recursively scans object for any forbidden keys
 */
function assertPrivacyCompliance(data) {
  if (!data || typeof data !== 'object') return
  const stack = [data]
  while (stack.length > 0) {
    const current = stack.pop()
    if (typeof current !== 'object' || current === null) continue
    for (const key of Object.keys(current)) {
      const lower = key.toLowerCase()
      if (FORBIDDEN_PRIVACY_KEYS.includes(lower)) {
        throw new PrivacyContractViolationError(key)
      }
      if (typeof current[key] === 'object' && current[key] !== null) {
        stack.push(current[key])
      }
    }
  }
}

/**
 * Validates outbound report shape before dispatch
 */
function validateOutboundReport(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Report payload must be an object')
  }

  // 1. Strict privacy assertion
  assertPrivacyCompliance(report)

  // 2. Structural sanity checks
  if (typeof report.seq !== 'number' || report.seq <= 0) {
    throw new Error('Report sequence number must be a positive integer')
  }

  if (!Array.isArray(report.findings)) {
    throw new Error('Report findings must be an array')
  }

  for (const f of report.findings) {
    if (!f.ruleId || typeof f.ruleId !== 'string') {
      throw new Error('Finding item missing valid ruleId')
    }
  }

  if (!report.display || typeof report.display.count !== 'number') {
    throw new Error('Report display count missing or invalid')
  }

  if (!report.session || typeof report.session.remote !== 'boolean') {
    throw new Error('Report session.remote missing or invalid')
  }

  if (!report.vm || !Array.isArray(report.vm.indicators)) {
    throw new Error('Report vm.indicators missing or invalid')
  }

  if (!report.cameras || !Array.isArray(report.cameras.virtual)) {
    throw new Error('Report cameras.virtual missing or invalid')
  }

  if (!report.collection || typeof report.collection.ok !== 'boolean') {
    throw new Error('Report collection status missing or invalid')
  }

  return true
}

module.exports = {
  FORBIDDEN_PRIVACY_KEYS,
  PrivacyContractViolationError,
  assertPrivacyCompliance,
  validateOutboundReport
}
