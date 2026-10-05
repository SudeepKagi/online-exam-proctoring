const { prisma } = require('../../infra/postgres/client')
const {
  buildIdentityKey,
  buildEvidenceKey,
  buildQuestionKey,
  createDirectUploadPolicy
} = require('../../infra/s3/s3.client')
const {
  MAX_EVIDENCE_SIZE_BYTES,
  MAX_IDENTITY_SIZE_BYTES,
  checkEvidenceBudget
} = require('../../shared/evidencePolicy')
const {
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')
const { logger } = require('../../shared/logging')

class PresignService {
  /**
   * Authorize and generate direct client-to-S3 upload credentials (ADR-011)
   */
  async generateUploadPresignedUrl(user, { purpose, attemptId, examId, contentType, bytes }) {
    const normalizedPurpose = purpose.toUpperCase()

    const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png']
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new ValidationError(`Unsupported content type '${contentType}'. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`)
    }

    let key
    let maxAllowedBytes

    switch (normalizedPurpose) {
      case 'EVIDENCE': {
        if (!attemptId) {
          throw new ValidationError('attemptId is required for EVIDENCE uploads')
        }

        // BOLA + Active Guard in SQL
        const attempt = await prisma.examAttempt.findFirst({
          where: {
            id: attemptId,
            studentId: user.id,
            status: 'ACTIVE'
          },
          select: { id: true, examId: true, expiresAt: true }
        })

        if (!attempt) {
          throw new NotFoundError('Active exam attempt not found for this candidate')
        }

        if (new Date() > new Date(attempt.expiresAt)) {
          throw new ForbiddenError('Exam session has expired; uploads no longer accepted')
        }

        // Size check: evidence <= 300 KB
        if (bytes > MAX_EVIDENCE_SIZE_BYTES) {
          throw new ValidationError(`Evidence screenshot exceeds maximum allowed size of 300 KB (${bytes} bytes requested)`)
        }

        // Budget check (max 30 per attempt)
        const budget = await checkEvidenceBudget(attemptId, prisma)
        if (!budget.allowed) {
          throw new ForbiddenError(`Evidence budget cap reached (${budget.cap} screenshots max per attempt)`)
        }

        maxAllowedBytes = MAX_EVIDENCE_SIZE_BYTES
        key = buildEvidenceKey(attempt.examId, attemptId)
        break
      }

      case 'IDENTITY_PHOTO':
      case 'PROFILE':
      case 'IDENTITY': {
        if (user.role !== ROLES.STUDENT) {
          throw new ForbiddenError('Only candidates may upload identity profile photos')
        }
        if (bytes > MAX_IDENTITY_SIZE_BYTES) {
          throw new ValidationError(`Profile photo exceeds maximum allowed size of 2 MB (${bytes} bytes requested)`)
        }
        maxAllowedBytes = MAX_IDENTITY_SIZE_BYTES
        key = buildIdentityKey(user.id, 'profile')
        break
      }

      case 'ID_CARD': {
        if (user.role !== ROLES.STUDENT) {
          throw new ForbiddenError('Only candidates may upload student ID cards')
        }
        if (bytes > MAX_IDENTITY_SIZE_BYTES) {
          throw new ValidationError(`ID card snapshot exceeds maximum allowed size of 2 MB (${bytes} bytes requested)`)
        }
        maxAllowedBytes = MAX_IDENTITY_SIZE_BYTES
        key = buildIdentityKey(user.id, 'id-card')
        break
      }

      case 'QUESTION_IMAGE': {
        if (![ROLES.FACULTY, ROLES.ADMIN].includes(user.role)) {
          throw new ForbiddenError('Only faculty or administrators may upload question illustrations')
        }
        if (!examId) {
          throw new ValidationError('examId is required for question image uploads')
        }
        if (user.role === ROLES.FACULTY) {
          const exam = await prisma.exam.findFirst({
            where: { id: examId, facultyId: user.id }
          })
          if (!exam) {
            throw new ForbiddenError('Not authorized to upload question media for this exam')
          }
        }
        maxAllowedBytes = 2 * 1024 * 1024
        key = buildQuestionKey(examId)
        break
      }

      default:
        throw new ValidationError(`Unsupported upload purpose: ${purpose}`)
    }

    const policy = await createDirectUploadPolicy({
      key,
      contentType,
      maxSizeBytes: Math.min(bytes, maxAllowedBytes),
      expiresIn: 120
    })

    return {
      key: policy.key,
      url: policy.postUrl,
      fields: policy.fields,
      putUrl: policy.putUrl,
      contentType,
      maxSizeBytes: maxAllowedBytes,
      expiresIn: 120
    }
  }

  /**
   * Finalize direct upload, record storage key in DB, and enqueue outbox event
   */
  async completeUpload(user, data) {
    const normalizedPurpose = data.purpose.toUpperCase()

    if (normalizedPurpose === 'EVIDENCE') {
      if (!data.attemptId) {
        throw new ValidationError('attemptId is required to complete evidence upload')
      }

      return await prisma.$transaction(async (tx) => {
        const attempt = await tx.examAttempt.findFirst({
          where: {
            id: data.attemptId,
            studentId: user.id
          },
          select: { id: true, examId: true, status: true }
        })

        if (!attempt) {
          throw new NotFoundError('Exam attempt not found')
        }

        // Create or update violation record with evidenceKey
        const violation = await tx.violationEvent.create({
          data: {
            attemptId: data.attemptId,
            eventType: data.eventType || 'TAB_SWITCH',
            severity: 'MEDIUM',
            source: 'DIRECT_UPLOAD',
            evidenceKey: data.key,
            evidenceStatus: 'PENDING',
            clientTimestamp: data.clientTimestamp ? new Date(data.clientTimestamp) : null,
            serverTimestamp: new Date()
          }
        })

        // Enqueue transactional outbox event for async validation worker
        await tx.outboxEvent.create({
          data: {
            eventType: 'evidence.uploaded',
            payload: {
              eventId: String(violation.id),
              attemptId: data.attemptId,
              examId: attempt.examId,
              evidenceKey: data.key,
              eventType: data.eventType || 'TAB_SWITCH',
              clientTimestamp: data.clientTimestamp
            },
            status: 'PENDING',
            nextAttemptAt: new Date()
          }
        })

        logger.info({ attemptId: data.attemptId, key: data.key, eventId: String(violation.id) }, 'Direct evidence upload completed & enqueued')

        return {
          success: true,
          status: 'PENDING',
          key: data.key,
          eventId: String(violation.id)
        }
      })
    }

    if (normalizedPurpose === 'IDENTITY_PHOTO' || normalizedPurpose === 'PROFILE' || normalizedPurpose === 'IDENTITY') {
      await prisma.student.update({
        where: { id: user.id },
        data: { facePhotoKey: data.key }
      })
      return { success: true, key: data.key, field: 'facePhotoKey' }
    }

    if (normalizedPurpose === 'ID_CARD') {
      await prisma.student.update({
        where: { id: user.id },
        data: { idCardPhotoKey: data.key }
      })
      return { success: true, key: data.key, field: 'idCardPhotoKey' }
    }

    return { success: true, key: data.key }
  }
}

module.exports = {
  PresignService,
  presignService: new PresignService()
}
