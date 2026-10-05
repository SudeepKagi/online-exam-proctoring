/**
 * Submission DTOs
 */

function toSubmissionResponseDTO(attempt, alreadySubmitted = false) {
  const rawTs = attempt.submitted_at || attempt.submittedAt
  return {
    status: 'SUBMITTED',
    submittedAt: rawTs ? new Date(rawTs).toISOString() : new Date().toISOString(),
    alreadySubmitted,
    message: alreadySubmitted ? 'Exam was already submitted' : 'Exam submitted successfully'
  }
}

module.exports = {
  toSubmissionResponseDTO
}
