/**
 * Student Controller — High-Performance Exam Engine
 */
const { paginate } = require('../utils/helpers')

/**
 * GET /api/student/exams
 * List exams eligible for student department/semester
 */
async function listMyExams(req, res) {
  try {
    const student = await global.prisma.student.findUnique({ where: { id: req.user.id } })
    if (!student) return res.status(404).json({ error: 'Student not found' })

    const exams = await global.prisma.exam.findMany({
      where: {
        allowedDepartments: { has: student.department },
        allowedSemesters: { has: student.semester },
        status: { in: ['PUBLISHED', 'ACTIVE'] }
      },
      include: { 
        faculty: { select: { name: true } },
        studentExams: { where: { studentId: req.user.id } }
      },
      orderBy: { startTime: 'asc' }
    })

    const formatted = exams.map(e => ({
      ...e,
      studentStatus: e.studentExams?.[0]?.status || 'NOT_JOINED'
    }))

    res.json({ exams: formatted })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch exams' })
  }
}

/**
 * GET /api/student/exams/:id/start
 * Initialize or Resume Exam Session
 */
async function startExam(req, res) {
  try {
    const { id: examId } = req.params
    const studentId = req.user.id

    const exam = await global.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true }
    })

    if (!exam) return res.status(404).json({ error: 'Exam not found' })

    // Check session
    let studentExam = await global.prisma.studentExam.findFirst({
      where: { studentId, examId },
      include: { answers: true }
    })

    if (studentExam?.status === 'SUBMITTED') {
      return res.status(403).json({ error: 'Exam already submitted' })
    }

    if (!studentExam) {
      // Logic for randomized pool selection
      const pool = exam.questions
      const count = (exam.questionsPerStudent === 0 || !exam.questionsPerStudent) ? pool.length : exam.questionsPerStudent
      
      const assignedIds = pool
        .sort(() => Math.random() - 0.5)
        .slice(0, count)
        .map(q => q.id)

      studentExam = await global.prisma.studentExam.create({
        data: {
          studentId,
          examId,
          assignedQuestionIds: assignedIds,
          watermarkSeed: Math.random().toString(36).substring(2, 10).toUpperCase(),
          status: 'ACTIVE',
          startedAt: new Date()
        },
        include: { answers: true }
      })
    }

    const questions = await global.prisma.question.findMany({
      where: { id: { in: studentExam.assignedQuestionIds } },
      select: {
        id: true, type: true, questionText: true, 
        options: true, marks: true, 
        codeLanguage: true, codeTemplate: true,
        wordLimitMin: true, wordLimitMax: true
      }
    })

    // Return in assigned order
    const orderedQuestions = studentExam.assignedQuestionIds.map(qid => questions.find(q => q.id === qid))

    res.json({
      exam,
      questions: orderedQuestions,
      answers: studentExam.answers
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Initialization error' })
  }
}

/**
 * POST /api/student/exams/:id/autosave
 * Incremental Persistence for candidate answers
 */
async function autoSaveAnswer(req, res) {
  try {
    const { id: examId } = req.params
    const { questionId, answer } = req.body
    const studentId = req.user.id

    const session = await global.prisma.studentExam.findFirst({
      where: { studentId, examId, status: 'ACTIVE' }
    })

    if (!session) return res.status(403).json({ error: 'No active session' })

    const question = await global.prisma.question.findUnique({ where: { id: questionId } })

    const updateData = {}
    if (question.type === 'MCQ') updateData.selectedOption = answer
    else if (question.type === 'CODE') updateData.codeAnswer = answer
    else updateData.subjectiveAnswer = answer

    await global.prisma.answer.upsert({
      where: {
        studentExamId_questionId: { studentExamId: session.id, questionId }
      },
      update: { ...updateData, updatedAt: new Date() },
      create: { 
        studentExamId: session.id, 
        questionId, 
        ...updateData 
      }
    })

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Autosave failed' })
  }
}

/**
 * POST /api/student/exams/:id/violation
 * Log security events to Evidence Table
 */
async function logViolation(req, res) {
  try {
    const { id: examId } = req.params
    const { eventType, details } = req.body
    const studentId = req.user.id

    const session = await global.prisma.studentExam.findFirst({ where: { studentId, examId } })
    if (!session) return res.status(404).json({ error: 'Session not found' })

    await global.prisma.evidenceLog.create({
      data: {
        studentExamId: session.id,
        eventType,
        severity: ['TAB_SWITCH', 'MULTIPLE_FACES'].includes(eventType) ? 'HIGH' : 'MEDIUM',
        details: typeof details === 'string' ? details : JSON.stringify(details),
        timestamp: new Date()
      }
    })

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Logging failed' })
  }
}

/**
 * POST /api/student/exams/:id/submit
 * Finalize, Auto-grade, and Lock Session
 */
async function submitExam(req, res) {
  try {
    const { id: examId } = req.params
    const studentId = req.user.id

    const session = await global.prisma.studentExam.findFirst({
      where: { studentId, examId, status: 'ACTIVE' },
      include: { 
        answers: { include: { question: true } },
        exam: true
      }
    })

    if (!session) return res.status(403).json({ error: 'Nothing to submit' })

    // Grading logic
    let totalScore = 0
    let totalMarks = 0

    for (const ans of session.answers) {
      totalMarks += ans.question.marks
      let marksAwarded = 0

      if (ans.question.type === 'MCQ') {
        const isCorrect = ans.selectedOption === ans.question.options.find(o => o.isCorrect)?.text
        marksAwarded = isCorrect ? ans.question.marks : 0
      } 
      // Note: CODE and SUBJECTIVE require manual grading or specialized runners
      
      totalScore += marksAwarded
      await global.prisma.answer.update({
        where: { id: ans.id },
        data: { autoScore: marksAwarded }
      })
    }

    // Create Final Result
    await global.prisma.examResult.create({
      data: {
        studentExamId: session.id,
        examId,
        autoScore: totalScore,
        totalScore: totalScore, // Can be updated by manual grading later
        totalMarks,
        percentage: (totalScore / totalMarks) * 100,
        timeTaken: Math.floor((new Date() - session.startedAt) / 1000),
        finalStatus: 'COMPLETED'
      }
    })

    await global.prisma.studentExam.update({
      where: { id: session.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() }
    })

    res.json({ success: true, score: totalScore })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Submission failed' })
  }
}

/**
 * GET /api/student/exams/:id
 */
async function getExamDetails(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.findUnique({
      where: { id },
      include: { faculty: { select: { name: true } } }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found' })
    res.json({ exam })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch details' })
  }
}

module.exports = {
  listMyExams,
  getExamDetails,
  startExam,
  autoSaveAnswer,
  logViolation,
  submitExam
}
