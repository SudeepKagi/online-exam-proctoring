/**
 * Exam Result DTOs
 * Privacy Invariant: Obey exam release policy; never leak answer keys unless explicitly released.
 */

function toStudentResultDTO(result, exam) {
  if (!result) return null

  const isReleased = result.isReleased || exam?.resultsReleased

  if (!isReleased) {
    return {
      attemptId: result.attemptId,
      examId: result.examId,
      status: 'PENDING_RELEASE',
      message: 'Exam results have not been published yet.',
      submittedAt: result.createdAt
    }
  }

  return {
    attemptId: result.attemptId,
    examId: result.examId,
    score: result.score,
    totalMarks: result.totalMarks,
    percentage: result.percentage,
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    unansweredCount: result.unansweredCount,
    rank: result.rank,
    timeTaken: result.timeTaken,
    status: result.status,
    isReleased: true,
    releasedAt: result.releasedAt || result.createdAt
  }
}

function toFacultyResultDTO(result) {
  if (!result) return null

  return {
    id: result.id,
    attemptId: result.attemptId,
    examId: result.examId,
    score: result.score,
    totalMarks: result.totalMarks,
    percentage: result.percentage,
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    unansweredCount: result.unansweredCount,
    rank: result.rank,
    timeTaken: result.timeTaken,
    flagCount: result.flagCount,
    status: result.status,
    isReleased: result.isReleased,
    student: result.attempt?.student ? {
      id: result.attempt.student.id,
      name: result.attempt.student.name,
      usn: result.attempt.student.usn,
      departmentCode: result.attempt.student.departmentCode
    } : undefined
  }
}

module.exports = {
  toStudentResultDTO,
  toFacultyResultDTO
}
