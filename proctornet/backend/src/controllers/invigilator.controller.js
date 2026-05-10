const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const { uploadBase64 } = require('../services/cloudinary.service')
const { verifyIdCardOcr } = require('../services/python.service')

/**
 * POST /api/auth/invigilator/login
 * Verify invigilator credentials for a specific exam and create a temporary session.
 */
async function login(req, res) {
  try {
    const { invId, invPassword, examId } = req.body
    
    // 1. Find exam
    const exam = await global.prisma.exam.findUnique({
      where: { id: examId }
    })

    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    // 2. Verify Invigilator Credentials
    if (exam.invId !== invId) {
      return res.status(401).json({ error: 'Invalid Invigilator ID.' })
    }

    const isMatch = await bcrypt.compare(invPassword, exam.invPasswordHash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid exam password.' })
    }

    // 3. Handle ID Card (optional in UI, but we process if present)
    let idCardPhotoUrl = null
    let idCardOcrResult = null
    
    if (req.file) {
      // In a real app, we'd upload the file. For now, simulate with a placeholder.
      idCardPhotoUrl = 'placeholder_inv_id'
      try {
        const ocr = await verifyIdCardOcr(idCardPhotoUrl)
        idCardOcrResult = ocr.extractedName || 'Unknown Invigilator'
      } catch (e) {
        console.warn('Invigilator OCR failed:', e.message)
      }
    }

    // 4. Create Session
    const session = await global.prisma.invigilatorSession.create({
      data: {
        examId,
        invId,
        idCardPhotoUrl,
        idCardOcrResult,
        sessionExpiry: new Date(exam.endTime.getTime() + 60 * 60 * 1000), // 1 hr after exam
        isActive: true
      }
    })

    // 5. Generate Temp JWT
    const token = jwt.sign(
      { id: session.id, role: 'invigilator', examId: exam.id },
      process.env.JWT_SECRET,
      { expiresIn: '6h' }
    )

    res.json({
      message: 'Logged in successfully.',
      token,
      session: {
        id: session.id,
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
 * GET /api/invigilator/students
 * Get all students enrolled/taking the current exam.
 */
async function getExamStudents(req, res) {
  try {
    const { examId } = req.user
    const students = await global.prisma.studentExam.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, name: true, usn: true, facePhotoUrl: true } },
        evidenceLogs: { orderBy: { timestamp: 'desc' }, take: 1 }
      }
    })

    res.json({ students })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch exam students.' })
  }
}

module.exports = {
  login,
  getExamStudents
}
