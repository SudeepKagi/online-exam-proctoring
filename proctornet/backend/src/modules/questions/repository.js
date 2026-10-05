const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')

class QuestionRepository {
  /**
   * Find an exam by ID (for guard checks before question mutations).
   */
  async findExamById(examId) {
    return prisma.exam.findUnique({ where: { id: examId } })
  }

  /**
   * Find a question by ID, including its parent exam.
   */
  async findByIdWithExam(questionId) {
    return prisma.question.findUnique({
      where: { id: questionId },
      include: { exam: true }
    })
  }

  /**
   * Create a question and its options in a single transaction.
   * Returns the newly created question with options attached.
   */
  async createWithOptions(examId, questionData, options) {
    return prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          id: questionData.id || crypto.randomUUID(),
          ...questionData,
          examId
        }
      })

      const optionInserts = options.map((opt, idx) => ({
        id: opt.id || crypto.randomUUID(),
        questionId: q.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: idx + 1
      }))

      await tx.questionOption.createMany({ data: optionInserts })

      return tx.question.findUnique({
        where: { id: q.id },
        include: { options: true }
      })
    })
  }

  /**
   * Delete a question (cascades to options via FK constraint).
   */
  async deleteById(questionId) {
    return prisma.question.delete({ where: { id: questionId } })
  }
}

module.exports = {
  QuestionRepository,
  questionRepository: new QuestionRepository()
}
