const bcrypt = require('bcrypt')
const crypto = require('crypto')
const ExcelJS = require('exceljs')
const adminRepository = require('./repository')
const { logAudit } = require('../../utils/auditLogger')
const {
  toFacultyAdminDTO,
  toStudentAdminDTO,
  toPlatformSettingDTO,
  toAnnouncementDTO
} = require('./dto')
const {
  NotFoundError,
  ConflictError,
  ValidationError
} = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')

class AdminService {
  async getDashboard() {
    return adminRepository.getDashboardStats()
  }

  // ── Faculty ──
  async listFaculty(query) {
    const res = await adminRepository.listFaculty(query)
    return {
      ...res,
      faculty: res.faculty.map(toFacultyAdminDTO)
    }
  }

  async listPendingFaculty() {
    const list = await adminRepository.listPendingFaculty()
    return list.map(toFacultyAdminDTO)
  }

  async createFaculty(data) {
    const hashedPassword = await bcrypt.hash(data.password || 'Faculty@123', 10)
    const faculty = await adminRepository.createFaculty({
      name: data.name,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      departmentCode: data.departmentCode || 'CSE',
      employeeId: data.employeeId,
      phone: data.phone || null,
      isApproved: true
    })
    return toFacultyAdminDTO(faculty)
  }

  async approveFaculty(id, approverId) {
    const f = await adminRepository.findFacultyById(id)
    if (!f) throw new NotFoundError('Faculty not found')
    if (f.isApproved) throw new ConflictError('Faculty is already approved')

    const updated = await adminRepository.updateFaculty(id, {
      isApproved: true,
      approvedBy: approverId,
      approvedAt: new Date()
    })
    return toFacultyAdminDTO(updated)
  }

  async rejectFaculty(id) {
    const f = await adminRepository.findFacultyById(id)
    if (!f) throw new NotFoundError('Faculty not found')
    await adminRepository.deleteFaculty(id)
    return { success: true, message: 'Faculty application rejected and account removed' }
  }

  async setFacultySuspension(id, isSuspended) {
    const f = await adminRepository.findFacultyById(id)
    if (!f) throw new NotFoundError('Faculty not found')
    const updated = await adminRepository.updateFaculty(id, { isSuspended: Boolean(isSuspended) })
    return toFacultyAdminDTO(updated)
  }

  // ── Students ──
  async listStudents(query) {
    const res = await adminRepository.listStudents(query)
    return {
      ...res,
      students: res.students.map(toStudentAdminDTO)
    }
  }

  async listPendingStudents() {
    const list = await adminRepository.listPendingStudents()
    return list.map(toStudentAdminDTO)
  }

  async createStudent(data) {
    const hashedPassword = await bcrypt.hash(data.password || 'Student@123', 10)
    const student = await adminRepository.createStudent({
      name: data.name,
      usn: data.usn.toUpperCase().trim(),
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      departmentCode: data.departmentCode || 'CSE',
      semester: parseInt(data.semester || 1, 10),
      phone: data.phone || null,
      approvalStatus: 'APPROVED',
      profileStatus: 'PENDING'
    })
    return toStudentAdminDTO(student)
  }

  async approveStudent(id, approverId) {
    const s = await adminRepository.findStudentById(id)
    if (!s) throw new NotFoundError('Student not found')
    const updated = await adminRepository.updateStudent(id, {
      approvalStatus: 'APPROVED',
      profileStatus: 'VERIFIED',
      approvedBy: approverId,
      approvedAt: new Date()
    })
    return toStudentAdminDTO(updated)
  }

  async rejectStudent(id, reason) {
    const s = await adminRepository.findStudentById(id)
    if (!s) throw new NotFoundError('Student not found')
    const updated = await adminRepository.updateStudent(id, {
      approvalStatus: 'REJECTED',
      profileStatus: 'REJECTED',
      rejectionReason: reason || 'Rejected by administration'
    })
    return toStudentAdminDTO(updated)
  }

  async setStudentSuspension(id, isSuspended) {
    const s = await adminRepository.findStudentById(id)
    if (!s) throw new NotFoundError('Student not found')
    const updated = await adminRepository.updateStudent(id, { isSuspended: Boolean(isSuspended) })
    return toStudentAdminDTO(updated)
  }

  // ── Exam Oversight ──
  async listExams(query) {
    return adminRepository.listExams(query)
  }

  async getExam(id) {
    const exam = await adminRepository.getExamById(id)
    if (!exam) throw new NotFoundError('Exam not found')
    return exam
  }

