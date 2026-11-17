'use strict'

const crypto = require('crypto')
const config = require('../../shared/config')
const { settingsService } = require('../admin/settings.service')
const { getStorageAdapter } = require('../../infra/s3/s3.client')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { generateSebLaunchToken, verifySebLaunchToken } = require('./sebToken')
const { invalidateInstitutionSebState } = require('./seb.service')

async function ping(req, res, next) {
  try {
    const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
    const rawPath = (req.originalUrl || req.url || '').split('#')[0]
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const expectedUrl = `${cleanPublicOrigin}${normalizedPath}`

    let activeKey = null
    try {
      const sebConfig = await settingsService.getSebConfig()
      if (sebConfig && sebConfig.configKey) {
        activeKey = sebConfig.configKey.trim().toLowerCase()
      }
    } catch (_) {}

    if (!activeKey && process.env.SEB_CONFIG_KEY) {
      activeKey = process.env.SEB_CONFIG_KEY.trim().toLowerCase()
    }

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
    const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
    const receivedHeader = typeof rawHeader === 'string' ? rawHeader.trim() : ''
    const is64Hex = /^[0-9a-fA-F]{64}$/.test(receivedHeader)

    if (!matched && is64Hex) {
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
          matched = true
          matchMethod = 'header_hash'
          break
        }

        // Variant B: SHA256(url + SHA256(activeKey))
        const hashKey = crypto.createHash('sha256').update(activeKey).digest('hex')
        const hashB = crypto.createHash('sha256').update(candUrl + hashKey).digest('hex').toLowerCase()
        const bufB = Buffer.from(hashB, 'utf8')
        if (bufB.length === receivedBuf.length && crypto.timingSafeEqual(bufB, receivedBuf)) {
          matched = true
          matchMethod = 'header_hash_hashed_key'
          break
        }

        // Variant C: SHA256(url + Buffer.from(activeKey, 'hex'))
        try {
          const hashC = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(candUrl, 'utf8'), Buffer.from(activeKey, 'hex')])).digest('hex').toLowerCase()
          const bufC = Buffer.from(hashC, 'utf8')
          if (bufC.length === receivedBuf.length && crypto.timingSafeEqual(bufC, receivedBuf)) {
            matched = true
            matchMethod = 'header_hash_binary_key'
            break
          }
        } catch (_) {}
      }
    }

    if (matched) {
      const nowIso = new Date().toISOString()
      await settingsService.updateSebLastVerified(nowIso, {
        method: matchMethod,
        userAgent
      })
      invalidateInstitutionSebState()
      logger.info({ matchMethod, ip: req.ip }, 'Safe Exam Browser ping successfully verified')
      return res.status(200).json({
        verified: true,
        method: matchMethod,
        timestamp: nowIso
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

    let qualifyingExamId = null
    const userRole = normalizeRole(user.role)

    if (userRole === ROLES.ADMIN) {
      // Admins can generate launch links anytime for testing
      qualifyingExamId = null
    } else if (userRole === ROLES.STUDENT) {
      const serverNow = new Date()
      const preDownloadMinutes = config.sebPreDownloadMinutes || 30
      const windowStart = new Date(serverNow.getTime() + preDownloadMinutes * 60 * 1000)

      const candidateExams = await prisma.exam.findMany({
        where: {
          status: { in: ['PUBLISHED', 'ACTIVE'] },
          startTime: { lte: windowStart },
          endTime: { gte: serverNow }
        },
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
    } else {
      // Faculty/Invigilator can also test launch links
      qualifyingExamId = null
    }

    const token = generateSebLaunchToken({
      userId: user.id,
      role: user.role,
      examId: qualifyingExamId,
      expMinutes: 10
    })

    const origin = new URL(config.publicOrigin || 'http://localhost:5000')
    const scheme = origin.protocol === 'https:' ? 'sebs:' : 'seb:'
    const url = `${scheme}//${origin.host}/api/v1/seb/config/${token}.seb`

    return res.status(200).json({ url })
  } catch (err) {
    logger.error({ err }, 'Error creating SEB launch link')
    next(err)
  }
}

async function downloadSebConfig(req, res, next) {
  try {
    const rawToken = req.params.token || req.params[0] || ''
    const cleanToken = rawToken.replace(/\.seb$/i, '')

    const verification = verifySebLaunchToken(cleanToken)
    if (!verification.valid) {
      if (verification.error === 'TOKEN_EXPIRED') {
        return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Launch token has expired' })
      }
      return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or tampered token' })
    }

    const { payload } = verification

    // Window check for students
    if (normalizeRole(payload.role) === ROLES.STUDENT && payload.examId) {
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

module.exports = {
  ping,
  createLaunchLink,
  downloadSebConfig
}
