const xlsx = require('xlsx')
const pythonService = require('./python.service')
const { validateMcqQuestion, normalizeExcelQuestionRow } = require('../validators/question.validator')

/**
 * Question Service
 * Handles Single-Correct MCQ creation, updates, deletes, bulk additions,
 * Excel imports, and AI question generation.
 */

async function addQuestionToExam({ examId, facultyId, data }) {
  const where = { id: examId }
  if (facultyId) where.facultyId = facultyId

  const exam = await global.prisma.exam.findFirst({ where })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const validated = validateMcqQuestion(data)

  const question = await global.prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        examId,
        questionText: validated.questionText,
        marks: validated.marks,
        negativeMarks: validated.negativeMarks,
        difficulty: validated.difficulty,
        imageUrl: validated.imageUrl,
        order: validated.order,
        tags: validated.tags,
        options: {
          create: validated.options.map((opt, idx) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order !== undefined ? opt.order : idx
          }))
        }
      },
      include: {
        options: {
          orderBy: { order: 'asc' }
        }
      }
    })

    await tx.exam.update({
      where: { id: examId },
      data: { totalMarks: { increment: validated.marks } }
    })

    return created
  })

  return question
}

async function listQuestionsForExam(examId) {
  const questions = await global.prisma.question.findMany({
    where: { examId },
    include: {
      options: {
        orderBy: { order: 'asc' }
      }
    },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'asc' }
    ]
  })
  return questions
}

async function updateQuestionById({ id, facultyId, data }) {
  const question = await global.prisma.question.findUnique({
    where: { id },
    include: { exam: true, options: true }
  })
  if (!question) {
    const error = new Error('Question not found.')
    error.status = 404
    throw error
  }

  if (facultyId && question.exam.facultyId !== facultyId) {
    const error = new Error('Access denied to modify this question.')
    error.status = 403
    throw error
  }

  // Merge existing values with update data before validation
  const mergedData = {
    questionText: data.questionText !== undefined ? data.questionText : question.questionText,
    marks: data.marks !== undefined ? data.marks : question.marks,
    negativeMarks: data.negativeMarks !== undefined ? data.negativeMarks : question.negativeMarks,
    difficulty: data.difficulty !== undefined ? data.difficulty : question.difficulty,
    imageUrl: data.imageUrl !== undefined ? data.imageUrl : question.imageUrl,
    order: data.order !== undefined ? data.order : question.order,
    tags: data.tags !== undefined ? data.tags : question.tags,
    options: data.options !== undefined ? data.options : question.options,
    correctOption: data.correctOption,
    correctAnswer: data.correctAnswer
  }

  const validated = validateMcqQuestion(mergedData)
  const oldMarks = question.marks || 0
  const markDiff = validated.marks - oldMarks

  const updated = await global.prisma.$transaction(async (tx) => {
    // Delete old options and re-create validated options
    await tx.questionOption.deleteMany({
      where: { questionId: id }
    })

    const q = await tx.question.update({
      where: { id },
      data: {
        questionText: validated.questionText,
        marks: validated.marks,
        negativeMarks: validated.negativeMarks,
        difficulty: validated.difficulty,
        imageUrl: validated.imageUrl,
        order: validated.order,
        tags: validated.tags,
        options: {
          create: validated.options.map((opt, idx) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order !== undefined ? opt.order : idx
          }))
        }
      },
      include: {
        options: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (markDiff !== 0) {
      await tx.exam.update({
        where: { id: question.examId },
        data: { totalMarks: { increment: markDiff } }
      })
    }

    return q
  })

  return updated
}

async function deleteQuestionById({ id, facultyId }) {
  const question = await global.prisma.question.findUnique({
    where: { id },
    include: { exam: true }
  })
  if (!question) {
    const error = new Error('Question not found.')
    error.status = 404
    throw error
  }

  if (facultyId && question.exam.facultyId !== facultyId) {
    const error = new Error('Access denied to delete this question.')
    error.status = 403
    throw error
  }

  await global.prisma.$transaction(async (tx) => {
    await tx.question.delete({
      where: { id }
    })

    await tx.exam.update({
      where: { id: question.examId },
      data: { totalMarks: { decrement: question.marks || 0 } }
    })
  })

  return { success: true, message: 'Question deleted successfully.' }
}

async function bulkAddQuestionsToExam({ examId, facultyId, questions }) {
  if (!examId) {
    const error = new Error('Exam ID is required.')
    error.status = 400
    throw error
  }

  const where = { id: examId }
  if (facultyId) where.facultyId = facultyId

  const exam = await global.prisma.exam.findFirst({ where })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    const error = new Error('Questions array is required.')
    error.status = 400
    throw error
  }

  // Pre-validate all questions before entering transaction
  const validatedList = questions.map((q, idx) => {
    try {
      return validateMcqQuestion({ ...q, order: q.order !== undefined ? q.order : (idx + 1) })
    } catch (err) {
      const error = new Error(`Question ${idx + 1} validation failed: ${err.message}`)
      error.status = 400
      throw error
    }
  })

  const createdQuestions = await global.prisma.$transaction(async (tx) => {
    let totalAddedMarks = 0
    const list = []

    for (const val of validatedList) {
      const created = await tx.question.create({
        data: {
          examId,
          questionText: val.questionText,
          marks: val.marks,
          negativeMarks: val.negativeMarks,
          difficulty: val.difficulty,
          imageUrl: val.imageUrl,
          order: val.order,
          tags: val.tags,
          options: {
            create: val.options.map((opt, optIdx) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: opt.order !== undefined ? opt.order : optIdx
            }))
          }
        },
        include: {
          options: {
            orderBy: { order: 'asc' }
          }
        }
      })
      totalAddedMarks += val.marks
      list.push(created)
    }

    await tx.exam.update({
      where: { id: examId },
      data: { totalMarks: { increment: totalAddedMarks } }
    })

    return list
  })

  return createdQuestions
}

