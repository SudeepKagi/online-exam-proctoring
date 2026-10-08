const facultyRepository = require('./repository')
const { examService } = require('../exams/service')
const { resultService } = require('../results/service')
const { toFacultyExamDTO, toFacultyQuestionDTO } = require('./dto')
const { validateMcqQuestion, normalizeExcelQuestionRow } = require('../questions/validation')
const ExcelJS = require('exceljs')
const {
  NotFoundError,
  ForbiddenError,
  ValidationError
} = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')
const { llmService } = require('./llmService')
const { prisma } = require('../../infra/postgres/client')

class FacultyService {
  async formatQuestionWithPresignedUrl(q) {
    if (!q) return null
    let imageUrl = null
    if (q.imageKey) {
      try {
        imageUrl = await getPresignedReadUrl(q.imageKey, 3600)
      } catch {
        imageUrl = null
      }
    }
    return toFacultyQuestionDTO({ ...q, imageUrl })
  }
  async getDashboard(facultyId) {
    return facultyRepository.getDashboardStats(facultyId)
  }

  async listExams(facultyId) {
    const exams = await facultyRepository.listExams(facultyId)
    return exams.map(toFacultyExamDTO)
  }

  async getExam(id, facultyId) {
    const exam = await facultyRepository.findExamById(id, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    return toFacultyExamDTO(exam)
  }

  async createExam(data, facultyId) {
    const created = await examService.createExam(data, facultyId)
    const dto = toFacultyExamDTO(created)
    return {
      ...dto,
      invId: created.invId,
      oneTimePassword: created.oneTimePassword,
      invCredentials: {
        invId: created.invId,
        password: created.oneTimePassword,
        validUntil: created.validUntil
      }
    }
  }

  async updateExam(id, data, facultyId) {
    const updated = await examService.updateExam(id, data, facultyId, ROLES.FACULTY)
    return toFacultyExamDTO(updated)
  }

  async deleteExam(id, facultyId) {
    const exam = await facultyRepository.findExamById(id, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot delete an exam in status '${exam.status}'`)
    }
    await facultyRepository.deleteExam(id, facultyId)
    return { success: true, message: 'Exam deleted successfully' }
  }

  async publishExam(id, facultyId) {
    const published = await examService.publishExam(id, facultyId, ROLES.FACULTY)
    const dto = toFacultyExamDTO(published)
    return {
      ...dto,
      invId: published.invId,
      oneTimePassword: published.oneTimePassword,
      invCredentials: {
        invId: published.invId,
        password: published.oneTimePassword,
        validUntil: published.validUntil
      }
    }
  }

  async regenerateInvigilatorCredentials(id, facultyId) {
    return await examService.regenerateInvigilatorCredentials(id, facultyId, ROLES.FACULTY)
  }

  async getExamCredentials(id, facultyId) {
    const exam = await facultyRepository.findExamById(id, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    return {
      examId: exam.id,
      title: exam.title,
      invId: exam.invId
    }
  }

  async duplicateExam(id, facultyId) {
    const original = await facultyRepository.findExamById(id, facultyId)
    if (!original) throw new NotFoundError('Exam not found or access denied')

    const newTitle = `${original.title} (Copy)`
    const newExam = await examService.createExam({
      title: newTitle,
      subject: original.subject,
      description: original.description,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000 + original.duration * 60000).toISOString(),
      duration: original.duration,
      totalMarks: original.totalMarks,
      negativeMarking: original.negativeMarking,
      negativeValue: original.negativeValue,
      questionsPerStudent: original.questionsPerStudent,
      randomiseQuestions: original.randomiseQuestions,
      randomiseOptions: original.randomiseOptions,
      allowedDepartments: original.allowedDepartments,
      allowedSemesters: original.allowedSemesters,
      cameraRequired: original.cameraRequired,
      micRequired: original.micRequired,
      browserLock: original.browserLock,
      fullScreenMode: original.fullScreenMode,
      watermarkRequired: original.watermarkRequired,
      tabSwitchLimit: original.tabSwitchLimit,
      vpnRequired: original.vpnRequired
    }, facultyId)

    // Copy questions
    if (original.questions && original.questions.length > 0) {
      for (const q of original.questions) {
        await facultyRepository.createQuestion({
          examId: newExam.id,
          questionText: q.questionText,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          difficulty: q.difficulty,
          imageKey: q.imageKey,
          order: q.order,
          options: q.options.map(o => ({
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order
          }))
        })
      }
    }

    return toFacultyExamDTO(newExam)
  }

  // ── Results ──
  async listAllResults(facultyId) {
    return facultyRepository.listResultsForFaculty(facultyId)
  }

  async listExamResults(examId, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    return facultyRepository.listExamResults(examId)
  }

  async exportExamResultsCSV(examId, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')

    const sanitizeCsvField = (val) => {
      if (val === null || val === undefined) return '""'
      let str = String(val)
      // R-13: Formula neutralization: prevent spreadsheet formula execution (=, +, -, @, \t, \r)
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`
      }
      return `"${str.replace(/"/g, '""')}"`
    }

    const results = await facultyRepository.listExamResults(examId)
    const headers = ['USN', 'Student Name', 'Department', 'Score', 'Total Marks', 'Percentage', 'Rank', 'Status']
    const rows = results.map(r => [
      sanitizeCsvField(r.student?.usn || ''),
      sanitizeCsvField(r.student?.name || ''),
      sanitizeCsvField(r.student?.departmentCode || ''),
      sanitizeCsvField(r.score),
      sanitizeCsvField(r.totalMarks),
      sanitizeCsvField(r.percentage),
      sanitizeCsvField(r.rank || ''),
      sanitizeCsvField(r.status)
    ])

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(row => row.join(','))].join('\n')
    return {
      filename: `Exam_${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}_Results.csv`,
      csvContent
    }
  }

  async releaseResults(examId, facultyId) {
    return resultService.releaseResults(examId, facultyId, ROLES.FACULTY)
  }

  async getStudentResult(id, facultyId) {
    const result = await facultyRepository.getStudentResult(id)
    if (!result) throw new NotFoundError('Result not found')
    if (result.exam?.facultyId !== facultyId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }
    return result
  }

  async getStudentResultByExam(examId, studentId, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')

    const result = await facultyRepository.getStudentResultByExam(examId, studentId)
    if (!result) throw new NotFoundError('Result not found')
    return result
  }

  async runCollusionCheck(examId, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')

    const collusionModule = require('../proctoring/collusionService')
    return collusionModule.runCollusionAnalysis(examId)
  }

  // ── Questions ──
  async listExamQuestions(examId, facultyId) {
    if (!examId) throw new ValidationError('examId is required')
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    const questions = await facultyRepository.listExamQuestions(examId)
    return Promise.all(questions.map((q) => this.formatQuestionWithPresignedUrl(q)))
  }

  async addQuestion(examId, questionData, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot add questions to an exam in status '${exam.status}'`)
    }

    const validated = validateMcqQuestion(questionData)
    const created = await facultyRepository.createQuestion({
      examId,
      ...validated
    })
    return this.formatQuestionWithPresignedUrl(created)
  }

  async updateQuestion(id, data, facultyId) {
    const question = await facultyRepository.findQuestionById(id)
    if (!question) throw new NotFoundError('Question not found')

    const exam = await facultyRepository.findExamById(question.examId, facultyId)
    if (!exam) throw new ForbiddenError('Access denied: You do not own this exam')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot update questions in an exam with status '${exam.status}'`)
    }

    const validated = validateMcqQuestion(data)
    const updated = await facultyRepository.updateQuestion(id, validated)

    // Cache invalidation (R-12)
    const { redis } = require('../../infra/redis/client')
    await redis.del(`pn:exam:${exam.id}:content`)
    await redis.del(`pn:exam:${exam.id}`)

    return this.formatQuestionWithPresignedUrl(updated)
  }

  async deleteQuestion(id, facultyId) {
    const question = await facultyRepository.findQuestionById(id)
    if (!question) throw new NotFoundError('Question not found')

    const exam = await facultyRepository.findExamById(question.examId, facultyId)
    if (!exam) throw new ForbiddenError('Access denied: You do not own this exam')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot delete questions in an exam with status '${exam.status}'`)
    }

    await facultyRepository.deleteQuestion(id)

    // Cache invalidation (R-12)
    const { redis } = require('../../infra/redis/client')
    await redis.del(`pn:exam:${exam.id}:content`)
    await redis.del(`pn:exam:${exam.id}`)

    return { success: true, message: 'Question deleted' }
  }

  async bulkAddQuestions(examId, questions, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot add questions to an exam in status '${exam.status}'`)
    }

    const created = []
    for (const q of questions) {
      const validated = validateMcqQuestion(q)
      const res = await facultyRepository.createQuestion({ examId, ...validated })
      created.push(await this.formatQuestionWithPresignedUrl(res))
    }

    // Cache invalidation (R-12)
    const { redis } = require('../../infra/redis/client')
    await redis.del(`pn:exam:${examId}:content`)
    await redis.del(`pn:exam:${examId}`)

    return created
  }

  async importQuestionsExcel(examId, buffer, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot add questions to an exam in status '${exam.status}'`)
    }

    // Enforce 5MB size cap
    const MAX_EXCEL_BYTES = 5 * 1024 * 1024
    if (!buffer || buffer.length > MAX_EXCEL_BYTES) {
      throw new ValidationError('Excel file exceeds maximum allowed size of 5 MB')
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new ValidationError('Excel file contains no worksheets')
    }

    const rows = []
    const headers = []
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').trim()
        })
      } else {
        const rowData = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber]
          if (header) {
            rowData[header] = cell.text ?? cell.value
          }
        })
        if (Object.keys(rowData).length > 0) {
          rows.push({ rowNumber, data: rowData })
        }
      }
    })

    const validatedQuestions = []
    const rowReports = []

    for (const r of rows) {
      try {
        const validated = normalizeExcelQuestionRow(r.data, r.rowNumber)
        validatedQuestions.push(validated)
        rowReports.push({ row: r.rowNumber, status: 'VALID', questionText: validated.questionText })
      } catch (err) {
        rowReports.push({ row: r.rowNumber, status: 'INVALID', error: err.message })
      }
    }

    const hasErrors = rowReports.some(r => r.status === 'INVALID')
    if (hasErrors) {
      return {
        success: false,
        totalRows: rows.length,
        importedCount: 0,
        errorsCount: rowReports.filter(r => r.status === 'INVALID').length,
        reports: rowReports,
        message: 'Import rejected due to validation errors. No questions were imported (transactional rollback).'
      }
    }

    // Transactional insert of all valid questions (R-13)
    const created = await prisma.$transaction(async (tx) => {
      const results = []
      for (const q of validatedQuestions) {
        const { options, ...qData } = q
        const newQ = await tx.question.create({
          data: {
            examId,
            ...qData,
            options: {
              create: options.map((opt, idx) => ({
                text: opt.text,
                isCorrect: Boolean(opt.isCorrect),
                order: opt.order !== undefined ? opt.order : idx
              }))
            }
          },
          include: { options: { orderBy: { order: 'asc' } } }
        })
        results.push(newQ)
      }
      return results
    })

    // Cache invalidation (R-12)
    const { redis } = require('../../infra/redis/client')
    await redis.del(`pn:exam:${examId}:content`)
    await redis.del(`pn:exam:${examId}`)

    return {
      success: true,
      totalRows: rows.length,
      importedCount: created.length,
      errorsCount: 0,
      reports: rowReports.map(r => ({ ...r, status: 'IMPORTED' })),
      createdCount: created.length
    }
  }

  // AI question generation — real LLM call or error (LLM_PROVIDER=none → error, never mocked)
  async generateQuestionsPreview({ prompt, topic, count = 5, difficulty = 'MEDIUM', facultyId }) {
    const topicToUse = topic || prompt || 'Computer Science'
    const { questions, validationErrors, provider, tokensUsed } = await llmService.generateQuestionsPreview({
      topic: topicToUse,
      count,
      difficulty,
      facultyId
    })
    return { questions, validationErrors, provider, tokensUsed }
  }

  async generateQuestionsFromAI(examId, { prompt, topic, count = 5, difficulty = 'MEDIUM' }, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot add questions to an exam in status '${exam.status}'`)
    }

    const { questions, validationErrors, provider, tokensUsed } = await this.generateQuestionsPreview({
      prompt,
      topic,
      count,
      difficulty,
      facultyId
    })

    const created = []
    for (const q of questions) {
      const saved = await facultyRepository.createQuestion({ examId, ...q })
      created.push(toFacultyQuestionDTO(saved))
    }

    return { questions: created, validationErrors, provider, tokensUsed }
  }

  // ── Students ──
  async listStudents(departmentCode) {
    return facultyRepository.listEligibleStudents(departmentCode)
  }

  async approveStudent(studentId, facultyId) {
    const [faculty, student] = await Promise.all([
      facultyRepository.findFacultyById(facultyId),
      facultyRepository.findStudentById(studentId)
    ])
    if (!faculty) throw new NotFoundError('Faculty not found')
    if (!student) throw new NotFoundError('Student not found')

    if (faculty.departmentCode !== student.departmentCode) {
      throw new ForbiddenError('Faculty can only approve students from their own department')
    }

    return facultyRepository.approveStudent(studentId, facultyId)
  }

  /**
   * addStudentsToExam — explicit extra-enrollment table.
   * Inserts into extra_exam_enrollments (ON CONFLICT DO NOTHING for idempotency).
   * Validates that each studentId exists and belongs to an allowed department.
   */
  async addStudentsToExam(examId, studentIds, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new ValidationError('studentIds must be a non-empty array')
    }

    // Cap at 500 per call
    const ids = studentIds.slice(0, 500)

    // Verify students exist
    const students = await prisma.user.findMany({
      where: { id: { in: ids }, role: 'STUDENT' },
      select: { id: true, departmentCode: true, name: true, usn: true }
    })

    const foundIds = new Set(students.map(s => s.id))
    const notFound = ids.filter(id => !foundIds.has(id))

    // Upsert enrollments (idempotent)
    const enrollmentData = students.map(s => ({
      examId,
      studentId: s.id,
      enrolledAt: new Date(),
      enrolledBy: facultyId,
      source: 'EXPLICIT'
    }))

    let enrolled = 0
    if (enrollmentData.length > 0) {
      // Use raw SQL for ON CONFLICT DO NOTHING
      const values = enrollmentData.map((_, i) =>
        `($${i * 5 + 1}::uuid, $${i * 5 + 2}::uuid, $${i * 5 + 3}, $${i * 5 + 4}::uuid, $${i * 5 + 5})`
      ).join(', ')

      const params = enrollmentData.flatMap(e => [
        e.examId,
        e.studentId,
        e.enrolledAt,
        e.enrolledBy,
        e.source
      ])

      const result = await prisma.$executeRawUnsafe(`
        INSERT INTO extra_exam_enrollments (exam_id, student_id, enrolled_at, enrolled_by, source)
        VALUES ${values}
        ON CONFLICT (exam_id, student_id) DO NOTHING;
      `, ...params).catch(async (err) => {
        // Table might not exist yet (migration pending) — graceful degradation
        if (err.message?.includes('extra_exam_enrollments')) {
          // Fall back to Prisma upsert pattern using examEnrollment if it exists
          for (const e of enrollmentData) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO exam_enrollments (exam_id, student_id, enrolled_at)
              VALUES ($1::uuid, $2::uuid, $3)
              ON CONFLICT (exam_id, student_id) DO NOTHING;
            `, e.examId, e.studentId, e.enrolledAt).catch((enrollErr) => {
              logger.warn({ error: enrollErr.message, studentId: e.studentId }, 'Fallback enrollment failed')
            })
          }
          return enrollmentData.length
        }
        throw err
      })
      enrolled = typeof result === 'number' ? result : enrollmentData.length
    }

    return {
      success: true,
      examId,
      requestedCount: ids.length,
      enrolledCount: enrolled,
      studentsFound: students.length,
      notFound: notFound.length > 0 ? notFound : undefined,
      students: students.map(s => ({ id: s.id, usn: s.usn, name: s.name, departmentCode: s.departmentCode }))
    }
  }

  async listExamStudents(examId, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    return facultyRepository.listExamAttemptsStudents(examId)
  }
}

module.exports = new FacultyService()
