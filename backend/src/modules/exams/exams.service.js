const examsSql = require('./exams.sql')
const { ROLES, normalizeRole } = require('../../shared/roles')

class ExamService {
  async createExam(data, creatorId) {
    const { title, subject, startTime, endTime, duration, totalMarks, requireVpn, proctoringConfig, description } = data
    if (!title || !subject || !startTime || !endTime) {
      const err = new Error('Title, subject, startTime, and endTime are required')
      err.status = 400
      throw err
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (end <= start) {
      const err = new Error('End time must be after start time')
      err.status = 400
      throw err
    }

    return examsSql.createExam({
      title,
      subject,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration: duration || 60,
      totalMarks: totalMarks || 100,
      requireVpn: Boolean(requireVpn),
      proctoringConfig: proctoringConfig || {
        cameraRequired: true,
        fullScreenMode: true,
        browserLock: true,
        screenShareRequired: true
      },
      createdBy: creatorId
    })
  }

  async getExamById(id, userRole = null) {
    const exam = await examsSql.findExamById(id)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const isStudent = normalizeRole(userRole) === ROLES.STUDENT
    const includeCorrect = !isStudent || exam.status === 'EVALUATED'
    const questions = await examsSql.getQuestionsByExamId(id, includeCorrect)
    return { ...exam, questions }
  }

  async listExams(filter = {}) {
    return examsSql.listExams(filter)
  }

  async publishExam(id) {
    const exam = await examsSql.findExamById(id)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const questions = await examsSql.getQuestionsByExamId(id, false)
    if (!questions || questions.length === 0) {
      const err = new Error('Cannot publish exam without questions')
      err.status = 400
      throw err
    }

    return examsSql.updateExamStatus(id, 'PUBLISHED')
  }

  async addQuestion(examId, data) {
    const { questionText, options, correctOptionIndex, marks, negativeMarks, order } = data
    if (!questionText || !options || correctOptionIndex === undefined) {
      const err = new Error('questionText, options, and correctOptionIndex are required')
      err.status = 400
      throw err
    }

    if (!Array.isArray(options) || options.length !== 4) {
      const err = new Error('Strict MCQ requirement: options must be an array of exactly 4 choices')
      err.status = 400
      throw err
    }

    const correctIdx = parseInt(correctOptionIndex, 10)
    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) {
      const err = new Error('correctOptionIndex must be an integer between 0 and 3')
      err.status = 400
      throw err
    }

    return examsSql.addQuestion({
      examId,
      questionText,
      options,
      correctOptionIndex: correctIdx,
      marks: Number(marks) || 1,
      negativeMarks: Number(negativeMarks) || 0,
      order: Number(order) || 0
    })
  }

  async deleteQuestion(questionId) {
    return examsSql.deleteQuestion(questionId)
  }

  async assignUser(examId, userId, role) {
    return examsSql.assignUserToExam(examId, userId, role)
  }
}

const examService = new ExamService()
module.exports = { examService, ExamService }
