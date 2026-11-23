'use strict'

const crypto = require('crypto')
const config = require('../../shared/config')
const { settingsService } = require('../admin/settings.service')
const { getStorageAdapter } = require('../../infra/s3/s3.client')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { authService } = require('../auth/auth.service')
const { setAuthCookie, setAccessCookie, setRefreshCookie } = require('../../utils/cookies')
const { verifySebLaunchToken } = require('./sebToken')
const { sebTokenService } = require('./sebToken.service')
const { getInstitutionSebState, invalidateInstitutionSebState } = require('./seb.service')
const { sebDiagnosticsService } = require('./sebDiagnostics.service')
const { generateStarterSebConfig, sanitizeProhibitedProcesses } = require('./sebConfigChecker')

/**
 * Validates X-SafeExamBrowser-ConfigKeyHash against candidate URLs for the given activeKey.
 */
function verifySebHeaderHash(req, activeKey, targetPath = null) {
  if (!activeKey || !/^[0-9a-f]{64}$/i.test(activeKey)) return false
  const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
  const receivedHeader = typeof rawHeader === 'string' ? rawHeader.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{64}$/.test(receivedHeader)) return false

  const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
  const rawPath = targetPath || (req.originalUrl || req.url || '').split('#')[0]
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const canonicalUrl = `${cleanPublicOrigin}${normalizedPath}`

  const expectedHash = crypto.createHash('sha256').update(canonicalUrl + activeKey.toLowerCase()).digest('hex').toLowerCase()
  const receivedBuf = Buffer.from(receivedHeader, 'utf8')
  const expectedBuf = Buffer.from(expectedHash, 'utf8')

  if (receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return { matched: true, method: 'header_hash' }
  }

  return false
}

async function ping(req, res, next) {
  try {
    const sebState = await getInstitutionSebState()
    const activeKey = sebState.configKey ? sebState.configKey.trim().toLowerCase() : null

    const userAgent = req.headers['user-agent'] || ''
    const isSebAgent = /SEB|SafeExamBrowser/i.test(userAgent)

    const rawConfigHeader = req.headers['x-safeexambrowser-configkeyhash']
    const rawBekHeader = req.headers['x-safeexambrowser-browserexamkeyhash'] || req.headers['x-safeexambrowser-requesthash']
    const headerPresent = Boolean(
      (typeof rawConfigHeader === 'string' && rawConfigHeader.trim().length > 0) ||
      (typeof rawBekHeader === 'string' && rawBekHeader.trim().length > 0)
    )

    if (!activeKey || !/^[0-9a-f]{64}$/.test(activeKey)) {
      return res.status(200).json({ verified: false, isSebAgent, headerPresent })
    }

    let matched = false
    let matchMethod = null

    // 1. Direct JavaScript API Key Matching (window.SafeExamBrowser.security.configKey)
    const clientKey = (req.body?.configKey || req.query?.configKey || req.headers['x-seb-config-key'] || '').toString().trim().toLowerCase()
    if (/^[0-9a-f]{64}$/.test(clientKey)) {
      const activeBuf = Buffer.from(activeKey, 'utf8')
      const clientBuf = Buffer.from(clientKey, 'utf8')
      if (activeBuf.length === clientBuf.length && crypto.timingSafeEqual(activeBuf, clientBuf)) {
        matched = true
        matchMethod = 'javascript_api'
      }
    }

    // 2. HTTP Header Hash Matching (X-SafeExamBrowser-ConfigKeyHash across candidate URLs)
    if (!matched) {
      const headerResult = verifySebHeaderHash(req, activeKey)
      if (headerResult) {
        matched = true
        matchMethod = headerResult.method
      }
    }

    if (matched) {
      const nowIso = new Date().toISOString()
      await settingsService.updateSebLastVerified(nowIso, {
        method: matchMethod,
        userAgent,
        configVersion: sebState.configVersion || null
      })
      invalidateInstitutionSebState()
      sebDiagnosticsService.recordAttempt({
        purpose: 'admin_test',
        outcome: 'SUCCESS',
        userAgent,
        clientIp: req.ip,
        timestamp: nowIso
      })
      logger.info({ matchMethod, ip: req.ip }, 'Safe Exam Browser ping successfully verified')
      return res.status(200).json({
        verified: true,
        headerPresent,
        isSebAgent,
        method: matchMethod,
        timestamp: nowIso
      })
    }

    if (isSebAgent || headerPresent) {
      sebDiagnosticsService.recordAttempt({
        purpose: 'admin_test',
        outcome: 'HEADER_MISMATCH',
        userAgent,
        clientIp: req.ip
      })
    }

    return res.status(200).json({
      verified: false,
      headerPresent,
      isSebAgent
    })
  } catch (err) {
    logger.error({ err }, 'Error handling SEB ping')
    return res.status(200).json({ verified: false, headerPresent: false, isSebAgent: false })
  }
}

