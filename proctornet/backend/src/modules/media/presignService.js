const { prisma } = require('../../infra/postgres/client')
const s3Client = require('../../infra/s3/s3.client')
const {
  buildIdentityKey,
  buildEvidenceKey,
  buildThumbKey,
  buildQuestionKey,
  createDirectUploadPolicy
} = s3Client
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
  async generateUploadPresignedUrl(user, { purpose, attemptId, violationId, examId, contentType, bytes }) {
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
        const budget = await checkEvidenceBudget(attemptId)
        if (!budget.allowed) {
          throw new ForbiddenError(`Evidence budget cap reached (${budget.cap} screenshots max per attempt)`)
        }

        maxAllowedBytes = MAX_EVIDENCE_SIZE_BYTES
        // Bind evidence key to violationId (C-08/C-09)
        key = buildEvidenceKey(attempt.examId, attemptId, violationId || undefined)
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
   * Generate dual-channel evidence upload tickets (camera + screen) bound to violationId (R2)
   */
  async generateEvidenceTickets(user, { attemptId, violationId, examId, contentType = 'image/webp' }) {
    if (!attemptId) {
      throw new ValidationError('attemptId is required for evidence upload tickets')
    }

    const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png']
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new ValidationError(`Unsupported content type '${contentType}'. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`)
    }

    // BOLA + Active Guard in SQL
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        ...(user.role === ROLES.STUDENT ? { studentId: user.id } : {}),
        status: 'ACTIVE'
      },
      select: { id: true, examId: true, expiresAt: true }
    })

    if (!attempt) {
      throw new NotFoundError('Active exam attempt not found')
    }

    if (new Date() > new Date(attempt.expiresAt)) {
      throw new ForbiddenError('Exam session has expired; uploads no longer accepted')
    }

    // Budget check
    const budget = await checkEvidenceBudget(attemptId)
    if (!budget.allowed) {
      throw new ForbiddenError(`Evidence budget cap reached (${budget.cap} screenshots max per attempt)`)
    }

    const resolvedExamId = examId || attempt.examId
    const safeViolationId = violationId ? String(violationId) : require('crypto').randomUUID()

    // 1. Camera tickets (Full image <= 300 KB, thumbnail <= 100 KB, TTL 120s)
    const cameraKey = buildEvidenceKey(resolvedExamId, attemptId, `${safeViolationId}_camera`)
    const cameraThumbKey = buildThumbKey(resolvedExamId, attemptId, `${safeViolationId}_camera`)

    const cameraPolicy = await createDirectUploadPolicy({
      key: cameraKey,
      contentType,
      maxSizeBytes: MAX_EVIDENCE_SIZE_BYTES,
      expiresIn: 120
    })

    const cameraThumbPolicy = await createDirectUploadPolicy({
      key: cameraThumbKey,
      contentType: 'image/webp',
      maxSizeBytes: 100 * 1024,
      expiresIn: 120
    })

    const cameraTicket = {
      key: cameraPolicy.key,
      url: cameraPolicy.postUrl,
      putUrl: cameraPolicy.putUrl,
      fields: cameraPolicy.fields,
      contentType,
      maxSizeBytes: MAX_EVIDENCE_SIZE_BYTES,
      expiresIn: 120,
      thumbKey: cameraThumbPolicy.key,
      thumbUrl: cameraThumbPolicy.postUrl,
      thumbPutUrl: cameraThumbPolicy.putUrl,
      thumbFields: cameraThumbPolicy.fields
    }

    // 2. Screen tickets (Full image <= 300 KB, thumbnail <= 100 KB, TTL 120s)
    const screenKey = buildEvidenceKey(resolvedExamId, attemptId, `${safeViolationId}_screen`)
    const screenThumbKey = buildThumbKey(resolvedExamId, attemptId, `${safeViolationId}_screen`)

    const screenPolicy = await createDirectUploadPolicy({
      key: screenKey,
      contentType,
      maxSizeBytes: MAX_EVIDENCE_SIZE_BYTES,
      expiresIn: 120
    })

    const screenThumbPolicy = await createDirectUploadPolicy({
      key: screenThumbKey,
      contentType: 'image/webp',
      maxSizeBytes: 100 * 1024,
      expiresIn: 120
    })

    const screenTicket = {
      key: screenPolicy.key,
      url: screenPolicy.postUrl,
      putUrl: screenPolicy.putUrl,
      fields: screenPolicy.fields,
      contentType,
      maxSizeBytes: MAX_EVIDENCE_SIZE_BYTES,
      expiresIn: 120,
      thumbKey: screenThumbPolicy.key,
      thumbUrl: screenThumbPolicy.postUrl,
      thumbPutUrl: screenThumbPolicy.putUrl,
      thumbFields: screenThumbPolicy.fields
    }

    return {
      camera: cameraTicket,
      screen: screenTicket
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

  /**
   * Verify uploaded evidence S3 object via HeadObject and transition evidence_status to UPLOADED (R2)
   */
  async completeEvidenceUpload(user, { violationId, cameraKey, screenKey, thumbKey, screenThumbKey, key }) {
    if (!violationId) {
      throw new ValidationError('violationId is required to complete evidence upload')
    }

    let parsedViolationId
    try {
      parsedViolationId = BigInt(violationId)
    } catch {
      throw new ValidationError(`Invalid violationId format: '${violationId}'`)
    }

    const violation = await prisma.violationEvent.findUnique({
      where: { id: parsedViolationId },
      include: { attempt: true }
    })

    if (!violation) {
      throw new NotFoundError(`Violation event '${violationId}' not found`)
    }

    // BOLA check: student must own attempt
    if (user.role === ROLES.STUDENT && violation.attempt.studentId !== user.id) {
      throw new ForbiddenError('Access denied: You do not own this violation event')
    }

    const primaryKey = cameraKey || key || violation.evidenceKey
    if (!primaryKey) {
      throw new ValidationError('No evidence storage key provided or recorded for this violation')
    }

    const thumbnailKey = thumbKey || violation.thumbKey || null

    // Verify S3 object exists, size <= 300 KB, and valid content type via HeadObject
    let head
    try {
      head = await s3Client.headObject(primaryKey)
    } catch (err) {
      // Mark as FAILED on failure, violation row remains durable
      try {
        await prisma.violationEvent.update({
          where: { id: parsedViolationId },
          data: { evidenceStatus: 'FAILED' }
        })
      } catch (updateErr) {
        logger.warn({ error: updateErr.message, violationId }, 'Failed to set evidenceStatus to FAILED')
      }
      throw new ValidationError(`Evidence object not found in storage: ${err.message}`)
    }

    const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png']
    if (head.ContentLength > MAX_EVIDENCE_SIZE_BYTES) {
      try {
        await prisma.violationEvent.update({
          where: { id: parsedViolationId },
          data: { evidenceStatus: 'FAILED' }
        })
      } catch (updateErr) {
        logger.warn({ error: updateErr.message, violationId }, 'Failed to set evidenceStatus to FAILED')
      }
      throw new ValidationError(`Evidence size (${head.ContentLength} bytes) exceeds maximum limit of 300 KB`)
    }

    if (head.ContentType && !ALLOWED_CONTENT_TYPES.includes(head.ContentType)) {
      try {
        await prisma.violationEvent.update({
          where: { id: parsedViolationId },
          data: { evidenceStatus: 'FAILED' }
        })
      } catch (updateErr) {
        logger.warn({ error: updateErr.message, violationId }, 'Failed to set evidenceStatus to FAILED')
      }
      throw new ValidationError(`Unsupported evidence image content type '${head.ContentType}'`)
    }

    // Update violation row to UPLOADED status
    const currentMeta = typeof violation.metadata === 'object' && violation.metadata !== null ? violation.metadata : {}
    const updated = await prisma.violationEvent.update({
      where: { id: parsedViolationId },
      data: {
        evidenceKey: primaryKey,
        thumbKey: thumbnailKey,
        evidenceStatus: 'UPLOADED',
        metadata: {
          ...currentMeta,
          ...(screenKey ? { screenKey } : {}),
          ...(screenThumbKey ? { screenThumbKey } : {}),
          verifiedBytes: head.ContentLength,
          verifiedContentType: head.ContentType
        }
      }
    })

    // Enqueue transactional outbox event
    await prisma.outboxEvent.create({
      data: {
        eventType: 'evidence.uploaded',
        payload: {
          eventId: String(updated.id),
          attemptId: updated.attemptId,
          examId: violation.attempt.examId,
          evidenceKey: primaryKey,
          thumbKey: thumbnailKey,
          eventType: updated.eventType
        },
        status: 'PENDING',
        nextAttemptAt: new Date()
      }
    }).catch((err) => {
      logger.warn({ error: err.message, violationId }, 'Failed to enqueue evidence.uploaded outbox event')
    })

    logger.info({ violationId: String(updated.id), primaryKey, status: 'UPLOADED' }, 'Evidence upload verified via HeadObject and finalized')

    return {
      success: true,
      status: 'UPLOADED',
      violationId: String(updated.id),
      evidenceKey: primaryKey,
      thumbKey: thumbnailKey
    }
  }
}

module.exports = {
  PresignService,
  presignService: new PresignService()
}
