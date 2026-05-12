const bcrypt  = require('bcryptjs')
const { signToken } = require('../utils/jwt')
const { logAudit }  = require('../utils/auditLogger')
const { getClientIp } = require('../utils/helpers')
const { sendFacultyRegisteredEmail } = require('../services/email.service')
const { compareFaces, verifyIdCardOcr } = require('../services/python.service')

// ════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/admin/login
 */
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' })

    const admin = await global.prisma.admin.findUnique({ where: { email } })
    if (!admin)
      return res.status(401).json({ error: 'Invalid credentials.' })

    const valid = await bcrypt.compare(password, admin.password)
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials.' })

    const token = signToken({ id: admin.id, role: 'admin' })

    logAudit({ userId: admin.id, userRole: 'admin', action: 'ADMIN_LOGIN', ipAddress: getClientIp(req) })

    res.json({
      token,
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' },
    })
  } catch (e) {
    console.error('[adminLogin]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// FACULTY AUTH
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/faculty/register
 */
async function facultyRegister(req, res) {
  try {
    const { name, email, password, department, employeeId, idCardBase64, profilePhotoBase64 } = req.body
    if (!name || !email || !password || !department || !employeeId)
      return res.status(400).json({ error: 'All fields are required.' })

    // Check duplicate
    const existing = await global.prisma.faculty.findFirst({
      where: { OR: [{ email }, { employeeId }] },
    })
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Employee ID'
      return res.status(409).json({ error: `${field} is already registered.` })
    }

    const { uploadBase64 } = require('../services/cloudinary.service')
    let idCardPhotoUrl = null
    let profilePhotoUrl = null

    if (idCardBase64) {
      idCardPhotoUrl = await uploadBase64(idCardBase64, 'proctornet/faculty-ids')
    }
    if (profilePhotoBase64) {
      profilePhotoUrl = await uploadBase64(profilePhotoBase64, 'proctornet/faculty-profiles')
    }

    const hashed  = await bcrypt.hash(password, 12)
    const faculty = await global.prisma.faculty.create({
      data: { name, email, password: hashed, department, employeeId, idCardPhotoUrl, profilePhotoUrl, isApproved: false },
    })

    logAudit({ userId: faculty.id, userRole: 'faculty', action: 'FACULTY_REGISTERED',
      details: `${name} (${employeeId})`, ipAddress: getClientIp(req), facultyId: faculty.id })

    // Notify admin (non-blocking)
    sendFacultyRegisteredEmail(faculty).catch(() => {})

    res.status(201).json({
      message: 'Registration successful. Waiting for admin approval.',
      status: 'PENDING_APPROVAL',
    })
  } catch (e) {
    console.error('[facultyRegister]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * POST /api/auth/faculty/login
 */
async function facultyLogin(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' })

    const faculty = await global.prisma.faculty.findUnique({ where: { email } })
    if (!faculty)
      return res.status(401).json({ error: 'Invalid credentials.' })

    if (!faculty.isApproved)
      return res.status(403).json({ error: 'Your account is pending admin approval.', status: 'PENDING_APPROVAL' })

    if (faculty.isSuspended)
      return res.status(403).json({ error: 'Your account has been suspended. Contact admin.', status: 'SUSPENDED' })

    const valid = await bcrypt.compare(password, faculty.password)
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials.' })

    const token = signToken({ id: faculty.id, role: 'faculty' })

    logAudit({ userId: faculty.id, userRole: 'faculty', action: 'FACULTY_LOGIN', ipAddress: getClientIp(req), facultyId: faculty.id })

    res.json({
      token,
      user: { id: faculty.id, name: faculty.name, email: faculty.email, department: faculty.department, role: 'faculty' },
    })
  } catch (e) {
    console.error('[facultyLogin]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// STUDENT AUTH
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/student/register
 * Requires: name, usn, email, password, department, semester
 * + facePhoto and idCard as multipart OR base64 in body
 */
async function studentRegister(req, res) {
  try {
    const { name, usn, email, password, department, semester, facePhotoBase64, idCardBase64 } = req.body

    if (!name || !usn || !email || !password || !department || !semester)
      return res.status(400).json({ error: 'All fields are required.' })

    // Check duplicates
    const existing = await global.prisma.student.findFirst({
      where: { OR: [{ email }, { usn }] },
    })
    if (existing) {
      const field = existing.email === email ? 'Email' : 'USN'
      return res.status(409).json({ error: `${field} is already registered.` })
    }

    // Upload photos to Cloudinary
    const { uploadBase64 } = require('../services/cloudinary.service')
    let facePhotoUrl   = 'placeholder_face'
    let idCardPhotoUrl = 'placeholder_id'

    if (facePhotoBase64) {
      facePhotoUrl = await uploadBase64(facePhotoBase64, 'proctornet/faces')
    }
    if (idCardBase64) {
      idCardPhotoUrl = await uploadBase64(idCardBase64, 'proctornet/idcards')
    }

    // Call Python AI service for face match + OCR
    let faceMatchScore  = 0
    let approvalStatus  = 'PENDING_ADMIN'

    try {
      // 1. Face Comparison
      const faceRes = await compareFaces(facePhotoUrl, idCardPhotoUrl)
      faceMatchScore = faceRes.matchScore || 0
      
      // 2. OCR Verification
      const ocrRes = await verifyIdCardOcr(idCardPhotoUrl)
      const ocrUsn = ocrRes.extractedUsn || ''

      // Auto-approve to faculty queue if score >= threshold AND USN matches
      const threshold = 0.80
      const usnMatches = ocrUsn.toUpperCase() === usn.toUpperCase()
      
      if (faceMatchScore >= threshold && usnMatches) {
        approvalStatus = 'PENDING_FACULTY'
      } else {
        console.warn(`[studentRegister] Auto-approval failed: Score=${faceMatchScore}, USN Match=${usnMatches} (OCR: ${ocrUsn}, Input: ${usn})`)
      }
    } catch (pyErr) {
      // Python service not running or error — set to manual review
      console.warn('[studentRegister] AI Service Issue:', pyErr.message)
      faceMatchScore = 0 // Indicate verification was not performed
      approvalStatus = 'PENDING_ADMIN' 
    }

    const hashed  = await bcrypt.hash(password, 12)
    const student = await global.prisma.student.create({
      data: {
        name, usn, email, password: hashed, department,
        semester: parseInt(semester),
        facePhotoUrl, idCardPhotoUrl,
        faceMatchScore,
        approvalStatus,
      },
    })

    logAudit({ userId: student.id, userRole: 'student', action: 'STUDENT_REGISTERED',
      details: `${name} (${usn}) score=${faceMatchScore}`, ipAddress: getClientIp(req), studentId: student.id })

    res.status(201).json({
      message: approvalStatus === 'PENDING_FACULTY'
        ? 'Registration successful. Awaiting faculty approval.'
        : 'Registration submitted. Under admin review due to low identity match score.',
      status: approvalStatus,
      matchScore: faceMatchScore,
    })
  } catch (e) {
    console.error('[studentRegister]', e)
    res.status(500).json({ error: 'Server error: ' + e.message })
  }
}

/**
 * POST /api/auth/student/login
 */
async function studentLogin(req, res) {
  try {
    const { usn, password } = req.body
    if (!usn || !password)
      return res.status(400).json({ error: 'USN and password are required.' })

    const student = await global.prisma.student.findUnique({ where: { usn } })
    if (!student)
      return res.status(401).json({ error: 'Invalid credentials.' })

    if (student.approvalStatus !== 'APPROVED')
      return res.status(403).json({
        error: 'Your account is not yet approved.',
        status: student.approvalStatus,
      })

    if (student.isSuspended)
      return res.status(403).json({ error: 'Account suspended. Contact admin.', status: 'SUSPENDED' })

    const valid = await bcrypt.compare(password, student.password)
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials.' })

    const token = signToken({ id: student.id, role: 'student' })

    logAudit({ userId: student.id, userRole: 'student', action: 'STUDENT_LOGIN', ipAddress: getClientIp(req), studentId: student.id })

    res.json({
      token,
      user: {
        id: student.id, name: student.name, usn: student.usn,
        email: student.email, department: student.department,
        semester: student.semester, facePhotoUrl: student.facePhotoUrl,
        role: 'student',
      },
    })
  } catch (e) {
    console.error('[studentLogin]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// INVIGILATOR AUTH
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/invigilator/login
 */
async function invigilatorLogin(req, res) {
  try {
    const { invId, invPassword, examId } = req.body
    if (!invId || !invPassword || !examId)
      return res.status(400).json({ error: 'invId, invPassword and examId are required.' })

    // Find exam
    const exam = await global.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam)
      return res.status(404).json({ error: 'Exam not found.' })

    if (exam.invId !== invId)
      return res.status(401).json({ error: 'Invalid invigilator credentials.' })

    const valid = await bcrypt.compare(invPassword, exam.invPasswordHash)
    if (!valid)
      return res.status(401).json({ error: 'Invalid invigilator credentials.' })

    // Handle ID card OCR (optional — photo may come as multipart)
    let idCardPhotoUrl  = 'placeholder_id'
    let idCardOcrResult = null

    if (req.file) {
      const { uploadBuffer } = require('../services/cloudinary.service')
      idCardPhotoUrl = await uploadBuffer(req.file.buffer, 'proctornet/invigilator-ids')
      try {
        const ocrRes = await verifyIdCardOcr(idCardPhotoUrl)
        idCardOcrResult = ocrRes.extractedName || null
      } catch { /* Python unavailable */ }
    }

    // Session expires at exam end + 30 mins
    const sessionExpiry = new Date(exam.endTime.getTime() + 30 * 60 * 1000)

    // Create session record
    const session = await global.prisma.invigilatorSession.create({
      data: {
        examId,
        invId,
        idCardPhotoUrl,
        idCardOcrResult,
        sessionExpiry,
        ipAddress: getClientIp(req),
        isActive: true,
      },
    })

    // Temp JWT expires at exam end + 30 min
    const secondsUntilExpiry = Math.floor((sessionExpiry - Date.now()) / 1000)
    const token = signToken(
      { id: session.id, role: 'invigilator', examId },
      `${secondsUntilExpiry}s`
    )

    logAudit({ userId: session.id, userRole: 'invigilator', action: 'INVIGILATOR_LOGIN',
      details: `examId=${examId} invId=${invId}`, ipAddress: getClientIp(req) })

    res.json({
      token,
      session: {
        id: session.id, examId, invId,
        sessionExpiry, exam: { title: exam.title, subject: exam.subject },
      },
    })
  } catch (e) {
    console.error('[invigilatorLogin]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

module.exports = {
  adminLogin,
  facultyRegister,
  facultyLogin,
  studentRegister,
  studentLogin,
  invigilatorLogin,
}
