const bcrypt = require('bcryptjs')
const { signToken } = require('../utils/jwt')
const { setAuthCookie, clearAuthCookie } = require('../utils/cookies')
const { logAudit } = require('../utils/auditLogger')
const { getClientIp } = require('../utils/helpers')

// ════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════

function handleAuthError(res, err, context) {
  console.error(`[${context}]`, err.message || err)
  const msg = err.message || ''
  const isDbConnectionError =
    err.code === 'P1001' ||
    err.code === 'P1002' ||
    err.name === 'PrismaClientInitializationError' ||
    msg.includes('tenant') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connection timed out') ||
    msg.includes('Can\'t reach database server')

  if (isDbConnectionError) {
    return res.status(503).json({
      error: 'Database is currently unreachable. If using Supabase free tier, please unpause your project in the Supabase dashboard.',
      details: msg
    })
  }
  return res.status(500).json({ error: 'Authentication service encountered an error: ' + (err.message || 'Please try again.') })
}

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
    setAuthCookie(res, token)

    logAudit({ userId: admin.id, userRole: 'admin', action: 'ADMIN_LOGIN', ipAddress: getClientIp(req) })

    res.json({
      authenticated: true,
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin', mustChangePassword: false },
    })
  } catch (e) {
    handleAuthError(res, e, 'adminLogin')
  }
}

// ════════════════════════════════════════════════════
// FACULTY AUTH
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/faculty/register (DISABLED — Admin-Managed Creation Only)
 */
async function facultyRegister(req, res) {
  return res.status(403).json({
    error: 'Public self-registration is disabled. Accounts are managed by System Administration.',
  })
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
    setAuthCookie(res, token)

    logAudit({ userId: faculty.id, userRole: 'faculty', action: 'FACULTY_LOGIN', ipAddress: getClientIp(req), facultyId: faculty.id })

    res.json({
      authenticated: true,
      user: {
        id: faculty.id,
        name: faculty.name,
        email: faculty.email,
        department: faculty.department,
        employeeId: faculty.employeeId,
        role: 'faculty',
        mustChangePassword: faculty.mustChangePassword || false,
      },
    })
  } catch (e) {
    handleAuthError(res, e, 'facultyLogin')
  }
}

// ════════════════════════════════════════════════════
// STUDENT AUTH
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/student/register (DISABLED — Admin-Managed Creation Only)
 */
async function studentRegister(req, res) {
  return res.status(403).json({
    error: 'Public self-registration is disabled. Accounts are managed by System Administration.',
  })
}

/**
 * POST /api/auth/student/login
 */
async function studentLogin(req, res) {
  try {
    const { usn: rawUsn, password } = req.body
    if (!rawUsn || !password)
      return res.status(400).json({ error: 'USN and password are required.' })

    const usn = rawUsn.trim().toUpperCase()

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
    setAuthCookie(res, token)

    logAudit({ userId: student.id, userRole: 'student', action: 'STUDENT_LOGIN', ipAddress: getClientIp(req), studentId: student.id })

    res.json({
      authenticated: true,
      user: {
        id: student.id,
        name: student.name,
        usn: student.usn,
        email: student.email,
        department: student.department,
        semester: student.semester,
        facePhotoUrl: student.facePhotoUrl,
        role: 'student',
        mustChangePassword: student.mustChangePassword || false,
        profileStatus: student.profileStatus || 'PENDING',
      },
    })
  } catch (e) {
    handleAuthError(res, e, 'studentLogin')
  }
}

/**
 * GET /api/auth/me - Return current user profile with live DB status
 */
async function getMe(req, res) {
  try {
    const { id, role } = req.user

    if (role === 'student') {
      const student = await global.prisma.student.findUnique({ where: { id } })
      if (!student) return res.status(404).json({ error: 'Student not found.' })
      return res.json({
        authenticated: true,
        user: {
          id: student.id,
          name: student.name,
          usn: student.usn,
          email: student.email,
          department: student.department,
          semester: student.semester,
          facePhotoUrl: student.facePhotoUrl,
          idDocumentUrl: student.idDocumentUrl,
          role: 'student',
          mustChangePassword: student.mustChangePassword || false,
          profileStatus: student.profileStatus || 'PENDING',
          rejectionReason: student.rejectionReason,
        }
      })
    } else if (role === 'faculty') {
      const faculty = await global.prisma.faculty.findUnique({ where: { id } })
      if (!faculty) return res.status(404).json({ error: 'Faculty not found.' })
      return res.json({
        authenticated: true,
        user: {
          id: faculty.id,
          name: faculty.name,
          email: faculty.email,
          department: faculty.department,
          employeeId: faculty.employeeId,
          role: 'faculty',
          mustChangePassword: faculty.mustChangePassword || false,
        }
      })
    } else if (role === 'admin') {
      const admin = await global.prisma.admin.findUnique({ where: { id } })
      if (!admin) return res.status(404).json({ error: 'Admin not found.' })
      return res.json({
        authenticated: true,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: 'admin',
          mustChangePassword: false,
        }
      })
    } else if (role === 'invigilator') {
      const session = await global.prisma.invigilatorSession.findUnique({
        where: { id },
        include: { exam: { select: { id: true, title: true, subject: true } } }
      })
      if (!session || !session.isActive) return res.status(401).json({ error: 'Invigilator session has expired or is invalid.' })
      return res.json({
        authenticated: true,
        user: {
          id: session.invId,
          name: `Invigilator ${session.invId}`,
          role: 'invigilator',
          examId: session.examId,
          exam: session.exam,
          sessionId: session.id,
          sessionExpiry: session.sessionExpiry,
        }
      })
    }

    return res.json({ authenticated: true, user: req.user })
  } catch (err) {
    console.error('[getMe]', err)
    return res.status(500).json({ error: 'Server error.' })
  }
}


