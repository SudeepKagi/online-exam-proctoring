const bcrypt = require('bcryptjs')

/**
 * Student Service
 * Encapsulates candidate exam discovery, session lifecycle, answer autosave, auto-grading, and profile management.
 */

async function listExamsForStudent(studentId) {
  const student = await global.prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, department: true, semester: true }
  })
  if (!student) {
    const error = new Error('Student not found')
    error.status = 404
    throw error
  }

  const studentDept = (student.department || '').toLowerCase()
  const studentSem = student.semester

  const exams = await global.prisma.exam.findMany({
    where: {
      status: { in: ['PUBLISHED', 'ACTIVE', 'SCHEDULED', 'IN_PROGRESS'] }
    },
    select: {
      id: true,
      title: true,
      subject: true,
      description: true,
      startTime: true,
      endTime: true,
      duration: true,
      totalMarks: true,
      status: true,
      cameraRequired: true,
      browserLock: true,
      allowedDepartments: true,
      allowedSemesters: true,
      faculty: { select: { name: true } },
      _count: { select: { questions: true } },
      studentExams: {
        where: { studentId },
        select: { status: true }
      }
    },
    orderBy: { startTime: 'asc' },
    take: 100
  })

  const DEPT_ALIASES = {
    ece: ['ece', 'ec', 'electronics', 'electronics & communication', 'electronics and communication', 'electronics & communication engineering', 'electronics and communication engineering'],
    cse: ['cse', 'cs', 'computer science', 'computer science & engineering', 'computer science and engineering'],
    ise: ['ise', 'is', 'information science', 'information science & engineering', 'information technology', 'it'],
    aiml: ['aiml', 'ai', 'ai & ml', 'ai/ml', 'artificial intelligence', 'artificial intelligence and machine learning'],
    mech: ['mech', 'me', 'mechanical', 'mechanical engineering'],
    civil: ['civil', 'cv', 'civil engineering'],
    eee: ['eee', 'ee', 'electrical', 'electrical and electronics', 'electrical & electronics engineering'],
  }

  const checkDeptMatch = (allowedDepts, sDept) => {
    if (!allowedDepts || allowedDepts.length === 0) return true
    if (!sDept) return true
    const s = sDept.toLowerCase().trim()

    return allowedDepts.some(rawDept => {
      const d = rawDept.toLowerCase().trim()
      if (d === s || s.includes(d) || d.includes(s)) return true

      for (const aliases of Object.values(DEPT_ALIASES)) {
        const dMatches = aliases.some(a => a === d || d.includes(a) || a.includes(d))
        const sMatches = aliases.some(a => a === s || s.includes(a) || a.includes(s))
        if (dMatches && sMatches) return true
      }
      return false
    })
  }

  const filtered = exams.filter(e => {
    // 1. Department match
    if (!checkDeptMatch(e.allowedDepartments, studentDept)) return false

    // 2. Semester match
    if (!e.allowedSemesters || e.allowedSemesters.length === 0) return true
    const semList = e.allowedSemesters.map(Number)
    return semList.includes(Number(studentSem))
  })

  const formatted = filtered.map(e => ({
    id: e.id,
    title: e.title,
    subject: e.subject,
    description: e.description,
    startTime: e.startTime,
    endTime: e.endTime,
    duration: e.duration,
    totalMarks: e.totalMarks,
    status: e.status,
    cameraRequired: e.cameraRequired,
    browserLock: e.browserLock,
    faculty: e.faculty,
    questionCount: e._count?.questions || 0,
    _count: e._count,
    studentStatus: e.studentExams?.[0]?.status || 'NOT_JOINED'
  }))

  return formatted
}

async function getExamDetailsForStudent(examId) {
  const exam = await global.prisma.exam.findUnique({
    where: { id: examId },
    include: { faculty: { select: { name: true } } }
  })
  if (!exam) {
    const error = new Error('Exam not found')
    error.status = 404
    throw error
  }
  return exam
}

