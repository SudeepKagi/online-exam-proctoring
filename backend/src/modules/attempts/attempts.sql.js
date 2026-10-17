const { prisma } = require('../../infra/postgres/client')

async function findAttemptByExamAndStudent(examId, studentId) {
  const result = await prisma.$queryRaw`
    SELECT id::text, 
           exam_id::text AS "examId", 
           student_id::text AS "studentId", 
           status, 
           started_at AS "startedAt", 
           submitted_at AS "submittedAt", 
           expires_at AS "expiresAt", 
           suspended_at AS "suspendedAt", 
           total_suspended_ms AS "totalSuspendedMs", 
           score, 
           created_at AS "createdAt", 
           updated_at AS "updatedAt"
    FROM exam_attempts
    WHERE exam_id = ${examId}::uuid AND student_id = ${studentId}::uuid
    LIMIT 1;
  `
  return result[0] || null
}

async function findAttemptById(id) {
  const result = await prisma.$queryRaw`
    SELECT id::text, 
           exam_id::text AS "examId", 
           student_id::text AS "studentId", 
           status, 
           started_at AS "startedAt", 
           submitted_at AS "submittedAt", 
           expires_at AS "expiresAt", 
           suspended_at AS "suspendedAt", 
           total_suspended_ms AS "totalSuspendedMs", 
           score, 
           created_at AS "createdAt", 
           updated_at AS "updatedAt"
    FROM exam_attempts
    WHERE id = ${id}::uuid
    LIMIT 1;
  `
  return result[0] || null
}

async function createOrGetReadinessAttempt(examId, studentId) {
  const result = await prisma.$queryRaw`
    INSERT INTO exam_attempts (exam_id, student_id, status, created_at, updated_at)
    VALUES (${examId}::uuid, ${studentId}::uuid, 'NOT_STARTED'::"AttemptStatus", NOW(), NOW())
    ON CONFLICT (exam_id, student_id)
    DO UPDATE SET updated_at = NOW()
    RETURNING id::text, exam_id::text AS "examId", student_id::text AS "studentId", status;
  `
  return result[0]
}

async function startAttempt(attemptId, durationMinutes) {
  const durationInterval = `${Math.max(1, durationMinutes)} minutes`
  const result = await prisma.$queryRaw`
    UPDATE exam_attempts
    SET status = 'IN_PROGRESS'::"AttemptStatus",
        started_at = COALESCE(started_at, NOW()),
        expires_at = COALESCE(expires_at, NOW() + ${durationInterval}::interval),
        updated_at = NOW()
    WHERE id = ${attemptId}::uuid AND status IN ('NOT_STARTED'::"AttemptStatus", 'IN_PROGRESS'::"AttemptStatus")
    RETURNING id::text, exam_id::text AS "examId", student_id::text AS "studentId", status, 
              started_at AS "startedAt", expires_at AS "expiresAt";
  `
  return result[0] || null
}

async function upsertAnswer(attemptId, questionId, selectedOptionIndex) {
  const result = await prisma.$queryRaw`
    INSERT INTO attempt_answers (attempt_id, question_id, selected_option_index, saved_at)
    VALUES (${attemptId}::uuid, ${questionId}::uuid, ${selectedOptionIndex}, NOW())
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      selected_option_index = EXCLUDED.selected_option_index,
      saved_at = NOW()
    RETURNING id::text, attempt_id::text AS "attemptId", question_id::text AS "questionId", 
              selected_option_index AS "selectedOptionIndex", saved_at AS "savedAt";
  `
  return result[0]
}

async function getAttemptAnswers(attemptId) {
  return prisma.$queryRaw`
    SELECT id::text, attempt_id::text AS "attemptId", question_id::text AS "questionId", 
           selected_option_index AS "selectedOptionIndex", saved_at AS "savedAt"
    FROM attempt_answers
    WHERE attempt_id = ${attemptId}::uuid;
  `
}

async function submitAndGradeAttempt(attemptId) {
  const result = await prisma.$queryRaw`
    WITH graded AS (
      UPDATE attempt_answers aa
      SET is_correct = (aa.selected_option_index = q.correct_option_index),
          marks_awarded = CASE
            WHEN aa.selected_option_index IS NULL THEN 0
            WHEN aa.selected_option_index = q.correct_option_index THEN q.marks
            ELSE -ABS(q.negative_marks)
          END
      FROM questions q
      WHERE aa.attempt_id = ${attemptId}::uuid AND aa.question_id = q.id
      RETURNING aa.marks_awarded
    ),
    total_score AS (
      SELECT COALESCE(SUM(marks_awarded), 0) AS total FROM graded
    )
    UPDATE exam_attempts
    SET status = 'SUBMITTED'::"AttemptStatus",
        submitted_at = NOW(),
        score = GREATEST(0, (SELECT total FROM total_score)),
        updated_at = NOW()
    WHERE id = ${attemptId}::uuid
    RETURNING id::text, exam_id::text AS "examId", student_id::text AS "studentId", 
              status, score, started_at AS "startedAt", submitted_at AS "submittedAt";
  `
  return result[0] || null
}

async function updateAttemptStatus(attemptId, status) {
  const result = await prisma.$queryRaw`
    UPDATE exam_attempts
    SET status = ${status}::"AttemptStatus",
        suspended_at = CASE WHEN ${status}::text = 'SUSPENDED' THEN NOW() ELSE suspended_at END,
        updated_at = NOW()
    WHERE id = ${attemptId}::uuid
    RETURNING id::text, status, updated_at AS "updatedAt";
  `
  return result[0] || null
}

module.exports = {
  findAttemptByExamAndStudent,
  findAttemptById,
  createOrGetReadinessAttempt,
  startAttempt,
  upsertAnswer,
  getAttemptAnswers,
  submitAndGradeAttempt,
  updateAttemptStatus
}