async function createLaunchLink(req, res, next) {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' })
    }

    const purpose = (req.body?.purpose === 'check' || req.query?.purpose === 'check') ? 'check' : 'exam'
    let qualifyingExamId = null
    const userRole = normalizeRole(user.role)

    if (purpose === 'check' || userRole === ROLES.ADMIN || userRole === ROLES.FACULTY) {
      // Diagnostic check / Admin / Faculty test launches do not require an active exam
      qualifyingExamId = req.body?.examId || null
    } else if (userRole === ROLES.STUDENT) {
      const targetExamId = req.body?.examId || req.query?.examId
      const serverNow = new Date()
      const preDownloadMinutes = config.sebPreDownloadMinutes || 30
      const windowStart = new Date(serverNow.getTime() + preDownloadMinutes * 60 * 1000)

      const whereClause = {
        status: { in: ['PUBLISHED', 'ACTIVE'] },
        startTime: { lte: windowStart },
        endTime: { gte: serverNow }
      }
      if (targetExamId) {
        whereClause.id = targetExamId
      }

      const candidateExams = await prisma.exam.findMany({
        where: whereClause,
        include: {
          assignments: {
            where: { userId: user.id }
          },
          attempts: {
            where: { studentId: user.id }
          }
        }
      })

      const eligibleExams = []
      for (const exam of candidateExams) {
        const pConfig = (exam.proctoringConfig && typeof exam.proctoringConfig === 'object') ? exam.proctoringConfig : {}
        if (!pConfig.sebRequired) continue

        // Check if student has assignment or attempt, or if exam has 0 total assignments (cohort-wide)
        if (exam.assignments.length > 0 || exam.attempts.length > 0) {
          eligibleExams.push(exam)
        } else {
          const totalAssignments = await prisma.examAssignment.count({ where: { examId: exam.id } })
          if (totalAssignments === 0) {
            eligibleExams.push(exam)
          }
        }
      }

      if (eligibleExams.length === 0) {
        return res.status(403).json({
          code: 'NO_ACTIVE_SEB_EXAM',
          message: 'No upcoming or open Safe Exam Browser exam found within the allowed launch window.'
        })
      }

      qualifyingExamId = eligibleExams[0].id
    }

    // Generate stateful, single-use launch token and download token
    const tokenResult = sebTokenService.createLaunchToken({
      userId: user.id,
      userRole: user.role,
      examId: qualifyingExamId,
      purpose
    })

    const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
    const origin = new URL(cleanPublicOrigin)
    const scheme = origin.protocol === 'https:' ? 'sebs:' : 'seb:'

    // Safe Exam Browser 3.x query forwarding syntax:
    // sebs://host/api/v1/seb/config/<downloadToken>.seb??launch=<exchangeToken>
    const url = `${scheme}//${origin.host}/api/v1/seb/config/${tokenResult.downloadToken}.seb??launch=${tokenResult.launchToken}`
    const correlationId = tokenResult.correlationId

    sebDiagnosticsService.recordLaunchHop(correlationId, {
      step: 'LAUNCH_LINK_CREATED',
      status: 200,
      code: 'SUCCESS',
      userId: user.id,
      examId: qualifyingExamId,
      purpose,
      details: 'Launch link generated'
    })

    return res.status(200).json({
      success: true,
      correlationId,
      url,
      launchUrl: url,
      downloadToken: tokenResult.downloadToken,
      exchangeToken: tokenResult.launchToken,
      launchToken: tokenResult.launchToken,
      token: tokenResult.launchToken, // Backwards compatibility for existing test assertions
      expiresAt: tokenResult.expiresAt,
      purpose: tokenResult.purpose,
      examId: tokenResult.examId
    })
  } catch (err) {
    logger.error({ err }, 'Error creating SEB launch link')
    next(err)
  }
}

