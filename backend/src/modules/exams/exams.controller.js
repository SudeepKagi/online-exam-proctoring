const { examService } = require('./exams.service')

async function createExam(req, res, next) {
  try {
    const exam = await examService.createExam(req.body, req.user?.id)
    return res.status(201).json({ status: 'success', exam })
  } catch (err) {
    next(err)
  }
}

async function getExam(req, res, next) {
  try {
    const exam = await examService.getExamById(req.params.id, req.user?.role)
    return res.status(200).json({ status: 'success', exam, serverTime: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
}

async function listExams(req, res, next) {
  try {
    const exams = await examService.listExams(req.query)
    return res.status(200).json({ status: 'success', exams: exams || [] })
  } catch (err) {
    next(err)
  }
}

async function publishExam(req, res, next) {
  try {
    const exam = await examService.publishExam(req.params.id)
    return res.status(200).json({ status: 'success', exam })
  } catch (err) {
    next(err)
  }
}

async function addQuestion(req, res, next) {
  try {
    const question = await examService.addQuestion(req.params.id, req.body)
    return res.status(201).json({ status: 'success', question })
  } catch (err) {
    next(err)
  }
}

async function deleteQuestion(req, res, next) {
  try {
    await examService.deleteQuestion(req.params.questionId)
    return res.status(200).json({ status: 'success', message: 'Question deleted' })
  } catch (err) {
    next(err)
  }
}

async function assignUser(req, res, next) {
  try {
    const { userId, role } = req.body
    const assignment = await examService.assignUser(req.params.id, userId, role)
    return res.status(201).json({ status: 'success', assignment })
  } catch (err) {
    next(err)
  }
}

async function getStudentExams(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const studentId = req.user?.id
    const [exams, attempts] = await Promise.all([
      examService.listExams({ role: 'STUDENT' }),
      studentId ? prisma.examAttempt.findMany({ where: { studentId } }) : []
    ])

    const attemptMap = new Map()
    for (const a of attempts) {
      attemptMap.set(a.examId, a)
    }

    const formatted = (exams || []).map(e => {
      const att = attemptMap.get(e.id)
      return {
        ...e,
        attemptId: att?.id || null,
        attemptStatus: att?.status || null,
        score: att?.score ?? null
      }
    })

    return res.status(200).json({ status: 'success', exams: formatted })
  } catch (err) {
    next(err)
  }
}

async function getFacultyExams(req, res, next) {
  try {
    const exams = await examService.listExams({ createdBy: req.user?.id })
    return res.status(200).json({ status: 'success', exams: exams || [] })
  } catch (err) {
    next(err)
  }
}

async function bulkAddQuestions(req, res, next) {
  try {
    const questions = req.body?.questions || []
    const created = await examService.bulkAddQuestions(req.params.id, questions)
    return res.status(201).json({ status: 'success', count: created.length, questions: created })
  } catch (err) {
    next(err)
  }
}

const multer = require('multer')
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
const uploadQuestionsMiddleware = upload.single('file')

async function uploadQuestionsExcel(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: { message: 'Questions Excel file (.xlsx) is required' } })
    }
    const questions = await examService.parseQuestionsExcel(req.file.buffer)
    const created = await examService.bulkAddQuestions(req.params.id, questions)
    return res.status(201).json({ status: 'success', count: created.length, questions: created })
  } catch (err) {
    next(err)
  }
}

async function getExamAttempts(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: req.params.id },
      include: {
        student: { select: { fullName: true, email: true, institutionId: true } }
      },
      orderBy: { startedAt: 'desc' }
    })
    const formatted = attempts.map(a => ({
      id: a.id,
      studentName: a.student?.fullName || 'Student',
      email: a.student?.email || '—',
      usn: a.student?.institutionId || '—',
      status: a.status,
      score: a.score,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt
    }))
    return res.status(200).json({ status: 'success', attempts: formatted })
  } catch (err) {
    next(err)
  }
}

async function exportResultsCsv(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: req.params.id },
      include: {
        student: { select: { fullName: true, email: true, institutionId: true } }
      },
      orderBy: { startedAt: 'desc' }
    })
    const rows = ['Student Name,Email,USN,Status,Score,Submitted At']
    for (const a of attempts) {
      rows.push(`"${a.student?.fullName || ''}","${a.student?.email || ''}","${a.student?.institutionId || ''}","${a.status}","${a.score ?? ''}","${a.submittedAt ? a.submittedAt.toISOString() : ''}"`)
    }
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="results-${req.params.id}.csv"`)
    return res.status(200).send(rows.join('\n'))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createExam,
  getExam,
  listExams,
  publishExam,
  addQuestion,
  deleteQuestion,
  assignUser,
  getStudentExams,
  getFacultyExams,
  bulkAddQuestions,
  uploadQuestionsMiddleware,
  uploadQuestionsExcel,
  getExamAttempts,
  exportResultsCsv
}
