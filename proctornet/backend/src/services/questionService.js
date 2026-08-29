const pythonService = require('./python.service')

/**
 * Question Service
 * Handles Question creation, updates, deletes, bulk additions, and AI question generation.
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

  const {
    type,
    questionText,
    text,
    marks,
    negativeMarks,
    difficulty,
    options,
    correctAnswer,
    codeTemplate,
    codeLanguage,
    sampleInput,
    sampleOutput,
    testCases,
    wordLimitMin,
    wordLimitMax,
    order
  } = data

  const finalQuestionText = questionText || text || ''
  if (!finalQuestionText.trim()) {
    const error = new Error('Question text is required.')
    error.status = 400
    throw error
  }

  const parsedMarks = marks !== undefined && marks !== null ? parseFloat(marks) : 5
  const parsedNegMarks = negativeMarks !== undefined && negativeMarks !== null ? parseFloat(negativeMarks) : 0
  const parsedOrder = order !== undefined && order !== null ? parseInt(order, 10) : 0

  const question = await global.prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        examId,
        type: (type || 'MCQ').toUpperCase(),
        questionText: finalQuestionText,
        marks: parsedMarks,
        negativeMarks: parsedNegMarks,
        difficulty: difficulty ? difficulty.toUpperCase() : 'MEDIUM',
        options: options || [],
        correctAnswer: correctAnswer ? String(correctAnswer) : null,
        codeTemplate: codeTemplate || null,
        codeLanguage: codeLanguage || null,
        sampleInput: sampleInput || null,
        sampleOutput: sampleOutput || null,
        testCases: testCases || [],
        wordLimitMin: wordLimitMin ? parseInt(wordLimitMin, 10) : null,
        wordLimitMax: wordLimitMax ? parseInt(wordLimitMax, 10) : null,
        order: parsedOrder
      }
    })

    await tx.exam.update({
      where: { id: examId },
      data: { totalMarks: { increment: parsedMarks } }
    })

    return created
  })

  return question
}

async function listQuestionsForExam(examId) {
  const questions = await global.prisma.question.findMany({
    where: { examId },
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

  const {
    type,
    questionText,
    text,
    marks,
    negativeMarks,
    difficulty,
    options,
    correctAnswer,
    sampleInput,
    sampleOutput,
    testCases,
    order
  } = data

  const oldMarks = question.marks || 0
  const newMarks = marks !== undefined && marks !== null ? parseFloat(marks) : oldMarks
  const markDiff = newMarks - oldMarks

  const updated = await global.prisma.$transaction(async (tx) => {
    const q = await tx.question.update({
      where: { id },
      data: {
        type: type ? type.toUpperCase() : question.type,
        questionText: questionText !== undefined ? questionText : (text !== undefined ? text : question.questionText),
        marks: newMarks,
        negativeMarks: negativeMarks !== undefined && negativeMarks !== null ? parseFloat(negativeMarks) : question.negativeMarks,
        difficulty: difficulty ? difficulty.toUpperCase() : question.difficulty,
        options: options !== undefined ? options : question.options,
        correctAnswer: correctAnswer !== undefined ? String(correctAnswer) : question.correctAnswer,
        sampleInput: sampleInput !== undefined ? (sampleInput || null) : question.sampleInput,
        sampleOutput: sampleOutput !== undefined ? (sampleOutput || null) : question.sampleOutput,
        testCases: testCases !== undefined ? testCases : question.testCases,
        codeTemplate: data.codeTemplate !== undefined ? data.codeTemplate : question.codeTemplate,
        codeLanguage: data.codeLanguage !== undefined ? data.codeLanguage : question.codeLanguage,
        wordLimitMin: data.wordLimitMin !== undefined ? (data.wordLimitMin ? parseInt(data.wordLimitMin, 10) : null) : question.wordLimitMin,
        wordLimitMax: data.wordLimitMax !== undefined ? (data.wordLimitMax ? parseInt(data.wordLimitMax, 10) : null) : question.wordLimitMax,
        order: order !== undefined && order !== null ? parseInt(order, 10) : question.order
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

  const createdQuestions = await global.prisma.$transaction(async (tx) => {
    let totalAddedMarks = 0
    const list = []

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const parsedMarks = q.marks !== undefined && q.marks !== null ? parseFloat(q.marks) : 5
      const created = await tx.question.create({
        data: {
          examId,
          type: (q.type || 'MCQ').toUpperCase(),
          questionText: q.questionText || q.text || `Question ${i + 1}`,
          marks: parsedMarks,
          negativeMarks: q.negativeMarks !== undefined && q.negativeMarks !== null ? parseFloat(q.negativeMarks) : 0,
          difficulty: (q.difficulty || 'MEDIUM').toUpperCase(),
          options: q.options || [],
          correctAnswer: q.correctAnswer ? String(q.correctAnswer) : null,
          codeTemplate: q.codeTemplate || null,
          codeLanguage: q.codeLanguage || null,
          sampleInput: q.sampleInput || null,
          sampleOutput: q.sampleOutput || null,
          testCases: q.testCases || [],
          wordLimitMin: q.wordLimitMin ? parseInt(q.wordLimitMin, 10) : null,
          wordLimitMax: q.wordLimitMax ? parseInt(q.wordLimitMax, 10) : null,
          order: q.order !== undefined && q.order !== null ? parseInt(q.order, 10) : (i + 1)
        }
      })
      totalAddedMarks += parsedMarks
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

async function generateAIQuestionsPreview({ topic, difficulty = 'Medium', count, numMCQ, numEssay, type = 'MCQ' }) {
  if (!topic || !String(topic).trim()) {
    const error = new Error('Topic is required.')
    error.status = 400
    throw error
  }

  const requestedCount = count || numMCQ || (numEssay ? parseInt(numEssay, 10) : 5)
  const sanitizedCount = Math.max(1, Math.min(parseInt(requestedCount, 10) || 5, 30))
  const sanitizedTopic = String(topic).trim().substring(0, 200)
  const sanitizedType = ['MCQ', 'CODE', 'SUBJECTIVE'].includes(String(type).toUpperCase()) ? String(type).toUpperCase() : 'MCQ'

  const result = await pythonService.generateAIQuestions({
    topic: sanitizedTopic,
    difficulty,
    count: sanitizedCount,
    type: sanitizedType
  })
  if (!result.success) {
    const error = new Error(result.error || 'Failed to generate AI questions')
    error.status = 500
    throw error
  }

  const formattedQuestions = (result.questions || []).map((q, idx) => {
    const correctIdx = typeof q.correctOption === 'number' ? q.correctOption : 0
    const correctLetter = String.fromCharCode(65 + correctIdx)
    const rawOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']
    const optionsObj = rawOptions.map((opt, i) => {
      const isCorrect = i === correctIdx
      if (typeof opt === 'string') return { text: opt, isCorrect }
      return { text: opt.text || String(opt), isCorrect: opt.isCorrect !== undefined ? Boolean(opt.isCorrect) : isCorrect }
    })

    return {
      type: (q.type || 'MCQ').toUpperCase(),
      questionText: q.questionText || `Question ${idx + 1}`,
      options: optionsObj,
      correctOption: correctIdx,
      correctAnswer: q.correctAnswer || correctLetter,
      marks: q.marks || (difficulty.toUpperCase() === 'HARD' ? 3 : difficulty.toUpperCase() === 'MEDIUM' ? 2 : 1),
      difficulty: q.difficulty || difficulty,
      explanation: q.explanation || ''
    }
  })

  return {
    questions: formattedQuestions,
    source: result.source
  }
}

async function generateAndSaveAIQuestions({ examId, facultyId, topic, difficulty = 'Medium', count, numMCQ, numEssay, type = 'MCQ' }) {
  const where = { id: examId }
  if (facultyId) where.facultyId = facultyId

  const exam = await global.prisma.exam.findFirst({ where })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const requestedCount = count || numMCQ || (numEssay ? parseInt(numEssay, 10) : 5)
  const sanitizedCount = Math.max(1, Math.min(parseInt(requestedCount, 10) || 5, 30))
  const sanitizedTopic = String(topic || exam.title || 'General Subject').trim().substring(0, 200)
  const sanitizedType = ['MCQ', 'CODE', 'SUBJECTIVE'].includes(String(type).toUpperCase()) ? String(type).toUpperCase() : 'MCQ'

  const result = await pythonService.generateAIQuestions({
    topic: sanitizedTopic,
    difficulty,
    count: sanitizedCount,
    type: sanitizedType
  })

  if (!result.success || !result.questions || result.questions.length === 0) {
    const error = new Error(result.error || 'AI question generation returned no results.')
    error.status = 500
    throw error
  }

  const createdQuestions = await global.prisma.$transaction(async (tx) => {
    const list = []
    let totalAddedMarks = 0

    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i]
      const correctIdx = typeof q.correctOption === 'number' ? q.correctOption : 0
      const correctLetter = String.fromCharCode(65 + correctIdx)
      const rawOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']
      const optionsObj = rawOptions.map((opt, optIdx) => {
        const isCorrect = optIdx === correctIdx
        if (typeof opt === 'string') return { text: opt, isCorrect }
        return { text: opt.text || String(opt), isCorrect: opt.isCorrect !== undefined ? Boolean(opt.isCorrect) : isCorrect }
      })

      const marks = q.marks ? parseFloat(q.marks) : (difficulty.toUpperCase() === 'HARD' ? 3 : difficulty.toUpperCase() === 'MEDIUM' ? 2 : 1)
      const created = await tx.question.create({
        data: {
          examId,
          questionText: q.questionText || q.text || 'AI Generated Question',
          type: (q.type || 'MCQ').toUpperCase(),
          options: optionsObj,
          correctAnswer: q.correctAnswer || correctLetter,
          sampleInput: q.sampleInput || null,
          sampleOutput: q.sampleOutput || null,
          marks,
          negativeMarks: 0,
          difficulty: q.difficulty || difficulty,
          order: i + 1
        }
      })
      totalAddedMarks += marks
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

module.exports = {
  addQuestionToExam,
  listQuestionsForExam,
  updateQuestionById,
  deleteQuestionById,
  bulkAddQuestionsToExam,
  generateAIQuestionsPreview,
  generateAndSaveAIQuestions
}