async function getExamLobbyData({ examId, studentId }) {
  const exam = await global.prisma.exam.findUnique({
    where: { id: examId },
    include: { faculty: { select: { name: true, department: true } } }
  })
  if (!exam) {
    const error = new Error('Exam not found')
    error.status = 404
    throw error
  }

  const student = await global.prisma.student.findUnique({ where: { id: studentId } })
  const isEligible = exam.allowedDepartments && exam.allowedDepartments.length > 0
    ? exam.allowedDepartments.includes(student?.department)
    : true

  const chatMessagesRaw = await global.prisma.chatMessage.findMany({
    where: { examId, studentId },
    orderBy: { timestamp: 'asc' },
    take: 50
  }).catch(() => [])

  const chatMessages = chatMessagesRaw.map(c => ({
    sender: c.senderRole,
    message: c.message,
    timestamp: c.timestamp
  }))

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      description: exam.description,
      startTime: exam.startTime,
      endTime: exam.endTime,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      status: exam.status,
      faculty: exam.faculty,
      cameraRequired: exam.cameraRequired,
      fullScreenMode: exam.fullScreenMode
    },
    isEligible,
    chatMessages
  }
}

async function startOrResumeExam({ examId, studentId, _clientIp = '127.0.0.1', _userAgent = 'Unknown' }) {
  const exam = await global.prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: true }
  })

  if (!exam) {
    const error = new Error('Exam not found')
    error.status = 404
    throw error
  }

  const now = new Date()
  if (now < new Date(exam.startTime)) {
    return {
      waiting: true,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        startTime: exam.startTime,
        endTime: exam.endTime,
        duration: exam.duration,
        tabSwitchLimit: exam.tabSwitchLimit,
        cameraRequired: exam.cameraRequired,
        fullScreenMode: exam.fullScreenMode,
        watermarkRequired: exam.watermarkRequired
      },
      serverTime: now
    }
  }

  if (now > new Date(exam.endTime)) {
    const error = new Error('Exam has ended')
    error.status = 403
    throw error
  }

  let studentExam = await global.prisma.studentExam.findFirst({
    where: { studentId, examId },
    include: { answers: true }
  })

  if (studentExam) {
    if (studentExam.status === 'SUBMITTED') {
      const error = new Error('Exam already submitted')
      error.status = 403
      throw error
    }
    if (studentExam.status === 'TERMINATED') {
      const error = new Error('Exam has been terminated by an invigilator')
      error.status = 403
      throw error
    }

    let assignedIds = studentExam.assignedQuestionIds || []
    if (!assignedIds || assignedIds.length === 0) {
      const pool = exam.questions
      const count = (!exam.questionsPerStudent || exam.questionsPerStudent === 0)
        ? pool.length
        : Math.min(exam.questionsPerStudent, pool.length)

      assignedIds = pool
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, count)
        .map(q => q.id)
    }

    studentExam = await global.prisma.studentExam.update({
      where: { id: studentExam.id },
      data: {
        status: 'ACTIVE',
        assignedQuestionIds: assignedIds,
        startedAt: studentExam.startedAt || new Date()
      },
      include: { answers: true }
    })
  } else {
    const pool = exam.questions
    const count = (!exam.questionsPerStudent || exam.questionsPerStudent === 0)
      ? pool.length
      : Math.min(exam.questionsPerStudent, pool.length)

    const assignedIds = pool
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map(q => q.id)

    studentExam = await global.prisma.studentExam.create({
      data: {
        studentId,
        examId,
        assignedQuestionIds: assignedIds,
        watermarkSeed: Math.random().toString(36).substring(2, 10).toUpperCase(),
        status: 'ACTIVE',
        startedAt: new Date()
      },
      include: { answers: true }
    })
  }

  const questions = await global.prisma.question.findMany({
    where: { id: { in: studentExam.assignedQuestionIds } },
    select: {
      id: true, type: true, questionText: true,
      options: true, marks: true,
      codeLanguage: true, codeTemplate: true,
      wordLimitMin: true, wordLimitMax: true
    }
  })

  const orderedQuestions = studentExam.assignedQuestionIds
    .map(qid => questions.find(q => q.id === qid))
    .filter(Boolean)

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      endTime: exam.endTime,
      duration: exam.duration,
      tabSwitchLimit: exam.tabSwitchLimit,
      cameraRequired: exam.cameraRequired,
      fullScreenMode: exam.fullScreenMode,
      watermarkRequired: exam.watermarkRequired
    },
    questions: orderedQuestions,
    answers: studentExam.answers,
    sessionId: studentExam.id
  }
}

