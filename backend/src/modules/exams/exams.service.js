'use strict'

const examsSql = require('./exams.sql')
const config = require('../../shared/config')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { checkExamMutability, validateScheduleWindow, validateQuestionsList, sanitizeProctoringConfigInput } = require('./exams.guard')
const { parseQuestionsExcel } = require('./exams.excel')
const { invalidateExamSebCache } = require('../../middleware/seb')

function toExamDto(exam, viewer = null) {
  if (!exam) return null

  // Ensure we work strictly on a deep copy — never mutate cached or database objects
  const dto = (typeof structuredClone === 'function')
    ? structuredClone(exam)
    : JSON.parse(JSON.stringify(exam))

  let role = null
  let userId = null

  if (viewer) {
    if (typeof viewer === 'object') {
      role = viewer.role ? normalizeRole(viewer.role) : null
      userId = viewer.id || viewer.userId || null
    } else if (typeof viewer === 'string') {
      role = normalizeRole(viewer)
    }
  }

  const pConfig = (dto.proctoringConfig && typeof dto.proctoringConfig === 'object' && !Array.isArray(dto.proctoringConfig))
    ? { ...dto.proctoringConfig }
    : {}

  const sebRequired = Boolean(pConfig.sebRequired)
  const rawKey = pConfig.sebConfigKey ? String(pConfig.sebConfigKey).trim() : null
  const rawFileKey = pConfig.sebFileKey !== undefined ? pConfig.sebFileKey : null

  const isOwner = Boolean(userId && (dto.createdById === userId || dto.createdBy === userId))

  if (role === ROLES.ADMIN || (role === ROLES.FACULTY && isOwner)) {
    // FACULTY who owns the exam, and ADMIN: masked "••••••••" plus last 4 characters
    if (rawKey) {
      const suffix = rawKey.length > 4 ? rawKey.slice(-4) : rawKey
      pConfig.sebConfigKey = `••••••••${suffix}`
    } else {
      pConfig.sebConfigKey = null
    }
    pConfig.sebRequired = sebRequired
    if (rawFileKey !== null && rawFileKey !== undefined) {
      pConfig.sebFileKey = rawFileKey
    }
  } else {
    // STUDENT, FACULTY non-owner, INVIGILATOR, unknown/null role:
    // Remove sebConfigKey and sebFileKey, keep sebRequired boolean
    delete pConfig.sebConfigKey
    delete pConfig.sebFileKey
    pConfig.sebRequired = sebRequired
  }

  // Remove request-only flag if present
  delete pConfig.clearSebConfigKey

  dto.proctoringConfig = pConfig
  return dto
}

class ExamService {
  async checkExamMutability(examId, isQuestionMutation = false) {
    return checkExamMutability(examId, isQuestionMutation)
  }

