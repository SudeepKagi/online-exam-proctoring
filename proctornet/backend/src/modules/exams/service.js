const { examRepository } = require('./repository')
const { attemptPrewarmJob } = require('../attempts/prewarmJob')
const { attemptService } = require('../attempts/service')
const { logger } = require('../../shared/logging')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} = require('../../shared/errors')
const { ROLES, normalizeRole } = require('../../shared/roles')

/**
 * Generate unambiguous password (>= 10 chars, no 0/O/1/I/l) using crypto (R-10)
 */
function generateUnambiguousPassword(length = 12) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const bytes = crypto.randomBytes(length)
  let pass = ''
  for (let i = 0; i < length; i++) {
    pass += alphabet[bytes[i] % alphabet.length]
  }
  return pass
}

class ExamService {
  async createExam(data, facultyId) {
    const invId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const rawInvPassword = generateUnambiguousPassword(12)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)

    const exam = await examRepository.create({
      ...data,
      facultyId,
      invId,
      invPasswordHash,
      status: 'DRAFT',
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    })

    const validUntil = new Date(
      new Date(data.endTime).getTime() + 24 * 60 * 60 * 1000
    ).toISOString()

    return {
      ...exam,
      invId,
      rawInvPassword,
      oneTimePassword: rawInvPassword,
      validUntil,
    }
  }

  async publishExam(examId, facultyId, userRole) {
    const exam = await examRepository.findById(examId, { includeQuestions: true })

    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    if (normalizeRole(userRole) === ROLES.FACULTY && exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (exam.status !== 'DRAFT') {
      throw new ConflictError(`Exam cannot be published from state '${exam.status}'`)
    }

    // R-14: Publish Schedule Validation
    if (new Date(exam.endTime) <= new Date(exam.startTime)) {
      throw new ValidationError('Cannot publish exam: endTime must be strictly after startTime')
    }
    if (!exam.duration || exam.duration <= 0) {
      throw new ValidationError('Cannot publish exam: duration must be greater than 0 minutes')
    }
    if (new Date(exam.endTime).getTime() < Date.now()) {
      throw new ValidationError('Cannot publish exam: exam endTime has already passed')
    }

    if (!exam.questions || exam.questions.length === 0) {
      throw new ValidationError('Cannot publish exam: At least one question is required')
    }

    // P2 Invariant Validation: MCQ-only rules check
    for (const q of exam.questions) {
      if (q.options.length < 2 || q.options.length > 6) {
        throw new ValidationError(
          `Cannot publish exam: Question '${q.id}' violates MCQ rules: must have between 2 and 6 options (found ${q.options.length})`
        )
      }
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        throw new ValidationError(
          `Cannot publish exam: Question '${q.id}' violates MCQ rules: must have exactly 1 correct option (found ${correctCount})`
        )
      }
      if (q.marks <= 0) {
        throw new ValidationError(
          `Cannot publish exam: Question '${q.id}' violates MCQ rules: marks must be greater than 0`
        )
      }
      if (q.negativeMarks < 0 || q.negativeMarks > q.marks) {
        throw new ValidationError(
          `Cannot publish exam: Question '${q.id}' violates MCQ rules: negative marks must be between 0 and ${q.marks}`
        )
      }
    }

    // Generate fresh one-time invigilator password on publish (R-10)
    const rawInvPassword = generateUnambiguousPassword(12)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)
    const validUntil = new Date(
      new Date(exam.endTime).getTime() + 24 * 60 * 60 * 1000
    ).toISOString()

    let invId = exam.invId
    const updatePayload = { invPasswordHash }
    if (!invId) {
      invId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      updatePayload.invId = invId
    }

    await examRepository.update(examId, updatePayload)

    const updated = await examRepository.updateStatus(examId, 'PUBLISHED')

    // R-14: Trigger pre-warming and surface result or error with retry
    let prewarmResult = null
    let prewarmError = null
    try {
      prewarmResult = await attemptPrewarmJob.prewarmExam(examId)
    } catch (err) {
      logger.warn({ error: err.message, examId }, 'Prewarm failed on publish, surfaced for retry')
      prewarmError = err.message
    }

    const prewarmStatus = prewarmError ? 'FAILED' : 'SUCCESS'

    return {
      ...updated,
      invId: updated?.invId || invId,
      rawInvPassword,
      oneTimePassword: rawInvPassword,
      validUntil,
      prewarm: {
        status: prewarmStatus,
        prewarmedCount: prewarmResult?.prewarmedCount || 0,
        error: prewarmError,
        retryEndpoint: `/api/v1/exams/${examId}/prewarm`,
      },
    }
  }

  /**
   * Regenerate invigilator credentials (R-10)
   * Invalidates existing sessions, logs audit entry, and returns one-time password
   */
  async regenerateInvigilatorCredentials(examId, actorId, actorRole) {
    const exam = await examRepository.findById(examId)
    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    if (normalizeRole(actorRole) === ROLES.FACULTY && exam.facultyId !== actorId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    const { prisma } = require('../../infra/postgres/client')

    // Invalidate old active sessions
    await prisma.invigilatorSession.updateMany({
      where: { examId, isActive: true },
      data: { isActive: false },
    })

    const newInvId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const rawInvPassword = generateUnambiguousPassword(12)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)
    const validUntil = new Date(
      new Date(exam.endTime).getTime() + 24 * 60 * 60 * 1000
    ).toISOString()

    await examRepository.update(examId, {
      invId: newInvId,
      invPasswordHash,
    })

    // Audit log
    await prisma.auditLog
      .create({
        data: {
          actorId,
          actorRole: normalizeRole(actorRole),
          action: 'EXAM_INVIGILATOR_CREDENTIALS_REGENERATED',
          resourceType: 'Exam',
          resourceId: examId,
          metadata: { examId, invId: newInvId, validUntil },
        },
      })
      .catch(err => {
        logger.warn(
          { error: err.message, examId },
          'Failed to record audit log for invigilator credentials regeneration'
        )
      })

    return {
      success: true,
      examId,
      invId: newInvId,
      rawInvPassword,
      oneTimePassword: rawInvPassword,
      validUntil,
    }
  }

  async updateExam(examId, data, facultyId, userRole) {
    const exam = await examRepository.findById(examId)
    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    if (normalizeRole(userRole) === ROLES.FACULTY && exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (exam.status !== 'DRAFT') {
      throw new ConflictError(
        `Exam is in '${exam.status}' status. Content is immutable once published.`
      )
    }

    // Strip client-writable status and id (A-07)
    const { status, id, ...allowedData } = data

    const updated = await examRepository.update(examId, {
      ...allowedData,
      startTime: allowedData.startTime ? new Date(allowedData.startTime) : undefined,
      endTime: allowedData.endTime ? new Date(allowedData.endTime) : undefined,
    })

    // Invalidate content cache
    await attemptService.invalidateExamContentCache(examId).catch(err => {
      logger.warn({ error: err.message, examId }, 'Failed to invalidate exam content cache')
    })

    return updated
  }

  async getExam(examId, user) {
    const exam = await examRepository.findByIdWithFaculty(examId)

    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    // Sanitize invPasswordHash and one-time passwords - NEVER returned by any GET (R-10)
    const { invPasswordHash, rawInvPassword, oneTimePassword, ...safeExam } = exam
    return safeExam
  }

  /**
   * Get operational and scheduling settings for an exam (R-10 / P3)
   * Invigilators (assigned to this exam), Faculty (owner), or Admin
   */
  async getExamSettings(examId, user) {
    const exam = await examRepository.findById(examId)
    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    const role = normalizeRole(user.role)
    if (role === ROLES.INVIGILATOR) {
      if (user.examId && user.examId !== examId) {
        throw new ForbiddenError('Access denied: You are not assigned to this exam')
      }
    } else if (role === ROLES.FACULTY) {
      if (exam.facultyId !== user.id) {
        throw new ForbiddenError('Access denied: You do not own this exam')
      }
    } else if (role !== ROLES.ADMIN) {
      throw new ForbiddenError('Access denied: Insufficient privileges')
    }

    return {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      status: exam.status,
      startTime: exam.startTime,
      endTime: exam.endTime,
      duration: exam.duration,
      cameraRequired: exam.cameraRequired,
      micRequired: exam.micRequired,
      browserLock: exam.browserLock,
      fullScreenMode: exam.fullScreenMode,
      watermarkRequired: exam.watermarkRequired,
      tabSwitchLimit: exam.tabSwitchLimit,
      aiReverifyInterval: exam.aiReverifyInterval,
      deviceAgentPolicy: exam.deviceAgentPolicy,
      vpnRequired: exam.vpnRequired,
      isPaused: exam.isPaused,
      pauseReason: exam.pauseReason,
      totalMarks: exam.totalMarks,
    }
  }

  /**
   * Update operational & scheduling settings (R-10 / P3)
   * Restrict updates strictly to valid settings only.
   * Invigilators (assigned to this exam), Faculty (owner), or Admin
   */
  async updateExamSettings(examId, data, user, io) {
    const exam = await examRepository.findById(examId)
    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    const role = normalizeRole(user.role)
    if (role === ROLES.INVIGILATOR) {
      if (user.examId && user.examId !== examId) {
        throw new ForbiddenError('Access denied: You are not assigned to this exam')
      }
    } else if (role === ROLES.FACULTY) {
      if (exam.facultyId !== user.id) {
        throw new ForbiddenError('Access denied: You do not own this exam')
      }
    } else if (role !== ROLES.ADMIN) {
      throw new ForbiddenError('Access denied: Insufficient privileges')
    }

    if (['ENDED', 'EVALUATED', 'RESULT_PUBLISHED'].includes(exam.status)) {
      throw new ConflictError('Cannot modify settings for an exam that has already concluded')
    }

    // Schedule invariant checks
    const effectiveStart = data.startTime ? new Date(data.startTime) : new Date(exam.startTime)
    const effectiveEnd = data.endTime ? new Date(data.endTime) : new Date(exam.endTime)

    if (effectiveEnd.getTime() <= effectiveStart.getTime()) {
      throw new ValidationError('Exam endTime must be strictly after startTime')
    }

    const { prisma } = require('../../infra/postgres/client')

    // Whitelist mapping strictly to valid operational settings
    const updatePayload = {}
    if (data.startTime !== undefined) updatePayload.startTime = effectiveStart
    if (data.endTime !== undefined) updatePayload.endTime = effectiveEnd
    if (data.duration !== undefined) updatePayload.duration = data.duration
    if (data.cameraRequired !== undefined) updatePayload.cameraRequired = data.cameraRequired
    if (data.micRequired !== undefined) updatePayload.micRequired = data.micRequired
    if (data.browserLock !== undefined) updatePayload.browserLock = data.browserLock
    if (data.fullScreenMode !== undefined) updatePayload.fullScreenMode = data.fullScreenMode
    if (data.watermarkRequired !== undefined)
      updatePayload.watermarkRequired = data.watermarkRequired
    if (data.tabSwitchLimit !== undefined) updatePayload.tabSwitchLimit = data.tabSwitchLimit
    if (data.aiReverifyInterval !== undefined)
      updatePayload.aiReverifyInterval = data.aiReverifyInterval
    if (data.deviceAgentPolicy !== undefined)
      updatePayload.deviceAgentPolicy = data.deviceAgentPolicy
    if (data.vpnRequired !== undefined) updatePayload.vpnRequired = data.vpnRequired

    // If rescheduled to start now or in past, promote PUBLISHED/SCHEDULED -> LIVE immediately
    const nowMs = Date.now()
    if (
      (exam.status === 'PUBLISHED' || exam.status === 'SCHEDULED') &&
      effectiveStart.getTime() <= nowMs &&
      effectiveEnd.getTime() > nowMs
    ) {
      updatePayload.status = 'LIVE'
    }

    const updated = await examRepository.update(examId, updatePayload)

    // Synchronize attempt expirations if endTime extended
    if (data.endTime && effectiveEnd.getTime() > new Date(exam.endTime).getTime()) {
      await prisma.examAttempt
        .updateMany({
          where: {
            examId,
            status: 'ACTIVE',
            expiresAt: { lt: effectiveEnd },
          },
          data: {
            expiresAt: effectiveEnd,
          },
        })
        .catch(err => {
          logger.warn({ error: err.message, examId }, 'Failed to extend active attempt deadlines')
        })
    }

    // Audit log (never empty catch)
    await prisma.auditLog
      .create({
        data: {
          actorId: user.id || user.userId || 'invigilator',
          actorRole: role,
          action: 'EXAM_SETTINGS_UPDATED',
          resourceType: 'Exam',
          resourceId: examId,
          metadata: {
            examId,
            actor: user.email || user.name || user.id || 'invigilator',
            updatedFields: Object.keys(updatePayload),
            newStartTime: updatePayload.startTime?.toISOString(),
            newEndTime: updatePayload.endTime?.toISOString(),
            newDuration: updatePayload.duration,
          },
        },
      })
      .catch(err => {
        logger.warn(
          { error: err.message, examId },
          'Failed to record audit log for exam settings update'
        )
      })

    // Invalidate content cache
    await attemptService.invalidateExamContentCache(examId).catch(err => {
      logger.warn({ error: err.message, examId }, 'Failed to invalidate exam content cache')
    })

    const safeSettings = {
      id: updated.id,
      title: updated.title,
      subject: updated.subject,
      status: updated.status,
      startTime: updated.startTime,
      endTime: updated.endTime,
      duration: updated.duration,
      cameraRequired: updated.cameraRequired,
      micRequired: updated.micRequired,
      browserLock: updated.browserLock,
      fullScreenMode: updated.fullScreenMode,
      watermarkRequired: updated.watermarkRequired,
      tabSwitchLimit: updated.tabSwitchLimit,
      aiReverifyInterval: updated.aiReverifyInterval,
      deviceAgentPolicy: updated.deviceAgentPolicy,
      vpnRequired: updated.vpnRequired,
      isPaused: updated.isPaused,
      pauseReason: updated.pauseReason,
    }

    if (io) {
      io.to(`exam:${examId}`).emit('exam:updated', {
        examId,
        settings: safeSettings,
        message: 'Exam settings or schedule updated by invigilator',
      })
      io.to(`inv:${examId}`).emit('exam:updated', {
        examId,
        settings: safeSettings,
      })
    }

    return {
      success: true,
      examId,
      settings: safeSettings,
    }
  }
}

module.exports = {
  ExamService,
  examService: new ExamService(),
  generateUnambiguousPassword,
}
