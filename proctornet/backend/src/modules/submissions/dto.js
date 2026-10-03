/**
 * Submission DTOs
 */

function toSubmissionResponseDTO(attempt, alreadySubmitted = false) {
  return {
    status: 'SUBMITTED',
    submittedAt: attempt.submitted_at || attempt.submittedAt || new Date().toISOString(),
    alreadySubmitted,
    message: alreadySubmitted ? 'Exam was already submitted' : 'Exam submitted successfully'
  }
}

module.exports = {
  toSubmissionResponseDTO
}