async function downloadSebConfig(req, res, next) {
  try {
    const rawToken = req.params.token || req.params[0] || ''
    const cleanToken = rawToken.replace(/\.seb$/i, '')

    // 1. Check stateful sebTokenService first (does NOT consume the exchange token)
    const tokenRecord = sebTokenService.getTokenRecord(cleanToken)
    const correlationId = tokenRecord?.correlationId || crypto.createHash('sha256').update(cleanToken).digest('hex').slice(0, 12)
    let payload = null

    if (tokenRecord) {
      payload = {
        role: tokenRecord.userRole,
        examId: tokenRecord.examId,
        purpose: tokenRecord.purpose
      }
    } else {
      // 2. Fallback to legacy HMAC verification
      const verification = verifySebLaunchToken(cleanToken)
      if (!verification.valid) {
        if (verification.error === 'TOKEN_EXPIRED') {
          sebDiagnosticsService.recordLaunchHop(correlationId, {
            step: 'CONFIG_DOWNLOAD_REQUEST',
            status: 401,
            code: 'TOKEN_EXPIRED',
            userAgent: req.headers['user-agent'],
            details: 'Launch token has expired'
          })
          return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Launch token has expired' })
        }
        sebDiagnosticsService.recordLaunchHop(correlationId, {
          step: 'CONFIG_DOWNLOAD_REQUEST',
          status: 401,
          code: 'INVALID_TOKEN',
          userAgent: req.headers['user-agent'],
          details: 'Invalid or tampered token'
        })
        return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or tampered token' })
      }
      payload = verification.payload
    }

    // Window check for students
    if (payload && normalizeRole(payload.role) === ROLES.STUDENT && payload.examId) {
      const serverNow = new Date()
      const preDownloadMinutes = config.sebPreDownloadMinutes || 30
      const exam = await prisma.exam.findUnique({
        where: { id: payload.examId }
      })

      if (!exam || !['PUBLISHED', 'ACTIVE'].includes(exam.status)) {
        sebDiagnosticsService.recordLaunchHop(correlationId, {
          step: 'CONFIG_DOWNLOAD_REQUEST',
          status: 403,
          code: 'EXAM_WINDOW_CLOSED',
          userAgent: req.headers['user-agent'],
          details: 'Exam window is closed'
        })
        return res.status(403).json({ code: 'EXAM_WINDOW_CLOSED', message: 'Exam window is closed.' })
      }

      const openTime = new Date(new Date(exam.startTime).getTime() - preDownloadMinutes * 60 * 1000)
      const closeTime = new Date(exam.endTime)

      if (serverNow < openTime || serverNow > closeTime) {
        sebDiagnosticsService.recordLaunchHop(correlationId, {
          step: 'CONFIG_DOWNLOAD_REQUEST',
          status: 403,
          code: 'EXAM_WINDOW_CLOSED',
          userAgent: req.headers['user-agent'],
          details: 'Exam window is closed'
        })
        return res.status(403).json({ code: 'EXAM_WINDOW_CLOSED', message: 'Exam window is closed.' })
      }
    }

    // Retrieve .seb configuration file from S3 storage
    const sebConfig = await settingsService.getSebConfig()
    let buffer = null

    if (sebConfig && sebConfig.fileKey) {
      const storage = getStorageAdapter()
      try {
        buffer = await storage.getObjectBuffer(sebConfig.fileKey)
      } catch (storageErr) {
        logger.error({ storageErr }, 'Storage adapter error fetching SEB config file')
      }
    }

    // Dynamic Fallback: If S3 file is missing or empty, generate valid starter SEB config dynamically
    if (!buffer || buffer.length === 0) {
      const starterXml = generateStarterSebConfig({
        publicOrigin: config.publicOrigin || 'https://proctornet.duckdns.org',
        s3Host: config.s3PublicHost || ''
      })
      buffer = Buffer.from(starterXml, 'utf8')
    }

    // Sanitize plain XML so background services don't crash student SEB instances
    if (buffer && buffer.length > 0 && buffer.slice(0, 5).toString('utf8').includes('<?xml')) {
      const sanitizedXml = sanitizeProhibitedProcesses(buffer.toString('utf8'))
      buffer = Buffer.from(sanitizedXml, 'utf8')
    }

    sebDiagnosticsService.recordLaunchHop(correlationId, {
      step: 'CONFIG_DOWNLOAD_REQUEST',
      status: 200,
      code: 'SUCCESS',
      bytes: buffer.length,
      userAgent: req.headers['user-agent'],
      details: `Configuration file downloaded (${buffer.length} bytes)`
    })

    res.setHeader('Content-Type', 'application/seb')
    res.setHeader('Content-Disposition', 'attachment; filename="ProctorNet-Exam.seb"')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.status(200).send(buffer)
  } catch (err) {
    logger.error({ err }, 'Error serving SEB configuration file')
    next(err)
  }
}

