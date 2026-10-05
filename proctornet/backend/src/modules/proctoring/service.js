const { prisma } = require('../../infra/postgres/client')
const { redisClient } = require('../../infra/redis/client')
const { CANONICAL_SEVERITY, FLAG_COOLDOWNS, normalizeViolationType, isValidViolationType } = require('./constants')
const { violationMicroBatcher } = require('./violationMicroBatcher')
const { chatMicroBatcher } = require('./chatMicroBatcher')
const { presenceManager } = require('../../infra/websocket/presence')
const { rosterCoalescer } = require('../../infra/websocket/rosterCoalescer')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
  ValidationError
} = require('../../shared/errors')
const { logger } = require('../../shared/logging')
const { ROLES, normalizeRole } = require('../../shared/roles')

// In-memory fallback cooldown tracker if Redis is down
const inMemoryCooldowns = new Map()

class ProctoringService {
  /**
   * Record a violation event with Redis cooldown, server-side severity, and micro-batching
   */
  async recordViolation(attemptId, studentId, eventType, metadata = {}, clientTimestamp = null) {
    // 0. Validate and normalize against single shared catalogue
    const canonicalType = normalizeViolationType(eventType)
    if (!canonicalType || !isValidViolationType(canonicalType)) {
      throw new ValidationError(`Unknown or invalid violation event type: '${eventType}'`)
    }

    // 1. Authoritative check: ownership & ACTIVE status in SQL
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, exam_id, status, expires_at
      FROM exam_attempts
      WHERE id = $1::uuid AND student_id = $2::uuid;
    `, attemptId, studentId)

    if (!rows || rows.length === 0) {
      throw new NotFoundError(`Attempt '${attemptId}' not found or access denied`)
    }

    const attempt = rows[0]
    if (attempt.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot record violation on attempt in state '${attempt.status}'`)
    }

    // 2. Cooldown check: Redis SET NX PX
    const cooldownMs = FLAG_COOLDOWNS[canonicalType] || FLAG_COOLDOWNS.DEFAULT
    const cooldownKey = `pn:v1:cooldown:${attemptId}:${canonicalType}`
    let isCooledDown = false

    if (redisClient.client && redisClient.isReady) {
      try {
        const res = await redisClient.client.set(cooldownKey, '1', 'PX', cooldownMs, 'NX')
        isCooledDown = (res === 'OK')
      } catch (err) {
        logger.warn({ error: err.message }, 'Redis cooldown check failed, falling back to memory')
      }
    }

    if (!isCooledDown && (!redisClient.client || !redisClient.isReady)) {
      // Memory fallback
      const now = Date.now()
      const lastTime = inMemoryCooldowns.get(cooldownKey) || 0
      if (now - lastTime >= cooldownMs) {
        inMemoryCooldowns.set(cooldownKey, now)
        isCooledDown = true
      }
    }

    if (!isCooledDown) {
      return {
        recorded: false,
        cooldownActive: true,
        message: 'Violation suppressed due to active cooldown window'
      }
    }

    // 3. Server severity assignment (Never trust client severity)
    const severity = CANONICAL_SEVERITY[canonicalType] || 'MEDIUM'

    // 4. Push to micro-batcher first to ensure row exists in database (C-08/C-09)
    const batchRes = await violationMicroBatcher.queue({
      attemptId,
      eventType: canonicalType,
      severity,
      metadata,
      clientTimestamp
    })
    const violationId = batchRes?.violationId || null

    // 5. Issue the evidence ticket AFTER the row exists and bind key to violationId (C-08/C-09)
    let evidenceUpload = null
    const { isEvidenceRequired, checkEvidenceBudget } = require('../../shared/evidencePolicy')
    const { presignService } = require('../media/presignService')

    if (isEvidenceRequired(canonicalType)) {
      const budget = await checkEvidenceBudget(attemptId, prisma)
      if (budget.allowed) {
        try {
          evidenceUpload = await presignService.generateUploadPresignedUrl(
            { id: studentId, role: 'student' },
            { purpose: 'EVIDENCE', attemptId, violationId, contentType: 'image/webp', bytes: 300 * 1024 }
          )
        } catch (err) {
          logger.warn({ attemptId, violationId, error: err.message }, 'Could not generate evidence upload ticket')
        }
      }
    }

    return {
      recorded: true,
      violationId,
      eventType: canonicalType,
      severity,
      evidenceUpload
    }
  }

  /**
   * Fetch timeline of violation events with rounded presigned read URLs (Defect D-02 Fix)
   */
  async getViolationTimeline(attemptId, user) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true, studentId: true }
    })
    if (!attempt) {
      throw new NotFoundError(`Attempt '${attemptId}' not found`)
    }

    const role = normalizeRole(user?.role)
    if (role === ROLES.STUDENT) {
      if (attempt.studentId !== user.id) {
        throw new ForbiddenError('Access denied: You do not own this attempt')
      }
    } else {
      await this.assertStaffExamAccess(user, attempt.examId)
    }

    const isStudent = role === ROLES.STUDENT
    const { getPresignedReadUrl } = require('../../infra/s3/s3.client')
    const events = await prisma.violationEvent.findMany({
      where: { attemptId },
      orderBy: { serverTimestamp: 'desc' }
    })

    return await Promise.all(
      events.map(async (ev) => {
        // If student, strip presigned evidence URLs and internal storage keys (D-02)
        const evidenceUrl = (!isStudent && ev.evidenceKey) ? await getPresignedReadUrl(ev.evidenceKey, 600) : null
        const thumbUrl = (!isStudent && ev.thumbKey) ? await getPresignedReadUrl(ev.thumbKey, 600) : null

        return {
          id: ev.id.toString(),
          attemptId: ev.attemptId,
          eventType: ev.eventType,
          severity: ev.severity,
          evidenceKey: isStudent ? null : ev.evidenceKey,
          thumbKey: isStudent ? null : ev.thumbKey,
          evidenceUrl,
          thumbUrl,
          evidenceStatus: ev.evidenceStatus,
          metadata: ev.metadata,
          clientTimestamp: ev.clientTimestamp,
          serverTimestamp: ev.serverTimestamp
        }
      })
    )
  }

  /**
   * Post a chat message through micro-batcher with rate limiting (1 msg / 2 s)
   * Hardened against BOLA (D-01 / D-03 / D-04)
   */
  async postChatMessage(examId, userOrId, roleOrMessage, messageOrStudent, studentIdParam = null) {
    // Support signature: (examId, user, message, targetStudentId) OR legacy (examId, senderId, senderRole, message, studentIdParam)
    let user, message, targetStudentId
    if (typeof userOrId === 'object' && userOrId !== null) {
      user = userOrId
      message = roleOrMessage
      targetStudentId = messageOrStudent || null
    } else {
      user = { id: userOrId, role: roleOrMessage }
      message = messageOrStudent
      targetStudentId = studentIdParam || null
    }

    const normRole = normalizeRole(user?.role)
    const senderId = user.id

    let studentId = targetStudentId
    if (normRole === ROLES.STUDENT) {
      // Student chat strictly bound to user.id (D-01)
      studentId = senderId
      const attempt = await prisma.examAttempt.findFirst({
        where: { examId, studentId: senderId },
        select: { id: true }
      })
      if (!attempt) {
        throw new ForbiddenError('Access denied: You are not enrolled in this exam')
      }
    } else {
      // Staff chat bound to exam scope (D-01 / D-03)
      await this.assertStaffExamAccess(user, examId)
      if (!studentId) {
        throw new ValidationError('studentId is required for staff chat')
      }
      const attempt = await prisma.examAttempt.findFirst({
        where: { examId, studentId },
        select: { id: true }
      })
      if (!attempt) {
        throw new NotFoundError('Target student has no attempt in this exam')
      }
    }

    // Rate limit check: 1 per 2 seconds
    const rateLimitKey = `pn:v1:chat_limit:${senderId}`
    if (redisClient.client && redisClient.isReady) {
      const allowed = await redisClient.client.set(rateLimitKey, '1', 'PX', 2000, 'NX')
      if (!allowed) {
        throw new TooManyRequestsError('Chat rate limit exceeded. Please wait 2 seconds.', 2)
      }
    }

    return chatMicroBatcher.queue({
      examId,
      studentId,
      senderRole: normRole || user.role,
      message
    })
  }

  /**
   * Fetch chat history paginated by ID
   * Hardened against BOLA (D-01 / D-03 / D-04)
   */
  async getChatHistory(examId, userOrStudentId, studentIdOrLimit = 50, limitOrBefore = null, beforeId = null) {
    let user, studentId, limit, before
    if (typeof userOrStudentId === 'object' && userOrStudentId !== null) {
      user = userOrStudentId
      studentId = studentIdOrLimit
      limit = parseInt(limitOrBefore || '50', 10)
      before = beforeId
    } else {
      user = null
      studentId = userOrStudentId
      limit = parseInt(studentIdOrLimit || '50', 10)
      before = limitOrBefore
    }

    if (user) {
      const normRole = normalizeRole(user.role)
      if (normRole === ROLES.STUDENT) {
        studentId = user.id
        const attempt = await prisma.examAttempt.findFirst({
          where: { examId, studentId: user.id },
          select: { id: true }
        })
        if (!attempt) {
          throw new ForbiddenError('Access denied: You are not enrolled in this exam')
        }
      } else {
        await this.assertStaffExamAccess(user, examId)
        if (studentId) {
          const attempt = await prisma.examAttempt.findFirst({
            where: { examId, studentId },
            select: { id: true }
          })
          if (!attempt) {
            throw new NotFoundError('Target student has no attempt in this exam')
          }
        }
      }
    }

    const where = { examId }
    if (studentId) {
      where.studentId = studentId
    }
    if (before) {
      where.id = { lt: BigInt(before) }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' }
    })

    return messages.map(m => ({
      id: m.id.toString(),
      examId: m.examId,
      studentId: m.studentId,
      senderRole: m.senderRole,
      message: m.message,
      timestamp: m.timestamp
    }))
  }

  /**
   * Authorize staff access to an exam in SQL (Task 6 / Notion 13.10 §11 / Defect D-03 Fix)
   */
  async assertStaffExamAccess(user, examId) {
    const role = normalizeRole(user?.role)
    if (role === ROLES.ADMIN) return true

    if (role === ROLES.INVIGILATOR) {
      if (!user.examId || user.examId !== examId) {
        throw new ForbiddenError('Access denied: You are not assigned to this exam')
      }
      return true
    }

    if (role === ROLES.FACULTY) {
      const exam = await prisma.exam.findFirst({
        where: { id: examId, facultyId: user.id },
        select: { id: true }
      })
      if (!exam) {
        throw new ForbiddenError('Access denied: You do not own this exam')
      }
      return true
    }

    throw new ForbiddenError('Access denied: Staff role required')
  }

  /**
   * GET /api/v1/proctoring/exams/:examId/summary
   * Single aggregate query + Redis online presence
   */
  async getExamSummary(examId, user) {
    await this.assertStaffExamAccess(user, examId)

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
        count(*) FILTER (WHERE status = 'SUBMITTED')::int AS submitted,
        count(*) FILTER (WHERE status = 'TERMINATED')::int AS terminated,
        count(*) FILTER (WHERE status = 'READY')::int AS ready,
        count(*) FILTER (WHERE flag_count > 0)::int AS flagged
      FROM exam_attempts
      WHERE exam_id = $1::uuid;
    `, examId)

    const agg = rows[0] || { total: 0, active: 0, submitted: 0, terminated: 0, ready: 0, flagged: 0 }
    const online = await presenceManager.getOnlineCount(examId)

    return {
      examId,
      total: agg.total,
      active: agg.active,
      submitted: agg.submitted,
      terminated: agg.terminated,
      ready: agg.ready,
      flagged: agg.flagged,
      online
    }
  }

  /**
   * GET /api/v1/proctoring/exams/:examId/roster
   * Keyset pagination on (display_name, attempt_id)
   * Bounded DTO with NO base64 and NO evidence arrays (< 100 KB)
   */
  async getExamRoster(examId, user, { limit = 50, cursor = null, status = null, q = null } = {}) {
    await this.assertStaffExamAccess(user, examId)

    const sanitizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)
    const params = [examId]
    let paramIdx = 2
    let filterClause = ''

    if (status) {
      params.push(status.toUpperCase())
      filterClause += ` AND ea.status = $${paramIdx++}::"AttemptStatus"`
    }

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`)
      filterClause += ` AND (s.name ILIKE $${paramIdx} OR s.usn ILIKE $${paramIdx})`
      paramIdx++
    }

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
        if (decoded.name !== undefined && decoded.id) {
          params.push(decoded.name, decoded.id)
          filterClause += ` AND (s.name, ea.id) > ($${paramIdx++}, $${paramIdx++}::uuid)`
        }
      } catch (err) {
        logger.warn({ cursor, error: err.message }, 'Failed to decode roster cursor')
      }
    }

    params.push(sanitizedLimit + 1)
    const query = `
      SELECT 
        ea.id AS "attemptId",
        ea.student_id AS "studentId",
        s.name,
        s.usn,
        ea.status,
        ea.flag_count AS "flagCount",
        s.face_photo_key AS "facePhotoKey",
        (SELECT count(*)::int FROM questions q WHERE q.exam_id = ea.exam_id) AS "totalQuestions",
        (SELECT count(*)::int FROM answers a WHERE a.attempt_id = ea.id AND a.selected_option_id IS NOT NULL) AS "answeredCount"
      FROM exam_attempts ea
      JOIN students s ON s.id = ea.student_id
      WHERE ea.exam_id = $1::uuid
      ${filterClause}
      ORDER BY s.name ASC, ea.id ASC
      LIMIT $${paramIdx};
    `

    const rows = await prisma.$queryRawUnsafe(query, ...params)
    const hasMore = rows.length > sanitizedLimit
    const itemsToReturn = hasMore ? rows.slice(0, sanitizedLimit) : rows

    let nextCursor = null
    if (hasMore && itemsToReturn.length > 0) {
      const last = itemsToReturn[itemsToReturn.length - 1]
      nextCursor = Buffer.from(JSON.stringify({ name: last.name, id: last.attemptId })).toString('base64')
    }

    const onlineStudentIds = new Set(await presenceManager.getOnlineStudentIds(examId))

    const items = await Promise.all(
      itemsToReturn.map(async (row) => {
        let thumbUrl = null
        if (row.facePhotoKey) {
          try {
            thumbUrl = await getPresignedReadUrl(row.facePhotoKey, 600)
          } catch (e) {
            // ignore presign error
          }
        }

        return {
          attemptId: row.attemptId,
          studentId: row.studentId,
          name: row.name,
          usn: row.usn,
          status: row.status,
          flagCount: row.flagCount,
          answered: row.answeredCount,
          total: row.totalQuestions,
          online: onlineStudentIds.has(row.studentId),
          thumbUrl
        }
      })
    )

    return {
      items,
      nextCursor,
      hasMore,
      limit: sanitizedLimit
    }
  }

  /**
   * GET /api/v1/proctoring/attempts/:attemptId/violations
   * Keyset pagination on (server_timestamp DESC, id DESC)
   */
  async getAttemptViolations(attemptId, user, { cursor = null, limit = 50 } = {}) {
    const sanitizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true, studentId: true }
    })
    if (!attempt) throw new NotFoundError('Attempt not found')
    await this.assertStaffExamAccess(user, attempt.examId)

    const params = [attemptId]
    let paramIdx = 2
    let cursorClause = ''

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
        if (decoded.ts && decoded.id) {
          params.push(new Date(decoded.ts), BigInt(decoded.id))
          cursorClause = ` AND (server_timestamp, id) < ($${paramIdx++}::timestamptz, $${paramIdx++}::bigint)`
        }
      } catch (err) {
        // ignore
      }
    }

    params.push(sanitizedLimit + 1)
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, attempt_id AS "attemptId", event_type AS "eventType", severity,
             evidence_key AS "evidenceKey", thumb_key AS "thumbKey", evidence_status AS "evidenceStatus",
             client_timestamp AS "clientTimestamp", server_timestamp AS "serverTimestamp", metadata
      FROM violation_events
      WHERE attempt_id = $1::uuid
      ${cursorClause}
      ORDER BY server_timestamp DESC, id DESC
      LIMIT $${paramIdx};
    `, ...params)

    const hasMore = rows.length > sanitizedLimit
    const itemsToReturn = hasMore ? rows.slice(0, sanitizedLimit) : rows

    let nextCursor = null
    if (hasMore && itemsToReturn.length > 0) {
      const last = itemsToReturn[itemsToReturn.length - 1]
      nextCursor = Buffer.from(JSON.stringify({
        ts: last.serverTimestamp.toISOString(),
        id: last.id.toString()
      })).toString('base64')
    }

    const items = await Promise.all(
      itemsToReturn.map(async (v) => {
        const evidenceUrl = v.evidenceKey ? await getPresignedReadUrl(v.evidenceKey, 600) : null
        const thumbUrl = v.thumbKey ? await getPresignedReadUrl(v.thumbKey, 600) : null

        return {
          id: v.id.toString(),
          attemptId: v.attemptId,
          eventType: v.eventType,
          severity: v.severity,
          evidenceKey: v.evidenceKey,
          thumbKey: v.thumbKey,
          evidenceUrl,
          thumbUrl,
          evidenceStatus: v.evidenceStatus,
          metadata: v.metadata,
          clientTimestamp: v.clientTimestamp,
          serverTimestamp: v.serverTimestamp
        }
      })
    )

    return { items, nextCursor, hasMore }
  }

  /**
   * GET /api/v1/proctoring/exams/:examId/violations
   * Keyset pagination on (server_timestamp DESC, id DESC) across exam
   */
  async getExamViolations(examId, user, { severity = null, type = null, cursor = null, limit = 50 } = {}) {
    await this.assertStaffExamAccess(user, examId)
    const sanitizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)

    const params = [examId]
    let paramIdx = 2
    let filterClause = ''

    if (severity) {
      params.push(severity.toUpperCase())
      filterClause += ` AND ve.severity = $${paramIdx++}::"ViolationSeverity"`
    }

    if (type) {
      params.push(type.toUpperCase())
      filterClause += ` AND ve.event_type = $${paramIdx++}::"ViolationType"`
    }

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
        if (decoded.ts && decoded.id) {
          params.push(new Date(decoded.ts), BigInt(decoded.id))
          filterClause += ` AND (ve.server_timestamp, ve.id) < ($${paramIdx++}::timestamptz, $${paramIdx++}::bigint)`
        }
      } catch (err) {
        // ignore
      }
    }

    params.push(sanitizedLimit + 1)
    const query = `
      SELECT ve.id, ve.attempt_id AS "attemptId", ve.event_type AS "eventType", ve.severity,
             ve.evidence_key AS "evidenceKey", ve.thumb_key AS "thumbKey", ve.evidence_status AS "evidenceStatus",
             ve.client_timestamp AS "clientTimestamp", ve.server_timestamp AS "serverTimestamp", ve.metadata,
             s.name AS "studentName", s.usn AS "studentUsn"
      FROM violation_events ve
      JOIN exam_attempts ea ON ea.id = ve.attempt_id
      JOIN students s ON s.id = ea.student_id
      WHERE ea.exam_id = $1::uuid
      ${filterClause}
      ORDER BY ve.server_timestamp DESC, ve.id DESC
      LIMIT $${paramIdx};
    `

    const rows = await prisma.$queryRawUnsafe(query, ...params)
    const hasMore = rows.length > sanitizedLimit
    const itemsToReturn = hasMore ? rows.slice(0, sanitizedLimit) : rows

    let nextCursor = null
    if (hasMore && itemsToReturn.length > 0) {
      const last = itemsToReturn[itemsToReturn.length - 1]
      nextCursor = Buffer.from(JSON.stringify({
        ts: last.serverTimestamp.toISOString(),
        id: last.id.toString()
      })).toString('base64')
    }

    const items = await Promise.all(
      itemsToReturn.map(async (v) => {
        const evidenceUrl = v.evidenceKey ? await getPresignedReadUrl(v.evidenceKey, 600) : null
        const thumbUrl = v.thumbKey ? await getPresignedReadUrl(v.thumbKey, 600) : null

        return {
          id: v.id.toString(),
          attemptId: v.attemptId,
          studentName: v.studentName,
          studentUsn: v.studentUsn,
          eventType: v.eventType,
          severity: v.severity,
          evidenceKey: v.evidenceKey,
          thumbKey: v.thumbKey,
          evidenceUrl,
          thumbUrl,
          evidenceStatus: v.evidenceStatus,
          metadata: v.metadata,
          clientTimestamp: v.clientTimestamp,
          serverTimestamp: v.serverTimestamp
        }
      })
    )

    return { items, nextCursor, hasMore }
  }

  /**
   * Warn candidate (Task 7)
   */
  async warnCandidate(attemptId, user, message, io = null) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true, studentId: true }
    })
    if (!attempt) throw new NotFoundError('Attempt not found')
    await this.assertStaffExamAccess(user, attempt.examId)

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role.toUpperCase(),
        action: 'PROCTOR_WARNING',
        resourceType: 'ExamAttempt',
        resourceId: attemptId,
        attemptId: attemptId,
        metadata: { message, studentId: attempt.studentId }
      }
    })

    if (io) {
      io.to(`attempt:${attemptId}`).emit('proctor:warning', {
        message,
        timestamp: new Date().toISOString()
      })
    }

    return { success: true, message: 'Warning dispatched' }
  }

  /**
   * Pause exam attempt (Task 7 / Defect D-03 Fix)
   */
  async pauseAttempt(attemptId, user, reason, io = null) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true }
    })
    if (!attempt) throw new NotFoundError(`Attempt '${attemptId}' not found`)
    await this.assertStaffExamAccess(user, attempt.examId)

    const { attemptService } = require('../attempts/service')
    const updated = await attemptService.transitionState(attemptId, 'SUSPENDED', {
      actorId: user.id,
      actorRole: normalizeRole(user.role),
      reason: reason || 'Paused by proctor'
    })

    if (io) {
      io.to(`attempt:${attemptId}`).emit('attempt:state', {
        status: 'SUSPENDED',
        isPaused: true,
        reason
      })
      rosterCoalescer.queueDelta(updated.examId, {
        attemptId,
        status: 'SUSPENDED'
      })
    }

    return { success: true, status: 'SUSPENDED' }
  }

  /**
   * Resume exam attempt (Task 7 / Defect D-03 Fix)
   */
  async resumeAttempt(attemptId, user, io = null) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true }
    })
    if (!attempt) throw new NotFoundError(`Attempt '${attemptId}' not found`)
    await this.assertStaffExamAccess(user, attempt.examId)

    const { attemptService } = require('../attempts/service')
    const updated = await attemptService.transitionState(attemptId, 'ACTIVE', {
      actorId: user.id,
      actorRole: normalizeRole(user.role),
      reason: 'Resumed by proctor'
    })

    if (io) {
      io.to(`attempt:${attemptId}`).emit('attempt:state', {
        status: 'ACTIVE',
        isPaused: false
      })
      rosterCoalescer.queueDelta(updated.examId, {
        attemptId,
        status: 'ACTIVE'
      })
    }

    return { success: true, status: 'ACTIVE' }
  }

  /**
   * Terminate exam attempt (Task 7 / Defect D-03 Fix)
   */
  async terminateAttempt(attemptId, user, reason, io = null) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true }
    })
    if (!attempt) throw new NotFoundError(`Attempt '${attemptId}' not found`)
    await this.assertStaffExamAccess(user, attempt.examId)

    const { attemptService } = require('../attempts/service')
    const updated = await attemptService.transitionState(attemptId, 'TERMINATED', {
      actorId: user.id,
      actorRole: normalizeRole(user.role),
      reason: reason || 'Terminated by proctor for academic dishonesty'
    })

    if (io) {
      io.to(`attempt:${attemptId}`).emit('attempt:state', {
        status: 'TERMINATED',
        reason
      })
      rosterCoalescer.queueDelta(updated.examId, {
        attemptId,
        status: 'TERMINATED'
      })
    }

    return { success: true, status: 'TERMINATED' }
  }

  /**
   * Acknowledge violation (Task 7)
   */
  async acknowledgeViolation(violationId, user) {
    const violation = await prisma.violationEvent.findUnique({
      where: { id: BigInt(violationId) },
      include: { attempt: true }
    })
    if (!violation) throw new NotFoundError('Violation event not found')
    await this.assertStaffExamAccess(user, violation.attempt.examId)

    const updated = await prisma.violationEvent.update({
      where: { id: BigInt(violationId) },
      data: {
        metadata: {
          ...(typeof violation.metadata === 'object' && violation.metadata !== null ? violation.metadata : {}),
          acknowledged: true,
          acknowledgedBy: user.id,
          acknowledgedAt: new Date().toISOString()
        }
      }
    })

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role.toUpperCase(),
        action: 'VIOLATION_ACKNOWLEDGED',
        resourceType: 'ViolationEvent',
        resourceId: String(violationId),
        attemptId: violation.attemptId,
        metadata: { attemptId: violation.attemptId }
      }
    })

    return { success: true, violationId: updated.id.toString(), acknowledged: true }
  }
}

module.exports = {
  ProctoringService,
  proctoringService: new ProctoringService()
}
