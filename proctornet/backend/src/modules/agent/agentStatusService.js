const { prisma } = require('../../infra/postgres/client')
const { agentSessionService } = require('./agentSessionService')
const { policyService } = require('./policyService')
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

    // Evaluate device companion gate according to single policy
    const { evaluateDeviceGate } = require('./agentGate')
    const gateResult = await evaluateDeviceGate({
      attemptId,
      exam: attempt.exam,
      studentId: attempt.studentId
    })

    const session = gateResult.session || null
    const waiver = gateResult.waiver || (await prisma.deviceAgentWaiver.findUnique({ where: { attemptId } }))

    if (!session) {
      return {
        state: gateResult.state || 'NOT_PAIRED',
        paired: false,
        gatePassed: gateResult.passed,
        reason: gateResult.reason,
        message: gateResult.message || null,
        lastSeenAt: null,
        agentVersion: null,
        os: null,
        arch: null,
        findings: [],
        waiver: waiver ? { reason: waiver.reason, grantedAt: waiver.createdAt || waiver.grantedAt } : null,
        policy: attempt.exam.deviceAgentPolicy
      }
    }

    // Format findings from attempt session enriched with latest policy rules
    let findingsList = []
    if (session.openFindings && session.openFindings.size > 0) {
      const policy = await policyService.getLatestSignedPolicy().catch(() => ({ rules: [] }))
      const rulesMap = new Map((policy.rules || []).map(r => [r.id, r]))
      findingsList = Array.from(session.openFindings.values()).map(f => {
        const rule = rulesMap.get(f.ruleId)
        return {
          ruleId: f.ruleId,
          ruleName: rule?.name || f.ruleId,
          category: rule?.category || 'OTHER',
          action: rule?.action || 'FLAG',
          severity: rule?.severity || 'HIGH',
          firstSeenAt: f.firstSeenAt,
          lastSeenAt: f.lastSeenAt,
          hitCount: f.hitCount
        }
      })
    }

    return {
      state: gateResult.state,
      paired: true,
      gatePassed: gateResult.passed,
      reason: gateResult.reason,
      message: gateResult.message || null,
      sessionId: session.id,
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
      agentVersion: session.agentVersion || null,
      os: session.os || null,
      arch: session.arch || null,
      findings: findingsList,
      waiver: waiver ? { reason: waiver.reason, grantedAt: waiver.createdAt || waiver.grantedAt } : null,
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
