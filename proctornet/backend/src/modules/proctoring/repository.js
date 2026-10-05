const { prisma } = require('../../infra/postgres/client')

class ProctoringRepository {
  // ---------------------------------------------------------------------------
  // Attempt guards
  // ---------------------------------------------------------------------------

  /**
   * Fetch a minimal attempt row for BOLA / status checks.
   * Returns { id, exam_id, status, expires_at } or null.
   */
  async findAttemptForViolationGuard(attemptId, studentId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, exam_id, status, expires_at
      FROM exam_attempts
      WHERE id = $1::uuid AND student_id = $2::uuid;
    `, attemptId, studentId)
    return rows?.[0] ?? null
  }

  /**
   * Find a minimal attempt (id, examId, studentId) by attemptId.
   */
  async findAttemptMinimal(attemptId) {
    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true, studentId: true }
    })
  }

  /**
   * Find a minimal attempt (id, examId) by attemptId — for staff action guards.
   */
  async findAttemptExamScope(attemptId) {
    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, examId: true }
    })
  }

  // ---------------------------------------------------------------------------
  // Exam / faculty ownership
  // ---------------------------------------------------------------------------

  /**
   * Check that a faculty member owns the given exam (returns exam or null).
   */
  async findExamOwnedByFaculty(examId, facultyId) {
    return prisma.exam.findFirst({
      where: { id: examId, facultyId },
      select: { id: true }
    })
  }

  // ---------------------------------------------------------------------------
  // Chat access guards
  // ---------------------------------------------------------------------------

  /**
   * Check that a student has an attempt in the exam (for chat BOLA).
   */
  async findStudentAttemptInExam(examId, studentId) {
    return prisma.examAttempt.findFirst({
      where: { examId, studentId },
      select: { id: true }
    })
  }

  // ---------------------------------------------------------------------------
  // Chat queries
  // ---------------------------------------------------------------------------

  /**
   * Paginated chat messages (keyset on id DESC).
   */
  async findChatMessages(where, limit) {
    return prisma.chatMessage.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' }
    })
  }

  // ---------------------------------------------------------------------------
  // Violation timeline
  // ---------------------------------------------------------------------------

  /**
   * All violation events for an attempt, ordered newest-first.
   */
  async findViolationsByAttempt(attemptId) {
    return prisma.violationEvent.findMany({
      where: { attemptId },
      orderBy: { serverTimestamp: 'desc' }
    })
  }

  // ---------------------------------------------------------------------------
  // Violation pagination (attempt scope)
  // ---------------------------------------------------------------------------

  /**
   * Keyset-paginated violations for one attempt.
   * Returns raw rows: { id, attemptId, eventType, severity, evidenceKey, thumbKey,
   *                     evidenceStatus, clientTimestamp, serverTimestamp, metadata }
   */
  async findViolationsByAttemptPaginated(attemptId, { cursorTs, cursorId, limit }) {
    const params = [attemptId]
    let paramIdx = 2
    let cursorClause = ''

    if (cursorTs && cursorId) {
      params.push(new Date(cursorTs), BigInt(cursorId))
      cursorClause = ` AND (server_timestamp, id) < ($${paramIdx++}::timestamptz, $${paramIdx++}::bigint)`
    }

    params.push(limit)
    return prisma.$queryRawUnsafe(`
      SELECT id, attempt_id AS "attemptId", event_type AS "eventType", severity,
             evidence_key AS "evidenceKey", thumb_key AS "thumbKey", evidence_status AS "evidenceStatus",
             client_timestamp AS "clientTimestamp", server_timestamp AS "serverTimestamp", metadata
      FROM violation_events
      WHERE attempt_id = $1::uuid
      ${cursorClause}
      ORDER BY server_timestamp DESC, id DESC
      LIMIT $${paramIdx};
    `, ...params)
  }

  // ---------------------------------------------------------------------------
  // Violation pagination (exam scope)
  // ---------------------------------------------------------------------------

  /**
   * Keyset-paginated violations across an entire exam with optional severity/type filters.
   * Returns raw rows including studentName and studentUsn.
   */
  async findViolationsByExamPaginated(examId, { severity, type, cursorTs, cursorId, limit }) {
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

    if (cursorTs && cursorId) {
      params.push(new Date(cursorTs), BigInt(cursorId))
      filterClause += ` AND (ve.server_timestamp, ve.id) < ($${paramIdx++}::timestamptz, $${paramIdx++}::bigint)`
    }

    params.push(limit)
    return prisma.$queryRawUnsafe(`
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
    `, ...params)
  }

  // ---------------------------------------------------------------------------
  // Exam summary aggregate
  // ---------------------------------------------------------------------------

  /**
   * Single aggregate query for the exam summary dashboard card.
   */
  async getExamSummaryAggregate(examId) {
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
    return rows[0] ?? { total: 0, active: 0, submitted: 0, terminated: 0, ready: 0, flagged: 0 }
  }

  // ---------------------------------------------------------------------------
  // Roster (keyset pagination)
  // ---------------------------------------------------------------------------

  /**
   * Keyset-paginated roster query on (name ASC, id ASC).
   */
  async findRosterPage(examId, { status, q, cursorName, cursorId, limit }) {
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

    if (cursorName !== undefined && cursorId) {
      params.push(cursorName, cursorId)
      filterClause += ` AND (s.name, ea.id) > ($${paramIdx++}, $${paramIdx++}::uuid)`
    }

    params.push(limit)
    return prisma.$queryRawUnsafe(`
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
    `, ...params)
  }

  // ---------------------------------------------------------------------------
  // Violation acknowledgement
  // ---------------------------------------------------------------------------

  /**
   * Find a single violation event including its parent attempt.
   */
  async findViolationWithAttempt(violationId) {
    return prisma.violationEvent.findUnique({
      where: { id: BigInt(violationId) },
      include: { attempt: true }
    })
  }

  /**
   * Merge metadata into a violation event to record acknowledgement.
   */
  async acknowledgeViolation(violationId, mergedMetadata) {
    return prisma.violationEvent.update({
      where: { id: BigInt(violationId) },
      data: { metadata: mergedMetadata }
    })
  }

  // ---------------------------------------------------------------------------
  // Audit log writes from proctoring actions
  // ---------------------------------------------------------------------------

  /**
   * Insert an audit log entry for a proctoring action (warning, ack, etc.).
   */
  async createAuditEntry(data) {
    return prisma.auditLog.create({ data })
  }
}

module.exports = {
  ProctoringRepository,
  proctoringRepository: new ProctoringRepository()
}
