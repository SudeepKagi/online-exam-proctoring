'use strict'

const bcrypt = require('bcryptjs')
const { prisma, withTransaction } = require('../../infra/postgres/client')
const { ROLES, normalizeRole } = require('../../shared/roles')
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
  async extractPdfText({ pdfBase64, pdfBuffer }) {
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

    const { PDFParse } = require('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    let parsed
    try {
      parsed = await parser.getText()
    } catch (_) {
      // Fallback text extraction if format is unusual
      const fallbackText = buffer.toString('utf-8').replace(/[^a-zA-Z0-9\s.,?!;:()\-_/]/g, ' ')
      parsed = {
        total: 1,
        pages: [{ num: 1, text: fallbackText }],
        text: fallbackText
      }
    } finally {
      await parser.destroy().catch(() => {})
    }

    const rawPages = parsed?.pages || []
    const totalPages = parsed?.total || rawPages.length || 1

    const pages = []
    let totalWords = 0
    let readablePages = 0

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1
      const pageObj = rawPages.find(p => p.num === pageNum) || rawPages[i]
      const rawText = (pageObj?.text || '')
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const words = rawText.split(/\s+/).filter(w => w.length > 0)
      const wordCount = words.length
      const isReadable = wordCount >= 10

      if (isReadable) {
        readablePages++
        totalWords += wordCount
      }

      pages.push({
        pageNumber: pageNum,
        text: rawText,
        wordCount,
        isReadable,
        flag: isReadable ? null : 'unreadable'
      })
    }

    const minWords = parseInt(process.env.AI_MIN_SUBSTANTIVE_WORDS, 10) || 300
    if (totalWords < minWords) {
      const err = new Error("We couldn't read text from this PDF. Upload a text-based PDF or paste the text")
      err.status = 400
      err.code = 'INSUFFICIENT_SOURCE_TEXT'
      err.details = {
        totalWords,
        minWordsRequired: minWords,
        totalPages,
        readablePages
      }
      throw err
    }

    const combinedText = pages.filter(p => p.isReadable).map(p => p.text).join('\n\n')

    return {
      text: combinedText,
      pages,
      totalPages,
      readablePages,
      totalWords,
      summary: `Read ${readablePages} of ${totalPages} pages, about ${totalWords.toLocaleString()} words`
    }
  }

  async generateFromPdf({
    pdfBase64,
    pdfBuffer,
    fileName,
    count = 10,
    difficulty = 'MEDIUM',
    difficultySplit,
    focus,
    optionsPerQuestion,
    allowMultiple,
    language,
    explanations,
    avoidDuplicates,
    isExtractMode,
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

    const extracted = await this.extractPdfText({ pdfBase64, pdfBuffer })

    const cleanTopic = topicHint || (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : null) || 'Engineering Subject'

    const genResult = await generateExamQuestions({
      topic: cleanTopic,
      syllabusText: extracted.text.slice(0, 30000),
      pages: extracted.pages,
      difficulty,
      difficultySplit,
      count: parseInt(count, 10) || 10,
      focus,
      optionsPerQuestion: optionsPerQuestion || 4,
      allowMultiple: Boolean(allowMultiple),
      language: language || 'same as material',
      explanations: explanations !== false,
      avoidDuplicates: avoidDuplicates !== false,
      isExtractMode: Boolean(isExtractMode)
    })

    const questions = genResult.questions || []
    const coveredPages = Array.from(new Set(questions.map(q => Number(q.sourcePage) || 1))).sort((a, b) => a - b)
    const coveragePercent = Math.round((coveredPages.length / Math.max(1, extracted.readablePages)) * 100)

    const sourceCoverage = {
      coveredPages,
      totalPages: extracted.totalPages,
      readablePages: extracted.readablePages,
      coveragePercent
    }

    return {
      status: 'success',
      source: genResult.source,
      topic: genResult.subject || cleanTopic,
      extractionSummary: extracted.summary,
      sourceCoverage,
      metadata: {
        title: genResult.title || `${cleanTopic} Examination`,
        courseCode: genResult.courseCode || '',
        subject: genResult.subject || cleanTopic,
        description: genResult.description || '',
        studentInstructions: genResult.studentInstructions || '',
        suggestedDuration: genResult.suggestedDuration || 60,
        markingScheme: genResult.markingScheme || { positive: 1, negative: 0 }
      },
      count: questions.length,
      questions,
      honestyNote: genResult.honestyNote,
      aiAudit: {
        ...genResult.aiAudit,
        sourceCoverage
      }
    }
  }

  async publishWizard(creatorId, data = {}, userRole = null) {
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

    // Check SEB requirements using unified institution state
    const pConfigInput = (data.proctoringConfig && typeof data.proctoringConfig === 'object') ? data.proctoringConfig : {}
    const sebRequired = Boolean(data.sebRequired !== undefined ? data.sebRequired : pConfigInput.sebRequired)
    if (sebRequired) {
      const perExamKey = data.sebConfigKey || pConfigInput.sebConfigKey
      const validPerExam = perExamKey && /^[0-9a-fA-F]{64}$/.test(String(perExamKey).trim())
      const { getInstitutionSebState } = require('../seb/seb.service')
      const sebState = await getInstitutionSebState()

      if (!validPerExam && !sebState.configured) {
        let role = userRole
        if (!role && creatorId) {
          try {
            const u = await prisma.user.findUnique({ where: { id: creatorId }, select: { role: true } })
            role = u?.role
          } catch (_) {}
        }
        const normRole = normalizeRole(role)
        const isFaculty = normRole === ROLES.FACULTY || !normRole || normRole !== ROLES.ADMIN
        const msg = isFaculty
          ? 'Exam requires Safe Exam Browser but it is not configured yet. Ask your administrator to finish Secure Browser setup.'
          : 'Exam requires Safe Exam Browser but it is not configured yet. Configure it under Admin → Secure Browser.'
        const err = new Error(msg)
        err.status = 400
        err.code = 'SEB_KEY_REQUIRED'
        err.link = '/admin/seb'
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
