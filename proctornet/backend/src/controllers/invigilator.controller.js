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
      include: { faculty: { select: { name: true, department: true } } }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    const studentSessions = await global.prisma.studentExam.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, name: true, usn: true, facePhotoUrl: true } },
        evidenceLogs: {
          orderBy: { timestamp: 'desc' },
          take: 3,
          select: { eventType: true, severity: true, timestamp: true }
        }
      }
    })

    const students = studentSessions.map(se => ({
      studentId: se.student.id,
      name: se.student.name,
      usn: se.student.usn,
      facePhotoUrl: se.student.facePhotoUrl,
      status: se.status,
      flagCount: se.evidenceLogs.filter(e => ['HIGH', 'CRITICAL'].includes(e.severity)).length,
      events: se.evidenceLogs,
      progress: { answered: 0, total: exam.questionsPerStudent || 0 },
      startedAt: se.startedAt
    }))

    res.json({ exam, students })
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
