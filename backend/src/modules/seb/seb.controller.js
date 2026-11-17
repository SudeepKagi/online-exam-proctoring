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

/**
 * Validates X-SafeExamBrowser-ConfigKeyHash against candidate URLs for the given activeKey.
 */
function verifySebHeaderHash(req, activeKey, targetPath = null) {
  if (!activeKey || !/^[0-9a-f]{64}$/.test(activeKey)) return false
  const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
  const receivedHeader = typeof rawHeader === 'string' ? rawHeader.trim() : ''
  if (!/^[0-9a-fA-F]{64}$/.test(receivedHeader)) return false

  const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
  const rawPath = targetPath || (req.originalUrl || req.url || '').split('#')[0]
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const expectedUrl = `${cleanPublicOrigin}${normalizedPath}`

  const rawReferer = (req.headers.referer || req.headers.referrer || '').split('#')[0]
  const clientHref = (req.body?.href || req.query?.href || '').split('#')[0]

  const candidateUrls = new Set([
    expectedUrl,
    expectedUrl.replace(/\/$/, ''),
    `${cleanPublicOrigin}:443${normalizedPath}`,
    `${cleanPublicOrigin}/student/login`,
    `${cleanPublicOrigin}/student/login/`,
    `${cleanPublicOrigin}/login`,
    `${cleanPublicOrigin}/login/`,
    `${cleanPublicOrigin}/`,
    cleanPublicOrigin
  ])

  if (rawReferer) {
    candidateUrls.add(rawReferer)
    candidateUrls.add(rawReferer.replace(/\/$/, ''))
  }
  if (clientHref) {
    candidateUrls.add(clientHref)
    candidateUrls.add(clientHref.replace(/\/$/, ''))
  }

  const receivedBuf = Buffer.from(receivedHeader.toLowerCase(), 'utf8')

  for (const candUrl of candidateUrls) {
    // Variant A: SHA256(url + activeKey)
    const hashA = crypto.createHash('sha256').update(candUrl + activeKey).digest('hex').toLowerCase()
    const bufA = Buffer.from(hashA, 'utf8')
    if (bufA.length === receivedBuf.length && crypto.timingSafeEqual(bufA, receivedBuf)) {
      return { matched: true, method: 'header_hash' }
    }

    // Variant B: SHA256(url + SHA256(activeKey))
    const hashKey = crypto.createHash('sha256').update(activeKey).digest('hex')
    const hashB = crypto.createHash('sha256').update(candUrl + hashKey).digest('hex').toLowerCase()
    const bufB = Buffer.from(hashB, 'utf8')
    if (bufB.length === receivedBuf.length && crypto.timingSafeEqual(bufB, receivedBuf)) {
      return { matched: true, method: 'header_hash_hashed_key' }
    }

    // Variant C: SHA256(url + Buffer.from(activeKey, 'hex'))
    try {
      const hashC = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(candUrl, 'utf8'), Buffer.from(activeKey, 'hex')])).digest('hex').toLowerCase()
      const bufC = Buffer.from(hashC, 'utf8')
      if (bufC.length === receivedBuf.length && crypto.timingSafeEqual(bufC, receivedBuf)) {
        return { matched: true, method: 'header_hash_binary_key' }
      }
    } catch (_) {}
  }

  return false
}

