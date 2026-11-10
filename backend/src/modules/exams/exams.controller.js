const { examService, toExamDto } = require('./exams.service')

async function createExam(req, res, next) {
  try {
    const exam = await examService.createExam(req.body, req.user?.id)
    return res.status(201).json({ status: 'success', exam: toExamDto(exam, req.user) })
  } catch (err) {
    next(err)
  }
}

async function updateExam(req, res, next) {
  try {
    const exam = await examService.updateExam(req.params.id, req.body)
    return res.status(200).json({ status: 'success', exam: toExamDto(exam, req.user) })
  } catch (err) {
    next(err)
  }
}

async function deleteExam(req, res, next) {
  try {
    await examService.deleteExam(req.params.id)
    return res.status(200).json({ status: 'success', message: 'Exam deleted successfully' })
  } catch (err) {
    next(err)
  }
}

async function getExam(req, res, next) {
  try {
    const exam = await examService.getExamById(req.params.id, req.user)
    return res.status(200).json({ status: 'success', exam, serverTime: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
}

async function listExams(req, res, next) {
  try {
    const exams = await examService.listExams(req.query, req.user)
    return res.status(200).json({ status: 'success', exams: exams || [] })
  } catch (err) {
    next(err)
  }
}

async function publishExam(req, res, next) {
  try {
    const exam = await examService.publishExam(req.params.id)
    return res.status(200).json({ status: 'success', exam: toExamDto(exam, req.user) })
  } catch (err) {
    next(err)
  }
}

async function addQuestion(req, res, next) {
  try {
    const question = await examService.addQuestion(req.params.id, req.body)
    return res.status(201).json({ status: 'success', question })
  } catch (err) {
    next(err)
  }
}

async function deleteQuestion(req, res, next) {
  try {
    await examService.deleteQuestion(req.params.questionId, req.params.id)
    return res.status(200).json({ status: 'success', message: 'Question deleted' })
  } catch (err) {
    next(err)
  }
}

async function assignUser(req, res, next) {
  try {
    const { userId, role } = req.body
    const assignment = await examService.assignUser(req.params.id, userId, role)
    return res.status(201).json({ status: 'success', assignment })
  } catch (err) {
    next(err)
  }
}

async function getStudentExams(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const studentId = req.user?.id
    const [allExams, attempts, userRec, assignments] = await Promise.all([
      examService.listExams({ role: 'STUDENT' }),
      studentId ? prisma.examAttempt.findMany({ where: { studentId } }) : [],
      studentId ? prisma.user.findUnique({ where: { id: studentId }, select: { profileMetadata: true } }) : null,
      studentId ? prisma.examAssignment.findMany({ where: { userId: studentId } }) : []
    ])

    const sMeta = userRec?.profileMetadata || {}
    const sDept = String(sMeta.department || '').toLowerCase()
    const sSem = String(sMeta.semester || '').replace(/sem\s*/i, '').trim()
    const assignedIds = new Set(assignments.map(a => a.examId))
    const attemptMap = new Map(attempts.map(a => [a.examId, a]))

    const filtered = (allExams || []).filter(e => {
      if (assignedIds.has(e.id)) return true
      const pConfig = e.proctoringConfig || {}
      const eDept = String(pConfig.department || '').toLowerCase()
      const eSem = String(pConfig.semester || '').replace(/sem\s*/i, '').trim()
      if (!eDept && !eSem) return true
      const matchesDept = !eDept || sDept.includes(eDept) || eDept.includes(sDept)
      const matchesSem = !eSem || sSem === eSem
      return matchesDept && matchesSem
    })

    const formatted = filtered.map(e => {
      const att = attemptMap.get(e.id)
      return toExamDto({
        ...e,
        attemptId: att?.id || null,
        attemptStatus: att?.status || null,
        score: att?.score ?? null
      }, req.user)
    })

    return res.status(200).json({ status: 'success', exams: formatted })
  } catch (err) {
    next(err)
  }
}

async function getFacultyExams(req, res, next) {
  try {
    const exams = await examService.listExams({ createdBy: req.user?.id }, req.user)
    return res.status(200).json({ status: 'success', exams: exams || [] })
  } catch (err) {
    next(err)
  }
}

async function bulkAddQuestions(req, res, next) {
  try {
    const questions = req.body?.questions || []
    const created = await examService.bulkAddQuestions(req.params.id, questions)
    return res.status(201).json({ status: 'success', count: created.length, questions: created })
  } catch (err) {
    next(err)
  }
}

const multer = require('multer')
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } })
const uploadQuestionsMiddleware = upload.single('file')

