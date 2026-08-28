/**
 * H-7: This route delegates to the canonical invigilator login in auth.controller.js.
 * The canonical implementation handles credential verification, session creation,
 * JWT issuance, optional ID card upload, and audit logging in one place.
 */
const { invigilatorLogin: canonicalInvigilatorLogin } = require('./auth.controller')

async function login(req, res) {
  return canonicalInvigilatorLogin(req, res)
}



/**
 * GET /api/invigilator/exam/:examId
 * Get exam info + enrolled students for the monitoring dashboard
 */
async function getExamInfo(req, res) {
  try {
    let { examId } = req.params

    if (!examId || examId === 'active' || examId === 'undefined' || examId === 'null') {
      if (req.user.examId) {
        examId = req.user.examId
      } else {
        const activeExam = await global.prisma.exam.findFirst({
          where: { status: { in: ['ACTIVE', 'SCHEDULED', 'IN_PROGRESS', 'PUBLISHED'] } },
          orderBy: [{ createdAt: 'desc' }, { startTime: 'desc' }]
        })
        if (activeExam) {
          examId = activeExam.id
        }
      }
    }

    if (!examId) {
      return res.status(404).json({ error: 'No active examination found.' })
    }

    if (req.user.role === 'invigilator' && req.user.examId && req.user.examId !== examId) {
      return res.status(403).json({ error: 'Not authorized for this exam.' })
    }

    const exam = await global.prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        subject: true,
        duration: true,
        totalMarks: true,
        startTime: true,
        endTime: true,
        allowedDepartments: true,
        allowedSemesters: true,
        faculty: { select: { name: true, department: true } },
        _count: { select: { questions: true } }
      }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    // Security C-9: Scope candidate discovery at the database level to candidates enrolled or matching criteria for this exam
    const whereConditions = {
      OR: [
        { studentExams: { some: { examId } } }
      ]
    }
    if (exam.allowedDepartments && exam.allowedDepartments.length > 0 && !exam.allowedDepartments.some(d => String(d).toUpperCase() === 'ALL')) {
      const deptCondition = { department: { in: exam.allowedDepartments } }
      if (exam.allowedSemesters && exam.allowedSemesters.length > 0 && !exam.allowedSemesters.includes(0)) {
        deptCondition.semester = { in: exam.allowedSemesters }
      }
      whereConditions.OR.push(deptCondition)
    }

    const eligibleStudents = await global.prisma.student.findMany({
      where: whereConditions,
      select: { id: true, name: true, usn: true, facePhotoUrl: true, department: true, semester: true }
    })

    const studentSessions = await global.prisma.studentExam.findMany({
      where: { examId },
      select: {
        id: true,
        studentId: true,
        status: true,
        flagCount: true,
        startedAt: true,
        submittedAt: true,
        assignedQuestionIds: true,
        answers: { select: { id: true } },
        identityVerification: {
          select: {
            liveFaceMatchScore: true,
            status: true
          }
        },
        evidenceLogs: {
          select: {
            id: true,
            eventType: true,
            timestamp: true,
            screenshotUrl: true,
            cameraFrameUrl: true,
            details: true,
            severity: true,
            invAction: true,
            invActionNote: true
          },
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    })

    // O(1) Hash Map Lookup Table
    const sessionMap = new Map()
    studentSessions.forEach(se => sessionMap.set(se.studentId, se))

    const totalQuestions = exam._count?.questions || 0

    const students = eligibleStudents.map(student => {
      const se = sessionMap.get(student.id)
      const total = (se && se.assignedQuestionIds && se.assignedQuestionIds.length > 0)
        ? se.assignedQuestionIds.length
        : totalQuestions

      const rawLogs = se?.evidenceLogs || []
      const liveMemory = global.latestLiveFrames?.get(student.id) || {}
      const latestCameraFrame = liveMemory.camera || rawLogs.find(e => e.cameraFrameUrl)?.cameraFrameUrl || null
      const latestScreenshot = liveMemory.screen || rawLogs.find(e => e.screenshotUrl)?.screenshotUrl || null

      return {
        studentId: student.id,
        name: student.name,
        usn: student.usn,
        facePhotoUrl: student.facePhotoUrl,
        status: se ? se.status : 'NOT_STARTED',
        flagCount: se ? Math.max(se.flagCount || 0, rawLogs.length) : 0,
        events: rawLogs.map(e => ({
          id: e.id,
          type: e.eventType,
          eventType: e.eventType,
          details: e.details,
          severity: e.severity || 'MEDIUM',
          timestamp: e.timestamp,
          screenshotUrl: e.screenshotUrl,
          cameraFrameUrl: e.cameraFrameUrl,
          invAction: e.invAction,
          invActionNote: e.invActionNote
        })),
        latestFrame: latestCameraFrame,
        latestScreen: latestScreenshot,
        progress: {
          answered: se ? (se.answers?.length || 0) : 0,
          total
        },
        startedAt: se ? se.startedAt : null,
        faceMatchScore: se?.identityVerification?.liveFaceMatchScore ?? (se ? 0.95 : null),
        identityStatus: se?.identityVerification?.status ?? (se ? 'VERIFIED' : 'NOT_VERIFIED')
      }
    })

    // Fetch all chat messages for this exam
    const chatMessagesRaw = await global.prisma.chatMessage.findMany({
      where: { examId },
      orderBy: { timestamp: 'asc' },
      take: 50
    }).catch(() => [])

    const chatMessages = chatMessagesRaw.map(c => ({
      studentId: c.studentId,
      sender: c.senderRole,
      message: c.message,
      timestamp: c.timestamp
    }))

    res.json({ exam, students, chatMessages })
  } catch (e) {
    console.error('[getExamInfo]', e)
    res.status(500).json({ error: 'Failed to fetch exam data.' })
  }
}

/**
 * GET /api/invigilator/exams/:examId/students (legacy)
 */
async function getExamStudents(req, res) {
  req.params.examId = req.params.examId || req.user.examId
  return getExamInfo(req, res)
}

/**
 * POST /api/invigilator/exam/:examId/warn/:studentId
 * Send a warning to a student (also emitted via socket from frontend)
 */
async function warnStudent(req, res) {
  try {
    const { examId, studentId } = req.params
    const { message } = req.body

    if (!message?.trim()) return res.status(400).json({ error: 'Warning message required.' })
    if (req.user.examId !== examId) return res.status(403).json({ error: 'Not authorized.' })

    // Log the warning as an evidence event
    const session = await global.prisma.studentExam.findFirst({
      where: { studentId, examId }
    })

    if (session) {
      await global.prisma.evidenceLog.create({
        data: {
          studentExamId: session.id,
          eventType: 'INVIGILATOR_WARNING',
          severity: 'MEDIUM',
          details: `Warning: ${message}`,
          timestamp: new Date()
        }
      }).catch(() => {})
    }

    // Socket emission is handled by the frontend, but we can do it here too
    const io = req.app.get('io')
    if (io) {
      io.to(`student:${studentId}`).emit('exam:warning', {
        message,
        from: 'Invigilator',
        timestamp: new Date().toISOString()
      })
    }

    res.json({ success: true, message: 'Warning sent.' })
  } catch (e) {
    console.error('[warnStudent]', e)
    res.status(500).json({ error: 'Failed to send warning.' })
  }
}

const { transitionExamSession, SESSION_STATES } = require('../services/sessionStateMachine')

async function verifyExamAuthorization(req, targetExamId) {
  if (!req.user) {
    const error = new Error('Authentication required.')
    error.status = 401
    throw error
  }

  if (req.user.role === 'admin') {
    return true
  }

  if (req.user.role === 'invigilator') {
    if (!req.user.examId) {
      const error = new Error('Invigilator has no assigned examination.')
      error.status = 403
      throw error
    }
    if (targetExamId && targetExamId !== req.user.examId) {
      const error = new Error('Not authorized for this examination.')
      error.status = 403
      throw error
    }
    return true
  }

  if (req.user.role === 'faculty') {
    if (!targetExamId) return true
    const exam = await global.prisma.exam.findFirst({
      where: { id: targetExamId, facultyId: req.user.id }
    })
    if (!exam) {
      const error = new Error('Not authorized to manage this examination.')
      error.status = 403
      throw error
    }
    return true
  }

  const error = new Error('Unauthorized role.')
  error.status = 403
  throw error
}

/**
 * POST /api/invigilator/exam/:examId/terminate/:studentId
 * Terminate a student's exam session
 */
async function terminateStudent(req, res) {
  try {
    const { examId, studentId } = req.params
    const { reason } = req.body

    await verifyExamAuthorization(req, examId)

    const session = await global.prisma.studentExam.findFirst({
      where: { studentId, examId }
    })

    if (!session) {
      return res.status(404).json({ error: 'Student session not found for this exam.' })
    }

    const io = req.app.get('io')
    const result = await transitionExamSession({
      studentExamId: session.id,
      targetStatus: SESSION_STATES.TERMINATED,
      reason: reason || 'Terminated by Invigilator for academic integrity violation.',
      reqUser: req.user,
      io
    })

    res.json({ success: true, message: 'Student exam terminated.', ...result })
  } catch (e) {
    console.error('[terminateStudent]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to terminate.' })
  }
}

