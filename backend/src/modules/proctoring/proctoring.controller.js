const { proctoringService } = require('./proctoring.service')

async function logViolation(req, res, next) {
  try {
    const { attemptId, examId, eventType, severity, metadata, evidenceS3Key } = req.body
    const targetAttemptId = attemptId || req.params.attemptId
    const result = await proctoringService.recordViolation({
      attemptId: targetAttemptId,
      examId,
      eventType: eventType || 'GENERIC_VIOLATION',
      severity: severity || 'MEDIUM',
      metadata: metadata || {},
      evidenceS3Key: evidenceS3Key || null
    })
    return res.status(200).json({ status: 'success', result })
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
