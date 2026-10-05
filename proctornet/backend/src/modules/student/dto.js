/**
 * Student DTO Mappers
 */

function toStudentProfileDTO(s) {
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    usn: s.usn,
    email: s.email,
    departmentCode: s.departmentCode,
    department: s.department?.name || s.departmentCode,
    semester: s.semester,
    phone: s.phone || null,
    facePhotoKey: s.facePhotoKey,
    idCardPhotoKey: s.idCardPhotoKey,
    idDocumentKey: s.idDocumentKey,
    idCroppedFaceKey: s.idCroppedFaceKey,
    faceMatchScore: s.faceMatchScore,
    profileStatus: s.profileStatus,
    approvalStatus: s.approvalStatus,
    mustChangePassword: s.mustChangePassword,
    rejectionReason: s.rejectionReason,
    consentTimestamp: s.consentTimestamp,
    createdAt: s.createdAt
  }
}

function toStudentExamDTO(e, attempt = null) {
  if (!e) return null
  return {
    id: e.id,
    title: e.title,
    subject: e.subject,
    description: e.description,
    startTime: e.startTime,
    endTime: e.endTime,
    duration: e.duration,
    totalMarks: e.totalMarks,
    negativeMarking: e.negativeMarking,
    cameraRequired: e.cameraRequired,
    micRequired: e.micRequired,
    browserLock: e.browserLock,
    fullScreenMode: e.fullScreenMode,
    watermarkRequired: e.watermarkRequired,
    tabSwitchLimit: e.tabSwitchLimit,
    vpnRequired: e.vpnRequired,
    status: e.status,
    attempt: attempt ? {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      flagCount: attempt.flagCount
    } : null
  }
}

function toStudentResultDTO(r) {
  if (!r) return null
  return {
    id: r.id,
    examId: r.examId,
    examTitle: r.exam?.title || null,
    examSubject: r.exam?.subject || null,
    score: r.score,
    totalMarks: r.totalMarks,
    percentage: r.percentage,
    rank: r.rank,
    status: r.status,
    evaluatedAt: r.evaluatedAt,
    isReleased: r.isReleased,
    releasedAt: r.releasedAt
  }
}

module.exports = {
  toStudentProfileDTO,
  toStudentExamDTO,
  toStudentResultDTO
}
