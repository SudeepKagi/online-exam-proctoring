const studentService = require('../services/studentService')
const verificationService = require('../services/verificationService')
const pythonService = require('../services/python.service')

/**
 * Student Controller
 * Thin HTTP adapter mapping student endpoints to domain services.
 */

/**
 * GET /api/student/exams
 * List exams eligible for this candidate
 */
async function listMyExams(req, res) {
  try {
    const exams = await studentService.listExamsForStudent(req.user.id)
    res.json({ exams, serverTime: new Date() })
  } catch (e) {
    console.error('[listMyExams]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to fetch exams' })
  }
}

/**
 * GET /api/student/exams/:id
 * Get single exam public details
 */
async function getExamDetails(req, res) {
  try {
    const exam = await studentService.getExamDetailsForStudent(req.params.id)
    res.json({ exam, serverTime: new Date() })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to fetch details' })
  }
}

/**
 * GET /api/student/exams/:id/lobby
 * Get waiting lobby data and chat history
 */
async function getExamLobby(req, res) {
  try {
    const lobbyData = await studentService.getExamLobbyData({
      examId: req.params.id,
      studentId: req.user.id
    })
    res.json({
      ...lobbyData,
      serverTime: new Date()
    })
  } catch (e) {
    console.error('[getExamLobby]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to load lobby' })
  }
}

/**
 * GET /api/student/exams/:id/start
 * Initialize or resume an active exam session
 */
async function startExam(req, res) {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    const userAgent = req.headers['user-agent'] || 'Unknown'

    const sessionData = await studentService.startOrResumeExam({
      examId: req.params.id,
      studentId: req.user.id,
      clientIp,
      userAgent
    })

    res.json(sessionData)
  } catch (e) {
    console.error('[startExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Initialization error' })
  }
}

/**
 * POST /api/student/exams/:id/answer
 * Save single answer
 */
async function saveAnswer(req, res) {
  try {
    const { id: examId } = req.params
    const { questionId } = req.body
    const result = await studentService.saveStudentAnswer({
      examId,
      studentId: req.user.id,
      questionId,
      answerData: req.body
    })
    res.json(result)
  } catch (e) {
    console.error('[saveAnswer]', e)
    res.status(e.status || 500).json({ error: e.message || 'Save failed' })
  }
}

/**
 * POST /api/student/exams/:id/autosave
 * Bulk autosave answers
 */
async function autoSaveAnswer(req, res) {
  try {
    const { id: examId } = req.params
    const { questionId, answer, answers } = req.body
    const result = await studentService.autoSaveStudentAnswers({
      examId,
      studentId: req.user.id,
      questionId,
      answer,
      answers
    })
    res.json(result)
  } catch (e) {
    console.error('[autoSaveAnswer]', e)
    res.status(e.status || 500).json({ error: e.message || 'Autosave failed' })
  }
}

/**
 * POST /api/student/exams/:id/evidence
 * Log security events & violation snapshots
 */
async function logEvidence(req, res) {
  try {
    const result = await studentService.logStudentEvidence({
      examId: req.params.id,
      studentId: req.user.id,
      data: req.body
    })
    res.json(result)
  } catch (e) {
    console.error('[logEvidence]', e)
    res.json({ success: true }) // Gracefully resolve to prevent client UI breaks
  }
}

/**
 * POST /api/student/exams/:id/violation (legacy alias)
 */
async function logViolation(req, res) {
  req.body.eventType = req.body.eventType || req.body.type
  req.body.details = req.body.details || req.body.description
  return logEvidence(req, res)
}

/**
 * POST /api/student/exams/:id/acknowledge
 * Watermark acknowledgement
 */
async function acknowledgeWatermark(req, res) {
  try {
    const result = await studentService.acknowledgeWatermarkSession({
      studentId: req.user.id,
      examId: req.params.id
    })
    res.json(result)
  } catch (e) {
    res.json({ success: true })
  }
}

