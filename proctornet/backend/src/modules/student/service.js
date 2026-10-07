const studentRepository = require('./repository')
const { attemptService } = require('../attempts/service')
const { faceVerificationService } = require('../media/faceVerificationService')
const { toStudentProfileDTO, toStudentExamDTO, toStudentResultDTO } = require('./dto')
const {
  NotFoundError,
  ForbiddenError,
  ValidationError
} = require('../../shared/errors')
const { putObject } = require('../../infra/s3/s3.client')
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

  async verifyFace(studentId, data = {}) {
    const liveInput = data.liveFrame || data.image || data.liveFrameKey || data.frameKey
    if (!liveInput) {
      throw new ValidationError('liveFrame or image is required for face verification')
    }

    let attempt = null
    if (data.examId) {
      attempt = await studentRepository.getAttemptByStudentAndExam(studentId, data.examId)
    } else if (data.attemptId) {
      attempt = await studentRepository.getAttemptById(data.attemptId)
    }

    let liveFrameKey = data.liveFrameKey || data.frameKey
    if (!liveFrameKey && typeof liveInput === 'string') {
      if (liveInput.startsWith('attempts/') || liveInput.startsWith('evidence/') || liveInput.startsWith('students/')) {
        liveFrameKey = liveInput
      } else {
        const base64Data = liveInput.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const attId = attempt ? attempt.id : 'pre_check'
        liveFrameKey = `attempts/${attId}/pre_exam_live_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`
        await putObject(liveFrameKey, buffer, 'image/webp')
      }
    }

    if (attempt && liveFrameKey) {
      const verificationResult = await faceVerificationService.verifyPreExam({
        attemptId: attempt.id,
        studentId,
        liveFrameKey,
        challengeId: data.challengeId || null,
        burstKeys: data.burstKeys || null
      })

      return {
        success: true,
        verified: verificationResult.verified,
        pendingReview: verificationResult.pendingReview,
        decision: verificationResult.decision,
        message: verificationResult.message
      }
    }

    return {
      success: true,
      verified: false,
      pendingReview: true,
      decision: 'REVIEW',
      message: 'Waiting for exam session initialization.'
    }
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

    const liveFrameKey = data.faceWithIdPhoto || data.liveFrameKey || data.frameKey
    if (!liveFrameKey) {
      throw new ValidationError('faceWithIdPhoto or liveFrameKey is required for identity verification')
    }

    const verificationResult = await faceVerificationService.verifyPreExam({
      attemptId: attempt.id,
      studentId,
      liveFrameKey,
      challengeId: data.challengeId || null,
      burstKeys: data.burstKeys || null
    })

    return {
      success: true,
      verified: verificationResult.verified,
      pendingReview: verificationResult.pendingReview,
      decision: verificationResult.decision,
      message: verificationResult.message
    }
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
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    // Run server-side enrollment quality gates (1 face, >= 20% height, brightness/sharpness, pose, eyes open, not occluded)
    const quality = await faceVerificationService.validateEnrollmentQuality(photoKey)
    if (!quality.passed) {
      throw new ValidationError(quality.reasons.join(' '))
    }

    const updated = await studentRepository.updateStudent(studentId, {
      facePhotoKey: photoKey,
      profileStatus: 'SUBMITTED'
    })
    return toStudentProfileDTO(updated)
  }

  async enrollIdDocument(studentId, idKey) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    // Enrollment photo vs ID-card photo compare is an assistive signal for admin approval queue, not auto-decision
    let idCardMatchSignal = null
    if (student.facePhotoKey) {
      idCardMatchSignal = await faceVerificationService.compareEnrollmentWithIdCard(student.facePhotoKey, idKey)
    }

    const updated = await studentRepository.updateStudent(studentId, {
      idCardPhotoKey: idKey,
      idDocumentKey: idKey,
      profileStatus: 'SUBMITTED'
    })

    if (idCardMatchSignal) {
      await studentRepository.recordVerificationAuditLog({
        studentId,
        checkType: 'ID_CARD_ENROLLMENT_SIGNAL',
        score: idCardMatchSignal.similarity,
        status: idCardMatchSignal.similarity >= 80 ? 'HIGH_MATCH' : 'REQUIRES_MANUAL_REVIEW',
        details: JSON.stringify(idCardMatchSignal)
      })
    }

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
