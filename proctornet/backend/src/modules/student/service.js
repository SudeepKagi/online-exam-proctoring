const studentRepository = require('./repository')
const { attemptService } = require('../attempts/service')
const { toStudentProfileDTO, toStudentExamDTO, toStudentResultDTO } = require('./dto')
const {
  NotFoundError,
  ForbiddenError,
  ValidationError
} = require('../../shared/errors')
const crypto = require('crypto')

class StudentService {
  async getProfile(studentId) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student profile not found')
    return toStudentProfileDTO(student)
  }

  async updateProfile(studentId, data) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student profile not found')

    const allowed = {}
    if (data.name) allowed.name = data.name
    if (data.phone !== undefined) allowed.phone = data.phone

    const updated = await studentRepository.updateStudent(studentId, allowed)
    return toStudentProfileDTO(updated)
  }

  async listMyExams(studentId) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student profile not found')

    const exams = await studentRepository.listAvailableExamsForStudent(student)
    return exams.map(e => toStudentExamDTO(e, e.attempts?.[0] || null))
  }

  async getExamDetails(examId, studentId) {
    const exam = await studentRepository.getExamById(examId)
    if (!exam) throw new NotFoundError('Exam not found')

    const attempt = await studentRepository.getAttemptByStudentAndExam(studentId, examId)
    return toStudentExamDTO(exam, attempt)
  }

  async getExamLobby(examId, studentId) {
    const exam = await studentRepository.getExamById(examId)
    if (!exam) throw new NotFoundError('Exam not found')

    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    const attempt = await studentRepository.getAttemptByStudentAndExam(studentId, examId)

    return {
      exam: toStudentExamDTO(exam, attempt),
      student: toStudentProfileDTO(student),
      isEligible: (exam.allowedDepartments || []).includes(student.departmentCode) &&
                  (exam.allowedSemesters || []).includes(student.semester),
      attempt: attempt ? {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt
      } : null
    }
  }

  async startExam(examId, studentId) {
    return attemptService.startOrResumeAttempt(examId, studentId)
  }


  async getMyResults(studentId) {
    const results = await studentRepository.listResultsForStudent(studentId)
    return results.map(toStudentResultDTO)
  }

  async verifyFace(studentId, { liveFrame }) {
    if (!liveFrame) {
      throw new ValidationError('liveFrame is required for face verification')
    }
    await studentRepository.recordVerificationAuditLog({
      studentId,
      checkType: 'FACE_LIVENESS',
      score: 0.0,
      status: 'PENDING_ANALYSIS',
      details: 'Automated liveness evaluation pending real model pipeline'
    })
    return { success: true, verified: false, matchScore: 0.0, pending: true }
  }

  async verifyIdCard(studentId, { idCardPhoto }) {
    if (!idCardPhoto) {
      throw new ValidationError('idCardPhoto is required for ID card verification')
    }
    await studentRepository.recordVerificationAuditLog({
      studentId,
      checkType: 'ID_CARD_OCR',
      score: 0.0,
      status: 'PENDING_ANALYSIS',
      details: 'ID Card OCR evaluation pending real OCR pipeline'
    })
    return { success: true, verified: false, matchScore: 0.0, pending: true }
  }

  async saveIdentityVerification(examId, studentId, data) {
    const attempt = await studentRepository.getAttemptByStudentAndExam(studentId, examId)
    if (!attempt) throw new NotFoundError('No attempt found for this exam')

    if (!data.faceWithIdPhoto) {
      throw new ValidationError('faceWithIdPhoto is required for identity verification')
    }

    const result = await studentRepository.saveIdentityVerification({
      attemptId: attempt.id,
      liveFaceMatchScore: data.liveFaceMatchScore ?? 0.0,
      idCardOcrUsn: data.idCardOcrUsn || null,
      idCardMatchResult: Boolean(data.idCardMatchResult),
      faceWithIdKey: data.faceWithIdPhoto,
      status: data.liveFaceMatchScore >= 0.8 && data.idCardMatchResult ? 'VERIFIED' : 'PENDING'
    })

    return { success: true, verification: result }
  }

  async createSupportTicket(studentId, { subject, message, priority, examId }) {
    return {
      success: true,
      ticket: {
        id: crypto.randomUUID(),
        studentId,
        examId: examId || null,
        subject,
        message,
        priority: priority || 'MEDIUM',
        status: 'OPEN',
        createdAt: new Date().toISOString()
      }
    }
  }

  async listSupportTickets(studentId) {
    return []
  }

  async submitConsent(studentId) {
    const updated = await studentRepository.updateStudent(studentId, {
      consentTimestamp: new Date(),
      profileStatus: 'CONSENT_GIVEN'
    })
    return toStudentProfileDTO(updated)
  }

  async enrollFace(studentId, photoKey) {
    const updated = await studentRepository.updateStudent(studentId, {
      facePhotoKey: photoKey,
      profileStatus: 'SUBMITTED'
    })
    return toStudentProfileDTO(updated)
  }

  async enrollIdDocument(studentId, idKey) {
    const updated = await studentRepository.updateStudent(studentId, {
      idCardPhotoKey: idKey,
      idDocumentKey: idKey,
      profileStatus: 'SUBMITTED'
    })
    return toStudentProfileDTO(updated)
  }

  async getEnrollmentStatus(studentId) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')
    return {
      studentId: student.id,
      name: student.name,
      usn: student.usn,
      profileStatus: student.profileStatus,
      approvalStatus: student.approvalStatus,
      hasConsent: Boolean(student.consentTimestamp),
      hasFace: Boolean(student.facePhotoKey),
      hasId: Boolean(student.idCardPhotoKey || student.idDocumentKey)
    }
  }

  async getChatHistory(examId, studentId, limit = 50) {
    return studentRepository.listChatMessages(examId, studentId, limit)
  }
}

module.exports = new StudentService()
