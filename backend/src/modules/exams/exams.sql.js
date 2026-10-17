const { prisma } = require('../../infra/postgres/client')

async function createExam({ title, subject, description, startTime, endTime, duration, totalMarks, requireVpn, proctoringConfig, createdBy }) {
  const result = await prisma.$queryRaw`
    INSERT INTO exams (title, subject, description, start_time, end_time, duration, total_marks, status, require_vpn, proctoring_config, created_by, created_at, updated_at)
    VALUES (${title}, ${subject}, ${description || null}, ${startTime}::timestamptz, ${endTime}::timestamptz, ${duration || 60}, ${totalMarks || 100}, 'DRAFT'::"ExamStatus", ${Boolean(requireVpn)}, ${proctoringConfig ? JSON.stringify(proctoringConfig) : null}::jsonb, ${createdBy}::uuid, NOW(), NOW())
    RETURNING id, title, subject, description, 
              start_time AS "startTime", 
              end_time AS "endTime", 
              duration, 
              total_marks AS "totalMarks", 
              status, 
              require_vpn AS "requireVpn", 
              proctoring_config AS "proctoringConfig", 
              created_by AS "createdBy", 
              created_at AS "createdAt", 
              updated_at AS "updatedAt";
  `
  return result[0]
}

async function findExamById(id) {
  const examResult = await prisma.$queryRaw`
    SELECT id, title, subject, description, 
           start_time AS "startTime", 
           end_time AS "endTime", 
           duration, 
           total_marks AS "totalMarks", 
           status, 
           require_vpn AS "requireVpn", 
           proctoring_config AS "proctoringConfig", 
           created_by AS "createdBy", 
           created_at AS "createdAt", 
           updated_at AS "updatedAt"
    FROM exams
    WHERE id = ${id}::uuid
    LIMIT 1;
  `
  return examResult[0] || null
}

async function listExams(filter = {}) {
  if (filter.createdBy) {
    return prisma.$queryRaw`
      SELECT id, title, subject, description, 
             start_time AS "startTime", 
             end_time AS "endTime", 
             duration, 
             total_marks AS "totalMarks", 
             status, 
             require_vpn AS "requireVpn", 
             proctoring_config AS "proctoringConfig", 
             created_at AS "createdAt"
      FROM exams
      WHERE created_by = ${filter.createdBy}::uuid
      ORDER BY start_time DESC;
    `
  }

  return prisma.$queryRaw`
    SELECT id, title, subject, description, 
           start_time AS "startTime", 
           end_time AS "endTime", 
           duration, 
           total_marks AS "totalMarks", 
           status, 
           require_vpn AS "requireVpn", 
           proctoring_config AS "proctoringConfig", 
           created_at AS "createdAt"
    FROM exams
    WHERE status IN ('PUBLISHED', 'LIVE')
    ORDER BY start_time DESC;
  `
}

async function updateExamStatus(id, status) {
  const result = await prisma.$queryRaw`
    UPDATE exams
    SET status = ${status}::"ExamStatus", updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, status, updated_at AS "updatedAt";
  `
  return result[0] || null
}

async function addQuestion({ examId, questionText, options, correctOptionIndex, marks = 1, negativeMarks = 0, order = 0 }) {
  const optionsJson = JSON.stringify(options)
  const result = await prisma.$queryRaw`
    INSERT INTO questions (exam_id, question_text, options, correct_option_index, marks, negative_marks, "order", created_at)
    VALUES (${examId}::uuid, ${questionText}, ${optionsJson}::jsonb, ${correctOptionIndex}, ${marks}, ${negativeMarks}, ${order}, NOW())
    RETURNING id, exam_id AS "examId", question_text AS "questionText", options, correct_option_index AS "correctOptionIndex", marks, negative_marks AS "negativeMarks", "order", created_at AS "createdAt";
  `
  return result[0]
}

async function getQuestionsByExamId(examId, includeAnswer = true) {
  if (includeAnswer) {
    return prisma.$queryRaw`
      SELECT id, exam_id AS "examId", question_text AS "questionText", options, 
             correct_option_index AS "correctOptionIndex", marks, negative_marks AS "negativeMarks", "order"
      FROM questions
      WHERE exam_id = ${examId}::uuid
      ORDER BY "order" ASC, created_at ASC;
    `
  }

  return prisma.$queryRaw`
    SELECT id, exam_id AS "examId", question_text AS "questionText", options, marks, negative_marks AS "negativeMarks", "order"
    FROM questions
    WHERE exam_id = ${examId}::uuid
    ORDER BY "order" ASC, created_at ASC;
  `
}

async function deleteQuestion(questionId) {
  return prisma.$queryRaw`
    DELETE FROM questions
    WHERE id = ${questionId}::uuid
    RETURNING id;
  `
}

async function assignUserToExam(examId, userId, role) {
  const result = await prisma.$queryRaw`
    INSERT INTO exam_assignments (exam_id, user_id, role, assigned_at)
    VALUES (${examId}::uuid, ${userId}::uuid, ${role}::"Role", NOW())
    ON CONFLICT (exam_id, user_id) DO NOTHING
    RETURNING id, exam_id AS "examId", user_id AS "userId", role, assigned_at AS "assignedAt";
  `
  return result[0] || null
}

module.exports = {
  createExam,
  findExamById,
  listExams,
  updateExamStatus,
  addQuestion,
  getQuestionsByExamId,
  deleteQuestion,
  assignUserToExam
}