// ════════════════════════════════════════════════════
// FORCED PASSWORD CHANGE (Student, Faculty, Admin)
// ════════════════════════════════════════════════════

/**
 * POST /api/auth/change-password
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.id
    const userRole = req.user.role

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' })
    }

    let userObj = null
    let modelName = ''

    if (userRole === 'student') {
      userObj = await global.prisma.student.findUnique({ where: { id: userId } })
      modelName = 'student'
    } else if (userRole === 'faculty') {
      userObj = await global.prisma.faculty.findUnique({ where: { id: userId } })
      modelName = 'faculty'
    } else if (userRole === 'admin') {
      userObj = await global.prisma.admin.findUnique({ where: { id: userId } })
      modelName = 'admin'
    }

    if (!userObj) {
      return res.status(404).json({ error: 'User account not found.' })
    }

    const valid = await bcrypt.compare(currentPassword, userObj.password)
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' })
    }

    const newHashed = await bcrypt.hash(newPassword, 10)

    if (modelName === 'student') {
      await global.prisma.student.update({
        where: { id: userId },
        data: { password: newHashed, mustChangePassword: false },
      })
    } else if (modelName === 'faculty') {
      await global.prisma.faculty.update({
        where: { id: userId },
        data: { password: newHashed, mustChangePassword: false },
      })
    } else if (modelName === 'admin') {
      await global.prisma.admin.update({
        where: { id: userId },
        data: { password: newHashed },
      })
    }

    logAudit({ userId, userRole, action: 'PASSWORD_CHANGED', ipAddress: getClientIp(req) })

    return res.json({
      success: true,
      message: 'Password changed successfully. Your account is now fully unlocked.',
    })
  } catch (e) {
    console.error('[changePassword]', e)
    return res.status(500).json({ error: 'Server error: ' + e.message })
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
    const { invId, invPassword, examId, idCardPhoto } = req.body
    if (!invId || !invPassword || !examId)
      return res.status(400).json({ error: 'invId, invPassword and examId are required.' })

    const exam = await global.prisma.exam.findUnique({ where: { id: examId } })
    if (!exam)
      return res.status(404).json({ error: 'Exam not found.' })

    if (exam.invId !== invId)
      return res.status(401).json({ error: 'Invalid invigilator credentials.' })

    const valid = await bcrypt.compare(invPassword, exam.invPasswordHash)
    if (!valid)
      return res.status(401).json({ error: 'Invalid invigilator credentials.' })

    // H-5: Handle optional ID card photo — upload if provided, null otherwise. Never persist placeholder strings.
    let idCardPhotoUrl = null
    if (idCardPhoto) {
      try {
        const { uploadBase64 } = require('../services/cloudinary.service')
        idCardPhotoUrl = await uploadBase64(idCardPhoto, 'invigilator-ids')
      } catch (uploadErr) {
        console.warn('[invigilatorLogin] ID card upload skipped:', uploadErr.message)
        // Upload failure is non-fatal; proceed with null rather than a placeholder
        idCardPhotoUrl = null
      }
    }

    const sessionExpiry = new Date(exam.endTime.getTime() + 30 * 60 * 1000)

    const session = await global.prisma.invigilatorSession.create({
      data: {
        exam: { connect: { id: examId } },
        invId,
        idCardPhotoUrl: idCardPhotoUrl || '',
        idCardOcrResult: null,
        sessionExpiry,
        ipAddress: getClientIp(req),
        isActive: true,
      },
    })

    const secondsUntilExpiry = Math.floor((sessionExpiry - Date.now()) / 1000)
    const token = signToken(
      { id: session.id, role: 'invigilator', examId },
      `${secondsUntilExpiry}s`
    )
    setAuthCookie(res, token, secondsUntilExpiry * 1000)

    logAudit({ userId: session.id, userRole: 'invigilator', action: 'INVIGILATOR_LOGIN',
      details: `examId=${examId} invId=${invId}`, ipAddress: getClientIp(req) })

    res.json({
      authenticated: true,
      session: {
        id: session.id, examId, invId,
        sessionExpiry, exam: { title: exam.title, subject: exam.subject },
      },
      user: {
        id: session.invId,
        name: `Invigilator ${session.invId}`,
        role: 'invigilator',
        examId,
        exam: { title: exam.title, subject: exam.subject },
        sessionId: session.id,
        sessionExpiry,
      },
    })
  } catch (e) {
    handleAuthError(res, e, 'invigilatorLogin')
  }
}

/**
 * POST /api/auth/logout
 * Revokes the authentication cookie and logs the audit event.
 */
async function logout(req, res) {
  try {
    clearAuthCookie(res)
    if (req.user?.id) {
      logAudit({
        userId: req.user.id,
        userRole: req.user.role || 'user',
        action: 'USER_LOGOUT',
        ipAddress: getClientIp(req),
      })
    }
    return res.json({ success: true, message: 'Logged out successfully.' })
  } catch (e) {
    console.error('[logout]', e)
    clearAuthCookie(res)
    return res.json({ success: true, message: 'Logged out.' })
  }
}

module.exports = {
  adminLogin,
  facultyRegister,
  facultyLogin,
  studentRegister,
  studentLogin,
  changePassword,
  invigilatorLogin,
  getMe,
  logout,
}
