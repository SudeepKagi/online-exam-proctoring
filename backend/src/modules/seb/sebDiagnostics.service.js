'use strict'

const crypto = require('crypto')

const MAX_HISTORY = 50
const MAX_FAILURES = 500
const MAX_TRACES = 50
const attemptsHistory = []
const exchangeFailures = []
const launchTraces = new Map()

const STARTER_CONFIG_KEY = '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a'

/**
 * Diagnostic service recording recent Safe Exam Browser verification and handshake attempts,
 * with diagnostic hypothesis engine for explaining header mismatches.
 */
class SebDiagnosticsService {
  /**
   * Evaluates a header hash mismatch and determines the most probable cause.
   * Diagnostic only — NEVER accepts a mismatched variant.
   */
  evaluateHeaderMismatch(receivedHeader, targetUrl, activeKey, options = {}) {
    if (!receivedHeader || !activeKey) {
      return {
        matchedVariant: 'HEADER_MISSING',
        likelyCause: 'Safe Exam Browser configuration header is missing.'
      }
    }

    const cleanReceived = receivedHeader.trim().toLowerCase()
    const cleanUrl = String(targetUrl || '').split('#')[0]
    const cleanKey = activeKey.trim().toLowerCase()

    // 1. Starter key test
    const starterHash = crypto.createHash('sha256').update(cleanUrl + STARTER_CONFIG_KEY).digest('hex').toLowerCase()
    if (cleanReceived === starterHash) {
      return {
        matchedVariant: 'STARTER_KEY',
        likelyCause: 'Client is running the default starter template instead of the institution-specific configuration file.'
      }
    }

    // 2. Trailing slash variant
    const withSlash = cleanUrl.endsWith('/') ? cleanUrl : `${cleanUrl}/`
    const withoutSlash = cleanUrl.replace(/\/+$/, '')
    const slashUrl = cleanUrl.endsWith('/') ? withoutSlash : withSlash
    const slashHash = crypto.createHash('sha256').update(slashUrl + cleanKey).digest('hex').toLowerCase()
    if (cleanReceived === slashHash) {
      return {
        matchedVariant: 'TRAILING_SLASH',
        likelyCause: 'URL trailing slash mismatch between client request and server canonical URL.'
      }
    }

    // 3. Scheme mismatch (http vs https)
    let altSchemeUrl = null
    if (cleanUrl.startsWith('https://')) {
      altSchemeUrl = cleanUrl.replace('https://', 'http://')
    } else if (cleanUrl.startsWith('http://')) {
      altSchemeUrl = cleanUrl.replace('http://', 'https://')
    }
    if (altSchemeUrl) {
      const schemeHash = crypto.createHash('sha256').update(altSchemeUrl + cleanKey).digest('hex').toLowerCase()
      if (cleanReceived === schemeHash) {
        return {
          matchedVariant: 'SCHEME_MISMATCH',
          likelyCause: 'URL protocol mismatch (HTTP vs HTTPS) between client and server origin.'
        }
      }
    }

    // 4. Explicit port number variant (:443 or :80)
    try {
      const parsed = new URL(cleanUrl)
      if (!parsed.port) {
        const port = parsed.protocol === 'https:' ? '443' : '80'
        const urlWithPort = `${parsed.protocol}//${parsed.hostname}:${port}${parsed.pathname}${parsed.search}`
        const portHash = crypto.createHash('sha256').update(urlWithPort + cleanKey).digest('hex').toLowerCase()
        if (cleanReceived === portHash) {
          return {
            matchedVariant: 'PORT_INCLUDED',
            likelyCause: 'Client included explicit default port number (:443 or :80) in the hashed URL.'
          }
        }
      }
    } catch (_) {}

    // 5. Query encoding / decoding variant
    try {
      const parsed = new URL(cleanUrl)
      if (parsed.search) {
        const decodedQuery = decodeURIComponent(parsed.search)
        if (decodedQuery !== parsed.search) {
          const decodedUrl = `${parsed.origin}${parsed.pathname}${decodedQuery}`
          const queryHash = crypto.createHash('sha256').update(decodedUrl + cleanKey).digest('hex').toLowerCase()
          if (cleanReceived === queryHash) {
            return {
              matchedVariant: 'QUERY_ENCODING',
              likelyCause: 'URL query parameter character encoding mismatch (raw vs URL-decoded).'
            }
          }
        }
      }
    } catch (_) {}

    // 6. Double hash variant
    const doubleKey = crypto.createHash('sha256').update(cleanKey).digest('hex').toLowerCase()
    const doubleHash = crypto.createHash('sha256').update(cleanUrl + doubleKey).digest('hex').toLowerCase()
    if (cleanReceived === doubleHash) {
      return {
        matchedVariant: 'DOUBLE_HASH',
        likelyCause: 'Configuration key was double-hashed on the client before request transmission.'
      }
    }

    // Default: client configuration key differs from active key
    return {
      matchedVariant: 'DIFFERENT_CONFIG_KEY',
      likelyCause: 'Client Safe Exam Browser loaded a different .seb configuration file or an outdated version.'
    }
  }

