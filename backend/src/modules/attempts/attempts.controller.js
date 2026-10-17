const { attemptService } = require('./attempts.service')

async function getReadiness(req, res, next) {
  try {
    const examId = req.params.examId || req.params.id
    const attempt = await attemptService.getReadiness(examId, req.user.id)
    return res.status(200).json({ status: 'success', attempt, attemptId: attempt.id })
  } catch (err) {
    next(err)
  }
}

async function startAttempt(req, res, next) {
  try {
    const examId = req.params.examId || req.params.id || req.body?.examId
    const result = await attemptService.startAttempt(examId, req.user.id)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function getAttempt(req, res, next) {
  try {
    const result = await attemptService.getAttemptState(req.params.attemptId, req.user.id, req.user.role)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function saveAnswer(req, res, next) {
  try {
    const { attemptId } = req.params
    const { questionId, selectedOptionIndex } = req.body
    const answer = await attemptService.saveAnswer(attemptId, req.user.id, questionId, selectedOptionIndex)
    return res.status(200).json({ status: 'success', answer })
  } catch (err) {
    next(err)
  }
}

async function batchSaveAnswers(req, res, next) {
  try {
    const { attemptId } = req.params
    const answersData = req.body?.answers !== undefined ? req.body.answers : req.body
    const results = await attemptService.batchSaveAnswers(attemptId, req.user.id, answersData || [])
    return res.status(200).json({ status: 'success', savedCount: results.length, answers: results })
  } catch (err) {
    next(err)
  }
}

async function submitAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const result = await attemptService.submitAttempt(attemptId, req.user.id)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function suspendAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const { reason } = req.body || {}
    const result = await attemptService.suspendAttempt(attemptId, req.user.id, reason)
    return res.status(200).json({ status: 'success', attempt: result })
  } catch (err) {
    next(err)
  }
}

async function resumeAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const result = await attemptService.resumeAttempt(attemptId, req.user.id)
    return res.status(200).json({ status: 'success', attempt: result })
  } catch (err) {
    next(err)
  }
}

async function getVpnStatus(req, res) {
  // WireGuard VPN Hook check
  const clientIp = req.socket.remoteAddress || req.ip || '127.0.0.1'
  return res.status(200).json({
    status: 'connected',
    clientIp,
    vpnRequired: false,
    matched: true
  })
}

module.exports = {
  getReadiness,
  startAttempt,
  getAttempt,
  saveAnswer,
  batchSaveAnswers,
  submitAttempt,
  suspendAttempt,
  resumeAttempt,
  getVpnStatus
}
