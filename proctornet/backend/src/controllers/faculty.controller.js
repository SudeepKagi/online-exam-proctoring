const examService = require('../services/examService')
const questionService = require('../services/questionService')
const resultService = require('../services/resultService')
const collusionService = require('../services/collusionService')
const studentService = require('../services/studentService')
const { logAudit } = require('../utils/auditLogger')
const { getClientIp } = require('../utils/helpers')

/**
 * Faculty Controller
 * Thin HTTP adapter mapping requests to domain services.
 */

// ════════════════════════════════════════════════════
// DASHBOARD & EXAM LIFECYCLE
// ════════════════════════════════════════════════════

async function getDashboardStats(req, res) {
  try {
    const stats = await examService.getFacultyDashboardStats(req.user.id)
    res.json(stats)
  } catch (e) {
    console.error('[getDashboardStats]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function createExam(req, res) {
  try {
    const exam = await examService.createExam({
      facultyId: req.user.id,
      data: req.body
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'EXAM_CREATED',
      details: `Created exam "${exam.title}" (${exam.id})`,
      ipAddress: getClientIp(req)
    })
    res.status(201).json({ message: 'Exam created successfully.', exam })
  } catch (e) {
    console.error('[createExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function listExams(req, res) {
  try {
    const exams = await examService.listFacultyExams(req.user.id)
    res.json({ exams })
  } catch (e) {
    console.error('[listExams]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function getExam(req, res) {
  try {
    const exam = await examService.getExamById({
      id: req.params.id,
      facultyId: req.user.id
    })
    res.json({ exam })
  } catch (e) {
    console.error('[getExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function updateExam(req, res) {
  try {
    const exam = await examService.updateExamById({
      id: req.params.id,
      facultyId: req.user.id,
      data: req.body
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'EXAM_UPDATED',
      details: `Updated exam ${req.params.id}`,
      ipAddress: getClientIp(req)
    })
    res.json({ message: 'Exam updated.', exam })
  } catch (e) {
    console.error('[updateExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function deleteExam(req, res) {
  try {
    const result = await examService.deleteExamById({
      id: req.params.id,
      facultyId: req.user.id
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'EXAM_DELETED',
      details: `Deleted exam ${req.params.id}`,
      ipAddress: getClientIp(req)
    })
    res.json(result)
  } catch (e) {
    console.error('[deleteExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function duplicateExam(req, res) {
  try {
    const exam = await examService.duplicateExamById({
      id: req.params.id,
      facultyId: req.user.id
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'EXAM_DUPLICATED',
      details: `Duplicated exam ${req.params.id} -> ${exam.id}`,
      ipAddress: getClientIp(req)
    })
    res.status(201).json({ message: 'Exam duplicated successfully.', exam })
  } catch (e) {
    console.error('[duplicateExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function publishExam(req, res) {
  try {
    const result = await examService.publishExamById({
      id: req.params.id,
      facultyId: req.user.id
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'EXAM_PUBLISHED',
      details: `Published Exam ${req.params.id}`,
      ipAddress: getClientIp(req)
    })
    res.json({
      success: true,
      message: 'Exam published successfully',
      exam: result.exam,
      invCredentials: result.invCredentials
    })
  } catch (e) {
    console.error('[publishExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to publish exam.' })
  }
}

async function getExamCredentials(req, res) {
  try {
    const result = await examService.getExamCredentialsById({
      id: req.params.id,
      facultyId: req.user.id
    })
    res.json(result)
  } catch (e) {
    console.error('[getExamCredentials]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve credentials.' })
  }
}

async function releaseResults(req, res) {
  try {
    const exam = await examService.toggleReleaseResults({
      id: req.params.id,
      facultyId: req.user.id,
      release: req.body.release
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'RESULTS_RELEASE_TOGGLED',
      details: `Exam ${req.params.id}: resultsReleased=${exam.resultsReleased}`,
      ipAddress: getClientIp(req)
    })
    res.json({
      message: exam.resultsReleased ? 'Results are now visible to students.' : 'Results are hidden from students.',
      resultsReleased: exam.resultsReleased,
      exam
    })
  } catch (e) {
    console.error('[releaseResults]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// QUESTIONS MANAGEMENT
// ════════════════════════════════════════════════════

async function addQuestion(req, res) {
  try {
    const question = await questionService.addQuestionToExam({
      examId: req.params.examId || req.body.examId,
      facultyId: req.user.id,
      data: req.body
    })
    res.status(201).json({ message: 'Question added.', question })
  } catch (e) {
    console.error('[addQuestion]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function listQuestions(req, res) {
  try {
    const questions = await questionService.listQuestionsForExam(req.params.examId)
    res.json({ questions })
  } catch (e) {
    console.error('[listQuestions]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function listExamQuestions(req, res) {
  return listQuestions(req, res)
}

async function updateQuestion(req, res) {
  try {
    const question = await questionService.updateQuestionById({
      id: req.params.id,
      facultyId: req.user.id,
      data: req.body
    })
    res.json({ message: 'Question updated.', question })
  } catch (e) {
    console.error('[updateQuestion]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function deleteQuestion(req, res) {
  try {
    const result = await questionService.deleteQuestionById({
      id: req.params.id,
      facultyId: req.user.id
    })
    res.json(result)
  } catch (e) {
    console.error('[deleteQuestion]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function bulkAddQuestions(req, res) {
  try {
    const questions = await questionService.bulkAddQuestionsToExam({
      examId: req.params.examId,
      facultyId: req.user.id,
      questions: req.body.questions
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'QUESTIONS_BULK_ADDED',
      details: `${questions.length} questions to exam ${req.params.examId}`,
      ipAddress: getClientIp(req)
    })
    res.status(201).json({ message: `${questions.length} questions added.`, count: questions.length, questions })
  } catch (e) {
    console.error('[bulkAddQuestions]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function generateQuestionsPreview(req, res) {
  try {
    const result = await questionService.generateAIQuestionsPreview(req.body)
    res.json({ success: true, questions: result.questions, source: result.source })
  } catch (e) {
    console.error('[generateQuestionsPreview]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to generate AI questions' })
  }
}

async function generateQuestionsFromAI(req, res) {
  try {
    const questions = await questionService.generateAndSaveAIQuestions({
      examId: req.params.examId,
      facultyId: req.user.id,
      ...req.body
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'AI_QUESTIONS_GENERATED',
      details: `${questions.length} questions for exam ${req.params.examId}`
    })
    res.json({
      success: true,
      message: `Successfully generated ${questions.length} AI questions`,
      questions
    })
  } catch (e) {
    console.error('[generateQuestionsFromAI]', e)
    res.status(e.status || 500).json({ error: e.message || 'Failed to generate AI questions' })
  }
}

// ════════════════════════════════════════════════════
// ENROLLMENT & CANDIDATE MANAGEMENT
// ════════════════════════════════════════════════════

async function addStudentsToExam(req, res) {
  try {
    const result = await examService.addStudentsToExamList({
      examId: req.params.id,
      facultyId: req.user.id,
      studentIds: req.body.studentIds
    })
    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'STUDENTS_ENROLLED',
      details: `Enrolled students to exam ${req.params.id}`,
      ipAddress: getClientIp(req)
    })
    res.json(result)
  } catch (e) {
    console.error('[addStudentsToExam]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function listExamStudents(req, res) {
  try {
    const studentExams = await examService.listStudentsInExam({
      examId: req.params.id,
      facultyId: req.user.id
    })
    res.json({ students: studentExams })
  } catch (e) {
    console.error('[listExamStudents]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function listStudents(req, res) {
  try {
    const result = await studentService.listDepartmentStudents(req.query)
    res.json(result)
  } catch (e) {
    console.error('[faculty listStudents]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function approveStudent(req, res) {
  try {
    const { id } = req.params
    const result = await studentService.approveStudentByFaculty({
      studentId: id,
      facultyId: req.user.id
    })

    logAudit({
      userId: req.user.id,
      userRole: 'faculty',
      action: 'STUDENT_APPROVED',
      details: `Approved student ${result.original.usn}`
    })

    res.json({ message: 'Student approved.', student: result.student })
  } catch (e) {
    console.error('[faculty approveStudent]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

// ════════════════════════════════════════════════════
// RESULTS, COLLUSION & EXPORTS
// ════════════════════════════════════════════════════

async function listExamResults(req, res) {
  try {
    const results = await resultService.listResultsForExam({
      examId: req.params.id,
      facultyId: req.user.id
    })
    res.json({ results })
  } catch (e) {
    console.error('[listExamResults]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function listAllResults(req, res) {
  try {
    const results = await resultService.listAllResultsForFaculty(req.user.id)
    res.json({ results })
  } catch (e) {
    console.error('[listAllResults]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function getStudentResult(req, res) {
  try {
    const { examId, studentId } = req.params
    const result = await resultService.getDetailedStudentResult({
      examId,
      studentId,
      facultyId: req.user.id
    })
    res.json(result)
  } catch (e) {
    console.error('[getStudentResult]', e)
    res.status(e.status || 500).json({ error: e.message || 'Server error.' })
  }
}

async function runCollusionCheck(req, res) {
  try {
    const result = await collusionService.checkCollusionForExam(req.params.id)
    res.json(result)
  } catch (error) {
    console.error('[runCollusionCheck]', error)
    res.status(500).json({ error: 'Collusion check failed.' })
  }
}

async function exportExamResultsCSV(req, res) {
  try {
    const csv = await resultService.exportExamResultsToCSV({
      examId: req.params.id,
      facultyId: req.user.id
    })
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="Exam_${req.params.id}_Results_Report.csv"`)
    return res.status(200).send(csv)
  } catch (err) {
    console.error('[exportExamResultsCSV]', err)
    return res.status(err.status || 500).json({ error: 'Failed to export CSV: ' + err.message })
  }
}

module.exports = {
  getDashboardStats,
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
  duplicateExam,
  publishExam,
  getExamCredentials,
  addQuestion,
  listQuestions,
  listExamQuestions,
  updateQuestion,
  deleteQuestion,
  bulkAddQuestions,
  addStudentsToExam,
  listExamStudents,
  listExamResults,
  listAllResults,
  releaseResults,
  listStudents,
  approveStudent,
  runCollusionCheck,
  getStudentResult,
  generateQuestionsFromAI,
  generateQuestionsPreview,
  exportExamResultsCSV,
}
