const examsSql = require('./exams.sql')
const { ROLES, normalizeRole } = require('../../shared/roles')

class ExamService {
  async createExam(data, creatorId) {
    const { title, subject, courseCode, startTime, endTime, duration, durationMinutes, totalMarks, requireVpn, proctoringConfig, description } = data
    const subj = subject || courseCode || 'GENERAL'
    if (!title || !subj || !startTime || !endTime) {
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
      subject: subj,
      courseCode: subj,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration: duration || durationMinutes || 60,
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

  async updateExam(id, data) {
    const exam = await examsSql.findExamById(id)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }
    return examsSql.updateExam(id, data)
  }

  async deleteExam(id) {
    const exam = await examsSql.findExamById(id)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }
    return examsSql.deleteExam(id)
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

    const updated = await examsSql.updateExamStatus(id, 'PUBLISHED')
    try {
      const { redisClient } = require('../../infra/redis/client')
      await redisClient.set(`exam:${id}:questions`, JSON.stringify(questions), 'EX', 86400)
    } catch (_) {}
    return updated
  }

  async bulkAddQuestions(examId, questions = []) {
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
        if (['A', 'B', 'C', 'D'].includes(upper)) {
          correctIdx = upper.charCodeAt(0) - 65
        } else {
          correctIdx = parseInt(correctIdx, 10)
        }
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
    const ExcelJS = require('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) throw new Error('No sheet found in questions workbook')
    const questions = []
    let headerMap = {}
    worksheet.eachRow((row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      if (rowNumber === 1) {
        values.forEach((v, idx) => {
          headerMap[String(v || '').toLowerCase().trim()] = idx
        })
      } else {
        const getVal = (key) => {
          const idx = headerMap[key]
          return idx !== undefined && values[idx] !== undefined ? String(values[idx]).trim() : ''
        }
        const text = getVal('question') || getVal('question text') || getVal('prompt') || values[0]
        const optA = getVal('option a') || getVal('option 1') || values[1] || 'Option A'
        const optB = getVal('option b') || getVal('option 2') || values[2] || 'Option B'
        const optC = getVal('option c') || getVal('option 3') || values[3] || 'Option C'
        const optD = getVal('option d') || getVal('option 4') || values[4] || 'Option D'
        let correct = getVal('correct answer') || getVal('correct') || values[5] || '0'
        if (['A', 'B', 'C', 'D'].includes(String(correct).toUpperCase())) {
          correct = String(correct).toUpperCase().charCodeAt(0) - 65
        } else {
          correct = parseInt(correct, 10) || 0
        }
        const marks = parseFloat(getVal('marks') || values[6]) || 1
        if (text) {
          questions.push({
            questionText: String(text).trim(),
            options: [String(optA).trim(), String(optB).trim(), String(optC).trim(), String(optD).trim()],
            correctOptionIndex: correct,
            marks
          })
        }
      }
    })
    return questions
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
