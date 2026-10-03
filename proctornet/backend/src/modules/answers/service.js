const { answerRepository } = require('./repository')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  StaleRevisionError,
  GoneError,
  ValidationError
} = require('../../shared/errors')
const {
  toSaveAnswerResponseDTO,
  toBatchSaveAnswersResponseDTO
} = require('./dto')

class AnswerService {
  /**
   * Save student answer with optimistic revision guard (Kills B-02/B-03)
   */
  async saveAnswer(attemptId, studentId, attemptQuestionId, optionId, revision) {
    // 1. Single-statement update with guarded CTE
    const updatedRevision = await answerRepository.saveAnswer(
      attemptId,
      studentId,
      attemptQuestionId,
      optionId,
      revision
    )

    if (updatedRevision !== null) {
      return toSaveAnswerResponseDTO(updatedRevision)
    }

    // 2. 0 rows updated -> execute single diagnostic query
    const diag = await answerRepository.diagnoseSaveFailure(
      attemptId,
      studentId,
      attemptQuestionId,
      optionId,
      revision
    )

    switch (diag.failure) {
      case 'NOT_FOUND':
        throw new NotFoundError(diag.message)
      case 'FORBIDDEN':
        throw new ForbiddenError(diag.message)
      case 'INVALID_STATE':
        throw new ConflictError(diag.message, 'INVALID_STATE', { currentStatus: diag.currentStatus })
      case 'EXPIRED':
        throw new GoneError(diag.message, 'EXAM_EXPIRED', { expiresAt: diag.expiresAt })
      case 'QUESTION_NOT_FOUND':
        throw new NotFoundError(diag.message)
      case 'INVALID_OPTION':
        throw new ValidationError(diag.message)
      case 'STALE_REVISION':
        throw new StaleRevisionError(diag.currentRevision, diag.message)
      default:
        throw new ConflictError(diag.message || 'Failed to save answer')
    }
  }

  /**
   * Batch save dirty answers (<= 100 items)
   */
  async batchSaveAnswers(attemptId, studentId, answers) {
    const results = await answerRepository.saveBatchAnswers(attemptId, studentId, answers)
    return toBatchSaveAnswersResponseDTO(results)
  }
}

module.exports = {
  AnswerService,
  answerService: new AnswerService()
}
