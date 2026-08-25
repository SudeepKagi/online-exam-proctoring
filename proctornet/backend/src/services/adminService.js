/**
 * Admin Service
 * Encapsulates administrative queries, faculty approvals, student management,
 * exam oversight, platform stats, audit logs, violations, and system configuration.
 */
const { paginate } = require('../utils/helpers')

async function listFacultyAccounts(query) {
  const { status, department, search, page = 1, limit = 20 } = query
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
        idCardPhotoUrl: true, profilePhotoUrl: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    global.prisma.faculty.count({ where }),
  ])

  return { faculty, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function listPendingFacultyAccounts() {
  const faculty = await global.prisma.faculty.findMany({
    where: { isApproved: false, isSuspended: false },
    select: {
      id: true, name: true, email: true, department: true, employeeId: true,
      isApproved: true, isSuspended: true, createdAt: true,
      idCardPhotoUrl: true, profilePhotoUrl: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return faculty
}

async function approveFacultyAccount({ id, approvedBy }) {
  const faculty = await global.prisma.faculty.findUnique({ where: { id } })
  if (!faculty) {
    const error = new Error('Faculty not found.')
    error.status = 404
    throw error
  }
  if (faculty.isApproved) {
    const error = new Error('Faculty is already approved.')
    error.status = 409
    throw error
  }

  const updated = await global.prisma.faculty.update({
    where: { id },
    data: { isApproved: true, approvedBy, approvedAt: new Date() },
  })

  return { faculty: updated, original: faculty }
}

async function rejectFacultyAccount(id) {
  const faculty = await global.prisma.faculty.findUnique({ where: { id } })
  if (!faculty) {
    const error = new Error('Faculty not found.')
    error.status = 404
    throw error
  }

  await global.prisma.faculty.delete({ where: { id } })
  return faculty
}

async function setFacultySuspension({ id, isSuspended }) {
  const updated = await global.prisma.faculty.update({
    where: { id },
    data: { isSuspended: Boolean(isSuspended) },
  })
  return updated
}

async function listStudentAccounts(query) {
  const { status, department, semester, search, page = 1, limit = 20 } = query
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
        faceMatchScore: true, facePhotoUrl: true, idCardPhotoUrl: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    global.prisma.student.count({ where }),
  ])

  return { students, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function listPendingStudentAccounts() {
  const students = await global.prisma.student.findMany({
    where: { approvalStatus: 'PENDING_FACULTY' },
    select: {
      id: true, name: true, email: true, usn: true, department: true,
      semester: true, facePhotoUrl: true, idCardPhotoUrl: true,
      faceMatchScore: true, approvalStatus: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return students
}

async function approveStudentAccount({ id, approvedBy }) {
  const student = await global.prisma.student.findUnique({ where: { id } })
  if (!student) {
    const error = new Error('Student not found.')
    error.status = 404
    throw error
  }

  const updated = await global.prisma.student.update({
    where: { id },
    data: { approvalStatus: 'APPROVED', approvedBy, approvedAt: new Date() },
  })

  return { student: updated, original: student }
}

async function rejectStudentAccount(id) {
  const student = await global.prisma.student.findUnique({ where: { id } })
  if (!student) {
    const error = new Error('Student not found.')
    error.status = 404
    throw error
  }
  const updated = await global.prisma.student.update({
    where: { id },
    data: { approvalStatus: 'REJECTED' },
  })
  return { student: updated, original: student }
}

async function setStudentSuspension({ id, isSuspended }) {
  const updated = await global.prisma.student.update({
    where: { id },
    data: { isSuspended: Boolean(isSuspended) }
  })
  return updated
}

async function listExamsOversight(query) {
  const { status, search, page = 1, limit = 20 } = query
  const { skip, take } = paginate(page, limit)

  const where = {}
  if (status) where.status = status.toUpperCase()
  if (search) {
    where.OR = [
      { title:   { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [exams, total] = await Promise.all([
    global.prisma.exam.findMany({
      where, skip, take,
      include: {
        faculty: { select: { id: true, name: true, department: true } },
        _count:  { select: { studentExams: true, questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    global.prisma.exam.count({ where }),
  ])

  return { exams, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function getExamOversightDetails(id) {
  const exam = await global.prisma.exam.findUnique({
    where: { id },
    include: {
      faculty:      { select: { id: true, name: true, email: true, department: true } },
      questions:    { orderBy: { order: 'asc' } },
      studentExams: {
        include: {
          student: { select: { id: true, name: true, usn: true, department: true } },
          examResult: true,
          evidenceLogs: { select: { severity: true } }
        },
      },
    },
  })
  if (!exam) {
    const error = new Error('Exam not found.')
    error.status = 404
    throw error
  }
  return exam
}

async function updateExamStatus({ id, status }) {
  const updated = await global.prisma.exam.update({
    where: { id },
    data: { status }
  })
  return updated
}

async function listInvigilatorSessionRecords(query) {
  const { examId, page = 1, limit = 20 } = query
  const { skip, take } = paginate(page, limit)

  const where = {}
  if (examId) where.examId = examId

  const [sessions, total] = await Promise.all([
    global.prisma.invigilatorSession.findMany({
      where, skip, take,
      include: {
        exam: { select: { id: true, title: true, subject: true } }
      },
      orderBy: { sessionStart: 'desc' }
    }),
    global.prisma.invigilatorSession.count({ where })
  ])

  return { sessions, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function revokeInvigilatorSessionRecord(id) {
  const session = await global.prisma.invigilatorSession.update({
    where: { id },
    data: { isActive: false, sessionExpiry: new Date() }
  })
  return session
}

async function getAdminDashboardStats() {
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
    global.prisma.evidenceLog.count({ where: { severity: { in: ['HIGH', 'CRITICAL'] } } }).catch(() => 0),
  ])

  const recentViolationsRaw = await global.prisma.evidenceLog.findMany({
    take: 5,
    orderBy: { timestamp: 'desc' },
    include: {
      studentExam: {
        include: { student: true, exam: true }
      }
    }
  }).catch(() => [])

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

  return {
    faculty:  { total: totalFaculty,   pending: pendingFaculty },
    students: { total: totalStudents,  pending: pendingStudents },
    exams:    { total: totalExams,     active: activeExams },
    flags:    { highSeverity: totalFlags },
    recentViolations
  }
}

async function getSettingsMap() {
  const settings = await global.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } })
  const map = {}
  settings.forEach(s => { map[s.key] = s.value })
  return map
}

async function updateSettingsMap({ updates, updatedBy }) {
  const promises = Object.entries(updates).map(([key, value]) =>
    global.prisma.platformSetting.upsert({
      where:  { key },
      update: { value: String(value), updatedBy },
      create: { key, value: String(value), updatedBy },
    })
  )
  await Promise.all(promises)
  return { success: true }
}

async function getAuditLogRecords(query) {
  const { userRole, action, page = 1, limit = 50 } = query
  const { skip, take } = paginate(page, limit)
  const where = {}
  if (userRole) where.userRole = userRole
  if (action)   where.action   = { contains: action, mode: 'insensitive' }

  const [logs, total] = await Promise.all([
    global.prisma.auditLog.findMany({ where, skip, take, orderBy: { timestamp: 'desc' } }),
    global.prisma.auditLog.count({ where }),
  ])

  return { logs, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function getViolationsSummaryRecords(query) {
  const { page = 1, limit = 50 } = query
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

  return { violations, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function getViolationsListRecords(query) {
  const { page = 1, limit = 50 } = query
  const { skip, take } = paginate(page, limit)
  const logs = await global.prisma.evidenceLog.findMany({
    skip, take,
    orderBy: { timestamp: 'desc' },
    include: { studentExam: { include: { student: true, exam: true } } }
  })
  return logs.map(v => ({
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
}

async function getReportsData(period = '7d') {
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [totalExams, totalStudents, totalViolations, avgResult] = await Promise.all([
    global.prisma.exam.count(),
    global.prisma.student.count(),
    global.prisma.evidenceLog.count({ where: { timestamp: { gte: since } } }).catch(() => 0),
    global.prisma.examResult.aggregate({ _avg: { percentage: true } }),
  ])

  const recentExams = await global.prisma.exam.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  })
  const recentStudentExams = await global.prisma.studentExam.findMany({
    where: { startedAt: { gte: since } },
    select: { startedAt: true },
  })

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

  const violsByType = await global.prisma.evidenceLog.groupBy({
    by: ['eventType'],
    where: { timestamp: { gte: since } },
    _count: { eventType: true },
    orderBy: { _count: { eventType: 'desc' } },
    take: 5,
  }).catch(() => [])

  const violationBreakdown = violsByType.map(v => ({
    name: (v.eventType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: v._count.eventType,
  }))

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

  return {
    summary: {
      totalExams,
      totalStudents,
      violationsThisWeek: totalViolations,
      avgScore: Math.round(avgResult._avg.percentage || 0),
    },
    examActivity,
    violationBreakdown,
    scoreDistribution,
  }
}

async function createAnnouncementRecord({ title, content, audience, targetDepartment, priority, postedBy }) {
  const ann = await global.prisma.announcement.create({
    data: {
      title,
      message: content,
      target: audience || 'ALL',
      targetDepartment: targetDepartment || null,
      priority: priority || 'NORMAL',
      postedBy,
    },
  })
  return { ...ann, content: ann.message, audience: ann.target }
}

async function listAnnouncementRecords() {
  const raw = await global.prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' }, take: 50,
  })
  return raw.map(a => ({
    ...a,
    content: a.message,
    audience: a.target,
  }))
}

async function deleteAnnouncementRecord(id) {
  await global.prisma.announcement.delete({ where: { id } })
  return { success: true }
}

module.exports = {
  listFacultyAccounts,
  listPendingFacultyAccounts,
  approveFacultyAccount,
  rejectFacultyAccount,
  setFacultySuspension,
  listStudentAccounts,
  listPendingStudentAccounts,
  approveStudentAccount,
  rejectStudentAccount,
  setStudentSuspension,
  listExamsOversight,
  getExamOversightDetails,
  updateExamStatus,
  listInvigilatorSessionRecords,
  revokeInvigilatorSessionRecord,
  getAdminDashboardStats,
  getSettingsMap,
  updateSettingsMap,
  getAuditLogRecords,
  getViolationsSummaryRecords,
  getViolationsListRecords,
  getReportsData,
  createAnnouncementRecord,
  listAnnouncementRecords,
  deleteAnnouncementRecord
}
