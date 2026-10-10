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
const {
  autosaveItemsTotal,
  autosaveConflictsTotal
} = require('../../observability/metrics')

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
      autosaveItemsTotal.inc({ result: 'OK' })
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

    autosaveItemsTotal.inc({ result: diag.failure || 'ERROR' })
    if (diag.failure === 'STALE_REVISION') {
      autosaveConflictsTotal.inc()
    }

    switch (diag.failure) {
      case 'NOT_FOUND':
        throw new NotFoundError(diag.message)
      case 'FORBIDDEN':
        throw new ForbiddenError(diag.message)
      case 'NOT_ACTIVE':
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
    const { prisma } = require('../../infra/postgres/client')
    const rows = await prisma.$queryRawUnsafe(`
      SELECT status, expires_at, (expires_at < now()) AS is_expired
      FROM exam_attempts
      WHERE id = $1::uuid AND student_id = $2::uuid;
    `, attemptId, studentId)

    if (!rows || rows.length === 0) {
      throw new NotFoundError(`Attempt '${attemptId}' not found`)
    }

    const attempt = rows[0]
    if (attempt.status === 'SUSPENDED') {
      throw new ConflictError('Cannot save answers while attempt is suspended', 'ATTEMPT_SUSPENDED')
    }
    if (attempt.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot save answers on attempt in state '${attempt.status}'`, 'INVALID_STATE')
    }
    if (attempt.is_expired) {
      throw new GoneError('Exam attempt time has expired', 'EXAM_EXPIRED')
    }

    const results = await answerRepository.saveBatchAnswers(attemptId, studentId, answers)
    for (const res of results) {
      autosaveItemsTotal.inc({ result: res.status || (res.success ? 'OK' : 'ERROR') })
      if (res.status === 'STALE_REVISION') {
        autosaveConflictsTotal.inc()
      }
    }
    return toBatchSaveAnswersResponseDTO(results)
  }
}

module.exports = {
  AnswerService,
  answerService: new AnswerService()
}
