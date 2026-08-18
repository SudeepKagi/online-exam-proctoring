const pythonService = require('./python.service')

/**
 * Question Service
 * Handles Question creation, updates, deletes, bulk additions, and AI question generation.
 */

async function addQuestionToExam({ examId, facultyId, data }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const { type, questionText, text, marks, negativeMarks, difficulty, options, correctAnswer, sampleInput, sampleOutput, testCases, order } = data

  const finalQuestionText = questionText || text || ''
  if (!finalQuestionText.trim()) {
    const error = new Error('Question text is required.')
    error.status = 400
    throw error
  }

  const parsedMarks = marks ? parseFloat(marks) : 5
  const parsedNegMarks = negativeMarks ? parseFloat(negativeMarks) : 0

  const question = await global.prisma.question.create({
    data: {
      examId,
      type: (type || 'MCQ').toUpperCase(),
      questionText: finalQuestionText,
      marks: parsedMarks,
      negativeMarks: parsedNegMarks,
      difficulty: difficulty || 'MEDIUM',
      options: options || [],
      correctAnswer: correctAnswer ? String(correctAnswer) : null,
      sampleInput: sampleInput || null,
      sampleOutput: sampleOutput || null,
      testCases: testCases || [],
      order: order !== undefined ? parseInt(order) : 0
    }
  })

  // Update exam total marks
  await global.prisma.exam.update({
    where: { id: examId },
    data: { totalMarks: { increment: parsedMarks } }
  }).catch(() => {})

  return question
}

async function listQuestionsForExam(examId) {
  const questions = await global.prisma.question.findMany({
    where: { examId },
    orderBy: { order: 'asc' }
  })
  return questions
}

async function updateQuestionById({ id, facultyId, data }) {
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
    const error = new Error('Access denied to modify this question.')
    error.status = 403
    throw error
  }

  const { type, questionText, text, marks, negativeMarks, difficulty, options, correctAnswer, sampleInput, sampleOutput, testCases, order } = data

  const oldMarks = question.marks || 0
  const newMarks = marks !== undefined ? parseFloat(marks) : oldMarks
  const markDiff = newMarks - oldMarks

  const updated = await global.prisma.question.update({
    where: { id },
    data: {
      type: type ? type.toUpperCase() : question.type,
      questionText: questionText !== undefined ? questionText : (text !== undefined ? text : question.questionText),
      marks: newMarks,
      negativeMarks: negativeMarks !== undefined ? parseFloat(negativeMarks) : question.negativeMarks,
      difficulty: difficulty || question.difficulty,
      options: options !== undefined ? options : question.options,
      correctAnswer: correctAnswer !== undefined ? String(correctAnswer) : question.correctAnswer,
      sampleInput: sampleInput !== undefined ? sampleInput : question.sampleInput,
      sampleOutput: sampleOutput !== undefined ? sampleOutput : question.sampleOutput,
      testCases: testCases !== undefined ? testCases : question.testCases,
      order: order !== undefined ? parseInt(order) : question.order
    }
  })

  if (markDiff !== 0) {
    await global.prisma.exam.update({
      where: { id: question.examId },
      data: { totalMarks: { increment: markDiff } }
    }).catch(() => {})
  }

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

  await global.prisma.question.delete({
    where: { id }
  })

  await global.prisma.exam.update({
    where: { id: question.examId },
    data: { totalMarks: { decrement: question.marks || 0 } }
  }).catch(() => {})

  return { success: true, message: 'Question deleted successfully.' }
}

async function bulkAddQuestionsToExam({ examId, facultyId, questions }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
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

  let totalAddedMarks = 0
  const createdQuestions = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const parsedMarks = q.marks ? parseFloat(q.marks) : 5
    const created = await global.prisma.question.create({
      data: {
        examId,
        type: (q.type || 'MCQ').toUpperCase(),
        questionText: q.questionText || q.text || `Question ${i + 1}`,
        marks: parsedMarks,
        negativeMarks: q.negativeMarks ? parseFloat(q.negativeMarks) : 0,
        difficulty: q.difficulty || 'MEDIUM',
        options: q.options || [],
        correctAnswer: q.correctAnswer ? String(q.correctAnswer) : null,
        sampleInput: q.sampleInput || null,
        sampleOutput: q.sampleOutput || null,
        testCases: q.testCases || [],
        order: q.order !== undefined ? parseInt(q.order) : i + 1
      }
    })
    totalAddedMarks += parsedMarks
    createdQuestions.push(created)
  }

  await global.prisma.exam.update({
    where: { id: examId },
    data: { totalMarks: { increment: totalAddedMarks } }
  }).catch(() => {})

  return createdQuestions
}

async function generateAIQuestionsPreview({ topic, difficulty = 'Medium', count = 5, type = 'MCQ' }) {
  if (!topic) {
    const error = new Error('Topic is required.')
    error.status = 400
    throw error
  }

  const result = await pythonService.generateAIQuestions({ topic, difficulty, count, type })
  if (!result.success) {
    const error = new Error(result.error || 'Failed to generate AI questions')
    error.status = 500
    throw error
  }

  return {
    questions: result.questions,
    source: result.source
  }
}

async function generateAndSaveAIQuestions({ examId, facultyId, topic, difficulty = 'Medium', count = 5, type = 'MCQ' }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const result = await pythonService.generateAIQuestions({
    topic: topic || exam.title || 'General Subject',
    difficulty,
    count,
    type
  })

  if (!result.success || !result.questions || result.questions.length === 0) {
    const error = new Error(result.error || 'AI question generation returned no results.')
    error.status = 500
    throw error
  }

  const createdQuestions = []
  let totalAddedMarks = 0

  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i]
    const marks = q.marks ? parseFloat(q.marks) : 1
    const created = await global.prisma.question.create({
      data: {
        examId,
        questionText: q.questionText || q.text || 'AI Generated Question',
        type: (q.type || 'MCQ').toUpperCase(),
        options: q.options || [],
        correctAnswer: String(q.correctOption !== undefined ? q.correctOption : (q.correctAnswer || 0)),
        marks,
        negativeMarks: 0,
        difficulty: q.difficulty || difficulty,
        order: i + 1
      }
    })
    totalAddedMarks += marks
    createdQuestions.push(created)
  }

  await global.prisma.exam.update({
    where: { id: examId },
    data: { totalMarks: { increment: totalAddedMarks } }
  }).catch(() => {})

  return createdQuestions
}

module.exports = {
  addQuestionToExam,
  listQuestionsForExam,
  updateQuestionById,
  deleteQuestionById,
  bulkAddQuestionsToExam,
  generateAIQuestionsPreview,
  generateAndSaveAIQuestions
}
