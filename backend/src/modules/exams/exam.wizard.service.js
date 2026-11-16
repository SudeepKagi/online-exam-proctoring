'use strict'

const bcrypt = require('bcryptjs')
const { prisma, withTransaction } = require('../../infra/postgres/client')
const { generateExamQuestions } = require('./ai.generator')
const { validateQuestionsList } = require('./exams.guard')
const { toExamDto } = require('./exams.service')
const {
  validateWindow,
  computeEnd,
  datetimeLocalToUtcIso
} = require('../../shared/scheduleUtils')
const { examDraftService } = require('./exam.draft.service')

// In-memory rate limiting map for AI generation per faculty: creatorId -> [timestamps]
const aiRateLimitMap = new Map()

class ExamWizardService {
  async generateFromPdf({
    pdfBase64,
    pdfBuffer,
    fileName,
    count = 10,
    difficulty = 'MEDIUM',
    topicHint,
    creatorId
  }) {
    // 1. Per-user rate limiting: 5 requests per hour
    if (creatorId) {
      const now = Date.now()
      const oneHourAgo = now - 3600000
      const history = (aiRateLimitMap.get(creatorId) || []).filter(ts => ts > oneHourAgo)
      if (history.length >= 5) {
        const nextAvailableMs = history[0] + 3600000
        const resetMinutes = Math.ceil((nextAvailableMs - now) / 60000)
        const err = new Error(`AI generation rate limit reached (5 requests/hour). Try again in ${resetMinutes} minute(s).`)
        err.status = 429
        err.code = 'RATE_LIMIT_EXCEEDED'
        throw err
      }
      history.push(now)
      aiRateLimitMap.set(creatorId, history)
    }

    let buffer = pdfBuffer
    if (!buffer && pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '')
      buffer = Buffer.from(cleanBase64, 'base64')
    }

    if (!buffer || buffer.length === 0) {
      const err = new Error('Valid PDF document is required')
      err.status = 400
      err.code = 'INVALID_PDF'
      throw err
    }

    // Size limit check: 10 MB
    if (buffer.length > 10 * 1024 * 1024) {
      const err = new Error('PDF file size exceeds maximum limit of 10 MB')
      err.status = 400
      err.code = 'FILE_TOO_LARGE'
      throw err
    }

    let extractedText
    try {
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      extractedText = parsed?.text || ''
    } catch (_) {
      // Fallback text extraction if pdf-parse encounters unusual stream encoding
      extractedText = buffer.toString('utf-8').replace(/[^a-zA-Z0-9\s.,?!;:()\-_/]/g, ' ')
    }

    // Sanitize untrusted document text: remove HTML tags, normalize whitespace, cap length
    extractedText = (extractedText || '')
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const cleanTopic = topicHint || (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : null) || 'Engineering Subject'

    const genResult = await generateExamQuestions({
      topic: cleanTopic,
      syllabusText: extractedText.slice(0, 4000),
      difficulty,
      count: parseInt(count, 10) || 10,
      isPdfExtraction: true
    })