/**
 * Single-use Exchange Endpoint: exchanges launch token for authenticated student session.
 * GET /api/v1/seb/exchange?launch=TOKEN
 */
async function exchange(req, res, next) {
  try {
    const requestId = req.headers['x-request-id'] || req.id || crypto.randomUUID().slice(0, 8)
    const rawToken = req.query.launch || req.query.token
    if (!rawToken) {
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=missing_token')
      }
      return res.status(400).json({
        code: 'INVALID_CODE',
        message: 'Launch token is required in query parameter ?launch=TOKEN',
        requestId
      })
    }

    const validateResult = sebTokenService.validateLaunchToken(rawToken)
    const errCorrelationId = validateResult.record?.correlationId || crypto.createHash('sha256').update(rawToken).digest('hex').slice(0, 12)

    if (validateResult.status === 'NOT_FOUND') {
      sebDiagnosticsService.recordExchangeFailure({ code: 'INVALID_TOKEN', requestId, userAgent: req.headers['user-agent'], clientIp: req.ip })
      sebDiagnosticsService.recordLaunchHop(errCorrelationId, { step: 'TOKEN_EXCHANGE', status: 401, code: 'INVALID_TOKEN', details: 'Token not found' })
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=invalid_token')
      }
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid or unrecognized launch token.',
        requestId
      })
    }

    if (validateResult.status === 'EXPIRED') {
      sebDiagnosticsService.recordExchangeFailure({ code: 'TOKEN_EXPIRED', requestId, userAgent: req.headers['user-agent'], clientIp: req.ip })
      sebDiagnosticsService.recordLaunchHop(errCorrelationId, { step: 'TOKEN_EXCHANGE', status: 401, code: 'TOKEN_EXPIRED', details: 'Token expired' })
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=expired')
      }
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Launch token has expired. Please return to your browser and request a new launch link.',
        requestId
      })
    }

    if (validateResult.status === 'ALREADY_USED') {
      sebDiagnosticsService.recordExchangeFailure({ code: 'TOKEN_ALREADY_USED', requestId, userAgent: req.headers['user-agent'], clientIp: req.ip })
      sebDiagnosticsService.recordLaunchHop(errCorrelationId, { step: 'TOKEN_EXCHANGE', status: 409, code: 'TOKEN_ALREADY_USED', details: 'Token already used' })
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=already_used')
      }
      return res.status(409).json({
        code: 'TOKEN_ALREADY_USED',
        message: 'This launch token has already been used. Please return to your browser and request a new launch link.',
        requestId
      })
    }

    const { record } = validateResult
    const sebState = await getInstitutionSebState()
    const userAgent = req.headers['user-agent'] || ''
    const isSebAgent = /SEB|SafeExamBrowser/i.test(userAgent)

    // Decoupled exchange: evaluates and records SEB headers for diagnostics without blocking session issuance
    const activeKey = sebState.configKey ? sebState.configKey.trim().toLowerCase() : null
    const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
    const hasHeader = typeof rawHeader === 'string' && rawHeader.trim().length > 0
    const headerMatch = activeKey ? Boolean(verifySebHeaderHash(req, activeKey)) : false

    const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
    const rawPath = (req.originalUrl || req.url || '').split('#')[0]
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const canonicalUrl = `${cleanPublicOrigin}${normalizedPath}`

    if (hasHeader && !headerMatch && activeKey) {
      const evalResult = sebDiagnosticsService.evaluateHeaderMismatch(rawHeader, canonicalUrl, activeKey)
      sebDiagnosticsService.recordExchangeFailure({
        code: 'SEB_HEADER_MISMATCH',
        requestId,
        userAgent,
        clientIp: req.ip,
        likelyCause: evalResult.likelyCause,
        matchedVariant: evalResult.matchedVariant,
        receivedHeader: rawHeader
      })
      sebDiagnosticsService.recordAttempt({
        purpose: record.purpose || 'exam',
        outcome: 'HEADER_MISMATCH',
        userAgent,
        clientIp: req.ip
      })
    } else if (!hasHeader && isSebAgent) {
      sebDiagnosticsService.recordExchangeFailure({
        code: 'SEB_HEADER_MISSING',
        requestId,
        userAgent,
        clientIp: req.ip,
        likelyCause: 'Safe Exam Browser configuration header is missing.'
      })
    } else if (headerMatch) {
      sebDiagnosticsService.recordAttempt({
        purpose: record.purpose || 'exam',
        outcome: 'SUCCESS',
        userAgent,
        clientIp: req.ip
      })
    }

    // Consume the token atomically on initial exchange (replays within 60s will not re-consume)
    if (!validateResult.isReplay) {
      sebTokenService.markConsumed(record)
    }

    // Lookup user by id
    const user = await prisma.user.findUnique({
      where: { id: record.userId }
    })

    if (!user || user.status === 'SUSPENDED') {
      return res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is invalid or suspended. Please contact your administrator.'
      })
    }

    // Issue authentication tokens and set HttpOnly cookies
    const { accessToken, refreshToken } = authService.issueTokens(user)
    setAuthCookie(res, accessToken)
    setAccessCookie(res, accessToken)
    if (refreshToken) {
      setRefreshCookie(res, refreshToken)
    }

    if (headerMatch && record.examId) {
      try {
        const attempt = await prisma.examAttempt.findUnique({
          where: { examId_studentId: { examId: record.examId, studentId: user.id } },
          select: { id: true }
        })
        if (attempt?.id) {
          const { markAttemptSebVerified } = require('../../middleware/seb')
          markAttemptSebVerified(attempt.id)
        }
      } catch (_) {}
    }

    logger.info(
      { userId: user.id, examId: record.examId, purpose: record.purpose, isSebAgent },
      'Safe Exam Browser launch token successfully exchanged for user session'
    )

    sebDiagnosticsService.recordAttempt({
      purpose: record.purpose || 'exam',
      outcome: 'SUCCESS',
      userAgent,
      clientIp: req.ip
    })

    if (record.purpose === 'check' || normalizeRole(user.role) === ROLES.ADMIN || normalizeRole(user.role) === ROLES.FACULTY) {
      const nowIso = new Date().toISOString()
      await settingsService.updateSebLastVerified(nowIso, {
        method: 'exchange_token',
        userAgent
      })
      invalidateInstitutionSebState()

      // If a student ran a check, update their user profileMetadata
      if (record.purpose === 'check') {
        try {
          const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { profileMetadata: true }
          })
          const meta = (currentUser?.profileMetadata && typeof currentUser.profileMetadata === 'object')
            ? currentUser.profileMetadata
            : {}
          const detectedVersion = userAgent.match(/SEB\/([0-9.]+)/i)?.[1] || (isSebAgent ? 'SEB 3.x' : 'Verified Browser')
          await prisma.user.update({
            where: { id: user.id },
            data: {
              profileMetadata: {
                ...meta,
                sebLastCheckedAt: nowIso,
                sebVersion: detectedVersion,
                sebChecked: true
              }
            }
          })
        } catch (metaErr) {
          logger.warn({ err: metaErr.message }, 'Failed to update student profileMetadata for SEB check')
        }
      }
    }

    let destination = '/student/dashboard'
    if (record.purpose === 'check') {
      destination = (normalizeRole(user.role) === ROLES.ADMIN)
        ? '/admin/seb?verified=1'
        : (normalizeRole(user.role) === ROLES.FACULTY)
          ? '/faculty/exams?verified=1'
          : '/student/secure-browser?verified=1'
    } else if (record.examId) {
      destination = `/student/exams/${record.examId}/start`
    }

    sebDiagnosticsService.recordLaunchHop(record.correlationId, {
      step: 'TOKEN_EXCHANGE',
      status: 200,
      code: 'SUCCESS',
      userId: user.id,
      examId: record.examId,
      purpose: record.purpose,
      userAgent,
      details: 'Launch token successfully exchanged for user session'
    })

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(200).json({
        success: true,
        correlationId: record.correlationId,
        redirectUrl: destination,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token: accessToken
      })
    }

    return res.redirect(302, destination)
  } catch (err) {
    logger.error({ err }, 'Error during SEB launch token exchange')
    next(err)
  }
}