async function ping(req, res, next) {
  try {
    const sebState = await getInstitutionSebState()
    const activeKey = sebState.configKey ? sebState.configKey.trim().toLowerCase() : null

    const userAgent = req.headers['user-agent'] || ''
    const isSebAgent = /SEB|SafeExamBrowser/i.test(userAgent)

    if (!activeKey || !/^[0-9a-f]{64}$/.test(activeKey)) {
      return res.status(200).json({ verified: false, isSebAgent })
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
        userAgent
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
        method: matchMethod,
        timestamp: nowIso
      })
    }

    if (isSebAgent) {
      sebDiagnosticsService.recordAttempt({
        purpose: 'admin_test',
        outcome: 'HEADER_MISMATCH',
        userAgent,
        clientIp: req.ip
      })
    }

    return res.status(200).json({
      verified: false,
      isSebAgent
    })
  } catch (err) {
    logger.error({ err }, 'Error handling SEB ping')
    return res.status(200).json({ verified: false })
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

    // Generate stateful, single-use launch token, download token, and fallback PIN
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

    return res.status(200).json({
      success: true,
      url,
      launchUrl: url,
      downloadToken: tokenResult.downloadToken,
      exchangeToken: tokenResult.launchToken,
      launchToken: tokenResult.launchToken,
      token: tokenResult.launchToken, // Backwards compatibility for existing test assertions
      pin: tokenResult.pin,
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
          return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Launch token has expired' })
        }
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
        return res.status(403).json({ code: 'EXAM_WINDOW_CLOSED', message: 'Exam window is closed.' })
      }

      const openTime = new Date(new Date(exam.startTime).getTime() - preDownloadMinutes * 60 * 1000)
      const closeTime = new Date(exam.endTime)

      if (serverNow < openTime || serverNow > closeTime) {
        return res.status(403).json({ code: 'EXAM_WINDOW_CLOSED', message: 'Exam window is closed.' })
      }
    }

    // Retrieve .seb configuration file from S3 storage
    const sebConfig = await settingsService.getSebConfig()
    if (!sebConfig || !sebConfig.fileKey) {
      return res.status(404).json({
        code: 'SEB_CONFIG_FILE_NOT_FOUND',
        message: 'Institution Safe Exam Browser configuration file not found.'
      })
    }

    const storage = getStorageAdapter()
    let buffer
    try {
      buffer = await storage.getObjectBuffer(sebConfig.fileKey)
    } catch (storageErr) {
      logger.error({ storageErr }, 'Storage adapter error fetching SEB config file')
    }

    if (!buffer || buffer.length === 0) {
      return res.status(404).json({
        code: 'SEB_CONFIG_FILE_NOT_FOUND',
        message: 'Institution Safe Exam Browser configuration file not found.'
      })
    }

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
    const rawToken = req.query.launch || req.query.token
    if (!rawToken) {
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=missing_token')
      }
      return res.status(400).json({
        code: 'MISSING_LAUNCH_TOKEN',
        message: 'Launch token is required in query parameter ?launch=TOKEN'
      })
    }

    const consumeResult = sebTokenService.consumeLaunchToken(rawToken)
    if (consumeResult.status === 'NOT_FOUND') {
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=invalid_token')
      }
      return res.status(401).json({
        code: 'INVALID_LAUNCH_TOKEN',
        message: 'Invalid or unrecognized launch token.'
      })
    }

    if (consumeResult.status === 'EXPIRED') {
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=expired')
      }
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Launch token has expired. Please return to your browser and request a new launch link.'
      })
    }

    if (consumeResult.status === 'ALREADY_USED') {
      if (req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json')) {
        return res.redirect(302, '/seb/enter?error=already_used')
      }
      return res.status(409).json({
        code: 'TOKEN_ALREADY_USED',
        message: 'This launch token has already been used. Please return to your browser and request a new launch link.'
      })
    }

    const { record } = consumeResult
    const sebState = await getInstitutionSebState()
    const userAgent = req.headers['user-agent'] || ''
    const isSebAgent = /SEB|SafeExamBrowser/i.test(userAgent)

    // Enforcement mode security gating
    if (sebState.effectiveMode === 'enforce') {
      if (!isSebAgent) {
        return res.status(403).json({
          code: 'SEB_ENFORCEMENT_FAILED',
          message: 'Access restricted to verified Safe Exam Browser sessions. Standard browsers are blocked.'
        })
      }

      if (sebState.keyPresent && sebState.configKey) {
        const headerMatch = verifySebHeaderHash(req, sebState.configKey)
        if (!headerMatch) {
          logger.warn({ ip: req.ip, userAgent }, 'SEB enforcement failed on exchange: invalid or missing header hash')
          sebDiagnosticsService.recordAttempt({
            purpose: record.purpose || 'exam',
            outcome: 'HEADER_MISMATCH',
            userAgent,
            clientIp: req.ip
          })
          return res.status(403).json({
            code: 'SEB_ENFORCEMENT_FAILED',
            message: 'Safe Exam Browser configuration check failed. Configuration Key header is invalid.'
          })
        }
      }
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
      destination = '/student/secure-browser?verified=1'
    } else if (record.examId) {
      destination = `/student/exams/${record.examId}/start`
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(200).json({
        success: true,
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
 * Fallback 6-digit PIN Exchange Endpoint
 * POST /api/v1/seb/exchange-pin
 */
async function exchangePin(req, res, next) {
  try {
    const rawPin = req.body?.pin || req.body?.code
    if (!rawPin || typeof rawPin !== 'string') {
      return res.status(400).json({
        code: 'MISSING_PIN',
        message: 'A 6-digit launch code is required.'
      })
    }

    const consumeResult = sebTokenService.consumePin(rawPin.trim())
    if (consumeResult.status === 'NOT_FOUND') {
      return res.status(401).json({
        code: 'INVALID_PIN',
        message: 'Invalid 6-digit launch code. Please check the code and try again.'
      })
    }

    if (consumeResult.status === 'EXPIRED') {
      return res.status(401).json({
        code: 'PIN_EXPIRED',
        message: 'This launch code has expired. Please return to your browser to generate a fresh code.'
      })
    }

    if (consumeResult.status === 'ALREADY_USED') {
      return res.status(409).json({
        code: 'PIN_ALREADY_USED',
        message: 'This launch code has already been used. Please generate a fresh code.'
      })
    }

    const { record } = consumeResult
    const sebState = await getInstitutionSebState()
    const userAgent = req.headers['user-agent'] || ''
    const isSebAgent = /SEB|SafeExamBrowser/i.test(userAgent)

    if (sebState.effectiveMode === 'enforce') {
      if (!isSebAgent) {
        return res.status(403).json({
          code: 'SEB_ENFORCEMENT_FAILED',
          message: 'Access is restricted to verified Safe Exam Browser sessions.'
        })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId }
    })

    if (!user || user.status === 'SUSPENDED') {
      return res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is invalid or suspended.'
      })
    }

    const { accessToken, refreshToken } = authService.issueTokens(user)
    setAuthCookie(res, accessToken)
    setAccessCookie(res, accessToken)
    if (refreshToken) {
      setRefreshCookie(res, refreshToken)
    }

    logger.info(
      { userId: user.id, examId: record.examId, purpose: record.purpose, isSebAgent },
      'Safe Exam Browser launch PIN successfully exchanged for user session'
    )

    if (record.purpose === 'check' || normalizeRole(user.role) === ROLES.ADMIN || normalizeRole(user.role) === ROLES.FACULTY) {
      const nowIso = new Date().toISOString()
      await settingsService.updateSebLastVerified(nowIso, {
        method: 'exchange_pin',
        userAgent
      })
      invalidateInstitutionSebState()

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
          logger.warn({ err: metaErr.message }, 'Failed to update student profileMetadata for SEB PIN check')
        }
      }
    }

    let destination = '/student/dashboard'
    if (record.purpose === 'check') {
      destination = '/student/secure-browser?verified=1'
    } else if (record.examId) {
      destination = `/student/exams/${record.examId}/start`
    }

    return res.status(200).json({
      success: true,
      redirectUrl: destination,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: accessToken
    })
  } catch (err) {
    logger.error({ err }, 'Error during SEB launch PIN exchange')
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

module.exports = {
  ping,
  createLaunchLink,
  downloadSebConfig,
  exchange,
  exchangePin,
  verifySebHeaderHash,
  getStudentCheckStatus,
  getTokenStatus
}