/**
 * POST /api/invigilator/terminate-student/:studentId
 * Generic termination endpoint matching frontend action dispatcher
 */
async function terminateStudentGeneral(req, res) {
  try {
    const { studentId } = req.params
    const { reason, examId: bodyExamId } = req.body
    const targetExamId = req.user.role === 'invigilator' ? req.user.examId : (bodyExamId || req.user.examId)

    await verifyExamAuthorization(req, targetExamId)

    const query = { studentId }
    if (targetExamId) query.examId = targetExamId

    const session = await global.prisma.studentExam.findFirst({
      where: query,
      orderBy: { createdAt: 'desc' }
    })

    if (!session) {
      return res.status(404).json({ error: 'Active candidate exam record not found.' })
    }

    const io = req.app.get('io')
    const result = await transitionExamSession({
      studentExamId: session.id,
      targetStatus: SESSION_STATES.TERMINATED,
      reason: reason || 'Terminated by Invigilator for academic integrity violation.',
      reqUser: req.user,
      io
    })

    res.json({ success: true, message: 'Candidate session terminated.', ...result })
  } catch (e) {
    console.error('[terminateStudentGeneral]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to terminate candidate.' })
  }
}

async function sendWarningGeneral(req, res) {
  try {
    const { studentId, message, examId: bodyExamId } = req.body
    const targetExamId = req.user.role === 'invigilator' ? req.user.examId : (bodyExamId || req.user.examId)

    await verifyExamAuthorization(req, targetExamId)

    // Verify session
    if (studentId && targetExamId) {
      const session = await global.prisma.studentExam.findFirst({
        where: { studentId, examId: targetExamId }
      })
      if (session) {
        await global.prisma.evidenceLog.create({
          data: {
            studentExamId: session.id,
            eventType: 'INVIGILATOR_WARNING',
            severity: 'MEDIUM',
            details: `Warning: ${message || 'Please maintain full focus on the examination.'}`,
            invAction: 'WARNING',
            invActionNote: message,
            timestamp: new Date()
          }
        }).catch(e => console.warn('[sendWarningGeneral] log note:', e.message))
      }
    }

    const io = req.app.get('io')
    if (io && studentId) {
      io.to(`student:${studentId}`).emit('exam:warning', {
        message: message || 'Invigilator warning issued.',
        from: 'Invigilator',
        timestamp: new Date().toISOString()
      })
    }
    res.json({ success: true, message: 'Warning dispatched successfully.' })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to send warning.' })
  }
}