/**
 * Bulk imports questions from an Excel file buffer.
 * Columns: Question, OptionA…OptionF, CorrectOption, Marks, NegativeMarks, Difficulty, Tags
 */
async function importQuestionsFromExcel({ examId, facultyId, fileBuffer }) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    const error = new Error('Valid Excel file buffer is required.')
    error.status = 400
    throw error
  }

  let workbook
  try {
    workbook = xlsx.read(fileBuffer, { type: 'buffer' })
  } catch (err) {
    const error = new Error(`Failed to parse Excel workbook: ${err.message}`)
    error.status = 400
    throw error
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    const error = new Error('Excel workbook contains no sheets.')
    error.status = 400
    throw error
  }

  const worksheet = workbook.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' })

  if (!rows || rows.length === 0) {
    const error = new Error('Excel sheet contains no data rows.')
    error.status = 400
    throw error
  }

  const validatedQuestions = []
  const rowErrors = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const normalized = normalizeExcelQuestionRow(row, i + 1)
      validatedQuestions.push(normalized)
    } catch (err) {
      rowErrors.push(`Row ${i + 2}: ${err.message}`)
    }
  }

  if (rowErrors.length > 0) {
    const error = new Error(`Bulk import rejected with ${rowErrors.length} error(s): ${rowErrors.join('; ')}`)
    error.status = 400
    error.rowErrors = rowErrors
    throw error
  }

  return bulkAddQuestionsToExam({
    examId,
    facultyId,
    questions: validatedQuestions
  })
}

async function generateAIQuestionsPreview({ topic, difficulty = 'Medium', count = 5 }) {
  if (!topic || !String(topic).trim()) {
    const error = new Error('Topic is required.')
    error.status = 400
    throw error
  }

  const sanitizedCount = Math.max(1, Math.min(parseInt(count, 10) || 5, 30))
  const sanitizedTopic = String(topic).trim().substring(0, 200)

  const result = await pythonService.generateAIQuestions({
    topic: sanitizedTopic,
    difficulty,
    count: sanitizedCount,
    type: 'MCQ'
  })

  if (!result.success) {
    const error = new Error(result.error || 'Failed to generate AI questions')
    error.status = 500
    throw error
  }

  const formattedQuestions = (result.questions || []).map((q, idx) => {
    const correctIdx = typeof q.correctOption === 'number' ? q.correctOption : 0
    const rawOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']
    const optionsObj = rawOptions.map((opt, i) => {
      const isCorrect = i === correctIdx
      if (typeof opt === 'string') return { text: opt, isCorrect, order: i }
      return { text: opt.text || String(opt), isCorrect: opt.isCorrect !== undefined ? Boolean(opt.isCorrect) : isCorrect, order: i }
    })

    return {
      questionText: q.questionText || `Question ${idx + 1}`,
      options: optionsObj,
      correctOption: correctIdx,
      marks: q.marks || (difficulty.toUpperCase() === 'HARD' ? 3 : difficulty.toUpperCase() === 'MEDIUM' ? 2 : 1),
      negativeMarks: 0,
      difficulty: q.difficulty || difficulty,
      explanation: q.explanation || ''
    }
  })

  return {
    questions: formattedQuestions,
    source: result.source
  }
}

async function generateAndSaveAIQuestions({ examId, facultyId, topic, difficulty = 'Medium', count = 5 }) {
  const where = { id: examId }
  if (facultyId) where.facultyId = facultyId

  const exam = await global.prisma.exam.findFirst({ where })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const preview = await generateAIQuestionsPreview({
    topic: topic || exam.title || exam.subject,
    difficulty,
    count
  })

  return bulkAddQuestionsToExam({
    examId,
    facultyId,
    questions: preview.questions
  })
}

module.exports = {
  addQuestionToExam,
  listQuestionsForExam,
  updateQuestionById,
  deleteQuestionById,
  bulkAddQuestionsToExam,
  importQuestionsFromExcel,
  generateAIQuestionsPreview,
  generateAndSaveAIQuestions
}
