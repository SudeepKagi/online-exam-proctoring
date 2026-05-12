const bcrypt  = require('bcryptjs')
const { logAudit }   = require('../utils/auditLogger')
const { getClientIp, paginate } = require('../utils/helpers')
const {
  sendFacultyApprovedEmail,
  sendFacultyRejectedEmail,
  sendStudentApprovedEmail,
} = require('../services/email.service')

// ════════════════════════════════════════════════════
// FACULTY MANAGEMENT (Step 10)
// ════════════════════════════════════════════════════

/**
 * GET /api/admin/faculty
 * List all faculty with optional filters
 */
async function listFaculty(req, res) {
  try {
    const { status, department, search, page = 1, limit = 20 } = req.query
    const { skip, take } = paginate(page, limit)

    const where = {}
    if (status === 'pending')  { where.isApproved = false; where.isSuspended = false }
    if (status === 'approved') { where.isApproved = true }
    if (status === 'suspended'){ where.isSuspended = true }
    if (department) where.department = department
    if (search) {
      where.OR = [
        { name:       { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [faculty, total] = await Promise.all([
      global.prisma.faculty.findMany({
        where, skip, take,
        select: {
          id: true, name: true, email: true, department: true, employeeId: true,
          isApproved: true, isSuspended: true, approvedAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      global.prisma.faculty.count({ where }),
    ])

    res.json({ faculty, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    console.error('[listFaculty]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/faculty/:id/approve
 */
async function approveFaculty(req, res) {
  try {
    const { id } = req.params
    const faculty = await global.prisma.faculty.findUnique({ where: { id } })
    if (!faculty) return res.status(404).json({ error: 'Faculty not found.' })
    if (faculty.isApproved) return res.status(409).json({ error: 'Faculty is already approved.' })

    const updated = await global.prisma.faculty.update({
      where: { id },
      data: { isApproved: true, approvedBy: req.user.id, approvedAt: new Date() },
    })

    logAudit({ userId: req.user.id, userRole: 'admin', action: 'FACULTY_APPROVED',
      details: `${faculty.name} (${faculty.employeeId})`, ipAddress: getClientIp(req), facultyId: id })

    sendFacultyApprovedEmail(faculty).catch(() => {})

    res.json({ message: `Faculty "${faculty.name}" approved.`, faculty: updated })
  } catch (e) {
    console.error('[approveFaculty]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/faculty/:id/reject
 */
async function rejectFaculty(req, res) {
  try {
    const { id } = req.params
    const faculty = await global.prisma.faculty.findUnique({ where: { id } })
    if (!faculty) return res.status(404).json({ error: 'Faculty not found.' })

    await global.prisma.faculty.delete({ where: { id } })

    logAudit({ userId: req.user.id, userRole: 'admin', action: 'FACULTY_REJECTED',
      details: `${faculty.name} (${faculty.employeeId})`, ipAddress: getClientIp(req) })

    sendFacultyRejectedEmail(faculty).catch(() => {})

    res.json({ message: `Faculty "${faculty.name}" registration rejected and removed.` })
  } catch (e) {
    console.error('[rejectFaculty]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/faculty/:id/suspend
 */
async function suspendFaculty(req, res) {
  try {
    const { id } = req.params
    const updated = await global.prisma.faculty.update({
      where: { id },
      data: { isSuspended: true },
    })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'FACULTY_SUSPENDED',
      details: id, ipAddress: getClientIp(req) })
    res.json({ message: 'Faculty suspended.', faculty: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/faculty/:id/unsuspend
 */
async function unsuspendFaculty(req, res) {
  try {
    const { id } = req.params
    const updated = await global.prisma.faculty.update({
      where: { id },
      data: { isSuspended: false },
    })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'FACULTY_UNSUSPENDED',
      details: id, ipAddress: getClientIp(req) })
    res.json({ message: 'Faculty unsuspended.', faculty: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// STUDENT MANAGEMENT
// ════════════════════════════════════════════════════

/**
 * GET /api/admin/students
 */
async function listStudents(req, res) {
  try {
    const { status, department, semester, search, page = 1, limit = 20 } = req.query
    const { skip, take } = paginate(page, limit)

    const where = {}
    if (status)     where.approvalStatus = status.toUpperCase()
    if (department) where.department     = department
    if (semester)   where.semester       = parseInt(semester)
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { usn:   { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [students, total] = await Promise.all([
      global.prisma.student.findMany({
        where, skip, take,
        select: {
          id: true, name: true, usn: true, email: true, department: true,
          semester: true, approvalStatus: true, isSuspended: true,
          faceMatchScore: true, facePhotoUrl: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      global.prisma.student.count({ where }),
    ])

    res.json({ students, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    console.error('[listStudents]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/students/:id/approve
 */
async function approveStudent(req, res) {
  try {
    const { id } = req.params
    const student = await global.prisma.student.findUnique({ where: { id } })
    if (!student) return res.status(404).json({ error: 'Student not found.' })

    const updated = await global.prisma.student.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date() },
    })

    logAudit({ userId: req.user.id, userRole: 'admin', action: 'STUDENT_APPROVED',
      details: `${student.name} (${student.usn})`, ipAddress: getClientIp(req), studentId: id })

    sendStudentApprovedEmail(student).catch(() => {})
    res.json({ message: `Student "${student.name}" approved.`, student: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/students/:id/suspend
 */
async function suspendStudent(req, res) {
  try {
    const { id } = req.params
    await global.prisma.student.update({ where: { id }, data: { isSuspended: true } })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'STUDENT_SUSPENDED', details: id, ipAddress: getClientIp(req) })
    res.json({ message: 'Student suspended.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/students/:id/unsuspend
 */
async function unsuspendStudent(req, res) {
  try {
    const { id } = req.params
    await global.prisma.student.update({ where: { id }, data: { isSuspended: false } })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'STUDENT_UNSUSPENDED', details: id, ipAddress: getClientIp(req) })
    res.json({ message: 'Student unsuspended.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// EXAM OVERSIGHT
// ════════════════════════════════════════════════════

async function listExams(req, res) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query
    const { skip, take } = paginate(page, limit)

    const where = {}
    if (status) where.status = status.toUpperCase()
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [exams, total] = await Promise.all([
      global.prisma.exam.findMany({
        where, skip, take,
        include: { faculty: { select: { name: true, department: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      global.prisma.exam.count({ where }),
    ])

    res.json({ exams, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function getExam(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.findUnique({
      where: { id },
      include: {
        faculty: { select: { name: true, department: true } },
        students: { include: { student: { select: { name: true, usn: true } } } },
      }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })
    res.json({ exam })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function pauseExam(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.update({
      where: { id },
      data: { status: 'PAUSED' }
    })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'EXAM_PAUSED', details: `Exam ID: ${id}`, ipAddress: getClientIp(req) })
    
    // Broadcast via socket would go here

    res.json({ message: 'Exam paused globally.', exam })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function resumeExam(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.update({
      where: { id },
      data: { status: 'ACTIVE' }
    })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'EXAM_RESUMED', details: `Exam ID: ${id}`, ipAddress: getClientIp(req) })
    
    // Broadcast via socket would go here

    res.json({ message: 'Exam resumed.', exam })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// INVIGILATOR SESSIONS
// ════════════════════════════════════════════════════

async function listInvigilatorSessions(req, res) {
  try {
    const { isActive, examId, page = 1, limit = 20 } = req.query
    const { skip, take } = paginate(page, limit)

    const where = {}
    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (examId) where.examId = examId

    const [sessions, total] = await Promise.all([
      global.prisma.invigilatorSession.findMany({
        where, skip, take,
        include: { exam: { select: { title: true, subject: true } } },
        orderBy: { loginTime: 'desc' }   // InvigilatorSession has loginTime not createdAt
      }),
      global.prisma.invigilatorSession.count({ where })
    ])

    res.json({ sessions, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    console.error('[listInvigilatorSessions]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function revokeInvigilatorSession(req, res) {
  try {
    const { id } = req.params
    const session = await global.prisma.invigilatorSession.update({
      where: { id },
      data: { isActive: false, sessionExpiry: new Date() }
    })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'INVIGILATOR_REVOKED', details: `Session ID: ${id}`, ipAddress: getClientIp(req) })
    
    res.json({ message: 'Invigilator session revoked.', session })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// DASHBOARD STATS
// ════════════════════════════════════════════════════

/**
 * GET /api/admin/dashboard
 */
async function getDashboardStats(req, res) {
  try {
    const [
      totalFaculty, pendingFaculty,
      totalStudents, pendingStudents,
      totalExams, activeExams,
      totalFlags,
    ] = await Promise.all([
      global.prisma.faculty.count({ where: { isApproved: true } }),
      global.prisma.faculty.count({ where: { isApproved: false } }),
      global.prisma.student.count({ where: { approvalStatus: 'APPROVED' } }),
      global.prisma.student.count({ where: { approvalStatus: { not: 'APPROVED' } } }),
      global.prisma.exam.count(),
      global.prisma.exam.count({ where: { status: 'ACTIVE' } }),
      global.prisma.evidenceLog.count({ where: { severity: { in: ['HIGH', 'CRITICAL'] } } }),
    ])

    const recentViolationsRaw = await global.prisma.evidenceLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: {
        studentExam: {
          include: { student: true, exam: true }
        }
      }
    });

    const recentViolations = recentViolationsRaw
      .filter(v => v.studentExam && v.studentExam.student && v.studentExam.exam)
      .map(v => ({
        id: v.id,
        student: v.studentExam.student.name,
        exam: v.studentExam.exam.title,
        type: v.eventType,
        severity: v.severity,
        time: v.timestamp
      }))

    res.json({
      faculty:  { total: totalFaculty,   pending: pendingFaculty },
      students: { total: totalStudents,  pending: pendingStudents },
      exams:    { total: totalExams,     active: activeExams },
      flags:    { highSeverity: totalFlags },
      recentViolations
    })
  } catch (e) {
    console.error('[getDashboardStats]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// PLATFORM SETTINGS
// ════════════════════════════════════════════════════

/**
 * GET /api/admin/settings
 */
async function getSettings(req, res) {
  try {
    const settings = await global.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } })
    // Convert array to object map
    const map = {}
    settings.forEach(s => { map[s.key] = s.value })
    res.json({ settings: map })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/admin/settings
 */
async function updateSettings(req, res) {
  try {
    const updates = req.body // { key: value, ... }
    const promises = Object.entries(updates).map(([key, value]) =>
      global.prisma.platformSetting.upsert({
        where:  { key },
        update: { value: String(value), updatedBy: req.user.id },
        create: { key, value: String(value), updatedBy: req.user.id },
      })
    )
    await Promise.all(promises)
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'SETTINGS_UPDATED',
      details: JSON.stringify(updates), ipAddress: getClientIp(req) })
    res.json({ message: 'Settings updated.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════

/**
 * GET /api/admin/audit-logs
 */
async function getAuditLogs(req, res) {
  try {
    const { userRole, action, page = 1, limit = 50 } = req.query
    const { skip, take } = paginate(page, limit)
    const where = {}
    if (userRole) where.userRole = userRole
    if (action)   where.action   = { contains: action, mode: 'insensitive' }

    const [logs, total] = await Promise.all([
      global.prisma.auditLog.findMany({ where, skip, take, orderBy: { timestamp: 'desc' } }),
      global.prisma.auditLog.count({ where }),
    ])

    res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// VIOLATIONS
// ════════════════════════════════════════════════════

/**
 * GET /api/admin/violations/summary
 */
async function getViolationsSummary(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query
    const { skip, take } = paginate(page, limit)

    const [logs, total] = await Promise.all([
      global.prisma.evidenceLog.findMany({
        skip, take,
        orderBy: { timestamp: 'desc' },
        include: {
          studentExam: {
            include: { student: true, exam: true }
          }
        }
      }),
      global.prisma.evidenceLog.count(),
    ])

    const violations = logs
      .filter(v => v.studentExam && v.studentExam.student && v.studentExam.exam)
      .map(v => ({
        id: v.id,
        student: `${v.studentExam.student.name} (${v.studentExam.student.usn})`,
        exam: v.studentExam.exam.title,
        type: v.eventType,
        severity: v.severity,
        status: v.invAction ? 'Reviewed' : 'Pending',
        time: v.timestamp
      }))

    res.json({ violations, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    console.error('[getViolationsSummary]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// PENDING LISTS
// ════════════════════════════════════════════════════

async function listPendingFaculty(req, res) {
  try {
    const faculty = await global.prisma.faculty.findMany({
      where: { isApproved: false, isSuspended: false },
      select: {
        id: true, name: true, email: true, department: true, employeeId: true,
        isApproved: true, isSuspended: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ faculty })
  } catch (e) {
    console.error('[listPendingFaculty]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function listPendingStudents(req, res) {
  try {
    const students = await global.prisma.student.findMany({
      where: { approvalStatus: 'PENDING_FACULTY' },
      select: {
        id: true, name: true, email: true, usn: true, department: true,
        semester: true, facePhotoUrl: true, idCardPhotoUrl: true,
        faceMatchScore: true, approvalStatus: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ students })
  } catch (e) {
    console.error('[listPendingStudents]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function rejectStudent(req, res) {
  try {
    const { id } = req.params
    const student = await global.prisma.student.findUnique({ where: { id } })
    if (!student) return res.status(404).json({ error: 'Student not found.' })
    const updated = await global.prisma.student.update({
      where: { id },
      data: { approvalStatus: 'REJECTED' },
    })
    logAudit({ userId: req.user.id, userRole: 'admin', action: 'STUDENT_REJECTED',
      details: `${student.name} (${student.usn})`, ipAddress: getClientIp(req) })
    res.json({ message: 'Student rejected.', student: updated })
  } catch (e) {
    console.error('[rejectStudent]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// VIOLATIONS (detailed list)
// ════════════════════════════════════════════════════

async function getViolations(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query
    const { skip, take } = paginate(page, limit)
    const logs = await global.prisma.evidenceLog.findMany({
      skip, take,
      orderBy: { timestamp: 'desc' },
      include: { studentExam: { include: { student: true, exam: true } } }
    })
    const violations = logs.map(v => ({
      id: v.id,
      studentName: v.studentExam?.student?.name,
      studentUsn: v.studentExam?.student?.usn,
      examTitle: v.studentExam?.exam?.title,
      eventType: v.eventType,
      severity: v.severity,
      timestamp: v.timestamp,
      cameraFrameUrl: v.cameraFrameUrl,
      details: v.details,
    }))
    res.json({ violations })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════

async function getReports(req, res) {
  try {
    const period = req.query.period || '7d'
    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [totalExams, totalStudents, totalViolations, avgResult] = await Promise.all([
      global.prisma.exam.count(),
      global.prisma.student.count(),
      global.prisma.evidenceLog.count({ where: { timestamp: { gte: since } } }),
      global.prisma.examResult.aggregate({ _avg: { percentage: true } }),
    ])

    // Daily exam activity
    const recentExams = await global.prisma.exam.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    })
    const recentStudentExams = await global.prisma.studentExam.findMany({
      where: { startedAt: { gte: since } },
      select: { startedAt: true },
    })

    // Build day buckets
    const dayLabels = []
    const dayMap = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, month: days > 7 ? 'short' : undefined, day: days > 7 ? 'numeric' : undefined })
      dayLabels.push(key)
      dayMap[key] = { day: key, exams: 0, students: 0 }
    }
    recentExams.forEach(e => {
      const key = new Date(e.createdAt).toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, month: days > 7 ? 'short' : undefined, day: days > 7 ? 'numeric' : undefined })
      if (dayMap[key]) dayMap[key].exams++
    })
    recentStudentExams.forEach(se => {
      const key = new Date(se.startedAt).toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, month: days > 7 ? 'short' : undefined, day: days > 7 ? 'numeric' : undefined })
      if (dayMap[key]) dayMap[key].students++
    })
    const examActivity = dayLabels.map(k => dayMap[k])

    // Violation type breakdown
    const violsByType = await global.prisma.evidenceLog.groupBy({
      by: ['eventType'],
      where: { timestamp: { gte: since } },
      _count: { eventType: true },
      orderBy: { _count: { eventType: 'desc' } },
      take: 5,
    })
    const violationBreakdown = violsByType.map(v => ({
      name: v.eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: v._count.eventType,
    }))

    // Score distribution
    const results = await global.prisma.examResult.findMany({ select: { percentage: true } })
    const ranges = [
      { range: '0-40', min: 0, max: 40 }, { range: '41-50', min: 41, max: 50 },
      { range: '51-60', min: 51, max: 60 }, { range: '61-70', min: 61, max: 70 },
      { range: '71-80', min: 71, max: 80 }, { range: '81-90', min: 81, max: 90 },
      { range: '91-100', min: 91, max: 100 },
    ]
    const scoreDistribution = ranges.map(r => ({
      range: r.range,
      students: results.filter(res => (res.percentage || 0) >= r.min && (res.percentage || 0) <= r.max).length,
    }))

    res.json({
      summary: {
        totalExams,
        totalStudents,
        violationsThisWeek: totalViolations,
        avgScore: Math.round(avgResult._avg.percentage || 0),
      },
      examActivity,
      violationBreakdown,
      scoreDistribution,
    })
  } catch (e) {
    console.error('[getReports]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}


// ════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ════════════════════════════════════════════════════

/**
 * POST /api/admin/announcements
 */
async function createAnnouncement(req, res) {
  try {
    // Accept both naming conventions from frontend
    const title = req.body.title
    const content = req.body.content || req.body.message
    const audience = req.body.audience || req.body.target || 'ALL'
    const priority = req.body.priority || 'NORMAL'
    const targetDepartment = req.body.targetDepartment || null

    if (!title || !content)
      return res.status(400).json({ error: 'title and content are required.' })

    const ann = await global.prisma.announcement.create({
      data: {
        title,
        message: content,
        target: audience,
        targetDepartment,
        priority,
        postedBy: req.user.id,
      },
    })
    // Return both field names for frontend compatibility
    res.status(201).json({
      message: 'Announcement created.',
      announcement: { ...ann, content: ann.message, audience: ann.target },
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/admin/announcements
 */
async function listAnnouncements(req, res) {
  try {
    const raw = await global.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }, take: 50,
    })
    // Map to frontend field names
    const announcements = raw.map(a => ({
      ...a,
      content: a.message,
      audience: a.target,
    }))
    res.json({ announcements })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * DELETE /api/admin/announcements/:id
 */
async function deleteAnnouncement(req, res) {
  try {
    const { id } = req.params
    await global.prisma.announcement.delete({ where: { id } })
    res.json({ message: 'Announcement deleted.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

module.exports = {
  listFaculty, listPendingFaculty,
  approveFaculty, rejectFaculty, suspendFaculty, unsuspendFaculty,
  listStudents, listPendingStudents,
  approveStudent, rejectStudent, suspendStudent, unsuspendStudent,
  listExams, getExam, pauseExam, resumeExam,
  listInvigilatorSessions, revokeInvigilatorSession,
  getDashboardStats,
  getSettings, updateSettings,
  getAuditLogs, getViolationsSummary, getViolations,
  createAnnouncement, listAnnouncements, deleteAnnouncement,
  getReports,
}
