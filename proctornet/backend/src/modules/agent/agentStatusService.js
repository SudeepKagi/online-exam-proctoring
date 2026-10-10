const { prisma } = require('../../infra/postgres/client')
const { agentSessionService } = require('./agentSessionService')
const { NotFoundError, ForbiddenError } = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')

class AgentStatusService {
  /**
   * Get device agent companion status for an attempt
   */
  async getAttemptAgentStatus(attemptId, user) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true
      }
    })

    if (!attempt) {
      throw new NotFoundError(`Exam attempt '${attemptId}' not found`)
    }

    // Access control (BOLA)
    if (user.role === ROLES.STUDENT) {
      if (attempt.studentId !== user.id) {
        throw new ForbiddenError('You can only view companion status for your own attempts')
      }
    } else if (user.role === ROLES.FACULTY) {
      if (attempt.exam.facultyId !== user.id) {
        throw new ForbiddenError('You can only view companion status for exams you own')
      }
    } else if (user.role === ROLES.INVIGILATOR) {
      if (!user.examId || user.examId !== attempt.examId) {
        throw new ForbiddenError('You are not assigned to this exam')
      }
    }

    // Fetch waiver if granted
    const waiver = await prisma.deviceAgentWaiver.findUnique({
      where: { attemptId }
    })

    // Fetch active session: check attemptId first, fall back to student precheck session per T2.1
    let session = await agentSessionService.getSessionByAttemptId(attemptId)
    if (!session && attempt.studentId) {
      session = await agentSessionService.getSessionByStudentId(attempt.studentId)
    }

    if (!session) {
      return {
        state: 'NOT_PAIRED',
        paired: false,
        lastSeenAt: null,
        agentVersion: null,
        os: null,
        arch: null,
        findings: [],
        waiver: waiver ? { reason: waiver.reason, grantedAt: waiver.createdAt } : null,
        policy: attempt.exam.deviceAgentPolicy
      }
    }

    // Format findings
    const findingsList = Array.from(session.openFindings.values()).map(f => ({
      ruleId: f.ruleId,
      firstSeenAt: f.firstSeenAt,
      lastSeenAt: f.lastSeenAt,
      hitCount: f.hitCount
    }))

    return {
      state: session.state,
      paired: true,
      sessionId: session.id,
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
      agentVersion: session.agentVersion || null,
      os: session.os || null,
      arch: session.arch || null,
      findings: findingsList,
      waiver: waiver ? { reason: waiver.reason, grantedAt: waiver.createdAt } : null,
      policy: attempt.exam.deviceAgentPolicy
    }
  }

  /**
   * Get device agent companion status for student precheck
   */
  async getStudentPrecheckStatus(studentId) {
    const session = await agentSessionService.getSessionByStudentId(studentId)
    if (!session) {
      return {
        state: 'NOT_PAIRED',
        paired: false,
        lastSeenAt: null,
        agentVersion: null,
        os: null,
        arch: null,
        findings: []
      }
    }

    const findingsList = Array.from(session.openFindings.values()).map(f => ({
      ruleId: f.ruleId,
      firstSeenAt: f.firstSeenAt,
      lastSeenAt: f.lastSeenAt,
      hitCount: f.hitCount
    }))

    return {
      state: session.state,
      paired: true,
      sessionId: session.id,
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
      agentVersion: session.agentVersion || null,
      os: session.os || null,
      arch: session.arch || null,
      findings: findingsList
    }
  }
}

const agentStatusService = new AgentStatusService()

module.exports = {
  agentStatusService
}
