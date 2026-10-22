const { prisma } = require('../../infra/postgres/client')
const { ROLES, normalizeRole } = require('../../shared/roles')

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
  if (!id || typeof id !== 'string' || id.length !== 36) return null
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
  } else if (normalizeRole(filter.role) === ROLES.STUDENT) {
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
  let list
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

  return list.map(q => {
    let cleanOptions = q.options
    if (!includeAnswer && cleanOptions && typeof cleanOptions === 'object' && !Array.isArray(cleanOptions)) {
      const { correctIndices: _ci, ...rest } = cleanOptions
      cleanOptions = rest
    }
    const res = {
      id: q.id,
      examId: q.examId,
      questionText: q.questionText,
      options: cleanOptions,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      order: q.displayOrder,
      displayOrder: q.displayOrder
    }
    if (includeAnswer) {
      res.correctOptionIndex = q.correctOptionIndex
    }
    return res
  })
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

async function updateExam(id, data) {
  examCache.delete(id)
  const updateData = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.courseCode !== undefined || data.subject !== undefined) updateData.courseCode = data.courseCode || data.subject
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime)
  if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime)
  if (data.durationMinutes !== undefined || data.duration !== undefined) {
    updateData.durationMinutes = Number(data.durationMinutes || data.duration)
  }
  if (data.proctoringConfig !== undefined) updateData.proctoringConfig = data.proctoringConfig

  const exam = await prisma.exam.update({
    where: { id },
    data: updateData
  })
  return mapExamRecord(exam)
}

async function deleteExam(id) {
  examCache.delete(id)
  questionsCache.delete(id)
  return prisma.exam.delete({
    where: { id }
  })
}

module.exports = {
  createExam,
  updateExam,
  deleteExam,
  findExamById,
  listExams,
  updateExamStatus,
  addQuestion,
  getQuestionsByExamId,
  deleteQuestion,
  assignUserToExam
}