  /**
   * Records an exchange failure event for admin diagnostics.
   */
  recordExchangeFailure({
    code,
    requestId,
    userAgent = null,
    clientIp = null,
    targetUrl = null,
    receivedHeader = null,
    activeKey = null,
    timestamp = Date.now()
  }) {
    let matchedVariant = null
    let likelyCause = null

    if (code === 'SEB_HEADER_MISMATCH' && receivedHeader && targetUrl && activeKey) {
      const evaluation = this.evaluateHeaderMismatch(receivedHeader, targetUrl, activeKey)
      matchedVariant = evaluation.matchedVariant
      likelyCause = evaluation.likelyCause
    } else if (code === 'SEB_HEADER_MISSING') {
      likelyCause = 'Candidate accessed the endpoint using a standard web browser or SEB stripped headers.'
    } else if (code === 'INVALID_CODE') {
      likelyCause = 'Candidate entered a typo or incorrect 6-digit launch code.'
    } else if (code === 'CODE_EXPIRED') {
      likelyCause = 'Launch code exceeded the 5-minute activation window.'
    } else if (code === 'CODE_USED') {
      likelyCause = 'Launch code was already redeemed in a prior session.'
    } else if (code === 'RATE_LIMITED') {
      likelyCause = 'Excessive incorrect code attempts triggered temporary rate limiting.'
    } else if (code === 'INSTITUTION_NOT_CONFIGURED') {
      likelyCause = 'Institution Safe Exam Browser configuration is missing or incomplete.'
    } else if (code === 'STORAGE_UNAVAILABLE') {
      likelyCause = 'Object storage connectivity or IAM permissions error.'
    }

    const entry = {
      timestamp,
      code,
      requestId: requestId || crypto.randomUUID().slice(0, 8),
      userAgent: userAgent ? String(userAgent).slice(0, 100) : 'unknown',
      clientIpPrefix: clientIp ? String(clientIp).replace(/^::ffff:/, '').slice(0, 10) + '...' : 'unknown',
      matchedVariant,
      likelyCause,
      receivedHeaderPrefix8: receivedHeader ? String(receivedHeader).slice(0, 8) : null
    }

    exchangeFailures.unshift(entry)
    if (exchangeFailures.length > MAX_FAILURES) {
      exchangeFailures.pop()
    }
    return entry
  }

  /**
   * Looks up a failure record by reference id.
   */
  lookupRefId(refId) {
    if (!refId) return null
    const cleanRef = String(refId).replace(/^#/, '').trim().toLowerCase()
    return exchangeFailures.find(e => e.requestId.toLowerCase() === cleanRef) || null
  }

  /**
   * Returns aggregated failure counts by code and last request ID per code in the last 24 hours.
   */
  getEntryDiagnostics24h() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const recent = exchangeFailures.filter(e => e.timestamp >= oneDayAgo)
    const failureCounts24h = {
      INVALID_CODE: 0,
      CODE_EXPIRED: 0,
      CODE_USED: 0,
      RATE_LIMITED: 0,
      SEB_HEADER_MISSING: 0,
      SEB_HEADER_MISMATCH: 0,
      INSTITUTION_NOT_CONFIGURED: 0,
      STORAGE_UNAVAILABLE: 0
    }
    const lastRequestIdByCode = {}
    let mostLikelyCause = null

    for (const e of recent) {
      if (failureCounts24h[e.code] !== undefined) {
        failureCounts24h[e.code]++
        if (!lastRequestIdByCode[e.code]) {
          lastRequestIdByCode[e.code] = e.requestId
        }
      }
      if (!mostLikelyCause && e.likelyCause) {
        mostLikelyCause = e.likelyCause
      }
    }

    const recentRefs = recent.slice(0, 8).map(e => ({
      requestId: e.requestId,
      code: e.code,
      timestamp: e.timestamp,
      likelyCause: e.likelyCause,
      matchedVariant: e.matchedVariant
    }))

    return {
      failureCounts24h,
      lastRequestIdByCode,
      mostLikelyCause: mostLikelyCause || 'No recent exchange failures in the last 24 hours.',
      recentRefs
    }
  }