  async resetExamInvigilatorCredentials(id, user = null) {
    const exam = await adminRepository.getExamById(id)
    if (!exam) throw new NotFoundError('Exam not found')

    const newInvId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const plainPassword = crypto.randomBytes(6).toString('hex')
    const invPasswordHash = await bcrypt.hash(plainPassword, 10)

    const updated = await adminRepository.updateExam(id, {
      invId: newInvId,
      invPasswordHash
    })

    await logAudit({
      userId: user?.id || null,
      userRole: user?.role || 'admin',
      action: 'EXAM_INVIGILATOR_CREDENTIALS_REGENERATED',
      details: `Regenerated invigilator credentials for exam ${id} (invId: ${newInvId})`
    })

    return {
      examId: updated.id,
      invId: newInvId,
      invPassword: plainPassword
    }
  }

  async setExamPaused(id, isPaused, user, reason) {
    const exam = await adminRepository.getExamById(id)
    if (!exam) throw new NotFoundError('Exam not found')

    const updated = await adminRepository.updateExam(id, {
      isPaused: Boolean(isPaused),
      pausedBy: user?.id || null,
      pauseReason: reason || (isPaused ? 'Paused by Administrator' : null)
    })

    return updated
  }

  // ── Invigilator Sessions ──
  async listInvigilatorSessions() {
    return adminRepository.listInvigilatorSessions()
  }

  async revokeInvigilatorSession(id) {
    return adminRepository.revokeInvigilatorSession(id)
  }

  // ── Settings ──
  async getSettings() {
    const settings = await adminRepository.getAllSettings()
    return settings.map(toPlatformSettingDTO)
  }

  async updateSettings(body, userId) {
    if (body.settings && typeof body.settings === 'object') {
      const results = []
      for (const [key, value] of Object.entries(body.settings)) {
        const updated = await adminRepository.upsertSetting(key, value, userId)
        results.push(toPlatformSettingDTO(updated))
      }
      return results
    }

    if (body.key) {
      const updated = await adminRepository.upsertSetting(body.key, body.value, userId)
      return toPlatformSettingDTO(updated)
    }

    throw new ValidationError('Expected settings object or key/value pair')
  }

  // ── Audit Logs & Violations ──
  async getAuditLogs(query) {
    return adminRepository.listAuditLogs(query)
  }

  async getViolations(limit = 50) {
    return adminRepository.listViolations({ limit })
  }

  async getViolationsSummary() {
    return adminRepository.getViolationsSummary()
  }

  // ── Announcements ──
  async listAnnouncements() {
    const announcements = await adminRepository.listAnnouncements()
    return announcements.map(toAnnouncementDTO)
  }

  async createAnnouncement(data, userId) {
    const announcement = await adminRepository.createAnnouncement({
      title: data.title,
      message: data.message,
      postedBy: userId,
      target: data.target || 'ALL',
      targetDepartment: data.targetDepartment || null,
      priority: data.priority || 'NORMAL'
    })
    return toAnnouncementDTO(announcement)
  }

  async deleteAnnouncement(id) {
    return adminRepository.deleteAnnouncement(id)
  }

  // ── Bulk Upload ──
  async parseBulkBuffer(buffer, _fileType = 'excel') {
    const MAX_EXCEL_BYTES = 5 * 1024 * 1024
    if (!buffer || buffer.length > MAX_EXCEL_BYTES) {
      throw new ValidationError('Excel file exceeds maximum allowed size of 5 MB')
    }
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new ValidationError('Excel file contains no worksheets')
    }
    const rows = []
    const headers = []
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').trim()
        })
      } else {
        const rowData = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber]
          if (header) {
            rowData[header] = cell.text ?? cell.value
          }
        })
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData)
        }
      }
    })
    return rows
  }

  async confirmBulkCreate(type, accounts) {
    const created = []
    const failed = []

    if (type === 'students') {
      for (const acc of accounts) {
        try {
          const res = await this.createStudent(acc)
          created.push(res)
        } catch (err) {
          failed.push({ usn: acc.usn || acc.USN, error: err.message })
        }
      }
    } else if (type === ROLES.FACULTY) {
      for (const acc of accounts) {
        try {
          const res = await this.createFaculty(acc)
          created.push(res)
        } catch (err) {
          failed.push({ email: acc.email || acc.Email, error: err.message })
        }
      }
    }

    return {
      success: true,
      total: accounts.length,
      createdCount: created.length,
      failedCount: failed.length,
      created,
      failed
    }
  }

  // ── Biometric Enrollment Override ──
  async overrideEnrollment(studentId, status, reason, approverId) {
    const student = await adminRepository.findStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    const prevStatus = student.profileStatus
    const updated = await adminRepository.updateStudent(studentId, {
      profileStatus: status,
      approvalStatus: status === 'VERIFIED' ? 'APPROVED' : (status === 'REJECTED' ? 'REJECTED' : student.approvalStatus),
      rejectionReason: status === 'REJECTED' ? reason : null
    })

    await adminRepository.recordBiometricOverride({
      studentId,
      approverId,
      reason,
      prevStatus,
      newStatus: status
    })

    return toStudentAdminDTO(updated)
  }
}

module.exports = new AdminService()
