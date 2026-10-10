const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')
const { paginate } = require('../../utils/helpers')

class AdminRepository {
  async getDashboardStats() {
    const [
      totalStudents,
      pendingStudents,
      totalFaculty,
      pendingFaculty,
      totalExams,
      activeExams,
      totalAttempts,
      flaggedAttempts
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.faculty.count(),
      prisma.faculty.count({ where: { isApproved: false } }),
      prisma.exam.count(),
      prisma.exam.count({ where: { status: 'LIVE' } }),
      prisma.examAttempt.count(),
      prisma.examAttempt.count({ where: { flagCount: { gt: 0 } } })
    ])

    return {
      students: { total: totalStudents, pending: pendingStudents },
      faculty: { total: totalFaculty, pending: pendingFaculty },
      exams: { total: totalExams, active: activeExams },
      attempts: { total: totalAttempts, flagged: flaggedAttempts }
    }
  }

  // ── Faculty ──
  async listFaculty({ status, department, search, page = 1, limit = 20 }) {
    const { skip, take } = paginate(page, limit)
    const where = {}
    if (status === 'pending') { where.isApproved = false; where.isSuspended = false }
    if (status === 'approved') { where.isApproved = true }
    if (status === 'suspended') { where.isSuspended = true }
    if (department) where.departmentCode = department
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [faculty, total] = await Promise.all([
      prisma.faculty.findMany({
        where, skip, take,
        include: { department: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.faculty.count({ where })
    ])

    return { faculty, total, page: parseInt(page, 10), totalPages: Math.ceil(total / take) }
  }

  async listPendingFaculty() {
    return prisma.faculty.findMany({
      where: { isApproved: false, isSuspended: false },
      include: { department: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createFaculty(data) {
    const { department, ...facultyData } = data
    return prisma.faculty.create({
      data: {
        id: facultyData.id || crypto.randomUUID(),
        ...facultyData
      },
      include: { department: true }
    })
  }

  async findFacultyByEmployeeIdOrEmail(employeeId, email) {
    const conditions = []
    if (employeeId) conditions.push({ employeeId: String(employeeId).trim() })
    if (email) conditions.push({ email: String(email).toLowerCase().trim() })
    if (conditions.length === 0) return null
    return prisma.faculty.findFirst({
      where: { OR: conditions }
    })
  }

  async findFacultyById(id) {
    return prisma.faculty.findUnique({
      where: { id },
      include: { department: true }
    })
  }

  async updateFaculty(id, data) {
    return prisma.faculty.update({
      where: { id },
      data,
      include: { department: true }
    })
  }

  async deleteFaculty(id) {
    return prisma.faculty.delete({
      where: { id }
    })
  }

  // ── Students ──
  async listStudents({ status, department, semester, search, page = 1, limit = 20 }) {
    const { skip, take } = paginate(page, limit)
    const where = {}
    if (status) where.approvalStatus = status.toUpperCase()
    if (department) where.departmentCode = department
    if (semester) where.semester = parseInt(semester, 10)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { usn: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where, skip, take,
        include: { department: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.student.count({ where })
    ])

    return { students, total, page: parseInt(page, 10), totalPages: Math.ceil(total / take) }
  }

  async listPendingStudents() {
    return prisma.student.findMany({
      where: {
        OR: [
          { profileStatus: 'SUBMITTED' },
          { approvalStatus: 'PENDING' }
        ]
      },
      include: { department: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createStudent(data) {
    const { department, ...studentData } = data
    return prisma.student.create({
      data: {
        id: studentData.id || crypto.randomUUID(),
        ...studentData
      },
      include: { department: true }
    })
  }

  async findStudentByUsnOrEmail(usn, email) {
    const conditions = []
    if (usn) conditions.push({ usn: String(usn).toUpperCase().trim() })
    if (email) conditions.push({ email: String(email).toLowerCase().trim() })
    if (conditions.length === 0) return null
    return prisma.student.findFirst({
      where: { OR: conditions }
    })
  }

  async findStudentById(id) {
    return prisma.student.findUnique({
      where: { id },
      include: { department: true }
    })
  }

  async updateStudent(id, data) {
    return prisma.student.update({
      where: { id },
      data,
      include: { department: true }
    })
  }

  // ── Exam Oversight ──
  async listExams({ status, search, page = 1, limit = 20 }) {
    const { skip, take } = paginate(page, limit)
    const where = {}
    if (status) where.status = status.toUpperCase()
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where, skip, take,
        include: {
          faculty: { select: { id: true, name: true, departmentCode: true } },
          _count: { select: { attempts: true, questions: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.exam.count({ where })
    ])

    return { exams, total, page: parseInt(page, 10), totalPages: Math.ceil(total / take) }
  }

  async getExamById(id) {
    return prisma.exam.findUnique({
      where: { id },
      include: {
        faculty: { select: { id: true, name: true, email: true, departmentCode: true } },
        questions: { orderBy: { createdAt: 'asc' } },
        attempts: {
          include: {
            student: { select: { id: true, name: true, usn: true, departmentCode: true } },
            examResult: true
          }
        }
      }
    })
  }

  async updateExam(id, data) {
    return prisma.exam.update({
      where: { id },
      data
    })
  }

  // ── Invigilator Sessions ──
  async listInvigilatorSessions() {
    return prisma.invigilatorSession.findMany({
      include: {
        exam: { select: { id: true, title: true, subject: true } }
      },
      orderBy: { loginTime: 'desc' },
      take: 50
    })
  }

  async revokeInvigilatorSession(id) {
    return prisma.invigilatorSession.update({
      where: { id },
      data: { isActive: false }
    })
  }

  // ── Settings ──
  async getAllSettings() {
    return prisma.platformSetting.findMany({
      orderBy: { key: 'asc' }
    })
  }

  async upsertSetting(key, value, updatedBy) {
    return prisma.platformSetting.upsert({
      where: { key },
      update: { value: String(value), updatedBy },
      create: {
        id: crypto.randomUUID(),
        key,
        value: String(value),
        updatedBy
      }
    })
  }

  // ── Audit Logs ──
  async listAuditLogs({ page = 1, limit = 50, actorId, action }) {
    const { skip, take } = paginate(page, limit)
    const where = {}
    if (actorId) where.actorId = actorId
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take,
        orderBy: { timestamp: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      logs: logs.map(l => ({ ...l, id: l.id != null ? l.id.toString() : l.id })),
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take)
    }
  }

  // ── Violations ──
  async listViolations({ limit = 50 }) {
    return prisma.violationEvent.findMany({
      take: limit,
      orderBy: { serverTimestamp: 'desc' },
      include: {
        attempt: {
          include: {
            student: { select: { id: true, name: true, usn: true } },
            exam: { select: { id: true, title: true } }
          }
        }
      }
    })
  }

  async getViolationsSummary() {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT event_type, severity, count(*)::int as count
      FROM violation_events
      GROUP BY event_type, severity
      ORDER BY count DESC;
    `)
    return rows
  }

  // ── Announcements ──
  async listAnnouncements() {
    return prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    })
  }

  async createAnnouncement(data) {
    return prisma.announcement.create({
      data: {
        id: crypto.randomUUID(),
        ...data
      }
    })
  }

  async deleteAnnouncement(id) {
    return prisma.announcement.delete({
      where: { id }
    })
  }

  // ── Biometric Overrides ──
  async recordBiometricOverride({ studentId, approverId, reason, prevStatus, newStatus }) {
    return prisma.biometricOverrideLog.create({
      data: {
        studentId,
        approverId,
        reason,
        prevStatus,
        newStatus
      }
    })
  }

  // ── Departments ──
  async listDepartments() {
    return prisma.department.findMany({
      orderBy: { code: 'asc' }
    })
  }

  async createDepartment({ code, name }) {
    return prisma.department.upsert({
      where: { code: String(code).trim().toUpperCase() },
      update: { name: String(name).trim() },
      create: { code: String(code).trim().toUpperCase(), name: String(name).trim() }
    })
  }
}

module.exports = new AdminRepository()
