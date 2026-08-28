const adminService = require('../services/adminService')
const { logAudit } = require('../utils/auditLogger')
const { getClientIp } = require('../utils/helpers')
const {
  sendFacultyApprovedEmail,
  sendFacultyRejectedEmail,
  sendStudentApprovedEmail,
} = require('../services/email.service')

async function createFaculty(req, res) {
  try {
    const faculty = await adminService.createFacultyAccount(req.body)

    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'FACULTY_CREATED_BY_ADMIN',
      details: `${faculty.name} (${faculty.employeeId})`,
      ipAddress: getClientIp(req),
      facultyId: faculty.id
    })

    res.status(201).json({ message: 'Faculty account created successfully.', faculty })
  } catch (e) {
    console.error('[createFaculty]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to create faculty account.' })
  }
}

async function createStudent(req, res) {
  try {
    const student = await adminService.createStudentAccount(req.body)

    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'STUDENT_CREATED_BY_ADMIN',
      details: `${student.name} (${student.usn})`,
      ipAddress: getClientIp(req),
      studentId: student.id
    })

    res.status(201).json({ message: 'Student account created successfully.', student })
  } catch (e) {
    console.error('[createStudent]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to create student account.' })
  }
}

// ─── Faculty Management ───

async function listFaculty(req, res) {
  try {
    const result = await adminService.listFacultyAccounts(req.query)
    res.json(result)
  } catch (e) {
    console.error('[listFaculty]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function listPendingFaculty(req, res) {
  try {
    const faculty = await adminService.listPendingFacultyAccounts()
    res.json({ faculty })
  } catch (e) {
    console.error('[listPendingFaculty]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function approveFaculty(req, res) {
  try {
    const { id } = req.params
    const result = await adminService.approveFacultyAccount({
      id,
      approvedBy: req.user.id
    })

    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'FACULTY_APPROVED',
      details: `${result.original.name} (${result.original.employeeId})`,
      ipAddress: getClientIp(req),
      facultyId: id
    })

    sendFacultyApprovedEmail(result.original).catch(() => {})
    res.json({ message: `Faculty "${result.original.name}" approved.`, faculty: result.faculty })
  } catch (e) {
    console.error('[approveFaculty]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function rejectFaculty(req, res) {
  try {
    const { id } = req.params
    const faculty = await adminService.rejectFacultyAccount(id)

    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'FACULTY_REJECTED',
      details: `${faculty.name} (${faculty.employeeId})`,
      ipAddress: getClientIp(req)
    })

    sendFacultyRejectedEmail(faculty).catch(() => {})
    res.json({ message: `Faculty "${faculty.name}" registration rejected and removed.` })
  } catch (e) {
    console.error('[rejectFaculty]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function suspendFaculty(req, res) {
  try {
    const { id } = req.params
    const updated = await adminService.setFacultySuspension({ id, isSuspended: true })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'FACULTY_SUSPENDED',
      details: id,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Faculty suspended.', faculty: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function unsuspendFaculty(req, res) {
  try {
    const { id } = req.params
    const updated = await adminService.setFacultySuspension({ id, isSuspended: false })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'FACULTY_UNSUSPENDED',
      details: id,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Faculty unsuspended.', faculty: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ─── Student Management ───

async function listStudents(req, res) {
  try {
    const result = await adminService.listStudentAccounts(req.query)
    res.json(result)
  } catch (e) {
    console.error('[listStudents]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function listPendingStudents(req, res) {
  try {
    const students = await adminService.listPendingStudentAccounts()
    res.json({
      students,
      pending: students,
      total: students.length
    })
  } catch (e) {
    console.error('[listPendingStudents]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function approveStudent(req, res) {
  try {
    const { id } = req.params
    const result = await adminService.approveStudentAccount({
      id,
      approvedBy: req.user.id
    })

    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'STUDENT_APPROVED',
      details: `${result.original.name} (${result.original.usn})`,
      ipAddress: getClientIp(req),
      studentId: id
    })

    sendStudentApprovedEmail(result.original).catch(() => {})
    res.json({ message: `Student "${result.original.name}" approved.`, student: result.student })
  } catch (e) {
    console.error('[approveStudent]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function rejectStudent(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    const result = await adminService.rejectStudentAccount(id, reason)
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'STUDENT_REJECTED',
      details: `${result.original?.name} (${result.original?.usn}) - Reason: ${reason || 'None'}`,
      ipAddress: getClientIp(req),
      studentId: id,
    })
    res.json({ message: 'Student rejected.', student: result.student })
  } catch (e) {
    console.error('[rejectStudent]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function suspendStudent(req, res) {
  try {
    const { id } = req.params
    await adminService.setStudentSuspension({ id, isSuspended: true })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'STUDENT_SUSPENDED',
      details: id,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Student suspended.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function unsuspendStudent(req, res) {
  try {
    const { id } = req.params
    await adminService.setStudentSuspension({ id, isSuspended: false })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'STUDENT_UNSUSPENDED',
      details: id,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Student unsuspended.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ─── Exam Oversight ───

async function listExams(req, res) {
  try {
    const result = await adminService.listExamsOversight(req.query)
    res.json(result)
  } catch (e) {
    console.error('[admin listExams]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function getExam(req, res) {
  try {
    const exam = await adminService.getExamOversightDetails(req.params.id)
    res.json({ exam })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function pauseExam(req, res) {
  try {
    const { id } = req.params
    const updated = await adminService.updateExamStatus({ id, status: 'PAUSED' })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'EXAM_PAUSED',
      details: id,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Exam paused.', exam: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function resumeExam(req, res) {
  try {
    const { id } = req.params
    const updated = await adminService.updateExamStatus({ id, status: 'ACTIVE' })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'EXAM_RESUMED',
      details: id,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Exam resumed.', exam: updated })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function getExamInvigilatorCredentials(req, res) {
  try {
    const { id } = req.params
    const credentials = await adminService.getExamInvigilatorCredentialsRecord(id)
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'INVIGILATOR_CREDENTIALS_VIEWED',
      details: `Viewed invigilator key for exam "${credentials.title}" (${credentials.invId})`,
      ipAddress: getClientIp(req)
    })
    res.json(credentials)
  } catch (e) {
    console.error('[getExamInvigilatorCredentials]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function resetExamInvigilatorCredentials(req, res) {
  try {
    const { id } = req.params
    const credentials = await adminService.resetExamInvigilatorCredentialsRecord(id)
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'INVIGILATOR_CREDENTIALS_RESET',
      details: `Reset invigilator key for exam "${credentials.title}" (${credentials.invId})`,
      ipAddress: getClientIp(req)
    })
    res.json(credentials)
  } catch (e) {
    console.error('[resetExamInvigilatorCredentials]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

// ─── Invigilator Sessions ───

async function listInvigilatorSessions(req, res) {
  try {
    const result = await adminService.listInvigilatorSessionRecords(req.query)
    res.json(result)
  } catch (e) {
    console.error('[listInvigilatorSessions]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function revokeInvigilatorSession(req, res) {
  try {
    const { id } = req.params
    const session = await adminService.revokeInvigilatorSessionRecord(id)
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'INVIGILATOR_REVOKED',
      details: `Session ID: ${id}`,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Invigilator session revoked.', session })
  } catch (e) {
    console.error('[revokeInvigilatorSession]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ─── Dashboard Stats ───

async function getDashboardStats(req, res) {
  try {
    const stats = await adminService.getAdminDashboardStats()
    res.json(stats)
  } catch (e) {
    console.error('[getDashboardStats]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ─── Platform Settings ───

async function getSettings(req, res) {
  try {
    const settings = await adminService.getSettingsMap()
    res.json({ settings })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function updateSettings(req, res) {
  try {
    const updates = req.body.settings || req.body
    await adminService.updateSettingsMap({
      updates,
      updatedBy: req.user.id
    })
    logAudit({
      userId: req.user.id,
      userRole: 'admin',
      action: 'SETTINGS_UPDATED',
      details: JSON.stringify(updates),
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Settings updated.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

// ─── Audit Logs & Violations ───

async function getAuditLogs(req, res) {
  try {
    const result = await adminService.getAuditLogRecords(req.query)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function getViolationsSummary(req, res) {
  try {
    const result = await adminService.getViolationsSummaryRecords(req.query)
    res.json(result)
  } catch (e) {
    console.error('[getViolationsSummary]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function getViolations(req, res) {
  try {
    const violations = await adminService.getViolationsListRecords(req.query)
    res.json({ violations })
  } catch (e) {
    console.error('[getViolations]', e)
    res.status(500).json({ error: e.message || 'Server error.' })
  }
}

// ─── Reports ───

async function getReports(req, res) {
  try {
    const result = await adminService.getReportsData(req.query.period || '7d')
    res.json(result)
  } catch (e) {
    console.error('[getReports]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

// ─── Announcements ───

async function createAnnouncement(req, res) {
  try {
    const title = req.body.title
    const content = req.body.content || req.body.message
    const audience = req.body.audience || req.body.target || 'ALL'
    const priority = req.body.priority || 'NORMAL'
    const targetDepartment = req.body.targetDepartment || null

    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required.' })
    }

    const announcement = await adminService.createAnnouncementRecord({
      title,
      content,
      audience,
      targetDepartment,
      priority,
      postedBy: req.user.id,
    })

    res.status(201).json({
      message: 'Announcement created.',
      announcement,
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function listAnnouncements(req, res) {
  try {
    const announcements = await adminService.listAnnouncementRecords()
    res.json({ announcements })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

async function deleteAnnouncement(req, res) {
  try {
    await adminService.deleteAnnouncementRecord(req.params.id)
    res.json({ message: 'Announcement deleted.' })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

module.exports = {
  listFaculty,
  listPendingFaculty,
  approveFaculty,
  rejectFaculty,
  suspendFaculty,
  unsuspendFaculty,
  listStudents,
  listPendingStudents,
  approveStudent,
  rejectStudent,
  suspendStudent,
  unsuspendStudent,
  listExams,
  getExam,
  getExamInvigilatorCredentials,
  resetExamInvigilatorCredentials,
  pauseExam,
  resumeExam,
  listInvigilatorSessions,
  revokeInvigilatorSession,
  getDashboardStats,
  getSettings,
  updateSettings,
  getAuditLogs,
  getViolationsSummary,
  getViolations,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
  getReports,
  createFaculty,
  createStudent,
}
