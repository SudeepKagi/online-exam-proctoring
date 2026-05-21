const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')

/**
 * POST /api/invigilator/login
 * Verify invigilator credentials for a specific exam and create a temporary session.
 */
async function login(req, res) {
  try {
    const { invId, invPassword, examId, idCardPhoto } = req.body

    if (!invId || !invPassword || !examId) {
      return res.status(400).json({ error: 'Exam ID, Invigilator ID, and password are required.' })
    }

    // 1. Find exam
    const exam = await global.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    // 2. Verify Invigilator Credentials
    if (exam.invId !== invId) {
      return res.status(401).json({ error: 'Invalid Invigilator ID.' })
    }

    const isMatch = await bcrypt.compare(invPassword, exam.invPasswordHash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid exam password.' })
    }

    // 3. Handle ID card photo (optional)
    let idCardPhotoUrl = null
    if (idCardPhoto) {
      try {
        const { uploadBase64 } = require('../services/cloudinary.service')
        idCardPhotoUrl = await uploadBase64(idCardPhoto, 'invigilator-ids')
      } catch (e) {
        console.warn('ID card upload skipped:', e.message)
      }
    }

    // 4. Create Session
    const session = await global.prisma.invigilatorSession.create({
      data: {
        examId,
        invId,
        idCardPhotoUrl,
        sessionExpiry: new Date(new Date(exam.endTime).getTime() + 60 * 60 * 1000),
        isActive: true
      }
    })

    // 5. Generate Temp JWT with invigilator role
    const token = jwt.sign(
      { id: session.id, role: 'invigilator', examId: exam.id },
      process.env.JWT_SECRET,
      { expiresIn: '6h' }
    )

    res.json({
      message: 'Logged in successfully.',
      token,
      role: 'invigilator',
      session: {
        id: session.id,
        examId: exam.id,
        examTitle: exam.title,
        expiry: session.sessionExpiry
      }
    })

  } catch (e) {
    console.error('[invigilatorLogin]', e)
    res.status(500).json({ error: 'Server error during invigilator login.' })
  }
}

/**
 * GET /api/invigilator/exam/:examId
 * Get exam info + enrolled students for the monitoring dashboard
 */
async function getExamInfo(req, res) {
  try {
    const { examId } = req.params

    // Verify invigilator is authorized for this exam
    if (req.user.examId !== examId) {
      return res.status(403).json({ error: 'Not authorized for this exam.' })
    }

    const exam = await global.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        faculty: { select: { name: true, department: true } },
        _count: { select: { questions: true } }
      }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    // Find all eligible students based on department and semester
    const eligibleStudents = await global.prisma.student.findMany({
      where: {
        department: exam.allowedDepartments.length > 0 ? { in: exam.allowedDepartments } : undefined,
        semester: exam.allowedSemesters.length > 0 ? { in: exam.allowedSemesters } : undefined
      },
      select: { id: true, name: true, usn: true, facePhotoUrl: true }
    })

    const studentSessions = await global.prisma.studentExam.findMany({
      where: { examId },
      include: {
        identityVerification: {
          select: { liveFaceMatchScore: true, status: true, verifiedAt: true }
        },
        evidenceLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: { eventType: true, severity: true, timestamp: true, details: true, screenshotUrl: true, cameraFrameUrl: true }
        },
        answers: {
          select: { id: true }
        }
      }
    })

    let totalQuestions = exam.questionsPerStudent || 0
    if (totalQuestions === 0 && exam._count) {
      totalQuestions = exam._count.questions
    }

    const students = eligibleStudents.map(student => {
      const se = studentSessions.find(s => s.studentId === student.id)
      let total = totalQuestions
      if (se && se.assignedQuestionIds && se.assignedQuestionIds.length > 0) {
        total = se.assignedQuestionIds.length
      }
      return {
        studentId: student.id,
        name: student.name,
        usn: student.usn,
        facePhotoUrl: student.facePhotoUrl,
        status: se ? se.status : 'NOT_STARTED',
        flagCount: se ? se.evidenceLogs.filter(e => ['HIGH', 'CRITICAL'].includes(e.severity)).length : 0,
        events: se ? se.evidenceLogs : [],
        progress: {
          answered: se ? se.answers.length : 0,
          total: total
        },
        startedAt: se ? se.startedAt : null,
        faceMatchScore: se?.identityVerification?.liveFaceMatchScore ?? null,
        identityStatus: se?.identityVerification?.status ?? null
      }
    })

    // Fetch all chat messages for this exam
    const chatMessagesRaw = await global.prisma.chatMessage.findMany({
      where: { examId },
      orderBy: { timestamp: 'asc' }
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

/**
 * POST /api/invigilator/exam/:examId/terminate/:studentId
 * Terminate a student's exam
 */
async function terminateStudent(req, res) {
  try {
    const { examId, studentId } = req.params
    const { reason } = req.body

    if (req.user.examId !== examId) return res.status(403).json({ error: 'Not authorized.' })

    // Force-submit the student's exam
    const session = await global.prisma.studentExam.findFirst({
      where: { studentId, examId, status: 'ACTIVE' }
    })

    if (session) {
      await global.prisma.studentExam.update({
        where: { id: session.id },
        data: { status: 'TERMINATED', submittedAt: new Date() }
      })

      await global.prisma.evidenceLog.create({
        data: {
          studentExamId: session.id,
          eventType: 'EXAM_TERMINATED',
          severity: 'CRITICAL',
          details: `Terminated by invigilator. Reason: ${reason || 'N/A'}`,
          timestamp: new Date()
        }
      }).catch(() => {})
    }

    // Socket notification (invigilator frontend also emits this)
    const io = req.app.get('io')
    if (io) {
      io.to(`student:${studentId}`).emit('exam:terminated', {
        reason: reason || 'Terminated by invigilator',
        timestamp: new Date().toISOString()
      })
    }

    res.json({ success: true, message: 'Student exam terminated.' })
  } catch (e) {
    console.error('[terminateStudent]', e)
    res.status(500).json({ error: 'Failed to terminate.' })
  }
}

module.exports = {
  login,
  getExamInfo,
  getExamStudents,
  warnStudent,
  terminateStudent
}
