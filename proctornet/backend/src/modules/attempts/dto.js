/**
 * Attempt DTOs
 * Critical Security Invariant: NEVER include is_correct in student responses.
 */

function toStudentAttemptDTO(attempt, questionsWithAnswers = []) {
  if (!attempt) return null

  const formattedQuestions = (questionsWithAnswers || []).map(q => {
    // Sanitize options - omit is_correct unconditionally
    const sanitizedOptions = (q.options || []).map(opt => ({
      id: opt.id,
      text: opt.text,
      order: opt.order
    }))

    return {
      attemptQuestionId: q.attemptQuestionId || q.id,
      questionId: q.questionId,
      displayOrder: q.displayOrder,
      questionText: q.questionText,
      imageKey: q.imageKey || null,
      imageUrl: q.imageUrl || null,
      marks: q.marks,
      negativeMarks: q.negativeMarks || 0,
      selectedOptionId: q.selectedOptionId || null,
      revision: typeof q.revision === 'number' ? q.revision : (q.selectedOptionId ? 1 : 0),
      options: sanitizedOptions
    }
  })

  return {
    id: attempt.id,
    examId: attempt.examId || attempt.exam_id,
    status: attempt.status,
    startedAt: attempt.startedAt || attempt.started_at,
    expiresAt: attempt.expiresAt || attempt.expires_at,
    submittedAt: attempt.submittedAt || attempt.submitted_at,
    suspendedAt: attempt.suspendedAt || attempt.suspended_at,
    totalSuspendedMs: attempt.totalSuspendedMs || attempt.total_suspended_ms || 0,
    watermarkSeed: attempt.watermarkSeed || attempt.watermark_seed,
    flagCount: attempt.flagCount || attempt.flag_count || 0,
    terminationReason: attempt.terminationReason || attempt.termination_reason || null,
    serverTime: new Date().toISOString(),
    exam: attempt.exam ? {
      id: attempt.exam.id,
      title: attempt.exam.title,
      subject: attempt.exam.subject,
      duration: attempt.exam.duration,
      totalMarks: attempt.exam.totalMarks || attempt.exam.total_marks,
      cameraRequired: attempt.exam.cameraRequired ?? attempt.exam.camera_required,
      micRequired: attempt.exam.micRequired ?? attempt.exam.mic_required,
      fullScreenMode: attempt.exam.fullScreenMode ?? attempt.exam.full_screen_mode,
      watermarkRequired: attempt.exam.watermarkRequired ?? attempt.exam.watermark_required,
      tabSwitchLimit: attempt.exam.tabSwitchLimit ?? attempt.exam.tab_switch_limit
    } : undefined,
    questions: formattedQuestions
  }
}

function toInvigilatorAttemptDTO(attempt) {
  if (!attempt) return null

  return {
    id: attempt.id,
    examId: attempt.examId || attempt.exam_id,
    studentId: attempt.studentId || attempt.student_id,
    status: attempt.status,
    startedAt: attempt.startedAt || attempt.started_at,
    expiresAt: attempt.expiresAt || attempt.expires_at,
    submittedAt: attempt.submittedAt || attempt.submitted_at,
    suspendedAt: attempt.suspendedAt || attempt.suspended_at,
    totalSuspendedMs: attempt.totalSuspendedMs || attempt.total_suspended_ms || 0,
    flagCount: attempt.flagCount || attempt.flag_count || 0,
    terminationReason: attempt.terminationReason || attempt.termination_reason || null,
    vpnIp: attempt.vpnIp || attempt.vpn_ip || null,
    student: attempt.student ? {
      id: attempt.student.id,
      name: attempt.student.name,
      usn: attempt.student.usn,
      departmentCode: attempt.student.departmentCode || attempt.student.department_code,
      semester: attempt.student.semester
    } : undefined
  }
}

module.exports = {
  toStudentAttemptDTO,
  toInvigilatorAttemptDTO
}
