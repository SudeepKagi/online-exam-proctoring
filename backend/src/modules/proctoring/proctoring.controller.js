const { proctoringService } = require('./proctoring.service')

async function logViolation(req, res, next) {
  try {
    const rawEvents = Array.isArray(req.body) ? req.body : req.body?.events || [req.body]
    const results = []
    for (const evt of rawEvents) {
      if (!evt) continue
      let targetAttemptId = evt.attemptId || req.params.attemptId || req.body?.attemptId
      const targetExamId = evt.examId || req.body?.examId
      if (!targetAttemptId && req.user?.id && targetExamId) {
        const { prisma } = require('../../infra/postgres/client')
        const att = await prisma.examAttempt.findFirst({
          where: { studentId: req.user.id, examId: targetExamId },
          orderBy: { startedAt: 'desc' }
        })
        if (att) targetAttemptId = att.id
      }
      if (!targetAttemptId) continue

      const result = await proctoringService.recordViolation({
        attemptId: targetAttemptId,
        examId: targetExamId,
        eventType: evt.eventType || evt.type || 'SCREEN_PROCTOR_EVENT',
        severity: evt.severity || 'MEDIUM',
        metadata: evt.metadata || evt,
        evidenceS3Key: evt.evidenceS3Key || evt.evidenceKey || null
      })
      results.push(result)
    }
    return res.status(200).json({ status: 'success', recorded: results.length, result: results[0] })
  } catch (err) {
    next(err)
  }
}

async function getAttemptLogs(req, res, next) {
  try {
    const logs = await proctoringService.getAttemptLogs(req.params.attemptId)
    return res.status(200).json({ status: 'success', logs: logs || [] })
  } catch (err) {
    next(err)
  }
}

async function getExamLogs(req, res, next) {
  try {
    const logs = await proctoringService.getExamLogs(req.params.examId)
    return res.status(200).json({ status: 'success', logs: logs || [] })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  logViolation,
  getAttemptLogs,
  getExamLogs
}
