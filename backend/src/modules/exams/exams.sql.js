const { prisma } = require('../../infra/postgres/client')

function mapExamRecord(exam) {
  if (!exam) return null
  return {
    ...exam,
    subject: exam.courseCode,
    duration: exam.durationMinutes,
    createdBy: exam.createdById
  }
}

async function createExam({ title, subject, courseCode, description, startTime, endTime, duration, durationMinutes, totalMarks, requireVpn, proctoringConfig, createdBy, createdById }) {
  const code = (courseCode || subject || 'CS101').trim()
  const creatorId = createdById || createdBy
  const dur = Number(durationMinutes || duration || 60)

  const exam = await prisma.exam.create({
    data: {
      title,
      courseCode: code,
      createdById: creatorId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationMinutes: dur,
      status: 'DRAFT',
      proctoringConfig: proctoringConfig || {}
    }
  })

  return mapExamRecord(exam)
}

const examCache = new Map()
const questionsCache = new Map()

async function findExamById(id) {
  if (!id) return null
  const cached = examCache.get(id)
  if (cached && Date.now() - cached.ts < 10000) return cached.val
  const exam = await prisma.exam.findUnique({
    where: { id }
  })
  const mapped = mapExamRecord(exam)
  if (mapped) examCache.set(id, { val: mapped, ts: Date.now() })
  return mapped
}

async function listExams(filter = {}) {
  const where = {}
  if (filter.createdBy || filter.createdById) {
    where.createdById = filter.createdById || filter.createdBy
  } else if (filter.status) {
    where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status
  } else if (filter.role === 'STUDENT') {
    where.status = { in: ['PUBLISHED', 'ACTIVE'] }
  }

  const exams = await prisma.exam.findMany({
    where,
    orderBy: { startTime: 'desc' }
  })

  return exams.map(mapExamRecord)
}

async function updateExamStatus(id, status) {
  examCache.delete(id)
  const exam = await prisma.exam.update({
    where: { id },
    data: { status: String(status).toUpperCase() }
  })
  return mapExamRecord(exam)
}

async function addQuestion({ examId, questionText, options, correctOptionIndex, marks = 1, negativeMarks = 0, order = 0, displayOrder = 0 }) {
  questionsCache.delete(examId)
  const question = await prisma.question.create({
    data: {
      examId,
      questionText,
      options: options || [],
      correctOptionIndex: Number(correctOptionIndex) || 0,
      marks: Number(marks) || 1,
      negativeMarks: Number(negativeMarks) || 0,
      displayOrder: Number(displayOrder || order || 0)
    }
  })
  return {
    ...question,
    order: question.displayOrder
  }
}

async function getQuestionsByExamId(examId, includeAnswer = true) {
  let list = null
  const cached = questionsCache.get(examId)
  if (cached && Date.now() - cached.ts < 10000) {
    list = cached.val
  } else {
    list = await prisma.question.findMany({
      where: { examId },
      orderBy: { displayOrder: 'asc' }
    })
    questionsCache.set(examId, { val: list, ts: Date.now() })
  }

  return list.map(q => ({
    id: q.id,
    examId: q.examId,
    questionText: q.questionText,
    options: q.options,
    correctOptionIndex: includeAnswer ? q.correctOptionIndex : undefined,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    order: q.displayOrder,
    displayOrder: q.displayOrder
  }))
}

async function deleteQuestion(questionId) {
  questionsCache.clear()
  return prisma.question.delete({
    where: { id: questionId },
    select: { id: true }
  })
}

async function assignUserToExam(examId, userId, role = 'STUDENT') {
  const assignedRole = String(role).toUpperCase()
  return prisma.examAssignment.upsert({
    where: {
      examId_userId: { examId, userId }
    },
    create: {
      examId,
      userId,
      assignedRole
    },
    update: {
      assignedRole
    }
  })
}

module.exports = {
  createExam,
  findExamById,
  listExams,
  updateExamStatus,
  addQuestion,
  getQuestionsByExamId,
  deleteQuestion,
  assignUserToExam
}