/**
 * Returns student-facing SEB setup status (profile check date, version, and institution mode).
 * GET /api/v1/seb/student-check-status
 */
async function getStudentCheckStatus(req, res, next) {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' })
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileMetadata: true }
    })
    const meta = (userData?.profileMetadata && typeof userData.profileMetadata === 'object')
      ? userData.profileMetadata
      : {}

    const institutionSeb = await getInstitutionSebState()

    return res.status(200).json({
      checked: Boolean(meta.sebChecked),
      lastCheckedAt: meta.sebLastCheckedAt || null,
      sebVersion: meta.sebVersion || null,
      institutionSeb: {
        configured: institutionSeb.configured,
        effectiveMode: institutionSeb.effectiveMode,
        requestedMode: institutionSeb.requestedMode,
        lastVerifiedAt: institutionSeb.lastVerifiedAt
      }
    })
  } catch (err) {
    logger.error({ err }, 'Error fetching student SEB check status')
    next(err)
  }
}

/**
 * Live status query for launch tokens (used by frontend polling while waiting for SEB).
 * GET /api/v1/seb/token-status/:token
 */
async function getTokenStatus(req, res, next) {
  try {
    const { token } = req.params
    if (!token) {
      return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Token parameter is required.' })
    }

    const result = sebTokenService.checkTokenStatus(token)
    return res.status(200).json({
      status: result.status,
      consumed: result.status === 'CONSUMED',
      consumedAt: result.consumedAt || null,
      purpose: result.purpose || null
    })
  } catch (err) {
    logger.error({ err }, 'Error checking token status')
    next(err)
  }
}

