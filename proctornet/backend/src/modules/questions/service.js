const { questionRepository } = require('./repository')
const { attemptService } = require('../attempts/service')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError
} = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')

class QuestionService {
  async createQuestion(examId, data, facultyId, userRole) {
    const exam = await questionRepository.findExamById(examId)
    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    if (userRole === ROLES.FACULTY && exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (exam.status !== 'DRAFT') {
      throw new ConflictError(`Exam is in '${exam.status}' status. Content is immutable once published.`)
    }

    const { options, ...questionData } = data

    const created = await questionRepository.createWithOptions(examId, questionData, options)

    // Invalidate exam content cache
    await attemptService.invalidateExamContentCache(examId).catch(() => {})

    return created
  }

  async deleteQuestion(questionId, facultyId, userRole) {
    const question = await questionRepository.findByIdWithExam(questionId)

    if (!question) {
      throw new NotFoundError(`Question '${questionId}' not found`)
    }

    if (userRole === ROLES.FACULTY && question.exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (question.exam.status !== 'DRAFT') {
      throw new ConflictError(`Exam is in '${question.exam.status}' status. Content is immutable once published.`)
    }

    await questionRepository.deleteById(questionId)

    // Invalidate exam content cache
    await attemptService.invalidateExamContentCache(question.examId).catch(() => {})

    return { success: true, deletedQuestionId: questionId }
  }
}

module.exports = {
  QuestionService,
  questionService: new QuestionService()
}
