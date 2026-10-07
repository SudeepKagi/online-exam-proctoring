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

    const results = await facultyRepository.listExamResults(examId)
    const headers = ['USN', 'Student Name', 'Department', 'Score', 'Total Marks', 'Percentage', 'Rank', 'Status']
    const rows = results.map(r => [
      r.student?.usn || '',
      `"${r.student?.name || ''}"`,
      r.student?.departmentCode || '',
      r.score,
      r.totalMarks,
      r.percentage,
      r.rank || '',
      r.status
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
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
    const validated = validateMcqQuestion(data)
    const updated = await facultyRepository.updateQuestion(id, validated)
    return this.formatQuestionWithPresignedUrl(updated)
  }

  async deleteQuestion(id, facultyId) {
    await facultyRepository.deleteQuestion(id)
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
          rows.push(rowData)
        }
      }
    })

    const created = []
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      try {
        const validated = normalizeExcelQuestionRow(rows[i], i + 1)
        const q = await facultyRepository.createQuestion({ examId, ...validated })
        created.push(await this.formatQuestionWithPresignedUrl(q))
      } catch (err) {
        errors.push({ row: i + 1, error: err.message })
      }
    }

    return {
      success: true,
      totalRows: rows.length,
      importedCount: created.length,
      errorsCount: errors.length,
      created,
      errors
    }
  }

  // AI question generation fallback
  generateFallbackAiQuestions(topic = 'General Computing', count = 5, difficulty = 'MEDIUM') {
    const sampleQuestions = [
      {
        questionText: `What is the primary function of an operating system kernel regarding ${topic}?`,
        marks: 2,
        negativeMarks: 0.5,
        difficulty,
        options: [
          { text: 'Resource abstraction and hardware management', isCorrect: true, order: 0 },
          { text: 'Compiling source code to machine binaries', isCorrect: false, order: 1 },
          { text: 'Rendering user interfaces on the GPU', isCorrect: false, order: 2 },
          { text: 'Managing external DNS records', isCorrect: false, order: 3 }
        ]
      },
      {
        questionText: `Which algorithmic time complexity is most optimal for searching in an indexed balanced binary tree for ${topic}?`,
        marks: 2,
        negativeMarks: 0.5,
        difficulty,
        options: [
          { text: 'O(log N)', isCorrect: true, order: 0 },
          { text: 'O(N)', isCorrect: false, order: 1 },
          { text: 'O(N log N)', isCorrect: false, order: 2 },
          { text: 'O(1)', isCorrect: false, order: 3 }
        ]
      },
      {
        questionText: `In relational database theory, which normal form eliminates transitive dependencies?`,
        marks: 3,
        negativeMarks: 1,
        difficulty,
        options: [
          { text: 'Third Normal Form (3NF)', isCorrect: true, order: 0 },
          { text: 'First Normal Form (1NF)', isCorrect: false, order: 1 },
          { text: 'Second Normal Form (2NF)', isCorrect: false, order: 2 },
          { text: 'Boyce-Codd Normal Form (BCNF)', isCorrect: false, order: 3 }
        ]
      },
      {
        questionText: `What is the idempotency property of HTTP PUT compared to POST in REST APIs?`,
        marks: 2,
        negativeMarks: 0.5,
        difficulty,
        options: [
          { text: 'Multiple identical PUT requests have the same side effect as a single request', isCorrect: true, order: 0 },
          { text: 'PUT requests cannot alter server state under any circumstances', isCorrect: false, order: 1 },
          { text: 'PUT always creates a brand new unique resource ID', isCorrect: false, order: 2 },
          { text: 'POST is guaranteed to be safe and read-only', isCorrect: false, order: 3 }
        ]
      },
      {
        questionText: `Which TCP flag is used to initiate a three-way connection handshake?`,
        marks: 2,
        negativeMarks: 0.5,
        difficulty,
        options: [
          { text: 'SYN', isCorrect: true, order: 0 },
          { text: 'ACK', isCorrect: false, order: 1 },
          { text: 'FIN', isCorrect: false, order: 2 },
          { text: 'RST', isCorrect: false, order: 3 }
        ]
      }
    ]

    return sampleQuestions.slice(0, count)
  }

  async generateQuestionsPreview({ prompt, topic, count = 5, difficulty = 'MEDIUM' }) {
    const topicToUse = topic || prompt || 'Computer Science'
    const questions = this.generateFallbackAiQuestions(topicToUse, count, difficulty)
    return questions.map(validateMcqQuestion)
  }

  async generateQuestionsFromAI(examId, { prompt, topic, count = 5, difficulty = 'MEDIUM' }, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    if (exam.status !== 'DRAFT') {
      throw new ValidationError(`Cannot add questions to an exam in status '${exam.status}'`)
    }

    const preview = await this.generateQuestionsPreview({ prompt, topic, count, difficulty })
    const created = []
    for (const q of preview) {
      const saved = await facultyRepository.createQuestion({ examId, ...q })
      created.push(toFacultyQuestionDTO(saved))
    }

    return created
  }

  // ── Students ──
  async listStudents(departmentCode) {
    return facultyRepository.listEligibleStudents(departmentCode)
  }

  async approveStudent(studentId, facultyId) {
    return facultyRepository.approveStudent(studentId, facultyId)
  }

  async addStudentsToExam(examId, studentIds, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    return { success: true, examId, count: studentIds.length }
  }

  async listExamStudents(examId, facultyId) {
    const exam = await facultyRepository.findExamById(examId, facultyId)
    if (!exam) throw new NotFoundError('Exam not found or access denied')
    return facultyRepository.listExamAttemptsStudents(examId)
  }
}

module.exports = new FacultyService()
