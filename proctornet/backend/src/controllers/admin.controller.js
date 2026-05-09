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

    res.json({
      faculty:  { total: totalFaculty,   pending: pendingFaculty },
      students: { total: totalStudents,  pending: pendingStudents },
      exams:    { total: totalExams,     active: activeExams },
      flags:    { highSeverity: totalFlags },
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
// ANNOUNCEMENTS
// ════════════════════════════════════════════════════

/**
 * POST /api/admin/announcements
 */
async function createAnnouncement(req, res) {
  try {
    const { title, message, target, targetDepartment, priority } = req.body
    if (!title || !message || !target)
      return res.status(400).json({ error: 'title, message, and target are required.' })

    const ann = await global.prisma.announcement.create({
      data: { title, message, target, targetDepartment: targetDepartment || null,
        priority: priority || 'NORMAL', postedBy: req.user.id },
    })
    res.status(201).json({ message: 'Announcement created.', announcement: ann })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/admin/announcements
 */
async function listAnnouncements(req, res) {
  try {
    const announcements = await global.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }, take: 50,
    })
    res.json({ announcements })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

module.exports = {
  listFaculty, approveFaculty, rejectFaculty, suspendFaculty, unsuspendFaculty,
  listStudents, approveStudent, suspendStudent,
  getDashboardStats,
  getSettings, updateSettings,
  getAuditLogs,
  createAnnouncement, listAnnouncements,
}