/**
 * GET /api/student/exams/:id/chat
 * Load chat history
 */
async function getChatHistory(req, res) {
  try {
    const messages = await studentService.getStudentChatHistory({
      examId: req.params.id,
      studentId: req.user.id
    })
    res.json({ messages })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load chat', messages: [] })
  }
}

/**
 * POST /api/student/exams/:id/chat
 * Save chat message
 */
async function saveChatMessage(req, res) {
  try {
    const result = await studentService.saveStudentChatMessage({
      examId: req.params.id,
      studentId: req.user.id,
      message: req.body.message
    })
    res.json(result)
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to save chat message' })
  }
}

/**
 * POST /api/student/exams/:id/submit
 * Finalize exam and auto-grade MCQ answers
 */
async function submitExam(req, res) {
  try {
    const result = await studentService.submitStudentExam({
      examId: req.params.id,
      studentId: req.user.id,
      answers: req.body.answers
    })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('[submitExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Submission failed' })
  }
}

/**
 * POST /api/student/verify-face
 * Biometric face comparison (fail-closed)
 */
async function verifyFace(req, res) {
  try {
    const result = await verificationService.verifyFaceBiometrics({
      studentId: req.user.id,
      examId: req.body.examId,
      liveFrame: req.body.liveFrame
    })
    return res.json(result)
  } catch (err) {
    console.error('[verifyFace Error]:', err.message)
    return res.status(503).json({
      verified: false,
      matchScore: 0,
      error: 'AI Face Verification service unavailable or match failed. Please retry.'
    })
  }
}

/**
 * POST /api/student/verify-id
 * OCR verification of candidate ID card
 */
async function verifyIdCard(req, res) {
  try {
    const result = await verificationService.verifyIdCardPhoto({
      idCardPhoto: req.body.idCardPhoto
    })
    return res.json(result)
  } catch (err) {
    console.error('[verifyIdCard Error]:', err.message)
    return res.status(503).json({
      success: false,
      extractedUsn: '',
      error: 'OCR service unavailable. Ensure Python microservice is running.'
    })
  }
}

/**
 * POST /api/student/exams/:id/identity-verify
 * Upsert identity verification state
 */
async function saveIdentityVerification(req, res) {
  try {
    const verification = await verificationService.saveIdentityVerificationRecord({
      studentId: req.user.id,
      examId: req.params.id,
      ...req.body
    })
    res.json({ success: true, verification })
  } catch (e) {
    console.error('[saveIdentityVerification]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to save identity verification' })
  }
}

/**
 * GET /api/student/results
 * Candidate past exam results
 */
async function getMyResults(req, res) {
  try {
    const results = await studentService.getStudentResultsHistory(req.user.id)
    res.json({ results })
  } catch (e) {
    console.error('[getMyResults]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to fetch results' })
  }
}

/**
 * GET /api/student/profile
 * Current candidate profile info
 */
async function getProfile(req, res) {
  try {
    const student = await studentService.getStudentProfile(req.user.id)
    res.json({ student })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to fetch student profile' })
  }
}

/**
 * PUT /api/student/profile
 * Update student credentials / bio / photos
 */
async function updateProfile(req, res) {
  try {
    const updatedStudent = await studentService.updateStudentProfile({
      studentId: req.user.id,
      data: req.body
    })
    res.json({
      message: 'Profile updated successfully!',
      student: updatedStudent
    })
  } catch (e) {
    console.error('[updateProfile]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to update profile' })
  }
}

module.exports = {
  listMyExams,
  getExamDetails,
  getExamLobby,
  startExam,
  saveAnswer,
  autoSaveAnswer,
  logEvidence,
  logViolation,
  acknowledgeWatermark,
  getChatHistory,
  saveChatMessage,
  submitExam,
  verifyFace,
  verifyIdCard,
  saveIdentityVerification,
  getMyResults,
  getProfile,
  updateProfile,
}
