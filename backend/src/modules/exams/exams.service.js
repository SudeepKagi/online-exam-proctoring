'use strict'

const examsSql = require('./exams.sql')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { checkExamMutability, validateScheduleWindow, validateQuestionsList } = require('./exams.guard')
const { parseQuestionsExcel } = require('./exams.excel')

class ExamService {
  async checkExamMutability(examId, isQuestionMutation = false) {
    return checkExamMutability(examId, isQuestionMutation)
  }

  async createExam(data, creatorId = null) {
    const { startTime, endTime, durationMinutes, duration } = data
    const dur = durationMinutes || duration || 60
    if (startTime && endTime) {
      validateScheduleWindow(startTime, endTime, dur)
    }
    return examsSql.createExam({
      ...data,
      durationMinutes: dur,
      createdBy: creatorId
    })
  }

  async updateExam(id, data) {
    await this.checkExamMutability(id)
    const existing = await examsSql.findExamById(id)
    const startTime = data.startTime || existing.startTime
    const endTime = data.endTime || existing.endTime
    const duration = data.durationMinutes || data.duration || existing.durationMinutes || existing.duration || 60

    if (startTime && endTime) {
      validateScheduleWindow(startTime, endTime, duration)
    }

    return examsSql.updateExam(id, data)
  }

  async deleteExam(id) {
    await this.checkExamMutability(id)
    try {
      return await examsSql.deleteExam(id)
    } catch (err) {
      if (err.code === 'P2003' || err.message?.includes('foreign key')) {
        const conflictErr = new Error('Cannot delete exam because associated student attempts or assignments exist.')
        conflictErr.status = 409
        conflictErr.code = 'ENTITY_IN_USE'
        throw conflictErr
      }
      throw err
    }
  }

  async getExamById(id, userRole = null) {
    const exam = await examsSql.findExamById(id)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const isStudent = normalizeRole(userRole) === ROLES.STUDENT
    const serverNow = new Date()
    const examEnded = exam.endTime && serverNow > new Date(exam.endTime)
    const includeCorrect = !isStudent || (exam.status === 'EVALUATED' && examEnded)
    const questions = await examsSql.getQuestionsByExamId(id, includeCorrect)
    return { ...exam, questions }
  }

  async listExams(filter = {}) {
    return examsSql.listExams(filter)
  }

  async publishExam(id) {
    const exam = await this.checkExamMutability(id)
    const serverNow = new Date()
    if (exam.startTime && new Date(exam.startTime) < serverNow) {
      const err = new Error('Exam start time cannot be in the past.')
      err.status = 400
      err.code = 'START_TIME_IN_PAST'
      throw err
    }

    validateScheduleWindow(exam.startTime, exam.endTime, exam.durationMinutes || exam.duration || 60)
    const questions = await examsSql.getQuestionsByExamId(id, true)
    validateQuestionsList(questions)

    return examsSql.updateExam(id, { status: 'PUBLISHED' })
  }

  async bulkAddQuestions(examId, questions) {
    await this.checkExamMutability(examId, true)
    const created = []
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      let opts = q.options || []
      let correctIdx = q.correctOptionIndex
      if (Array.isArray(opts) && typeof opts[0] === 'object') {
        const foundIdx = opts.findIndex((o) => o.isCorrect)
        if (foundIdx !== -1) correctIdx = foundIdx
        opts = opts.map((o) => o.text || o.optionText || String(o))
      }
      if (typeof correctIdx === 'string') {
        const upper = correctIdx.toUpperCase()
        correctIdx = ['A', 'B', 'C', 'D'].includes(upper) ? upper.charCodeAt(0) - 65 : parseInt(correctIdx, 10)
      }
      if (isNaN(correctIdx) || correctIdx === undefined) correctIdx = 0

      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`)
      if (opts.length > 4) opts = opts.slice(0, 4)

      const saved = await this.addQuestion(examId, {
        questionText: q.questionText || q.prompt || q.text,
        options: opts,
        correctOptionIndex: correctIdx,
        marks: q.marks || 1,
        negativeMarks: q.negativeMarks || 0,
        order: q.order !== undefined ? q.order : i
      })
      created.push(saved)
    }
    return created
  }

  async parseQuestionsExcel(buffer) {
    return parseQuestionsExcel(buffer)
  }

  async addQuestion(examId, data) {
    await this.checkExamMutability(examId, true)
    const { questionText, options, marks, negativeMarks, order } = data
    const isMultiObj = options && typeof options === 'object' && !Array.isArray(options) && Array.isArray(options.choices)
    const choicesList = isMultiObj ? options.choices : options

    let correctIdx = data.correctOptionIndex
    if (correctIdx === undefined && isMultiObj && Array.isArray(options.correctIndices)) {
      correctIdx = options.correctIndices[0] ?? 0
    }

    if (!questionText || !options || correctIdx === undefined) {
      const err = new Error('questionText, options, and correctOptionIndex are required')
      err.status = 400
      throw err
    }

    if (!Array.isArray(choicesList) || choicesList.length !== 4) {
      const err = new Error('Strict MCQ requirement: options must provide exactly 4 choices')
      err.status = 400
      throw err
    }

    const parsedCorrect = parseInt(correctIdx, 10)
    if (isNaN(parsedCorrect) || parsedCorrect < 0 || parsedCorrect > 3) {
      const err = new Error('correctOptionIndex must be an integer between 0 and 3')
      err.status = 400
      throw err
    }

    return examsSql.addQuestion({
      examId,
      questionText,
      options,
      correctOptionIndex: parsedCorrect,
      marks: Number(marks) || 1,
      negativeMarks: Number(negativeMarks) || 0,
      order: Number(order) || 0
    })
  }

  async deleteQuestion(questionId, examId = null) {
    let targetExamId = examId
    if (!targetExamId) {
      const { prisma } = require('../../infra/postgres/client')
      const q = await prisma.question.findUnique({ where: { id: questionId }, select: { examId: true } })
      if (!q) {
        const err = new Error('Question not found')
        err.status = 404
        throw err
      }
      targetExamId = q.examId
    }
    await this.checkExamMutability(targetExamId, true)
    return examsSql.deleteQuestion(questionId)
  }

  async assignUser(examId, userId, role) {
    return examsSql.assignUserToExam(examId, userId, role)
  }
}

const examService = new ExamService()
module.exports = { examService, ExamService }
