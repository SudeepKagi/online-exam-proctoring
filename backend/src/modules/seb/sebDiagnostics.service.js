'use strict'

const crypto = require('crypto')

const MAX_HISTORY = 20
const attemptsHistory = []

/**
 * Diagnostic service recording recent Safe Exam Browser verification and handshake attempts.
 */
class SebDiagnosticsService {
  /**
   * Records a verification attempt into the diagnostic log.
   */
  recordAttempt({
    purpose = 'check',
    outcome = 'SUCCESS', // 'SUCCESS' | 'HEADER_MISMATCH' | 'NO_PING' | 'TOKEN_EXPIRED' | 'TOKEN_ALREADY_USED' | 'UNRECOGNIZED_CLIENT'
    sebVersion = null,
    userAgent = null,
    clientIp = null,
    diagnosticDetails = null,
    timestamp = new Date().toISOString()
  } = {}) {
    const parsedVersion = sebVersion || this.extractSebVersion(userAgent)

    const entry = {
      id: crypto.randomUUID().slice(0, 8),
      timestamp,
      purpose,
      outcome,
      sebVersion: parsedVersion,
      clientIp: clientIp ? String(clientIp).replace(/^::ffff:/, '') : 'unknown',
      diagnosticDetails: diagnosticDetails || this.getDefaultDetails(outcome)
    }

    attemptsHistory.unshift(entry)
    if (attemptsHistory.length > MAX_HISTORY) {
      attemptsHistory.pop()
    }

    return entry
  }

  /**
   * Returns the most recent verification attempts (default 5).
   */
  getRecentAttempts(limit = 5) {
    return attemptsHistory.slice(0, Math.min(limit, attemptsHistory.length))
  }

  /**
   * Clear attempt history (useful in tests).
   */
  clearHistory() {
    attemptsHistory.length = 0
  }

  /**
   * Extracts SEB version and platform from User-Agent string.
   */
  extractSebVersion(userAgent) {
    if (!userAgent) return 'Safe Exam Browser (Unknown Version)'
    const match = userAgent.match(/SEB\/([0-9.]+)/i) || userAgent.match(/SafeExamBrowser[ /]([0-9.]+)/i)
    const osMatch = userAgent.match(/Windows NT [0-9.]+/i) ? 'Windows' : (userAgent.match(/Macintosh|Mac OS X/i) ? 'macOS' : 'Desktop')
    if (match) {
      return `SEB ${match[1]} (${osMatch})`
    }
    if (/SEB|SafeExamBrowser/i.test(userAgent)) {
      return `Safe Exam Browser (${osMatch})`
    }
    return userAgent.slice(0, 35)
  }

  /**
   * Returns human-readable diagnostic message for common failure outcomes.
   */
  getDefaultDetails(outcome) {
    switch (outcome) {
      case 'SUCCESS':
        return 'Cryptographic verification handshake succeeded. Configuration Key confirmed.'
      case 'HEADER_MISMATCH':
        return 'HTTP request arrived from Safe Exam Browser, but the Configuration Key header did not match. Likely cause: the pasted 64-hex key does not match this .seb file, or the client requested a different origin.'
      case 'NO_PING':
        return 'Configuration was downloaded by Safe Exam Browser, but no startup ping or handshake was received from the client.'
      case 'TOKEN_EXPIRED':
        return 'The test launch token expired before Safe Exam Browser completed startup (5-minute timeout).'
      case 'TOKEN_ALREADY_USED':
        return 'The test launch token was already redeemed in a prior session.'
      case 'UNRECOGNIZED_CLIENT':
        return 'Request arrived from a standard browser instead of Safe Exam Browser.'
      default:
        return 'Verification attempt concluded.'
    }
  }
}

const sebDiagnosticsService = new SebDiagnosticsService()

module.exports = {
  sebDiagnosticsService,
  SebDiagnosticsService
}
