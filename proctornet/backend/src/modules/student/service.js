const studentRepository = require('./repository')
const { prisma } = require('../../infra/postgres/client')
const { attemptService } = require('../attempts/service')
const { faceVerificationService } = require('../media/faceVerificationService')
const { toStudentProfileDTO, toStudentExamDTO, toStudentResultDTO } = require('./dto')
const { isStudentEligible } = require('../exams/eligibility')
const {
  NotFoundError,
  ForbiddenError,
  ValidationError
} = require('../../shared/errors')

class StudentService {
  async getProfile(studentId) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student profile not found')
    return toStudentProfileDTO(student)
  }

  async updateProfile(studentId, data) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student profile not found')

    if (student.profileStatus === 'LOCKED') {
      throw new ForbiddenError('Profile is locked and cannot be modified', 'FORBIDDEN')
    }

    // Strict Field Policy (§U1): Students may change only presentation fields (name, phone).
    // Not email, usn, departmentCode, semester, approvalStatus, profileStatus, isSuspended, or photos.
    const forbiddenFields = [
      'departmentCode', 'department', 'semester', 'email',
      'facePhotoKey', 'idCardPhotoKey', 'facePhotoUrl', 'idCardPhotoUrl',
      'usn', 'approvalStatus', 'profileStatus', 'isSuspended',
      'faceMatchScore', 'approvedBy', 'approvedAt'
    ]

    for (const field of forbiddenFields) {
      if (data[field] !== undefined) {
        throw new ForbiddenError(
          `Modifying field '${field}' is strictly prohibited for students. Presentation fields (name, phone) only.`,
          'FIELD_NOT_ALLOWED'
        )
      }
    }

    const allowed = {}
    if (data.name && typeof data.name === 'string' && data.name.trim()) {
      allowed.name = data.name.trim()
    }
    if (data.phone !== undefined) {
      allowed.phone = data.phone ? String(data.phone).trim() : null
    }

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

    const isEligible = isStudentEligible(exam, student)
    return {
      exam: toStudentExamDTO(exam, attempt),
      student: toStudentProfileDTO(student),
      isEligible,
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
    const liveInput = data.liveFrameKey || data.frameKey || data.liveFrame || data.image
    if (!liveInput) {
      throw new ValidationError('liveFrameKey is required for face verification')
    }

    let attempt = null
    if (data.examId) {
      attempt = await studentRepository.getAttemptByStudentAndExam(studentId, data.examId)
    } else if (data.attemptId) {
      attempt = await studentRepository.getAttemptById(data.attemptId)
    }

    let liveFrameKey = data.liveFrameKey || data.frameKey
    if (!liveFrameKey && typeof liveInput === 'string' && (liveInput.startsWith('attempts/') || liveInput.startsWith('live/'))) {
      liveFrameKey = liveInput
    }

    if (!liveFrameKey) {
      // Reject raw base64 through API (FLW-03)
      if (typeof liveInput === 'string' && liveInput.startsWith('data:image')) {
        throw new ValidationError('Direct base64 image uploads are rejected. Use server-issued presigned upload tickets (purpose: LIVE_FRAME).')
      }
      throw new ValidationError('Valid liveFrameKey is required for face verification')
    }

    // FLW-03: Live frames must come from server-issued, attempt-bound upload tickets
    const { pendingUploadRegistry } = require('../media/pendingUploads')
    await pendingUploadRegistry.verifyAndConsumeUpload({
      key: liveFrameKey,
      studentId,
      purpose: 'LIVE_FRAME'
    })

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
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    // FLW-02: ID-card photo is uploaded at enrollment and verified by admin.
    // At exam time only the live face check runs.
    const isEnrolledAndVerified = student.profileStatus === 'VERIFIED' || student.approvalStatus === 'APPROVED'

    await studentRepository.recordVerificationAuditLog({
      studentId,
      checkType: 'ID_CARD_OCR',
      score: isEnrolledAndVerified ? 1.0 : 0.0,
      status: isEnrolledAndVerified ? 'VERIFIED_DURING_ENROLLMENT' : 'PENDING_ANALYSIS',
      details: isEnrolledAndVerified ? 'ID card verified during enrollment by admin' : 'Pending enrollment review'
    })

    return {
      success: true,
      verified: isEnrolledAndVerified,
      matchScore: student.faceMatchScore || 1.0,
      pending: !isEnrolledAndVerified,
      message: isEnrolledAndVerified ? 'ID card verified during enrollment.' : 'Pending enrollment review.'
    }
  }

  async saveIdentityVerification(examId, studentId, data) {
    const attempt = await studentRepository.getAttemptByStudentAndExam(studentId, examId)
    if (!attempt) throw new NotFoundError('No attempt found for this exam')

    const liveFrameKey = data.faceWithIdPhoto || data.liveFrameKey || data.frameKey
    if (!liveFrameKey) {
      throw new ValidationError('faceWithIdPhoto or liveFrameKey is required for identity verification')
    }

    // FLW-03: Verify server-issued ticket
    const { pendingUploadRegistry } = require('../media/pendingUploads')
    await pendingUploadRegistry.verifyAndConsumeUpload({
      key: liveFrameKey,
      studentId,
      purpose: 'LIVE_FRAME'
    })

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
    const { supportService } = require('../support/supportService')
    return supportService.createTicket(studentId, { subject, message, priority, examId })
  }

  async listSupportTickets(studentId) {
    const { supportService } = require('../support/supportService')
    return supportService.listTicketsForStudent(studentId)
  }

  async submitConsent(studentId) {
    const updated = await studentRepository.updateStudent(studentId, {
      consentTimestamp: new Date()
    })
    return toStudentProfileDTO(updated)
  }

  async enrollFace(studentId, photoKey) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    if (student.profileStatus === 'VERIFIED') {
      throw new ForbiddenError(
        'Student biometric identity is already VERIFIED. Changing reference photos requires a staff-approved re-enrollment request.',
        'RE_ENROLLMENT_REQUIRED'
      )
    }

    // R-06 & R-07: Accept only server-issued keys for this student and verify object existence
    const { pendingUploadRegistry } = require('../media/pendingUploads')
    await pendingUploadRegistry.verifyAndConsumeUpload({
      key: photoKey,
      studentId,
      purpose: 'FACE_ENROLLMENT'
    })

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

  async requestReEnrollment(studentId, { reason } = {}) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    if (student.profileStatus !== 'VERIFIED') {
      throw new ValidationError('Re-enrollment requests are only permitted for VERIFIED candidates')
    }

    const updated = await studentRepository.updateStudent(studentId, {
      profileStatus: 'RE_ENROLL_PENDING',
      rejectionReason: reason ? String(reason).trim() : 'Candidate requested biometric re-enrollment'
    })

    await studentRepository.recordVerificationAuditLog({
      studentId,
      checkType: 'RE_ENROLLMENT_REQUEST',
      score: null,
      status: 'RE_ENROLL_PENDING',
      details: reason ? JSON.stringify({ reason }) : 'Candidate requested biometric re-enrollment'
    })

    await prisma.auditLog.create({
      data: {
        actorId: studentId,
        actorRole: 'student',
        studentId: studentId,
        action: 'RE_ENROLLMENT_REQUESTED',
        resourceType: 'student',
        resourceId: studentId,
        metadata: reason ? { reason: String(reason).slice(0, 500) } : { reason: 'Re-enrollment requested by student' }
      }
    })

    return toStudentProfileDTO(updated)
  }

  async enrollIdDocument(studentId, idKey) {
    const student = await studentRepository.getStudentById(studentId)
    if (!student) throw new NotFoundError('Student not found')

    if (student.profileStatus === 'VERIFIED') {
      throw new ForbiddenError(
        'Student identity is already VERIFIED. Changing ID document requires staff approval.',
        'RE_ENROLLMENT_REQUIRED'
      )
    }

    // R-06 & R-07: Accept only server-issued keys for this student and verify object existence
    const { pendingUploadRegistry } = require('../media/pendingUploads')
    await pendingUploadRegistry.verifyAndConsumeUpload({
      key: idKey,
      studentId,
      purpose: 'ID_ENROLLMENT'
    })

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
    const messages = await studentRepository.listChatMessages(examId, studentId, limit)
    return messages.map(m => ({
      id: m.id != null ? m.id.toString() : null,
      examId: m.examId,
      studentId: m.studentId,
      senderRole: m.senderRole,
      message: m.message,
      timestamp: m.timestamp
    }))
  }
}

module.exports = new StudentService()
