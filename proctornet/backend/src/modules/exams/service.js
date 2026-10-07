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
  ValidationError
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
      endTime: new Date(data.endTime)
    })

    const validUntil = new Date(new Date(data.endTime).getTime() + 24 * 60 * 60 * 1000).toISOString()

    return {
      ...exam,
      invId,
      rawInvPassword,
      oneTimePassword: rawInvPassword,
      validUntil
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

    if (!exam.questions || exam.questions.length === 0) {
      throw new ValidationError('Cannot publish exam: At least one question is required')
    }

    // P2 Invariant Validation: MCQ-only rules check
    for (const q of exam.questions) {
      if (q.options.length < 2 || q.options.length > 6) {
        throw new ValidationError(`Cannot publish exam: Question '${q.id}' violates MCQ rules: must have between 2 and 6 options (found ${q.options.length})`)
      }
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        throw new ValidationError(`Cannot publish exam: Question '${q.id}' violates MCQ rules: must have exactly 1 correct option (found ${correctCount})`)
      }
      if (q.marks <= 0) {
        throw new ValidationError(`Cannot publish exam: Question '${q.id}' violates MCQ rules: marks must be greater than 0`)
      }
      if (q.negativeMarks < 0 || q.negativeMarks > q.marks) {
        throw new ValidationError(`Cannot publish exam: Question '${q.id}' violates MCQ rules: negative marks must be between 0 and ${q.marks}`)
      }
    }

    // Generate fresh one-time invigilator password on publish (R-10)
    const rawInvPassword = generateUnambiguousPassword(12)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)
    const validUntil = new Date(new Date(exam.endTime).getTime() + 24 * 60 * 60 * 1000).toISOString()

    await examRepository.update(examId, { invPasswordHash })

    const updated = await examRepository.updateStatus(examId, 'PUBLISHED')

    // Trigger pre-warming in background
    attemptPrewarmJob.prewarmExam(examId).catch((err) => {
      logger.warn({ error: err.message, examId }, 'Failed to trigger background prewarm')
    })

    return {
      ...updated,
      invId: exam.invId,
      rawInvPassword,
      oneTimePassword: rawInvPassword,
      validUntil
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
      data: { isActive: false }
    })

    const newInvId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const rawInvPassword = generateUnambiguousPassword(12)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)
    const validUntil = new Date(new Date(exam.endTime).getTime() + 24 * 60 * 60 * 1000).toISOString()

    await examRepository.update(examId, {
      invId: newInvId,
      invPasswordHash
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole: normalizeRole(actorRole),
        action: 'EXAM_INVIGILATOR_CREDENTIALS_REGENERATED',
        resourceType: 'Exam',
        resourceId: examId,
        metadata: { examId, invId: newInvId, validUntil }
      }
    }).catch((err) => {
      logger.warn({ error: err.message, examId }, 'Failed to record audit log for invigilator credentials regeneration')
    })

    return {
      success: true,
      examId,
      invId: newInvId,
      rawInvPassword,
      oneTimePassword: rawInvPassword,
      validUntil
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
      throw new ConflictError(`Exam is in '${exam.status}' status. Content is immutable once published.`)
    }

    // Strip client-writable status and id (A-07)
    const { status, id, ...allowedData } = data

    const updated = await examRepository.update(examId, {
      ...allowedData,
      startTime: allowedData.startTime ? new Date(allowedData.startTime) : undefined,
      endTime: allowedData.endTime ? new Date(allowedData.endTime) : undefined
    })

    // Invalidate content cache
    await attemptService.invalidateExamContentCache(examId).catch((err) => {
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
}

module.exports = {
  ExamService,
  examService: new ExamService(),
  generateUnambiguousPassword
}