/**
 * Public Diagnostic endpoint: inspects incoming request headers, configuration state, and origin.
 * GET /api/v1/seb/diagnostics
 */
async function getPublicDiagnostics(req, res, next) {
  try {
    const sebState = await getInstitutionSebState()
    const activeKey = sebState.configKey ? sebState.configKey.trim().toLowerCase() : null
    const userAgent = req.headers['user-agent'] || ''
    const isSebAgent = /SEB|SafeExamBrowser/i.test(userAgent)

    const rawConfigHeader = req.headers['x-safeexambrowser-configkeyhash']
    const hasHeader = typeof rawConfigHeader === 'string' && rawConfigHeader.trim().length > 0
    const headerMatch = activeKey ? Boolean(verifySebHeaderHash(req, activeKey)) : false

    const diagnosticRef = req.headers['x-request-id'] || req.id || crypto.randomUUID().slice(0, 8)

    return res.status(200).json({
      success: true,
      sebHeaderPresent: hasHeader,
      sebHeaderMatch: headerMatch,
      effectiveMode: sebState.effectiveMode,
      publicOrigin: sebState.publicOrigin,
      configVersion: sebState.configVersion || null,
      isSebAgent,
      diagnosticRef
    })
  } catch (err) {
    logger.error({ err }, 'Error serving public SEB diagnostics')
    next(err)
  }
}

module.exports = {
  ping,
  createLaunchLink,
  downloadSebConfig,
  exchange,
  verifySebHeaderHash,
  getStudentCheckStatus,
  getTokenStatus,
  getPublicDiagnostics
}