async function pauseStudentGeneral(req, res) {
  try {
    const { studentId } = req.params
    const { reason, examId: bodyExamId } = req.body
    const targetExamId = req.user.role === 'invigilator' ? req.user.examId : (bodyExamId || req.user.examId)

    await verifyExamAuthorization(req, targetExamId)

    const query = { studentId }
    if (targetExamId) query.examId = targetExamId

    const session = await global.prisma.studentExam.findFirst({
      where: query,
      orderBy: { createdAt: 'desc' }
    })

    if (!session) {
      return res.status(404).json({ error: 'Active candidate exam record not found.' })
    }

    const io = req.app.get('io')
    const result = await transitionExamSession({
      studentExamId: session.id,
      targetStatus: SESSION_STATES.SUSPENDED,
      reason: reason || 'Examination temporarily suspended by proctor.',
      reqUser: req.user,
      io
    })

    res.json({ success: true, message: 'Exam session suspended.', ...result })
  } catch (e) {
    console.error('[pauseStudentGeneral]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to pause session.' })
  }
}

async function resumeStudentGeneral(req, res) {
  try {
    const { studentId } = req.params
    const { examId: bodyExamId } = req.body
    const targetExamId = req.user.role === 'invigilator' ? req.user.examId : (bodyExamId || req.user.examId)

    await verifyExamAuthorization(req, targetExamId)

    const query = { studentId }
    if (targetExamId) query.examId = targetExamId

    const session = await global.prisma.studentExam.findFirst({
      where: query,
      orderBy: { createdAt: 'desc' }
    })

    if (!session) {
      return res.status(404).json({ error: 'Candidate exam record not found.' })
    }

    const io = req.app.get('io')
    const result = await transitionExamSession({
      studentExamId: session.id,
      targetStatus: SESSION_STATES.ACTIVE,
      reason: 'Session resumed by proctor.',
      reqUser: req.user,
      io
    })

    res.json({ success: true, message: 'Exam session resumed.', ...result })
  } catch (e) {
    console.error('[resumeStudentGeneral]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to resume session.' })
  }
}

module.exports = {
  login,
  getExamInfo,
  getExamStudents,
  warnStudent,
  terminateStudent,
  terminateStudentGeneral,
  sendWarningGeneral,
  pauseStudentGeneral,
  resumeStudentGeneral
}