async function saveStudentAnswer({ examId, studentId, questionId, answerData }) {
  const session = await global.prisma.studentExam.findFirst({
    where: { studentId, examId, status: 'ACTIVE' }
  })
  if (!session) {
    const error = new Error('No active session found')
    error.status = 403
    throw error
  }

  const question = await global.prisma.question.findUnique({ where: { id: questionId } })
  if (!question) {
    const error = new Error('Question not found')
    error.status = 404
    throw error
  }

  const selectedVal = answerData?.selectedOption ?? answerData?.selected ?? (typeof answerData === 'string' ? answerData : null)
  const codeVal = answerData?.codeAnswer ?? answerData?.code ?? (typeof answerData === 'string' ? answerData : null)
  const writtenVal = answerData?.writtenText ?? answerData?.text ?? answerData?.subjectiveAnswer ?? (typeof answerData === 'string' ? answerData : null)

  const updateData = {}
  if (question.type === 'MCQ') {
    updateData.selectedOption = selectedVal
  } else if (question.type === 'CODE') {
    updateData.codeAnswer = codeVal
  } else {
    updateData.writtenText = writtenVal
  }

  await global.prisma.answer.upsert({
    where: {
      studentExamId_questionId: { studentExamId: session.id, questionId }
    },
    update: { ...updateData },
    create: { studentExamId: session.id, questionId, questionType: question.type, ...updateData }
  })

  return { success: true }
}

async function autoSaveStudentAnswers({ examId, studentId, questionId, answer, answers }) {
  const session = await global.prisma.studentExam.findFirst({
    where: { studentId, examId, status: 'ACTIVE' }
  })
  if (!session) {
    const error = new Error('No active session')
    error.status = 403
    throw error
  }

  if (questionId && answer !== undefined) {
    return saveStudentAnswer({ examId, studentId, questionId, answerData: answer })
  }

  if (answers && typeof answers === 'object') {
    const questionIds = Object.keys(answers)
    const questions = await global.prisma.question.findMany({
      where: { id: { in: questionIds } }
    })

    await Promise.allSettled(
      questions.map(async (question) => {
        const ans = answers[question.id]
        if (!ans) return

        const selectedVal = ans.selectedOption ?? ans.selected ?? (typeof ans === 'string' ? ans : null)
        const codeVal = ans.codeAnswer ?? ans.code ?? (typeof ans === 'string' ? ans : null)
        const writtenVal = ans.writtenText ?? ans.text ?? ans.subjectiveAnswer ?? (typeof ans === 'string' ? ans : null)

        const updateData = {}
        if (question.type === 'MCQ') updateData.selectedOption = selectedVal
        else if (question.type === 'CODE') updateData.codeAnswer = codeVal
        else updateData.writtenText = writtenVal

        return global.prisma.answer.upsert({
          where: { studentExamId_questionId: { studentExamId: session.id, questionId: question.id } },
          update: { ...updateData },
          create: { studentExamId: session.id, questionId: question.id, questionType: question.type, ...updateData }
        })
      })
    )
  }

  return { success: true }
}

async function logStudentEvidence({ examId, studentId, data }) {
  const { eventType, severity, details, screenshotUrl, cameraFrameUrl, timestamp } = data

  const session = await global.prisma.studentExam.findFirst({
    where: { studentId, examId }
  })
  if (!session) {
    const error = new Error('Session not found')
    error.status = 404
    throw error
  }

  await global.prisma.studentExam.update({
    where: { id: session.id },
    data: { flagCount: { increment: 1 } }
  }).catch(() => {})

  await global.prisma.verificationAuditLog.create({
    data: {
      studentId,
      studentExamId: session.id,
      checkType: eventType || 'EXAM_VIOLATION',
      status: 'FLAGGED',
      details: typeof details === 'string' ? details : JSON.stringify({ severity: severity || 'MEDIUM', details: details || {}, screenshotUrl, cameraFrameUrl }),
      timestamp: timestamp ? new Date(timestamp) : new Date()
    }
  }).catch(e => console.warn('[VerificationAuditLog warn]', e.message))

  return { success: true, message: 'Violation logged successfully' }
}