    return {
      status: 'success',
      source: genResult.source,
      topic: genResult.subject || cleanTopic,
      metadata: {
        title: genResult.title || `${cleanTopic} Examination`,
        courseCode: genResult.courseCode || 'EXM101',
        subject: genResult.subject || cleanTopic,
        description: genResult.description || '',
        studentInstructions: genResult.studentInstructions || '',
        suggestedDuration: genResult.suggestedDuration || 60,
        markingScheme: genResult.markingScheme || { positive: 1, negative: 0 }
      },
      count: genResult.questions ? genResult.questions.length : 0,
      questions: genResult.questions || []
    }
  }

  async publishWizard(creatorId, data = {}) {
    const {
      title, courseCode, subjectCode, description,
      startTime, startTimeUtc, timezone = 'Asia/Kolkata', lateEntryMinutes = 15,
      durationMinutes = 60, department, semester, examCode,
      invigilatorId, invigilatorPassword, invigilatorCredentials = {},
      questions = []
    } = data

    const cCode = courseCode || subjectCode
    if (!title || !cCode) {
      const err = new Error('Subject name and subject code are required')
      err.status = 400
      err.code = 'VALIDATION_ERROR'
      throw err
    }

    // Standardize start time to UTC ISO
    let startUtcIso = null
    if (startTimeUtc && typeof startTimeUtc === 'string') {
      startUtcIso = startTimeUtc
    } else if (startTime && typeof startTime === 'string') {
      if (startTime.endsWith('Z')) {
        startUtcIso = startTime
      } else {
        // datetime-local input without timezone designator
        try {
          startUtcIso = datetimeLocalToUtcIso(startTime, timezone)
        } catch (_) {
          startUtcIso = new Date(startTime).toISOString()
        }
      }
    }

    if (!startUtcIso) {
      const err = new Error('Start date & time is required')
      err.status = 400
      err.code = 'INVALID_EXAM_WINDOW'
      throw err
    }

    const dur = durationMinutes !== undefined && durationMinutes !== null ? Number(durationMinutes) : 60
    const late = Number(lateEntryMinutes) >= 0 ? Number(lateEntryMinutes) : 15

    // Validate schedule window using centralized scheduleUtils
    const windowValidation = validateWindow(startUtcIso, dur, late, Date.now())
    if (!windowValidation.valid) {
      const err = new Error(windowValidation.message)
      err.status = 400
      err.code = windowValidation.errorCode || 'INVALID_EXAM_WINDOW'
      throw err
    }

    validateQuestionsList(questions)

    // Check SEB requirements
    const pConfigInput = (data.proctoringConfig && typeof data.proctoringConfig === 'object') ? data.proctoringConfig : {}
    const sebRequired = Boolean(data.sebRequired !== undefined ? data.sebRequired : pConfigInput.sebRequired)
    if (sebRequired) {
      const perExamKey = data.sebConfigKey || pConfigInput.sebConfigKey
      const envKey = process.env.SEB_CONFIG_KEY
      const validPerExam = perExamKey && /^[0-9a-fA-F]{64}$/.test(String(perExamKey).trim())
      const validEnv = envKey && /^[0-9a-fA-F]{64}$/.test(String(envKey).trim())
      if (!validPerExam && !validEnv) {
        const err = new Error('Exam requires Safe Exam Browser but no valid Config Key is configured.')
        err.status = 400
        err.code = 'SEB_KEY_REQUIRED'
        throw err
      }
    }

    const start = new Date(startUtcIso)
    const { endUtcIso } = computeEnd(startUtcIso, dur, late)
    const end = new Date(endUtcIso)

    const cleanExamCode = examCode || `EXM-${cCode}-${Math.floor(100 + Math.random() * 900)}`
    const invId = invigilatorId || invigilatorCredentials.institutionId || invigilatorCredentials.loginId || `INV-${cCode}-${Math.floor(100 + Math.random() * 900)}`
    const invPass = invigilatorPassword || invigilatorCredentials.password || Math.random().toString(36).slice(-8)
    const invRoom = invigilatorCredentials.room || 'Main Examination Hall'

    const result = await withTransaction(async (tx) => {
      const db = tx || prisma
      const exam = await db.exam.create({
        data: {
          title,
          courseCode: cCode,
          createdById: creatorId,
          startTime: start,
          endTime: end,
          durationMinutes: dur,
          status: 'PUBLISHED',
          proctoringConfig: {
            description: description || null,
            department: department || null,
            semester: semester || null,
            examCode: cleanExamCode,
            timezone,
            lateEntryMinutes: late,
            invigilatorCredentials: {
              institutionId: invId,
              loginId: invId,
              invigilatorId: invId,
              password: invPass,
              passwordHint: invPass,
              room: invRoom
            },
            cameraRequired: true,
            fullScreenMode: true,
            browserLock: true,
            sebRequired,
            ...(data.sebConfigKey || pConfigInput.sebConfigKey
              ? { sebConfigKey: String(data.sebConfigKey || pConfigInput.sebConfigKey).trim().toLowerCase() }
              : {})
          }
        }
      })

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        await db.question.create({
          data: {
            examId: exam.id,
            questionText: q.questionText,
            options: q.options || [],
            correctOptionIndex: Number(q.correctOptionIndex) || 0,
            marks: Number(q.marks) || 1,
            negativeMarks: Number(q.negativeMarks) || 0,
            displayOrder: i
          }
        })
      }

      const activeStudents = await db.user.findMany({ where: { role: 'STUDENT', status: 'ACTIVE' } })
      const targetSem = semester ? String(semester).replace(/sem\s*/i, '').trim() : null
      let assignedCount = 0

      for (const st of activeStudents) {
        const meta = st.profileMetadata || {}
        const matchesDept = !department ||
          String(meta.department || '').toLowerCase().includes(department.toLowerCase()) ||
          department.toLowerCase().includes(String(meta.department || '').toLowerCase())
        const sSem = String(meta.semester || '').replace(/sem\s*/i, '').trim()
        const matchesSem = !targetSem || sSem === targetSem

        if (matchesDept && matchesSem) {
          await db.examAssignment.upsert({
            where: { examId_userId: { examId: exam.id, userId: st.id } },
            create: { examId: exam.id, userId: st.id, assignedRole: 'STUDENT' },
            update: { assignedRole: 'STUDENT' }
          })
          assignedCount++
        }
      }

      const invEmail = `${invId.toLowerCase().replace(/[^a-z0-9]/g, '')}@proctornet.local`
      const passwordHash = await bcrypt.hash(invPass, 12)
      const invProfile = { examId: exam.id, examCode: cleanExamCode, generatedPasswordHint: invPass, room: invRoom }

      let invUser = await db.user.findFirst({
        where: { OR: [{ institutionId: invId }, { email: invEmail }] }
      })

      if (invUser) {
        invUser = await db.user.update({
          where: { id: invUser.id },
          data: { passwordHash, status: 'ACTIVE', profileMetadata: { ...(invUser.profileMetadata || {}), ...invProfile } }
        })
      } else {
        invUser = await db.user.create({
          data: {
            email: invEmail,
            institutionId: invId,
            fullName: `Invigilator (${cCode} - ${invRoom})`,
            role: 'INVIGILATOR',
            status: 'ACTIVE',
            passwordHash,
            profileMetadata: invProfile
          }
        })
      }

      await db.examAssignment.upsert({
        where: { examId_userId: { examId: exam.id, userId: invUser.id } },
        create: { examId: exam.id, userId: invUser.id, assignedRole: 'INVIGILATOR' },
        update: { assignedRole: 'INVIGILATOR' }
      })

      try {
        const { redisClient } = require('../../infra/redis/client')
        const sanitized = questions.map(q => ({ questionText: q.questionText, options: q.options, marks: q.marks || 1 }))
        await redisClient.set(`exam:${exam.id}:questions`, JSON.stringify(sanitized), 'EX', 86400)
      } catch (_) {}

      return {
        exam: toExamDto(exam, { role: 'FACULTY', id: creatorId }),
        questionsCount: questions.length,
        assignedCount,
        invigilator: { id: invUser.id, institutionId: invId, password: invPass, room: invRoom }
      }
    })

    // 4. Delete saved draft upon successful publication
    if (creatorId) {
      await examDraftService.deleteDraft(creatorId).catch(() => {})
    }

    return result
  }
}

const examWizardService = new ExamWizardService()
module.exports = { examWizardService, ExamWizardService }