  /**
   * Returns count of setup-class failures in the last 10 minutes (for admin circuit-breaker suggestion).
   */
  getSetupFailures10m() {
    const tenMinAgo = Date.now() - 10 * 60 * 1000
    const setupCodes = new Set(['SEB_HEADER_MISMATCH', 'SEB_HEADER_MISSING', 'INSTITUTION_NOT_CONFIGURED'])
    const recent = exchangeFailures.filter(e => e.timestamp >= tenMinAgo && setupCodes.has(e.code))
    return {
      count: recent.length,
      thresholdExceeded: recent.length >= 5
    }
  }

  /**
   * Records a verification attempt into the diagnostic log.
   */
  recordAttempt({
    purpose = 'check',
    outcome = 'SUCCESS',
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

  getRecentAttempts(limit = 5) {
    return attemptsHistory.slice(0, Math.min(limit, attemptsHistory.length))
  }

  clearHistory() {
    attemptsHistory.length = 0
    exchangeFailures.length = 0
    launchTraces.clear()
  }

  /**
   * Records a lifecycle hop for a Safe Exam Browser launch identified by its correlation ID.
   * Correlation ID is a hashed token prefix (never the raw token).
   */
  recordLaunchHop(correlationId, {
    step,
    status = 200,
    code = 'SUCCESS',
    bytes = null,
    durationMs = null,
    details = null,
    userAgent = null,
    userId = null,
    examId = null,
    purpose = 'exam',
    timestamp = new Date().toISOString()
  } = {}) {
    if (!correlationId) return null
    const cleanId = String(correlationId).trim()

    let trace = launchTraces.get(cleanId)
    if (!trace) {
      trace = {
        correlationId: cleanId,
        createdAt: timestamp,
        updatedAt: timestamp,
        userId: userId || null,
        examId: examId || null,
        purpose: purpose || 'exam',
        overallStatus: 'IN_PROGRESS',
        hops: []
      }
      launchTraces.set(cleanId, trace)

      // Keep within bound
      if (launchTraces.size > MAX_TRACES) {
        const oldestKey = launchTraces.keys().next().value
        launchTraces.delete(oldestKey)
      }
    }

    if (userId && !trace.userId) trace.userId = userId
    if (examId && !trace.examId) trace.examId = examId
    if (purpose && !trace.purpose) trace.purpose = purpose
    trace.updatedAt = timestamp

    const hop = {
      step,
      status: Number(status),
      code: String(code),
      timestamp,
      bytes: bytes != null ? Number(bytes) : null,
      durationMs: durationMs != null ? Number(durationMs) : null,
      details: details ? String(details) : null,
      userAgent: userAgent ? this.extractSebVersion(userAgent) : null
    }

    trace.hops.push(hop)

    // Update overall status
    if (status >= 400 || (code && code !== 'SUCCESS')) {
      trace.overallStatus = 'FAILED'
    } else if (step === 'EXAM_START_ATTEMPT' && status === 200) {
      trace.overallStatus = 'COMPLETED'
    }

    return trace
  }

  /**
   * Returns recent launch traces sorted by most recent first.
   */
  getLaunchTraces(limit = 20) {
    const all = Array.from(launchTraces.values())
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return all.slice(0, Math.min(limit, all.length))
  }

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

  getDefaultDetails(outcome) {
    switch (outcome) {
      case 'SUCCESS':
        return 'Cryptographic verification handshake succeeded. Configuration Key confirmed.'
      case 'HEADER_MISMATCH':
        return 'HTTP request arrived from Safe Exam Browser, but the Configuration Key header did not match.'
      case 'NO_PING':
        return 'Configuration was downloaded by Safe Exam Browser, but no startup ping or handshake was received.'
      case 'TOKEN_EXPIRED':
        return 'The launch token expired before Safe Exam Browser completed startup (5-minute timeout).'
      case 'TOKEN_ALREADY_USED':
        return 'The launch token was already redeemed in a prior session.'
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
  SebDiagnosticsService,
  STARTER_CONFIG_KEY
}
