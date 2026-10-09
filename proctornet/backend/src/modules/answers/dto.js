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
    success: results.every(r => r.status === 'OK' || r.success === true),
    results: results.map(r => ({
      attemptQuestionId: r.attemptQuestionId,
      status: r.status || (r.success ? 'OK' : 'ERROR'),
      success: r.status === 'OK' || r.success === true,
      revision: r.revision,
      currentRevision: r.currentRevision,
      error: r.error
    }))
  }
}

module.exports = {
  toSaveAnswerResponseDTO,
  toBatchSaveAnswersResponseDTO
}