async function submitStudentExam({ examId, studentId, answers }) {
  const session = await global.prisma.studentExam.findFirst({
    where: { studentId, examId, status: 'ACTIVE' },
    include: {
      answers: { include: { question: true } },
      exam: true
    }
  })

  if (!session) {
    const error = new Error('Nothing to submit or session not active')
    error.status = 403
    throw error
  }

  if (answers && typeof answers === 'object') {
    await autoSaveStudentAnswers({ examId, studentId, answers })
  }

  const finalAnswers = await global.prisma.answer.findMany({
    where: { studentExamId: session.id },
    include: { question: true }
  })

  let totalScore = 0
  let totalMarks = 0

  for (const ans of finalAnswers) {
    if (!ans.question) continue
    totalMarks += ans.question.marks

    if (ans.question.type === 'MCQ') {
      const letterToIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
      const selectedIdx = letterToIndex[ans.selectedOption?.toUpperCase()]
      let isCorrect = false

      if (ans.question.correctAnswer && ans.selectedOption &&
          ans.selectedOption.trim().toUpperCase() === ans.question.correctAnswer.trim().toUpperCase()) {
        isCorrect = true
      }

      if (!isCorrect && Array.isArray(ans.question.options) && ans.question.options.length > 0) {
        const correctOptIdx = ans.question.options.findIndex(o => o && typeof o === 'object' && o.isCorrect)
        if (correctOptIdx !== -1) {
          if (selectedIdx === correctOptIdx) {
            isCorrect = true
          } else {
            const correctOpt = ans.question.options[correctOptIdx]
            if (correctOpt && correctOpt.text && ans.selectedOption === correctOpt.text) {
              isCorrect = true
            }
          }
        } else {
          const qCorrect = ans.question.correctAnswer
          if (qCorrect) {
            const correctIdxFromAnswer = letterToIndex[qCorrect.toUpperCase()]
            if (correctIdxFromAnswer !== undefined && selectedIdx === correctIdxFromAnswer) {
              isCorrect = true
            } else {
              const correctTextIdx = ans.question.options.findIndex(o => {
                const text = typeof o === 'string' ? o : o?.text
                return text && text.trim().toLowerCase() === qCorrect.trim().toLowerCase()
              })
              if (correctTextIdx !== -1 && selectedIdx === correctTextIdx) {
                isCorrect = true
              }
            }
          }
        }
      }

      const marksAwarded = isCorrect ? ans.question.marks : 0
      totalScore += marksAwarded

      await global.prisma.answer.update({
        where: { id: ans.id },
        data: { autoScore: marksAwarded }
      })
    }
  }

  const existingResult = await global.prisma.examResult.findFirst({
    where: { studentExamId: session.id }
  })

  const calculatedTotalMarks = totalMarks || session.exam.totalMarks || 100
  const percentage = calculatedTotalMarks > 0 ? (totalScore / calculatedTotalMarks) * 100 : 0
  const timeTaken = Math.floor((new Date() - new Date(session.startedAt || session.createdAt)) / 1000)

  if (!existingResult) {
    await global.prisma.examResult.create({
      data: {
        studentExamId: session.id,
        examId,
        autoScore: totalScore,
        totalScore,
        totalMarks: calculatedTotalMarks,
        percentage,
        timeTaken,
        finalStatus: 'COMPLETED'
      }
    })
  }

  await global.prisma.studentExam.update({
    where: { id: session.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() }
  })

  return {
    score: totalScore,
    totalMarks: calculatedTotalMarks,
    percentage
  }
}