async function uploadQuestionsExcel(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: { message: 'Questions Excel file (.xlsx) is required' } })
    }
    const questions = await examService.parseQuestionsExcel(req.file.buffer)
    const created = await examService.bulkAddQuestions(req.params.id, questions)
    return res.status(201).json({ status: 'success', count: created.length, questions: created })
  } catch (err) {
    next(err)
  }
}

async function getExamAttempts(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: req.params.id },
      include: {
        student: { select: { fullName: true, email: true, institutionId: true } }
      },
      orderBy: { startedAt: 'desc' }
    })
    const formatted = attempts.map(a => ({
      id: a.id,
      studentName: a.student?.fullName || 'Student',
      email: a.student?.email || '—',
      usn: a.student?.institutionId || '—',
      status: a.status,
      score: a.score,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      violationCount: a.violationCount || 0,
      reviewStatus: a.reviewStatus || 'PENDING',
      reviewNotes: a.reviewNotes || null,
      isFlagged: Boolean(a.isFlagged)
    }))
    return res.status(200).json({ status: 'success', attempts: formatted })
  } catch (err) {
    next(err)
  }
}

async function exportResultsCsv(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: req.params.id },
      include: {
        student: { select: { fullName: true, email: true, institutionId: true } }
      },
      orderBy: { startedAt: 'desc' }
    })
    const rows = ['Student Name,Email,USN,Status,Score,Violations,Review Status,Flagged,Submitted At']
    for (const a of attempts) {
      rows.push(`"${a.student?.fullName || ''}","${a.student?.email || ''}","${a.student?.institutionId || ''}","${a.status}","${a.score ?? ''}","${a.violationCount || 0}","${a.reviewStatus || 'PENDING'}","${a.isFlagged ? 'Yes' : 'No'}","${a.submittedAt ? a.submittedAt.toISOString() : ''}"`)
    }
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="results-${req.params.id}.csv"`)
    return res.status(200).send(rows.join('\n'))
  } catch (err) {
    next(err)
  }
}

async function getExamConsent(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const examId = req.params.id || req.params.examId
    const consent = await prisma.studentConsent.findUnique({
      where: {
        studentId_examId: {
          studentId: req.user.id,
          examId
        }
      }
    })
    return res.status(200).json({
      status: 'success',
      consented: Boolean(consent),
      consent: consent || null
    })
  } catch (err) {
    next(err)
  }
}

async function submitExamConsent(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const examId = req.params.id || req.params.examId
    const { consentVersion, consentText } = req.body

    if (!consentText || typeof consentText !== 'string' || !consentText.trim()) {
      return res.status(400).json({ error: { message: 'Consent text is required' } })
    }

    const consent = await prisma.studentConsent.upsert({
      where: {
        studentId_examId: {
          studentId: req.user.id,
          examId
        }
      },
      create: {
        studentId: req.user.id,
        examId,
        consentVersion: consentVersion || 'v1.0',
        consentText: consentText.trim(),
        agreedAt: new Date()
      },
      update: {
        consentVersion: consentVersion || 'v1.0',
        consentText: consentText.trim(),
        agreedAt: new Date()
      }
    })

    return res.status(201).json({ status: 'success', consent })
  } catch (err) {
    next(err)
  }
}

async function reportReadiness(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const examId = req.params.id || req.params.examId
    const { osFamily, browserFamily, cameraOk, latencyBucket, sebVerified } = req.body

    // Privacy Invariant: strictly extract ONLY allowed minimal fields (no IP, MAC, device ID, user agent, or images)
    const exam = await prisma.exam.findUnique({
      where: { id: examId }
    })
    if (!exam) {
      return res.status(404).json({ error: { message: 'Exam not found' } })
    }

    const reasons = []
    const isCameraOk = Boolean(cameraOk)
    if (!isCameraOk) {
      reasons.push('Camera feed or permission not detected')
    }

    const isSebRequired = Boolean(exam.proctoringConfig?.sebRequired)
    const isSebVerified = Boolean(sebVerified)
    const safeOs = String(osFamily || 'Unknown').trim()

    if (isSebRequired) {
      if (!isSebVerified) {
        reasons.push('Safe Exam Browser is required but not active')
      }
      if (safeOs.toLowerCase() !== 'windows') {
        reasons.push('Safe Exam Browser currently requires Windows OS')
      }
    }

    const safeLatency = ['good', 'acceptable', 'poor'].includes(String(latencyBucket).toLowerCase())
      ? String(latencyBucket).toLowerCase()
      : 'good'

    const isReady = reasons.length === 0

    const report = await prisma.studentReadinessReport.upsert({
      where: {
        examId_studentId: {
          examId,
          studentId: req.user.id
        }
      },
      create: {
        examId,
        studentId: req.user.id,
        osFamily: safeOs,
        browserFamily: String(browserFamily || 'Unknown').trim(),
        cameraOk: isCameraOk,
        latencyBucket: safeLatency,
        sebVerified: isSebVerified,
        isReady,
        reasons,
        reportedAt: new Date()
      },
      update: {
        osFamily: safeOs,
        browserFamily: String(browserFamily || 'Unknown').trim(),
        cameraOk: isCameraOk,
        latencyBucket: safeLatency,
        sebVerified: isSebVerified,
        isReady,
        reasons,
        reportedAt: new Date()
      }
    })

    return res.status(200).json({ status: 'success', report })
  } catch (err) {
    next(err)
  }
}

async function getExamReadiness(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const examId = req.params.id || req.params.examId
    const { status, search } = req.query

    // 1. Fetch all assigned students
    const assignments = await prisma.examAssignment.findMany({
      where: { examId, assignedRole: 'STUDENT' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, institutionId: true }
        }
      }
    })

    // 2. Fetch all readiness reports for this exam
    const reports = await prisma.studentReadinessReport.findMany({
      where: { examId },
      include: {
        student: {
          select: { id: true, fullName: true, email: true, institutionId: true }
        }
      }
    })

    const reportMap = new Map()
    for (const r of reports) {
      reportMap.set(r.studentId, r)
    }

    // Combine students
    const studentMap = new Map()
    for (const a of assignments) {
      if (a.user) studentMap.set(a.user.id, a.user)
    }
    for (const r of reports) {
      if (r.student && !studentMap.has(r.student.id)) {
        studentMap.set(r.student.id, r.student)
      }
    }

    let items = Array.from(studentMap.values()).map(student => {
      const rep = reportMap.get(student.id)
      if (!rep) {
        return {
          studentId: student.id,
          studentName: student.fullName || 'Student',
          email: student.email || '—',
          usn: student.institutionId || '—',
          status: 'NOT_REPORTED',
          isReady: false,
          reasons: ['Not yet reported'],
          osFamily: '—',
          browserFamily: '—',
          cameraOk: false,
          latencyBucket: '—',
          sebVerified: false,
          reportedAt: null
        }
      }
      return {
        studentId: student.id,
        studentName: student.fullName || 'Student',
        email: student.email || '—',
        usn: student.institutionId || '—',
        status: rep.isReady ? 'READY' : 'NOT_READY',
        isReady: rep.isReady,
        reasons: Array.isArray(rep.reasons) ? rep.reasons : [],
        osFamily: rep.osFamily,
        browserFamily: rep.browserFamily,
        cameraOk: rep.cameraOk,
        latencyBucket: rep.latencyBucket,
        sebVerified: rep.sebVerified,
        reportedAt: rep.reportedAt
      }
    })

    // Apply search filter
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(i =>
        i.studentName.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.usn.toLowerCase().includes(q)
      )
    }

    // Apply status filter ('ready', 'not_ready', 'not_reported', 'all')
    if (status && status.toLowerCase() !== 'all') {
      const s = status.toUpperCase()
      items = items.filter(i => i.status === s)
    }

    const summary = {
      total: studentMap.size,
      ready: Array.from(studentMap.keys()).filter(id => reportMap.get(id)?.isReady).length,
      notReady: Array.from(studentMap.keys()).filter(id => {
        const r = reportMap.get(id)
        return r && !r.isReady
      }).length,
      notReported: Array.from(studentMap.keys()).filter(id => !reportMap.has(id)).length
    }

    return res.status(200).json({ status: 'success', readiness: items, summary })
  } catch (err) {
    next(err)
  }
}

async function exportReadinessCsv(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const examId = req.params.id || req.params.examId

    const assignments = await prisma.examAssignment.findMany({
      where: { examId, assignedRole: 'STUDENT' },
      include: {
        user: { select: { id: true, fullName: true, email: true, institutionId: true } }
      }
    })
    const reports = await prisma.studentReadinessReport.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, fullName: true, email: true, institutionId: true } }
      }
    })

    const reportMap = new Map()
    for (const r of reports) reportMap.set(r.studentId, r)

    const studentMap = new Map()
    for (const a of assignments) if (a.user) studentMap.set(a.user.id, a.user)
    for (const r of reports) if (r.student && !studentMap.has(r.student.id)) studentMap.set(r.student.id, r.student)

    const rows = ['Student Name,Email,USN,Readiness Status,Reasons,OS Family,Browser Family,Camera OK,Latency,SEB Verified,Reported At']

    for (const student of studentMap.values()) {
      const rep = reportMap.get(student.id)
      const status = !rep ? 'NOT_REPORTED' : (rep.isReady ? 'READY' : 'NOT_READY')
      const reasons = rep && Array.isArray(rep.reasons) ? rep.reasons.join('; ') : (!rep ? 'Not yet reported' : '')
      const os = rep ? rep.osFamily : '—'
      const browser = rep ? rep.browserFamily : '—'
      const camera = rep ? (rep.cameraOk ? 'Yes' : 'No') : '—'
      const latency = rep ? rep.latencyBucket : '—'
      const seb = rep ? (rep.sebVerified ? 'Yes' : 'No') : '—'
      const reportedAt = rep && rep.reportedAt ? rep.reportedAt.toISOString() : '—'

      rows.push(`"${student.fullName || ''}","${student.email || ''}","${student.institutionId || ''}","${status}","${reasons}","${os}","${browser}","${camera}","${latency}","${seb}","${reportedAt}"`)
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="readiness-${examId}.csv"`)
    return res.status(200).send(rows.join('\n'))
  } catch (err) {
    next(err)
  }
}