  async createExam(data, creatorId = null) {
    const { startTime, endTime, durationMinutes, duration, title } = data
    if (!title || !String(title).trim()) {
      const err = new Error('Exam title is required.')
      err.status = 400
      err.code = 'VALIDATION_ERROR'
      throw err
    }

    const dur = Number(durationMinutes !== undefined ? durationMinutes : (duration !== undefined ? duration : 60))
    if (isNaN(dur) || dur <= 0) {
      const err = new Error('Exam duration must be greater than 0.')
      err.status = 400
      err.code = 'INVALID_DURATION'
      throw err
    }

    validateScheduleWindow(startTime, endTime, dur)

    const rawPConfig = { ...(data.proctoringConfig || {}) }
    if (data.clearSebConfigKey !== undefined) {
      rawPConfig.clearSebConfigKey = data.clearSebConfigKey
    }
    const validatedPConfig = sanitizeProctoringConfigInput(rawPConfig, { isUpdate: false })
    if (validatedPConfig.clearSebConfigKey) {
      validatedPConfig.sebConfigKey = null
    }
    delete validatedPConfig.clearSebConfigKey

    return examsSql.createExam({
      ...data,
      proctoringConfig: validatedPConfig,
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

    const rawPConfig = { ...(data.proctoringConfig || {}) }
    if (data.clearSebConfigKey !== undefined) {
      rawPConfig.clearSebConfigKey = data.clearSebConfigKey
    }
    const validatedPConfig = (data.proctoringConfig !== undefined || data.clearSebConfigKey !== undefined)
      ? sanitizeProctoringConfigInput(rawPConfig, { isUpdate: true })
      : undefined

    const updated = await examsSql.updateExam(id, {
      ...data,
      ...(validatedPConfig !== undefined ? { proctoringConfig: validatedPConfig } : {})
    })
    invalidateExamSebCache(id)
    return updated
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

  async getExamById(id, userRoleOrViewer = null, userId = null) {
    let viewer = null
    if (userRoleOrViewer && typeof userRoleOrViewer === 'object') {
      viewer = userRoleOrViewer
    } else if (userRoleOrViewer) {
      viewer = { role: userRoleOrViewer, id: userId }
    }

    const exam = await examsSql.findExamById(id)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const role = viewer?.role ? normalizeRole(viewer.role) : null
    const isStudent = role === ROLES.STUDENT
    if (isStudent && !['PUBLISHED', 'ACTIVE', 'ENDED', 'EVALUATED'].includes(exam.status)) {
      const notFoundErr = new Error('Exam not found')
      notFoundErr.status = 404
      notFoundErr.code = 'EXAM_NOT_FOUND'
      throw notFoundErr
    }
    const serverNow = new Date()
    const examEnded = exam.endTime && serverNow > new Date(exam.endTime)
    const includeCorrect = !isStudent || (exam.status === 'EVALUATED' && examEnded)
    const questions = await examsSql.getQuestionsByExamId(id, includeCorrect)

    const questionCount = questions ? questions.length : 0
    const totalMarks = questions ? questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) : (exam.totalMarks || 0)

    const pConfig = (exam.proctoringConfig && typeof exam.proctoringConfig === 'object') ? exam.proctoringConfig : {}
    const sebRequired = Boolean(pConfig.sebRequired)
    const sebMode = (config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()

    // 7. Student GET /exams/:id: only when sebRequired && SEB_MODE === 'enforce', omit questions but return questionCount and totalMarks
    const omitQuestions = isStudent && sebRequired && sebMode === 'enforce'

    const examPayload = {
      ...exam,
      questionCount,
      totalMarks
    }
    if (!omitQuestions) {
      examPayload.questions = questions
    }

    return toExamDto(examPayload, viewer)
  }

  async listExams(filter = {}, viewer = null) {
    const list = await examsSql.listExams(filter)
    return (list || []).map(e => toExamDto(e, viewer))
  }

  async getSebSettings(examId) {
    const exam = await examsSql.findExamById(examId)
    if (!exam) return { sebRequired: false, sebConfigKey: null }
    const pConfig = (exam.proctoringConfig && typeof exam.proctoringConfig === 'object') ? exam.proctoringConfig : {}
    const sebRequired = Boolean(pConfig.sebRequired)
    const perExamKey = pConfig.sebConfigKey ? String(pConfig.sebConfigKey).trim().toLowerCase() : null
    const envKey = process.env.SEB_CONFIG_KEY ? process.env.SEB_CONFIG_KEY.trim().toLowerCase() : null
    const sebConfigKey = perExamKey || envKey || null
    return { sebRequired, sebConfigKey }
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

    // 6. Publish guard: if sebRequired is true, require a valid 64-hex key (per-exam or env)
    const pConfig = (exam.proctoringConfig && typeof exam.proctoringConfig === 'object') ? exam.proctoringConfig : {}
    if (pConfig.sebRequired) {
      const perExamKey = pConfig.sebConfigKey ? String(pConfig.sebConfigKey).trim() : null
      const envKey = process.env.SEB_CONFIG_KEY ? process.env.SEB_CONFIG_KEY.trim() : null
      const validPerExam = perExamKey && /^[0-9a-fA-F]{64}$/.test(perExamKey)
      const validEnv = envKey && /^[0-9a-fA-F]{64}$/.test(envKey)
      if (!validPerExam && !validEnv) {
        const err = new Error('Exam requires Safe Exam Browser but no valid Config Key is configured.')
        err.status = 400
        err.code = 'SEB_KEY_REQUIRED'
        throw err
      }
    }

    validateScheduleWindow(exam.startTime, exam.endTime, exam.durationMinutes || exam.duration || 60)
    const questions = await examsSql.getQuestionsByExamId(id, true)
    validateQuestionsList(questions)

    const updated = await examsSql.updateExamStatus(id, 'PUBLISHED')
    invalidateExamSebCache(id)
    return updated
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
module.exports = { examService, ExamService, toExamDto }