async function getStudentResultsHistory(studentId) {
  const results = await global.prisma.examResult.findMany({
    where: { studentExam: { studentId } },
    include: {
      studentExam: {
        include: {
          exam: {
            select: {
              title: true,
              subject: true,
              totalMarks: true,
              duration: true,
              _count: {
                select: { questions: true }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const formatted = results.map(r => ({
    id: r.id,
    exam: r.studentExam?.exam,
    totalScore: r.totalScore,
    totalMarks: r.totalMarks,
    percentage: r.percentage,
    timeTaken: r.timeTaken,
    finalStatus: r.finalStatus,
    createdAt: r.createdAt,
    gradedAt: r.createdAt
  }))

  return formatted
}

async function getStudentProfile(studentId) {
  const student = await global.prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      usn: true,
      email: true,
      phone: true,
      department: true,
      semester: true,
      facePhotoUrl: true,
      idCardPhotoUrl: true,
      mustChangePassword: true,
      profileStatus: true,
      approvalStatus: true,
    }
  })
  if (!student) {
    const error = new Error('Student not found')
    error.status = 404
    throw error
  }
  return student
}

async function updateStudentProfile({ studentId, data }) {
  const {
    currentPassword,
    newPassword,
    usn,
    phone,
    email,
    department,
    semester,
    facePhotoUrl,
    idCardPhotoUrl,
  } = data

  const existingStudent = await global.prisma.student.findUnique({ where: { id: studentId } })
  if (!existingStudent) {
    const error = new Error('Student not found')
    error.status = 404
    throw error
  }

  const updateData = {}

  if (newPassword && newPassword.trim()) {
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, existingStudent.password)
      if (!isMatch) {
        const error = new Error('Current password is incorrect.')
        error.status = 400
        throw error
      }
    }
    const hashedPw = await bcrypt.hash(newPassword.trim(), 10)
    updateData.password = hashedPw
    updateData.mustChangePassword = false
  }

  if (usn && usn.trim()) updateData.usn = usn.trim().toUpperCase()
  if (email && email.trim()) updateData.email = email.trim().toLowerCase()
  if (phone && phone.trim()) updateData.phone = phone.trim()
  if (department && department.trim()) updateData.department = department.trim()
  if (semester !== undefined && semester !== null) updateData.semester = parseInt(semester, 10) || 1

  if (facePhotoUrl) updateData.facePhotoUrl = facePhotoUrl
  if (idCardPhotoUrl) updateData.idCardPhotoUrl = idCardPhotoUrl

  updateData.profileStatus = 'VERIFIED'

  const updatedStudent = await global.prisma.student.update({
    where: { id: studentId },
    data: updateData,
    select: {
      id: true,
      name: true,
      usn: true,
      email: true,
      phone: true,
      department: true,
      semester: true,
      facePhotoUrl: true,
      idCardPhotoUrl: true,
      mustChangePassword: true,
      profileStatus: true,
    }
  })

  return updatedStudent
}

async function listDepartmentStudents(query) {
  const { paginate } = require('../utils/helpers')
  const { department, semester, search, page = 1, limit = 20 } = query
  const { skip, take } = paginate(page, limit)

  const where = {}
  if (department) where.department = department
  if (semester) where.semester = parseInt(semester)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { usn: { contains: search, mode: 'insensitive' } }
    ]
  }

  const [students, total] = await Promise.all([
    global.prisma.student.findMany({
      where, skip, take,
      select: { id: true, name: true, usn: true, department: true, semester: true, approvalStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    }),
    global.prisma.student.count({ where })
  ])

  return { students, total, page: parseInt(page), totalPages: Math.ceil(total / take) }
}

async function approveStudentByFaculty({ studentId, facultyId }) {
  const student = await global.prisma.student.findUnique({ where: { id: studentId } })
  if (!student) {
    const error = new Error('Student not found.')
    error.status = 404
    throw error
  }

  const faculty = await global.prisma.faculty.findUnique({ where: { id: facultyId } })
  if (student.department !== faculty.department) {
    const error = new Error('Can only approve students in your department.')
    error.status = 403
    throw error
  }

  const updated = await global.prisma.student.update({
    where: { id: studentId },
    data: { approvalStatus: 'APPROVED', approvedBy: facultyId, approvedAt: new Date() }
  })

  return { student: updated, original: student }
}

async function acknowledgeWatermarkSession({ studentId, examId }) {
  const session = await global.prisma.studentExam.findFirst({
    where: { studentId, examId }
  })
  if (session) {
    await global.prisma.studentExam.update({
      where: { id: session.id },
      data: { acknowledgedAt: new Date() }
    }).catch(() => {})
  }
  return { success: true }
}

async function getStudentChatHistory({ examId, studentId }) {
  const messagesRaw = await global.prisma.chatMessage.findMany({
    where: { examId, studentId },
    orderBy: { timestamp: 'asc' },
    take: 100
  }).catch(() => [])

  return messagesRaw.map(c => ({
    sender: c.senderRole,
    message: c.message,
    timestamp: c.timestamp
  }))
}

async function saveStudentChatMessage({ examId, studentId, message }) {
  if (!message?.trim()) {
    const error = new Error('Empty message')
    error.status = 400
    throw error
  }

  await global.prisma.chatMessage.create({
    data: {
      examId,
      studentId,
      senderRole: 'student',
      message: message.trim()
    }
  }).catch(() => {})

  return { success: true }
}

module.exports = {
  listExamsForStudent,
  getExamDetailsForStudent,
  getExamLobbyData,
  startOrResumeExam,
  saveStudentAnswer,
  autoSaveStudentAnswers,
  logStudentEvidence,
  submitStudentExam,
  getStudentResultsHistory,
  getStudentProfile,
  updateStudentProfile,
  listDepartmentStudents,
  approveStudentByFaculty,
  acknowledgeWatermarkSession,
  getStudentChatHistory,
  saveStudentChatMessage
}

