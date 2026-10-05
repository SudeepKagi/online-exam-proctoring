const { prisma } = require('../../infra/postgres/client')
const { attemptService } = require('../attempts/service')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError
} = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')

class QuestionService {
  async createQuestion(examId, data, facultyId, userRole) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
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

    const created = await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          ...questionData,
          examId
        }
      })

      const optionInserts = options.map((opt, idx) => ({
        questionId: q.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: idx + 1
      }))

      await tx.questionOption.createMany({
        data: optionInserts
      })

      return tx.question.findUnique({
        where: { id: q.id },
        include: { options: true }
      })
    })

    // Invalidate exam content cache
    await attemptService.invalidateExamContentCache(examId).catch(() => {})

    return created
  }

  async deleteQuestion(questionId, facultyId, userRole) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { exam: true }
    })

    if (!question) {
      throw new NotFoundError(`Question '${questionId}' not found`)
    }

    if (userRole === ROLES.FACULTY && question.exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (question.exam.status !== 'DRAFT') {
      throw new ConflictError(`Exam is in '${question.exam.status}' status. Content is immutable once published.`)
    }

    await prisma.question.delete({ where: { id: questionId } })

    // Invalidate exam content cache
    await attemptService.invalidateExamContentCache(question.examId).catch(() => {})

    return { success: true, deletedQuestionId: questionId }
  }
}

module.exports = {
  QuestionService,
  questionService: new QuestionService()
}
