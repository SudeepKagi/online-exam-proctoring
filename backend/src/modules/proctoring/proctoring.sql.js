const { prisma } = require('../../infra/postgres/client')

async function insertLog({ attemptId, eventType, severity = 'MEDIUM', metadata = null, evidenceS3Key = null }) {
  const metadataJson = metadata ? JSON.stringify(metadata) : null
  const result = await prisma.$queryRaw`
    INSERT INTO proctoring_logs (attempt_id, event_type, severity, metadata, evidence_s3_key, timestamp)
    VALUES (${attemptId}::uuid, ${eventType}, ${severity}::"Severity", ${metadataJson}::jsonb, ${evidenceS3Key}, NOW())
    RETURNING id::text, attempt_id::text AS "attemptId", event_type AS "eventType", 
              severity, metadata, evidence_s3_key AS "evidenceS3Key", timestamp;
  `
  return result[0]
}

async function batchInsertLogs(logs = []) {
  if (!logs || logs.length === 0) return []
  const inserted = []
  for (const log of logs) {
    const res = await insertLog(log)
    inserted.push(res)
  }
  return inserted
}

async function getLogsByAttempt(attemptId, limit = 100) {
  return prisma.$queryRaw`
    SELECT id::text, attempt_id::text AS "attemptId", event_type AS "eventType", 
           severity, metadata, evidence_s3_key AS "evidenceS3Key", timestamp
    FROM proctoring_logs
    WHERE attempt_id = ${attemptId}::uuid
    ORDER BY timestamp DESC
    LIMIT ${limit};
  `
}

async function getLogsByExam(examId, limit = 200) {
  return prisma.$queryRaw`
    SELECT pl.id::text, pl.attempt_id::text AS "attemptId", pl.event_type AS "eventType", 
           pl.severity, pl.metadata, pl.evidence_s3_key AS "evidenceS3Key", pl.timestamp,
           ea.student_id::text AS "studentId", u.name AS "studentName", u.email AS "studentEmail"
    FROM proctoring_logs pl
    JOIN exam_attempts ea ON pl.attempt_id = ea.id
    JOIN users u ON ea.student_id = u.id
    WHERE ea.exam_id = ${examId}::uuid
    ORDER BY pl.timestamp DESC
    LIMIT ${limit};
  `
}

module.exports = {
  insertLog,
  batchInsertLogs,
  getLogsByAttempt,
  getLogsByExam
}
