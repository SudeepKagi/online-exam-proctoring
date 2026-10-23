const examsSql = require('./exams.sql')
const { ROLES, normalizeRole } = require('../../shared/roles')

class ExamService {
  async checkExamMutability(examId, isQuestionMutation = false) {
    const exam = await examsSql.findExamById(examId)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const { prisma } = require('../../infra/postgres/client')
    const attemptCount = await prisma.examAttempt.count({ where: { examId } })
    if (attemptCount > 0) {
      const err = new Error('Exam cannot be modified because student attempts already exist.')
      err.status = 409
      err.code = 'EXAM_HAS_ATTEMPTS'
      throw err
    }

    const serverNow = new Date()
    const startTime = exam.startTime ? new Date(exam.startTime) : null
    const endTime = exam.endTime ? new Date(exam.endTime) : null

    if (exam.status !== 'DRAFT') {
      if ((startTime && serverNow >= startTime) || (endTime && serverNow > endTime) || exam.status === 'ACTIVE' || exam.status === 'COMPLETED') {
        const err = new Error('Exam cannot be edited or deleted once it has started or ended.')
        err.status = 409
        err.code = 'EXAM_IMMUTABLE_ACTIVE_OR_ENDED'
        throw err
      }
    }

    return exam
  }

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
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      const err = new Error('Exam end time must be after start time.')
      err.status = 400
      err.code = 'INVALID_EXAM_WINDOW'
      throw err
    }

    const dur = Number(duration || durationMinutes || 60)
    const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
    if (dur <= 0 || dur > windowMinutes) {
      const err = new Error('Exam duration cannot exceed the scheduled window.')
      err.status = 400
      err.code = 'DURATION_EXCEEDS_WINDOW'
      throw err
    }

    return examsSql.createExam({
      title,
      subject: subj,
      courseCode: subj,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration: dur,
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
    const exam = await this.checkExamMutability(id)

    const newStart = data.startTime ? new Date(data.startTime) : new Date(exam.startTime)
    const newEnd = data.endTime ? new Date(data.endTime) : new Date(exam.endTime)
    const newDur = data.durationMinutes !== undefined ? Number(data.durationMinutes) : (data.duration !== undefined ? Number(data.duration) : exam.durationMinutes)

    if (data.startTime || data.endTime) {
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) {
        const err = new Error('Exam end time must be after start time.')
        err.status = 400
        err.code = 'INVALID_EXAM_WINDOW'
        throw err
      }
    }

    if (newDur <= 0 || newDur > Math.floor((newEnd.getTime() - newStart.getTime()) / 60000)) {
      const err = new Error('Exam duration cannot exceed the scheduled window.')
      err.status = 400
      err.code = 'DURATION_EXCEEDS_WINDOW'
      throw err
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
    // Never leak answers to students while exam window is open
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

    const start = new Date(exam.startTime)
    const end = new Date(exam.endTime)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      const err = new Error('Exam end time must be after start time.')
      err.status = 400
      err.code = 'INVALID_EXAM_WINDOW'
      throw err
    }

    const dur = Number(exam.durationMinutes || exam.duration || 60)
    const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
    if (dur <= 0 || dur > windowMinutes) {
      const err = new Error('Exam duration cannot exceed the scheduled window.')
      err.status = 400
      err.code = 'DURATION_EXCEEDS_WINDOW'
      throw err
    }

    const questions = await examsSql.getQuestionsByExamId(id, true)
    if (!questions || questions.length === 0) {
      const err = new Error('Cannot publish exam without questions')
      err.status = 400
      err.code = 'EXAM_INCOMPLETE'
      throw err
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const text = q.questionText || q.prompt || ''
      if (!text.trim()) {
        const err = new Error(`Question ${i + 1} has empty text prompt.`)
        err.status = 400
        err.code = 'EXAM_INCOMPLETE'
        throw err
      }
      let opts = q.options
      if (opts && typeof opts === 'object' && !Array.isArray(opts) && Array.isArray(opts.choices)) {
        opts = opts.choices
      }
      if (!Array.isArray(opts) || opts.length < 2) {
        const err = new Error(`Question ${i + 1} must have at least 2 options.`)
        err.status = 400
        err.code = 'EXAM_INCOMPLETE'
        throw err
      }
      if (opts.some(o => !String(o || '').trim())) {
        const err = new Error(`Question ${i + 1} contains empty options.`)
        err.status = 400
        err.code = 'EXAM_INCOMPLETE'
        throw err
      }
      const marks = Number(q.marks)
      if (isNaN(marks) || marks <= 0) {
        const err = new Error(`Question ${i + 1} must have positive marks.`)
        err.status = 400
        err.code = 'EXAM_INCOMPLETE'
        throw err
      }
      const cIdx = Number(q.correctOptionIndex)
      if (isNaN(cIdx) || cIdx < 0 || cIdx >= opts.length) {
        const err = new Error(`Question ${i + 1} has invalid correct option index.`)
        err.status = 400
        err.code = 'EXAM_INCOMPLETE'
        throw err
      }
    }

    const updated = await examsSql.updateExamStatus(id, 'PUBLISHED')
    try {
      const { redisClient } = require('../../infra/redis/client')
      await redisClient.set(`exam:${id}:questions`, JSON.stringify(questions), 'EX', 86400)
    } catch (_) {}
    return updated
  }

  async bulkAddQuestions(examId, questions = []) {
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
