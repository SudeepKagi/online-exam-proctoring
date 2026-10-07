const { prisma } = require('../../infra/postgres/client')
const { agentSessionService } = require('./agentSessionService')
const { NotFoundError, ForbiddenError } = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')

class WaiverService {
  /**
   * Grant a staff waiver for an exam attempt
   */
  async grantWaiver(attemptId, staffUser, reason) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: { faculty: true }
        }
      }
    })

    if (!attempt) {
      throw new NotFoundError(`Exam attempt '${attemptId}' not found`)
    }

    // BOLA Check: invigilator/faculty must belong to this exam
    if (staffUser.role === ROLES.FACULTY && attempt.exam.facultyId !== staffUser.id) {
      throw new ForbiddenError('You can only grant waivers for exams you own')
    }

    if (staffUser.role === ROLES.INVIGILATOR) {
      if (!staffUser.examId || staffUser.examId !== attempt.examId) {
        throw new ForbiddenError('You are not assigned to invigilate this exam')
      }
    }

    // Upsert waiver
    const waiver = await prisma.deviceAgentWaiver.upsert({
      where: { attemptId },
      create: {
        attemptId,
        grantedBy: staffUser.id,
        reason,
        createdAt: new Date()
      },
      update: {
        grantedBy: staffUser.id,
        reason,
        createdAt: new Date()
      }
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: staffUser.id,
        actorRole: staffUser.role,
        action: 'ATTEMPT_AGENT_WAIVER_GRANTED',
        attemptId,
        metadata: {
          reason,
          examId: attempt.examId,
          studentId: attempt.studentId
        }
      }
    })

    return waiver
  }

  /**
   * Request agent recheck (sets reportNow flag on the session)
   */
  async requestRecheck(attemptId, staffUser) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true }
    })

    if (!attempt) {
      throw new NotFoundError(`Exam attempt '${attemptId}' not found`)
    }

    if (staffUser.role === ROLES.FACULTY && attempt.exam.facultyId !== staffUser.id) {
      throw new ForbiddenError('You can only request recheck for exams you own')
    }

    const session = await agentSessionService.getSessionByAttemptId(attemptId)
    if (!session) {
      throw new NotFoundError('No active companion agent session found for this attempt')
    }

    session.reportNow = true

    return {
      success: true,
      requested: true,
      message: 'Agent companion recheck requested; will report on next heartbeat'
    }
  }
}

const waiverService = new WaiverService()

module.exports = {
  waiverService
}
