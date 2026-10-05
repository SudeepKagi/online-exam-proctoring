/**
 * Faculty DTO Mappers
 */

function toFacultyExamDTO(e) {
  if (!e) return null
  return {
    id: e.id,
    title: e.title,
    subject: e.subject,
    description: e.description,
    facultyId: e.facultyId,
    faculty: e.faculty ? { id: e.faculty.id, name: e.faculty.name, email: e.faculty.email } : undefined,
    startTime: e.startTime,
    endTime: e.endTime,
    duration: e.duration,
    totalMarks: e.totalMarks,
    negativeMarking: e.negativeMarking,
    negativeValue: e.negativeValue,
    questionsPerStudent: e.questionsPerStudent,
    randomiseQuestions: e.randomiseQuestions,
    randomiseOptions: e.randomiseOptions,
    allowedDepartments: e.allowedDepartments || [],
    allowedSemesters: e.allowedSemesters || [],
    invId: e.invId,
    status: e.status,
    cameraRequired: e.cameraRequired,
    micRequired: e.micRequired,
    browserLock: e.browserLock,
    fullScreenMode: e.fullScreenMode,
    watermarkRequired: e.watermarkRequired,
    tabSwitchLimit: e.tabSwitchLimit,
    vpnRequired: e.vpnRequired,
    isPaused: e.isPaused,
    resultsReleased: e.resultsReleased,
    createdAt: e.createdAt,
    questionCount: e._count?.questions ?? (Array.isArray(e.questions) ? e.questions.length : undefined),
    attemptCount: e._count?.attempts ?? (Array.isArray(e.attempts) ? e.attempts.length : undefined)
  }
}

function toFacultyQuestionDTO(q) {
  if (!q) return null
  return {
    id: q.id,
    examId: q.examId,
    questionText: q.questionText,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    difficulty: q.difficulty,
    imageKey: q.imageKey,
    order: q.order,
    options: (q.options || []).map(o => ({
      id: o.id,
      text: o.text,
      isCorrect: o.isCorrect,
      order: o.order
    }))
  }
}

module.exports = {
  toFacultyExamDTO,
  toFacultyQuestionDTO
}
