const { prisma } = require('../../infra/postgres/client')
const { generatePairingCode, hashPairingCode } = require('../../utils/encryption')
const { NotFoundError, ForbiddenError, ConflictError, TooManyRequestsError } = require('../../shared/errors')
const { agentPairingsTotal } = require('../../observability/metrics')

const PAIRING_CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ACTIVE_CODES_PER_STUDENT = 5

class PairingService {
  /**
   * Check rate limit: ensure student doesn't exceed maximum active unexpired codes
   */
  async checkRateLimit(studentId, issueIp) {
    const now = new Date()
    const activeCount = await prisma.agentPairing.count({
      where: {
        studentId,
        usedAt: null,
        expiresAt: { gt: now }
      }
    })

    if (activeCount >= MAX_ACTIVE_CODES_PER_STUDENT) {
      throw new TooManyRequestsError('Too many active pairing codes. Please wait for previous codes to expire or use an existing code.')
    }
  }

  /**
   * Generate pairing code for an exam attempt (scope: ATTEMPT)
   */
  async createAttemptPairingCode(attemptId, studentId, issueIp) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true }
    })

    if (!attempt) {
      throw new NotFoundError(`Exam attempt '${attemptId}' not found`)
    }

    // BOLA check: student must own the attempt
    if (attempt.studentId !== studentId) {
      throw new ForbiddenError('You can only generate pairing codes for your own attempts')
    }

    // State check: allowed only in READY, ACTIVE, SUSPENDED
    const allowedStates = ['READY', 'ACTIVE', 'SUSPENDED']
    if (!allowedStates.includes(attempt.status)) {
      throw new ConflictError(`Cannot pair agent when attempt is in '${attempt.status}' state`)
    }

    await this.checkRateLimit(studentId, issueIp)

    const code = generatePairingCode(8)
    const codeHash = hashPairingCode(code)
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS)

    await prisma.agentPairing.create({
      data: {
        scope: 'ATTEMPT',
        studentId,
        attemptId,
        codeHash,
        expiresAt,
        issueIp: issueIp || null
      }
    })

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      scope: 'ATTEMPT'
    }
  }

  /**
   * Generate practice pairing code for precheck (scope: PRECHECK)
   */
  async createPrecheckPairingCode(studentId, issueIp) {
    await this.checkRateLimit(studentId, issueIp)

    const code = generatePairingCode(8)
    const codeHash = hashPairingCode(code)
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS)

    await prisma.agentPairing.create({
      data: {
        scope: 'PRECHECK',
        studentId,
        codeHash,
        expiresAt,
        issueIp: issueIp || null
      }
    })

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      scope: 'PRECHECK'
    }
  }
}

const pairingService = new PairingService()

module.exports = {
  pairingService,
  PAIRING_CODE_TTL_MS,
  MAX_ACTIVE_CODES_PER_STUDENT
}
