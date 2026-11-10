const { attemptService } = require('./attempts.service')
const { markAttemptSebVerified, attemptExamLru } = require('../../middleware/seb')

async function getReadiness(req, res, next) {
  try {
    const examId = req.params.examId || req.params.id
    const attempt = await attemptService.getReadiness(examId, req.user.id)
    return res.status(200).json({ status: 'success', attempt, attemptId: attempt.id })
  } catch (err) {
    next(err)
  }
}

async function startAttempt(req, res, next) {
  try {
    const examId = req.params.examId || req.params.id || req.body?.examId
    const result = await attemptService.startAttempt(examId, req.user.id)
    const startedAttemptId = result?.attempt?.id || result?.id
    if (startedAttemptId) {
      if (req.seb?.verified) {
        markAttemptSebVerified(startedAttemptId)
      }
      attemptExamLru.set(startedAttemptId, examId)
    }
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function getAttempt(req, res, next) {
  try {
    const result = await attemptService.getAttemptState(req.params.attemptId, req.user.id, req.user.role)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function saveAnswer(req, res, next) {
  try {
    const { attemptId } = req.params
    const { questionId, selectedOptionIndex } = req.body
    const answer = await attemptService.saveAnswer(attemptId, req.user.id, questionId, selectedOptionIndex)
    return res.status(200).json({ status: 'success', answer })
  } catch (err) {
    next(err)
  }
}

async function batchSaveAnswers(req, res, next) {
  try {
    const { attemptId } = req.params
    const answersData = req.body?.answers !== undefined ? req.body.answers : req.body
    const results = await attemptService.batchSaveAnswers(attemptId, req.user.id, answersData || [])
    return res.status(200).json({ status: 'success', savedCount: results.length, answers: results })
  } catch (err) {
    next(err)
  }
}

async function submitAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const result = await attemptService.submitAttempt(attemptId, req.user.id)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function suspendAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const { reason } = req.body || {}
    const result = await attemptService.suspendAttempt(attemptId, req.user.id, reason)
    return res.status(200).json({ status: 'success', attempt: result })
  } catch (err) {
    next(err)
  }
}

async function resumeAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const result = await attemptService.resumeAttempt(attemptId, req.user.id)
    return res.status(200).json({ status: 'success', attempt: result })
  } catch (err) {
    next(err)
  }
}

async function terminateAttempt(req, res, next) {
  try {
    const { attemptId } = req.params
    const { reason } = req.body || {}
    const result = await attemptService.terminateAttempt(attemptId, req.user.id, reason)
    return res.status(200).json({ status: 'success', attempt: result })
  } catch (err) {
    next(err)
  }
}

async function getSebStatus(req, res, next) {
  try {
    const { required = false, mode = 'off', verified = false } = req.seb || {}
    return res.status(200).json({
      status: 'success',
      required: Boolean(required),
      mode: String(mode),
      verified: Boolean(verified)
    })
  } catch (err) {
    next(err)
  }
}

async function getVpnStatus(req, res) {
  // WireGuard VPN Hook check
  const clientIp = req.socket.remoteAddress || req.ip || '127.0.0.1'
  return res.status(200).json({
    status: 'connected',
    clientIp,
    vpnRequired: false,
    matched: true
  })
}

async function getAttemptIncidents(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const { formatViolationType } = require('../../shared/violationTypes')
    const { getPresignedReadUrl } = require('../../infra/s3/s3.client')
    const { attemptId } = req.params

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { id: true, fullName: true, email: true, institutionId: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
        proctoringLogs: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!attempt) {
      return res.status(404).json({ error: { message: 'Attempt not found' } })
    }

    const formattedIncidents = await Promise.all(
      attempt.proctoringLogs.map(async (log) => {
        let snapshotUrl = null
        if (log.evidenceKey) {
          try {
            snapshotUrl = await getPresignedReadUrl(log.evidenceKey, 1800)
          } catch (_) {}
        }
        return {
          id: String(log.id),
          eventType: log.eventType,
          displayLabel: formatViolationType(log.eventType),
          severity: log.severity,
          evidenceKey: log.evidenceKey,
          snapshotUrl,
          metadata: log.metadata,
          timestamp: log.createdAt
        }
      })
    )

    return res.status(200).json({
      status: 'success',
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        studentId: attempt.studentId,
        studentName: attempt.student?.fullName || 'Student',
        email: attempt.student?.email || '—',
        usn: attempt.student?.institutionId || '—',
        status: attempt.status,
        score: attempt.score,
        violationCount: attempt.violationCount,
        reviewStatus: attempt.reviewStatus,
        reviewNotes: attempt.reviewNotes,
        isFlagged: attempt.isFlagged,
        reviewedBy: attempt.reviewedBy ? {
          id: attempt.reviewedBy.id,
          fullName: attempt.reviewedBy.fullName,
          email: attempt.reviewedBy.email
        } : null,
        reviewedAt: attempt.reviewedAt
      },
      incidents: formattedIncidents
    })
  } catch (err) {
    next(err)
  }
}

async function updateAttemptReview(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const { attemptId } = req.params
    const { reviewStatus, reviewNotes, isFlagged } = req.body

    const validStatuses = ['PENDING', 'REVIEWED', 'DISMISSED', 'CONFIRMED']
    if (reviewStatus && !validStatuses.includes(reviewStatus)) {
      return res.status(400).json({
        error: { message: `Invalid reviewStatus. Must be one of: ${validStatuses.join(', ')}` }
      })
    }

    const data = {
      reviewedById: req.user.id,
      reviewedAt: new Date()
    }
    if (reviewStatus !== undefined) data.reviewStatus = reviewStatus
    if (reviewNotes !== undefined) data.reviewNotes = reviewNotes
    if (isFlagged !== undefined) {
      data.isFlagged = Boolean(isFlagged)
    } else if (reviewStatus === 'CONFIRMED') {
      data.isFlagged = true
    } else if (reviewStatus === 'DISMISSED') {
      data.isFlagged = false
    }

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data,
      include: {
        reviewedBy: { select: { id: true, fullName: true, email: true } }
      }
    })

    return res.status(200).json({
      status: 'success',
      attempt: {
        id: updated.id,
        reviewStatus: updated.reviewStatus,
        reviewNotes: updated.reviewNotes,
        isFlagged: updated.isFlagged,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt
      }
    })
  } catch (err) {
    next(err)
  }
}

async function exportAttemptIncidentsCsv(req, res, next) {
  try {
    const { prisma } = require('../../infra/postgres/client')
    const { formatViolationType } = require('../../shared/violationTypes')
    const { attemptId } = req.params

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { fullName: true, email: true, institutionId: true } },
        proctoringLogs: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!attempt) {
      return res.status(404).json({ error: { message: 'Attempt not found' } })
    }

    const rows = ['Timestamp,Event Type,Formatted Label,Severity,Has Evidence,Evidence Key']
    for (const log of attempt.proctoringLogs) {
      rows.push(`"${log.createdAt.toISOString()}","${log.eventType}","${formatViolationType(log.eventType)}","${log.severity}","${log.evidenceKey ? 'Yes' : 'No'}","${log.evidenceKey || ''}"`)
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="incidents-attempt-${attemptId}.csv"`)
    return res.status(200).send(rows.join('\n'))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getReadiness,
  getSebStatus,
  startAttempt,
  getAttempt,
  saveAnswer,
  batchSaveAnswers,
  submitAttempt,
  suspendAttempt,
  resumeAttempt,
  terminateAttempt,
  getVpnStatus,
  getAttemptIncidents,
  updateAttemptReview,
  exportAttemptIncidentsCsv
}
