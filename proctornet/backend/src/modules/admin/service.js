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
const { logger } = require('../../shared/logging')

function normalizeDepartmentCode(dept) {
  if (!dept) return 'CSE'
  const d = String(dept).trim().toUpperCase()
  if (['CSE', 'CS'].includes(d) || d.includes('COMPUTER')) return 'CSE'
  if (['ISE', 'IS', 'IT'].includes(d) || d.includes('INFORMATION')) return 'ISE'
  if (['ECE', 'EC', 'EE', 'EEE'].includes(d) || d.includes('ELECTRONIC')) return 'ECE'
  if (['MECH', 'ME'].includes(d) || d.includes('MECHANICAL')) return 'MECH'
  if (['CIVIL', 'CV'].includes(d) || d.includes('CIVIL')) return 'CIVIL'
  if (['AI_DS', 'AIDS', 'AIML', 'AI/DS', 'AI-DS'].includes(d) || d.includes('ARTIFICIAL') || d.includes('DATA SCIENCE')) return 'AI_DS'
  return d
}

function generateTempPassword() {
  return crypto.randomBytes(6).toString('base64url') + '@A1'
}

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
    const email = String(data.email || '').toLowerCase().trim()
    const employeeId = String(data.employeeId || '').trim()

    const existing = await adminRepository.findFacultyByEmployeeIdOrEmail(employeeId, email)
    if (existing) {
      if (existing.employeeId === employeeId) {
        throw new ConflictError('A faculty member with this Employee ID already exists.')
      }
      throw new ConflictError('A faculty member with this email already exists.')
    }

    const isGenerated = !data.password
    const tempPassword = isGenerated ? generateTempPassword() : String(data.password)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)
    const deptCode = normalizeDepartmentCode(data.departmentCode || data.department)
    const faculty = await adminRepository.createFaculty({
      id: data.id || crypto.randomUUID(),
      name: data.name,
      email,
      password: hashedPassword,
      departmentCode: deptCode,
      employeeId,
      phone: data.phone || null,
      mustChangePassword: isGenerated || Boolean(data.mustChangePassword),
      isApproved: true
    })
    const dto = toFacultyAdminDTO(faculty)
    if (isGenerated) {
      dto.tempPassword = tempPassword
    }
    return dto
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
    const usn = String(data.usn || '').toUpperCase().trim()
    const email = String(data.email || '').toLowerCase().trim()

    const existing = await adminRepository.findStudentByUsnOrEmail(usn, email)
    if (existing) {
      if (existing.usn === usn) {
        throw new ConflictError('A candidate with this USN already exists.')
      }
      throw new ConflictError('A candidate with this email address already exists.')
    }

    const isGenerated = !data.password
    const tempPassword = isGenerated ? generateTempPassword() : String(data.password)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)
    const deptCode = normalizeDepartmentCode(data.departmentCode || data.department)
    const student = await adminRepository.createStudent({
      id: data.id || crypto.randomUUID(),
      name: data.name,
      usn,
      email,
      password: hashedPassword,
      departmentCode: deptCode,
      semester: parseInt(data.semester || 1, 10),
      phone: data.phone || null,
      mustChangePassword: isGenerated || Boolean(data.mustChangePassword),
      approvalStatus: data.approvalStatus || 'APPROVED',
      profileStatus: data.profileStatus || 'PENDING'
    })
    student.tempPassword = isGenerated ? tempPassword : undefined
    return toStudentAdminDTO(student)
  }

  async approveStudent(id, approverId) {
    const s = await adminRepository.findStudentById(id)
    if (!s) throw new NotFoundError('Student not found')
    const facePhotoKey = s.facePhotoKey || `identity/${id}/enrolled-face.webp`
    const updated = await adminRepository.updateStudent(id, {
      approvalStatus: 'APPROVED',
      profileStatus: 'VERIFIED',
      facePhotoKey,
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

    const { prisma } = require('../../infra/postgres/client')
    const { generateUnambiguousPassword } = require('../exams/service')

    // Invalidate old active sessions
    await prisma.invigilatorSession.updateMany({
      where: { examId: id, isActive: true },
      data: { isActive: false }
    })

    const newInvId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const plainPassword = generateUnambiguousPassword(12)
    const invPasswordHash = await bcrypt.hash(plainPassword, 10)
    const validUntil = new Date(new Date(exam.endTime).getTime() + 24 * 60 * 60 * 1000).toISOString()

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
      success: true,
      examId: updated.id,
      invId: newInvId,
      invPassword: plainPassword,
      oneTimePassword: plainPassword,
      validUntil
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
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Expected settings object or key/value pair')
    }
    const { policyService } = require('../agent/policyService')
    const { prisma } = require('../../infra/postgres/client')

    const syncAgentRules = async (key, val) => {
      if (key === 'vmDetectionEnabled') {
        try {
          await prisma.agentRule.updateMany({
            where: { category: 'VIRTUAL_MACHINE' },
            data: { enabled: Boolean(val) }
          })
          await policyService.getLatestSignedPolicy(true)
        } catch (err) {
          logger.warn({ err: err.message }, 'Failed to synchronize agent VM detection rules')
        }
      }
    }

    if (body.settings && typeof body.settings === 'object') {
      const results = []
      for (const [key, value] of Object.entries(body.settings)) {
        const updated = await adminRepository.upsertSetting(key, value, userId)
        await syncAgentRules(key, value)
        results.push(toPlatformSettingDTO(updated))
      }
      return results
    }

    if (body.key !== undefined) {
      const updated = await adminRepository.upsertSetting(body.key, body.value, userId)
      await syncAgentRules(body.key, body.value)
      return toPlatformSettingDTO(updated)
    }

    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      const results = []
      for (const [key, value] of Object.entries(body)) {
        const updated = await adminRepository.upsertSetting(key, value, userId)
        await syncAgentRules(key, value)
        results.push(toPlatformSettingDTO(updated))
      }
      return results
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
    const MAX_FILE_BYTES = 5 * 1024 * 1024
    if (!buffer || buffer.length > MAX_FILE_BYTES) {
      throw new ValidationError('Upload exceeds maximum allowed size of 5 MB')
    }
    const workbook = new ExcelJS.Workbook()
    const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B // PK..
    if (isZip) {
      await workbook.xlsx.load(buffer)
    } else {
      const { Readable } = require('stream')
      const stream = Readable.from(buffer.toString('utf-8'))
      await workbook.csv.read(stream)
    }

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new ValidationError('File contains no worksheets or data')
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
            let val = cell.text ?? cell.value
            if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
              val = cell.value.result
            }
            if (typeof val === 'string') {
              val = val.trim()
            }
            rowData[header] = val
          }
        })
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData)
        }
      }
    })
    return rows
  }

  async confirmBulkCreate(type, accounts = []) {
    const normType = String(type || '').trim().toLowerCase()
    const isStudent = normType === 'students' || normType === ROLES.STUDENT.toLowerCase() || normType === ROLES.STUDENT
    const isFaculty = normType === 'faculties' || normType === ROLES.FACULTY.toLowerCase() || normType === ROLES.FACULTY
    const created = []
    const failed = []

    if (isStudent) {
      for (const raw of accounts) {
        try {
          const acc = {
            name: raw.name || raw['Full Name'] || raw.fullName || 'Student',
            usn: raw.usn || raw.USN || raw.identifier,
            email: raw.email || raw.Email,
            departmentCode: raw.departmentCode || raw.department || raw.Department,
            semester: raw.semester || raw.Semester || 1,
            phone: raw.phone || raw.Phone || null,
            password: raw.password || raw.Password || undefined
          }
          if (!acc.usn || !acc.email) {
            throw new Error('Missing required USN or Email in record')
          }
          const res = await this.createStudent(acc)
          created.push(res)
        } catch (err) {
          failed.push({ usn: raw.usn || raw.USN || raw.email || 'unknown', error: err.message })
        }
      }
    } else if (isFaculty) {
      for (const raw of accounts) {
        try {
          const acc = {
            name: raw.name || raw['Full Name'] || raw.fullName || 'Faculty Member',
            email: raw.email || raw.Email,
            employeeId: raw.employeeId || raw.EmployeeId || raw['Employee ID'] || raw.identifier,
            departmentCode: raw.departmentCode || raw.department || raw.Department,
            phone: raw.phone || raw.Phone || null,
            password: raw.password || raw.Password || undefined
          }
          if (!acc.employeeId || !acc.email) {
            throw new Error('Missing required Employee ID or Email in record')
          }
          const res = await this.createFaculty(acc)
          created.push(res)
        } catch (err) {
          failed.push({ email: raw.email || raw.Email || 'unknown', error: err.message })
        }
      }
    }

    const credentialsList = created.map(c => ({
      name: c.name,
      identifier: c.usn || c.employeeId,
      email: c.email,
      department: c.departmentCode || c.department?.code || 'CSE',
      tempPassword: c.tempPassword || 'Pre-set credentials'
    }))

    return {
      success: true,
      total: accounts.length,
      createdCount: created.length,
      failedCount: failed.length,
      created,
      failed,
      credentials: credentialsList,
      createdCredentials: credentialsList
    }
  }

  // ── Biometric Enrollment Override ──
  async overrideEnrollment(studentId, status, reason, approverId) {
    const student = await adminRepository.findStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    const prevStatus = student.profileStatus
    const facePhotoKey = student.facePhotoKey || (status === 'VERIFIED' ? `identity/${studentId}/enrolled-face.webp` : null)
    const updated = await adminRepository.updateStudent(studentId, {
      profileStatus: status,
      approvalStatus: status === 'VERIFIED' ? 'APPROVED' : (status === 'REJECTED' ? 'REJECTED' : student.approvalStatus),
      ...(facePhotoKey ? { facePhotoKey } : {}),
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

  // ── Departments ──
  async listDepartments() {
    return adminRepository.listDepartments()
  }

  async createDepartment(data) {
    return adminRepository.createDepartment(data)
  }
}

module.exports = new AdminService()
