/**
 * Answer DTOs
 */

function toSaveAnswerResponseDTO(revision) {
  return {
    success: true,
    revision,
    savedAt: new Date().toISOString()
  }
}

function toBatchSaveAnswersResponseDTO(results) {
  return {
    success: results.every(r => r.success),
    results
  }
}

module.exports = {
  toSaveAnswerResponseDTO,
  toBatchSaveAnswersResponseDTO
}
