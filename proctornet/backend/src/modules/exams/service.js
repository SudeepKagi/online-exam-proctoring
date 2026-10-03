const { prisma } = require('../../infra/postgres/client')
const { attemptPrewarmJob } = require('../attempts/prewarmJob')
const { attemptService } = require('../attempts/service')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError
} = require('../../shared/errors')

class ExamService {
  async createExam(data, facultyId) {
    const invId = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const rawInvPassword = crypto.randomBytes(6).toString('hex')
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)

    const exam = await prisma.exam.create({
      data: {
        ...data,
        facultyId,
        invId,
        invPasswordHash,
        status: 'DRAFT',
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime)
      }
    })

    return {
      ...exam,
      rawInvPassword
    }
  }

  async publishExam(examId, facultyId, userRole) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: { options: true }
        }
      }
    })

    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    if (userRole === 'FACULTY' && exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (exam.status !== 'DRAFT') {
      throw new ConflictError(`Exam cannot be published from state '${exam.status}'`)
    }

    if (!exam.questions || exam.questions.length === 0) {
      throw new ValidationError('Cannot publish exam without questions')
    }

    // P2 Invariant Validation: MCQ-only rules check
    for (const q of exam.questions) {
      if (q.options.length < 2 || q.options.length > 6) {
        throw new ValidationError(`Question '${q.id}' must have between 2 and 6 options (found ${q.options.length})`)
      }
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        throw new ValidationError(`Question '${q.id}' must have exactly 1 correct option (found ${correctCount})`)
      }
      if (q.marks <= 0) {
        throw new ValidationError(`Question '${q.id}' marks must be greater than 0`)
      }
      if (q.negativeMarks < 0 || q.negativeMarks > q.marks) {
        throw new ValidationError(`Question '${q.id}' negative marks must be between 0 and ${q.marks}`)
      }
    }

    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'PUBLISHED' }
    })

    // Trigger pre-warming in background
    attemptPrewarmJob.prewarmExam(examId).catch(() => {})

    return updated
  }

  async updateExam(examId, data, facultyId, userRole) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    if (userRole === 'FACULTY' && exam.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    if (exam.status !== 'DRAFT') {
      throw new ConflictError(`Exam is in '${exam.status}' status. Content is immutable once published.`)
    }

    const updated = await prisma.exam.update({
      where: { id: examId },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined
      }
    })

    // Invalidate content cache
    await attemptService.invalidateExamContentCache(examId).catch(() => {})

    return updated
  }

  async getExam(examId, user) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        faculty: {
          select: { id: true, name: true, email: true, departmentCode: true }
        }
      }
    })

    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    // Sanitize invPasswordHash
    const { invPasswordHash, ...safeExam } = exam
    return safeExam
  }
}

module.exports = {
  ExamService,
  examService: new ExamService()
}