async function exportExamIncidentsCsv(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const { formatViolationType } = require('../../shared/violationTypes')
    const examId = req.params.id || req.params.examId

    const attempts = await prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: { select: { fullName: true, email: true, institutionId: true } },
        proctoringLogs: { orderBy: { createdAt: 'asc' } }
      }
    })

    const rows = ['Attempt ID,Student Name,Email,USN,Event Type,Formatted Label,Severity,Timestamp,Review Status,Flagged,Has Snapshot,Evidence Key']
    for (const a of attempts) {
      for (const log of a.proctoringLogs) {
        rows.push(`"${a.id}","${a.student?.fullName || ''}","${a.student?.email || ''}","${a.student?.institutionId || ''}","${log.eventType}","${formatViolationType(log.eventType)}","${log.severity}","${log.createdAt.toISOString()}","${a.reviewStatus}","${a.isFlagged ? 'Yes' : 'No'}","${log.evidenceKey ? 'Yes' : 'No'}","${log.evidenceKey || ''}"`)
      }
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="incidents-exam-${examId}.csv"`)
    return res.status(200).send(rows.join('\n'))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createExam,
  updateExam,
  deleteExam,
  getExam,
  listExams,
  publishExam,
  addQuestion,
  deleteQuestion,
  assignUser,
  getStudentExams,
  getFacultyExams,
  bulkAddQuestions,
  uploadQuestionsMiddleware,
  uploadQuestionsExcel,
  getExamAttempts,
  exportResultsCsv,
  getExamConsent,
  submitExamConsent,
  reportReadiness,
  getExamReadiness,
  exportReadinessCsv,
  exportExamIncidentsCsv
}
