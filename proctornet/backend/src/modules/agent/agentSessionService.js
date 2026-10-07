const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')
const { hashPairingCode, encryptSessionKey, decryptSessionKey } = require('../../utils/encryption')
const { policyService } = require('./policyService')
const { NotFoundError, UnauthorizedError, ConflictError, BadRequestError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')
const { agentPairingsTotal, agentSessionsGauge } = require('../../observability/metrics')

// Hot in-memory cache for fast HMAC auth without hitting DB every 15s
// Map: tokenHash -> SessionContext
const hotSessions = new Map()
// Map: attemptId -> tokenHash
const attemptToToken = new Map()

class AgentSessionService {
  /**
   * Helper to compare simple semver strings (e.g. "1.0.0" vs "1.0.0")
   */
  isVersionAtLeast(actual, minimum) {
    if (!actual || !minimum) return false
    const parse = (v) => v.split('.').map(n => parseInt(n, 10) || 0)
    const [majA, minA, patchA] = parse(actual)
    const [majB, minB, patchB] = parse(minimum)
    if (majA !== majB) return majA > majB
    if (minA !== minB) return minA > minB
    return patchA >= patchB
  }

  /**
   * Public pairing endpoint implementation
   */
  async pair(params, clientIp) {
    const { code, agentVersion, os, arch, buildHash, deviceId } = params
    const codeHash = hashPairingCode(code)

    // 1. Look up pairing code
    const pairing = await prisma.agentPairing.findFirst({
      where: {
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    })

    if (!pairing) {
      // Check if it was already consumed to provide a distinct, clear error
      const alreadyUsed = await prisma.agentPairing.findFirst({
        where: { codeHash, usedAt: { not: null } }
      })
      agentPairingsTotal.inc({ scope: 'UNKNOWN', result: 'failure' })
      if (alreadyUsed) {
        throw new ConflictError('Pairing code has already been used')
      }
      throw new UnauthorizedError('Invalid or expired pairing code')
    }

    // 2. Minimum version check
    const policy = await policyService.getLatestSignedPolicy()
    const minVersion = policy.minAgentVersion || '1.0.0'
    if (!this.isVersionAtLeast(agentVersion, minVersion)) {
      agentPairingsTotal.inc({ scope: pairing.scope, result: 'outdated_version' })
      throw new BadRequestError(`Agent version '${agentVersion}' is outdated. Minimum required version is '${minVersion}'`)
    }

    // 3. Build hash verification (if releases exist in database)
    const releaseCount = await prisma.agentRelease.count()
    if (releaseCount > 0) {
      const release = await prisma.agentRelease.findFirst({
        where: {
          sha256: buildHash,
          revokedAt: null
        }
      })
      if (!release) {
        logger.warn({ buildHash, os, arch }, 'Untrusted or revoked agent build hash presented at pairing')
        agentPairingsTotal.inc({ scope: pairing.scope, result: 'untrusted_build' })
        throw new BadRequestError('Untrusted or revoked agent binary. Please download an official release.')
      }
    }

    // 4. Atomically consume pairing code (single-use invariant)
    const updated = await prisma.agentPairing.updateMany({
      where: {
        id: pairing.id,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    })

    if (updated.count === 0) {
      agentPairingsTotal.inc({ scope: pairing.scope, result: 'race_conflict' })
      throw new ConflictError('Pairing code was already consumed by another process')
    }

    // 5. Generate session credentials
    const sessionKey = crypto.randomBytes(32).toString('base64')
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
    const sessionKeyEnc = encryptSessionKey(sessionKey)

    // 6. Persist session to PostgreSQL
    const sessionRecord = await prisma.agentSession.create({
      data: {
        scope: pairing.scope,
        studentId: pairing.studentId,
        attemptId: pairing.attemptId,
        tokenHash,
        sessionKeyEnc,
        agentVersion,
        os,
        arch,
        buildHash,
        deviceId: deviceId || 'unknown',
        pairIp: clientIp || null,
        lastSeq: 0,
        state: 'HEALTHY',
        startedAt: new Date()
      }
    })

    // 7. Store in hot cache for zero-DB heartbeat path
    const hotSession = {
      id: sessionRecord.id,
      scope: pairing.scope,
      studentId: pairing.studentId,
      attemptId: pairing.attemptId,
      tokenHash,
      sessionKey, // Plaintext base64 in RAM
      state: 'HEALTHY',
      lastSeq: 0,
      lastSeenAt: Date.now(),
      reportNow: false,
      openFindings: new Map(),
      dirty: false,
      seenNonces: new Set()
    }

    hotSessions.set(tokenHash, hotSession)
    if (pairing.attemptId) {
      attemptToToken.set(pairing.attemptId, tokenHash)
    }

    agentPairingsTotal.inc({ scope: pairing.scope, result: 'success' })
    agentSessionsGauge.set({ state: 'HEALTHY' }, hotSessions.size)

    return {
      sessionToken,
      sessionKey,
      policy,
      heartbeatMs: policy.heartbeatMs || 15000,
      serverTime: new Date().toISOString()
    }
  }

  /**
   * Fast in-memory token lookup with DB fallback
   */
  async getSessionByToken(sessionToken) {
    if (!sessionToken) return null
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')

    if (hotSessions.has(tokenHash)) {
      return hotSessions.get(tokenHash)
    }

    // DB fallback (e.g. after process restart)
    const dbSession = await prisma.agentSession.findFirst({
      where: {
        tokenHash,
        endedAt: null
      }
    })

    if (!dbSession) return null

    let decryptedKey
    try {
      decryptedKey = decryptSessionKey(dbSession.sessionKeyEnc)
    } catch (err) {
      logger.error({ err, sessionId: dbSession.id }, 'Failed to decrypt session key')
      return null
    }

    // Rehydrate open findings
    const findings = await prisma.agentFinding.findMany({
      where: {
        sessionId: dbSession.id,
        clearedAt: null
      }
    })

    const findingsMap = new Map()
    for (const f of findings) {
      findingsMap.set(f.ruleId, {
        id: f.id,
        ruleId: f.ruleId,
        firstSeenAt: f.firstSeenAt,
        lastSeenAt: f.lastSeenAt,
        hitCount: f.hitCount,
        cleanCount: 0
      })
    }

    const rehydrated = {
      id: dbSession.id,
      scope: dbSession.scope,
      studentId: dbSession.studentId,
      attemptId: dbSession.attemptId,
      tokenHash,
      sessionKey: decryptedKey,
      state: dbSession.state,
      lastSeq: dbSession.lastSeq,
      lastSeenAt: Date.now(),
      reportNow: false,
      openFindings: findingsMap,
      dirty: false,
      seenNonces: new Set()
    }

    hotSessions.set(tokenHash, rehydrated)
    if (dbSession.attemptId) {
      attemptToToken.set(dbSession.attemptId, tokenHash)
    }

    return rehydrated
  }

  /**
   * Look up active session for an attempt
   */
  async getSessionByAttemptId(attemptId) {
    if (!attemptId) return null
    const tokenHash = attemptToToken.get(attemptId)
    if (tokenHash && hotSessions.has(tokenHash)) {
      return hotSessions.get(tokenHash)
    }

    const dbSession = await prisma.agentSession.findFirst({
      where: {
        attemptId,
        endedAt: null
      },
      orderBy: { startedAt: 'desc' }
    })

    if (!dbSession) return null
    return this.getSessionByToken(dbSession.tokenHash)
  }

  /**
   * Look up active practice/precheck session for a student
   */
  async getSessionByStudentId(studentId) {
    if (!studentId) return null
    for (const session of hotSessions.values()) {
      if (session.studentId === studentId && session.scope === 'PRECHECK') {
        return session
      }
    }
    const dbSession = await prisma.agentSession.findFirst({
      where: {
        studentId,
        scope: 'PRECHECK',
        endedAt: null
      },
      orderBy: { startedAt: 'desc' }
    })
    if (!dbSession) return null
    return this.getSessionByToken(dbSession.tokenHash)
  }

  /**
   * Return all hot sessions (used by sweeper)
   */
  getAllHotSessions() {
    return Array.from(hotSessions.values())
  }

  /**
   * End session
   */
  async endSession(sessionId) {
    for (const [tokenHash, session] of hotSessions.entries()) {
      if (session.id === sessionId) {
        hotSessions.delete(tokenHash)
        if (session.attemptId) attemptToToken.delete(session.attemptId)
        break
      }
    }

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        state: 'TERMINATED'
      }
    })
  }

  /**
   * Clear all sessions (used in test teardown)
   */
  clearHotSessions() {
    hotSessions.clear()
    attemptToToken.clear()
  }
}

const agentSessionService = new AgentSessionService()

module.exports = {
  agentSessionService,
  hotSessions
}
