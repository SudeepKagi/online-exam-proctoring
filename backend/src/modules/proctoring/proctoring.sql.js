const { prisma } = require('../../infra/postgres/client')

function mapLogRecord(log) {
  if (!log) return null
  return {
    id: String(log.id),
    attemptId: log.attemptId,
    eventType: log.eventType,
    severity: log.severity,
    metadata: log.metadata,
    evidenceS3Key: log.evidenceKey,
    evidenceKey: log.evidenceKey,
    timestamp: log.createdAt,
    createdAt: log.createdAt,
    studentId: log.attempt?.studentId,
    studentName: log.attempt?.student?.fullName,
    studentEmail: log.attempt?.student?.email
  }
}

async function insertLog({ attemptId, eventType, severity = 'MEDIUM', metadata = null, evidenceS3Key = null, evidenceKey = null }) {
  const log = await prisma.proctoringLog.create({
    data: {
      attemptId,
      eventType,
      severity: String(severity).toUpperCase(),
      evidenceKey: evidenceKey || evidenceS3Key || null,
      metadata: metadata || {}
    }
  })
  if (attemptId) {
    try {
      const updated = await prisma.examAttempt.update({
        where: { id: attemptId },
        data: { violationCount: { increment: 1 } }
      })
      if (updated.violationCount >= 50 && updated.status === 'IN_PROGRESS') {
        await prisma.examAttempt.update({
          where: { id: attemptId },
          data: { status: 'SUSPENDED' }
        })
        const { socketEmitter } = require('../../infra/websocket/emitter')
        socketEmitter.emitToAttempt(attemptId, 'attempt:suspended', { reason: 'Automated threshold suspension', by: 'SYSTEM' })
      }
    } catch (_) {}
  }
  return mapLogRecord(log)
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
  const logs = await prisma.proctoringLog.findMany({
    where: { attemptId },
    orderBy: { createdAt: 'desc' },
    take: Number(limit) || 100
  })
  return logs.map(mapLogRecord)
}

async function getLogsByExam(examId, limit = 200) {
  const logs = await prisma.proctoringLog.findMany({
    where: {
      attempt: { examId }
    },
    include: {
      attempt: {
        include: {
          student: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit) || 200
  })
  return logs.map(mapLogRecord)
}

module.exports = {
  insertLog,
  batchInsertLogs,
  getLogsByAttempt,
  getLogsByExam
}
