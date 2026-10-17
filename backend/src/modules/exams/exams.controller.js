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
    const exams = await examService.listExams({ role: 'STUDENT' })
    return res.status(200).json({ status: 'success', exams: exams || [] })
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

module.exports = {
  createExam,
  getExam,
  listExams,
  publishExam,
  addQuestion,
  deleteQuestion,
  assignUser,
  getStudentExams,
  getFacultyExams
}
