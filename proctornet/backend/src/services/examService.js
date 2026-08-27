const bcrypt = require('bcryptjs')

/**
 * Exam Service
 * Handles Exam entity lifecycle, security configurations, status changes, credentials, and faculty analytics.
 */

async function getFacultyDashboardStats(facultyId) {
  const [totalExams, activeExams, publishedExams, totalQuestions, allExams] = await Promise.all([
    global.prisma.exam.count({ where: { facultyId } }),
    global.prisma.exam.count({ where: { facultyId, status: 'ACTIVE' } }),
    global.prisma.exam.count({ where: { facultyId, status: 'PUBLISHED' } }),
    global.prisma.question.count({ where: { exam: { facultyId } } }),
    global.prisma.exam.findMany({
      where: { facultyId },
      include: {
        _count: {
          select: {
            questions: true,
            studentExams: true,
            examResults: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ])

  // Count total enrolled student sessions
  const totalSubmissions = await global.prisma.examResult.count({
    where: { exam: { facultyId } }
  })

  return {
    totalExams,
    activeExams,
    publishedExams,
    totalQuestions,
    totalSubmissions,
    recentExams: allExams
  }
}

async function createExam({ facultyId, data }) {
  const {
    title,
    description,
    subject,
    duration,
    startTime,
    endTime,
    totalMarks,
    negativeMarking,
    negativeValue,
    questionsPerStudent,
    randomiseQuestions,
    randomiseOptions,
    allowedDepartments,
    allowedSemesters,
    cameraRequired,
    browserLock,
    fullScreenMode,
    watermarkRequired,
    tabSwitchLimit,
    aiReverifyInterval
  } = data

  if (!title || !subject || !duration || !startTime || !endTime) {
    const error = new Error('Title, subject, duration, startTime, and endTime are required.')
    error.status = 400
    throw error
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  const invId = `INV-${randomSuffix}`
  const rawPassword = Math.random().toString(36).substring(2, 10).toUpperCase()
  const invPasswordHash = await bcrypt.hash(rawPassword, 10)

  const exam = await global.prisma.exam.create({
    data: {
      facultyId,
      title,
      description: description || '',
      subject,
      duration: parseInt(duration),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      totalMarks: totalMarks !== undefined ? parseInt(totalMarks) : 0,
      negativeMarking: Boolean(negativeMarking),
      negativeValue: negativeValue !== undefined ? parseFloat(negativeValue) : 0,
      questionsPerStudent: questionsPerStudent !== undefined ? parseInt(questionsPerStudent) : 0,
      randomiseQuestions: randomiseQuestions !== undefined ? Boolean(randomiseQuestions) : true,
      randomiseOptions: randomiseOptions !== undefined ? Boolean(randomiseOptions) : true,
      allowedDepartments: Array.isArray(allowedDepartments) ? allowedDepartments : ['CSE'],
      allowedSemesters: Array.isArray(allowedSemesters) ? allowedSemesters.map(s => parseInt(s)) : [5],
      cameraRequired: cameraRequired !== undefined ? Boolean(cameraRequired) : true,
      micRequired: false,
      browserLock: browserLock !== undefined ? Boolean(browserLock) : true,
      fullScreenMode: fullScreenMode !== undefined ? Boolean(fullScreenMode) : true,
      watermarkRequired: watermarkRequired !== undefined ? Boolean(watermarkRequired) : true,
      tabSwitchLimit: tabSwitchLimit !== undefined ? parseInt(tabSwitchLimit) : 3,
      aiReverifyInterval: aiReverifyInterval !== undefined ? parseInt(aiReverifyInterval) : 10,
      invId,
      invPasswordHash,
      status: 'DRAFT'
    }
  })

  return exam
}

async function listFacultyExams(facultyId) {
  const exams = await global.prisma.exam.findMany({
    where: { facultyId },
    include: {
      _count: {
        select: {
          questions: true,
          studentExams: true,
          examResults: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  return exams
}

async function getExamById({ id, facultyId }) {
  const where = { id }
  if (facultyId) where.facultyId = facultyId

  const exam = await global.prisma.exam.findFirst({
    where,
    include: {
      questions: { orderBy: { createdAt: 'asc' } },
      studentExams: {
        include: {
          student: {
            select: { id: true, name: true, email: true, usn: true, department: true }
          }
        }
      },
      _count: {
        select: {
          questions: true,
          studentExams: true,
          examResults: true
        }
      }
    }
  })

  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  return exam
}

async function updateExamById({ id, facultyId, data }) {
  const existing = await global.prisma.exam.findFirst({
    where: { id, facultyId }
  })
  if (!existing) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const updateData = {}
  const fields = [
    'title', 'description', 'subject', 'courseCode', 'status',
    'securityLevel', 'browserLockdown', 'tabLockdown', 'fullScreen',
    'faceTrack', 'aiObjectDetection', 'screenShareMonitoring',
    'ipCheck', 'negativeMarking', 'allowRetake', 'cameraRequired', 'browserLock',
    'fullScreenMode', 'randomiseQuestions', 'randomiseOptions'
  ]

  fields.forEach(f => {
    if (data[f] !== undefined) updateData[f] = data[f]
  })

  if (data.allowedDepartments !== undefined) {
    updateData.allowedDepartments = Array.isArray(data.allowedDepartments)
      ? data.allowedDepartments
      : [data.allowedDepartments]
  }
  if (data.allowedSemesters !== undefined) {
    updateData.allowedSemesters = Array.isArray(data.allowedSemesters)
      ? data.allowedSemesters.map(s => parseInt(s, 10))
      : [parseInt(data.allowedSemesters, 10)]
  }

  if (data.duration !== undefined) updateData.duration = parseInt(data.duration)
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime)
  if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime)
  if (data.totalMarks !== undefined) updateData.totalMarks = parseFloat(data.totalMarks)
  if (data.negativeValue !== undefined) updateData.negativeValue = parseFloat(data.negativeValue)
  if (data.tabSwitchLimit !== undefined) updateData.tabSwitchLimit = parseInt(data.tabSwitchLimit)
  if (data.maxRetakes !== undefined) updateData.maxRetakes = parseInt(data.maxRetakes)

  const updated = await global.prisma.exam.update({
    where: { id },
    data: updateData
  })

  return updated
}

async function deleteExamById({ id, facultyId }) {
  const existing = await global.prisma.exam.findFirst({
    where: { id, facultyId }
  })
  if (!existing) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  await global.prisma.exam.delete({
    where: { id }
  })

  return { success: true, message: 'Exam deleted successfully.' }
}

async function duplicateExamById({ id, facultyId }) {
  const original = await global.prisma.exam.findFirst({
    where: { id, facultyId },
    include: { questions: true }
  })
  if (!original) {
    const error = new Error('Original exam not found.')
    error.status = 404
    throw error
  }

  const now = new Date()
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  const invId = `INV-${randomSuffix}`
  const rawPassword = Math.random().toString(36).substring(2, 10).toUpperCase()
  const invPasswordHash = await bcrypt.hash(rawPassword, 10)

  const duplicated = await global.prisma.exam.create({
    data: {
      facultyId,
      title: `${original.title} (Copy)`,
      description: original.description,
      subject: original.subject,
      duration: original.duration,
      startTime: new Date(now.getTime() + 3600000), // 1 hour from now
      endTime: new Date(now.getTime() + 7200000),   // 2 hours from now
      totalMarks: original.totalMarks,
      negativeMarking: original.negativeMarking,
      negativeValue: original.negativeValue,
      questionsPerStudent: original.questionsPerStudent,
      randomiseQuestions: original.randomiseQuestions,
      randomiseOptions: original.randomiseOptions,
      allowedDepartments: original.allowedDepartments,
      allowedSemesters: original.allowedSemesters,
      cameraRequired: original.cameraRequired,
      micRequired: false,
      browserLock: original.browserLock,
      fullScreenMode: original.fullScreenMode,
      watermarkRequired: original.watermarkRequired,
      tabSwitchLimit: original.tabSwitchLimit,
      aiReverifyInterval: original.aiReverifyInterval,
      invId,
      invPasswordHash,
      status: 'DRAFT',
      questions: {
        create: original.questions.map(q => ({
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          difficulty: q.difficulty,
          options: q.options,
          correctAnswer: q.correctAnswer,
          codeTemplate: q.codeTemplate,
          codeLanguage: q.codeLanguage,
          testCases: q.testCases,
          wordLimitMin: q.wordLimitMin,
          wordLimitMax: q.wordLimitMax,
          tags: q.tags
        }))
      }
    },
    include: { questions: true }
  })

  return duplicated
}

async function publishExamById({ id, facultyId }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const questionCount = await global.prisma.question.count({ where: { examId: id } })
  if (questionCount === 0) {
    console.warn(`[publishExamById] Publishing exam ${id} with 0 questions currently configured.`)
  }

  const invId = exam.invId || `INV-${Math.floor(100 + Math.random() * 900)}`
  const rawPassword = Math.random().toString(36).substr(2, 8).toUpperCase()
  const invPasswordHash = await bcrypt.hash(rawPassword, 10)

  const updatedExam = await global.prisma.exam.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      invId,
      invPasswordHash
    }
  })

  return {
    exam: updatedExam,
    invCredentials: {
      invId,
      password: rawPassword
    }
  }
}

async function getExamCredentialsById({ id, facultyId }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id, facultyId },
    select: { id: true, title: true, invId: true, status: true }
  })
  if (!exam) {
    const error = new Error('Exam not found.')
    error.status = 404
    throw error
  }
  if (!exam.invId) {
    const error = new Error('This exam has no invigilator credentials yet. Publish it first.')
    error.status = 400
    throw error
  }

  const newPassword = Math.random().toString(36).substr(2, 8).toUpperCase()
  const newHash = await bcrypt.hash(newPassword, 10)
  await global.prisma.exam.update({
    where: { id: exam.id },
    data: { invPasswordHash: newHash }
  })

  return {
    invCredentials: { invId: exam.invId, password: newPassword },
    exam: { id: exam.id, title: exam.title }
  }
}

async function toggleReleaseResults({ id, facultyId, release }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found.')
    error.status = 404
    throw error
  }

  const updated = await global.prisma.exam.update({
    where: { id },
    data: { resultsReleased: release !== undefined ? Boolean(release) : !exam.resultsReleased }
  })

  return updated
}

async function addStudentsToExamList({ examId, facultyId, studentIds }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found.')
    error.status = 404
    throw error
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    const error = new Error('studentIds array is required.')
    error.status = 400
    throw error
  }

  const enrolled = []
  for (const studentId of studentIds) {
    const existing = await global.prisma.studentExam.findFirst({
      where: { examId, studentId }
    })
    if (!existing) {
      const created = await global.prisma.studentExam.create({
        data: {
          examId,
          studentId,
          status: 'SCHEDULED'
        }
      })
      enrolled.push(created)
    }
  }

  return {
    message: `${enrolled.length} students enrolled in exam.`,
    enrolled
  }
}

async function listStudentsInExam({ examId, facultyId }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found.')
    error.status = 404
    throw error
  }

  const studentExams = await global.prisma.studentExam.findMany({
    where: { examId },
    include: {
      student: {
        select: { id: true, name: true, email: true, usn: true, department: true }
      },
      examResult: true,
      _count: { select: { answers: true, evidenceLogs: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  return studentExams
}

module.exports = {
  getFacultyDashboardStats,
  createExam,
  listFacultyExams,
  getExamById,
  updateExamById,
  deleteExamById,
  duplicateExamById,
  publishExamById,
  getExamCredentialsById,
  toggleReleaseResults,
  addStudentsToExamList,
  listStudentsInExam
}
