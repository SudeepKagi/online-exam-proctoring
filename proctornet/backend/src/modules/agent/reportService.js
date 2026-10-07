const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')
const { verifyReportSignature } = require('../../utils/encryption')
const { agentSessionService } = require('./agentSessionService')
const { policyService } = require('./policyService')
const { assertPrivacyCompliance } = require('./validation')
const { attemptStateMachine } = require('../attempts/stateMachine')
const {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  TooManyRequestsError
} = require('../../shared/errors')
const { logger } = require('../../shared/logging')
const {
  agentReportsTotal,
  agentRejectionsTotal,
  agentFindingsOpenGauge
} = require('../../observability/metrics')

const CLOCK_SKEW_WINDOW_MS = 60 * 1000 // 60 seconds
const MIN_REPORT_INTERVAL_MS = 4000    // 4 seconds (1s grace below 5s)

// Map category to shared violation types
const CATEGORY_TO_VIOLATION = {
  REMOTE_ACCESS: 'REMOTE_SESSION_DETECTED',
  REMOTE_SESSION: 'REMOTE_SESSION_DETECTED',
  VIRTUAL_CAMERA: 'VIRTUAL_CAMERA_DETECTED',
  VIRTUAL_MACHINE: 'VIRTUAL_MACHINE_DETECTED',
  DISPLAY: 'MULTIPLE_DISPLAYS',
  SCREEN_CAPTURE: 'UNAUTHORIZED_APPLICATION',
  AI_ASSISTANT: 'UNAUTHORIZED_APPLICATION',
  OTHER: 'UNAUTHORIZED_APPLICATION'
}

class ReportService {
  /**
   * Process incoming signed agent telemetry report
   */
  async processReport(headers, rawBody, bodyObj, path = '/api/v1/agent/report', method = 'POST') {
    const sessionTokenHeader = headers['x-agent-session'] || headers['authorization']?.replace(/^Bearer\s+/i, '')
    const seqHeader = headers['x-agent-seq']
    const tsHeader = headers['x-agent-ts']
    const nonceHeader = headers['x-agent-nonce']
    const signatureHeader = headers['x-agent-signature']

    // 1. Header validation
    if (!sessionTokenHeader || !seqHeader || !tsHeader || !nonceHeader || !signatureHeader) {
      agentRejectionsTotal.inc({ reason: 'missing_headers' })
      throw new UnauthorizedError('Missing required agent authentication headers')
    }

    const seq = parseInt(seqHeader, 10)
    const ts = parseInt(tsHeader, 10)
    if (isNaN(seq) || isNaN(ts)) {
      agentRejectionsTotal.inc({ reason: 'invalid_header_types' })
      throw new BadRequestError('Invalid header types for sequence or timestamp')
    }

    // 2. Session lookup
    const session = await agentSessionService.getSessionByToken(sessionTokenHeader)
    if (!session) {
      agentRejectionsTotal.inc({ reason: 'unknown_session' })
      throw new UnauthorizedError('Invalid or expired agent session token')
    }

    // 3. Rate limiting (min 5s interval with 1s grace)
    const now = Date.now()
    if (process.env.NODE_ENV !== 'test' && session.lastSeenAt && now - session.lastSeenAt < MIN_REPORT_INTERVAL_MS) {
      agentRejectionsTotal.inc({ reason: 'rate_limited' })
      throw new TooManyRequestsError('Report rate limit exceeded (maximum 1 report per 5 seconds)')
    }

    // 4. Clock skew check (±60 seconds)
    if (Math.abs(now - ts) > CLOCK_SKEW_WINDOW_MS) {
      agentRejectionsTotal.inc({ reason: 'clock_skew' })
      const skewError = new BadRequestError('Agent clock skew exceeds allowed window')
      skewError.code = 'CLOCK_SKEW'
      skewError.serverTime = new Date().toISOString()
      throw skewError
    }

    // 5. Monotonic sequence check (last_seq < seq <= last_seq + 100)
    if (seq <= session.lastSeq || seq > session.lastSeq + 100) {
      agentRejectionsTotal.inc({ reason: 'seq_out_of_order' })
      throw new ConflictError(`Invalid sequence number: expected > ${session.lastSeq} and <= ${session.lastSeq + 100}, got ${seq}`)
    }

    // 6. Nonce replay check
    if (session.seenNonces.has(nonceHeader)) {
      agentRejectionsTotal.inc({ reason: 'nonce_replayed' })
      throw new ConflictError('Replay detected: nonce has already been processed')
    }
    session.seenNonces.add(nonceHeader)
    // Keep nonce set bounded
    if (session.seenNonces.size > 200) {
      const arr = Array.from(session.seenNonces)
      session.seenNonces = new Set(arr.slice(arr.length - 100))
    }

    // 7. HMAC signature verification
    const isValidSig = verifyReportSignature(
      session.sessionKey,
      method,
      path,
      seq,
      ts,
      nonceHeader,
      rawBody,
      signatureHeader
    )

    if (!isValidSig) {
      agentRejectionsTotal.inc({ reason: 'invalid_signature' })
      throw new UnauthorizedError('Invalid HMAC signature')
    }

    // 8. Strict Privacy Contract Enforcement
    try {
      assertPrivacyCompliance(bodyObj)
    } catch (privacyErr) {
      agentRejectionsTotal.inc({ reason: 'privacy_contract_violation' })
      logger.error({ err: privacyErr.message, sessionId: session.id }, 'Agent report rejected for privacy violation')
      throw new BadRequestError(privacyErr.message)
    }

    // 9. Process findings and telemetry
    const policy = await policyService.getLatestSignedPolicy()
    const rulesMap = new Map((policy.rules || []).map(r => [r.id, r]))

    const incomingFindingRuleIds = new Set()

    // Explicit findings
    if (Array.isArray(bodyObj.findings)) {
      for (const item of bodyObj.findings) {
        if (item.ruleId && rulesMap.has(item.ruleId)) {
          incomingFindingRuleIds.add(item.ruleId)
        }
      }
    }

    // Synthetic rule evaluations from structured signals
    if (bodyObj.session?.remote) {
      if (rulesMap.has('r-session-remote-general')) incomingFindingRuleIds.add('r-session-remote-general')
    }
    if (bodyObj.display?.count > 1) {
      if (rulesMap.has('r-display-multiple')) incomingFindingRuleIds.add('r-display-multiple')
    }
    if (bodyObj.vm?.indicators?.length > 0) {
      if (rulesMap.has('r-vm-hardware')) incomingFindingRuleIds.add('r-vm-hardware')
    }
    if (bodyObj.cameras?.virtual?.length > 0) {
      if (rulesMap.has('r-cam-virtual')) incomingFindingRuleIds.add('r-cam-virtual')
    }

    let hasCriticalOrBlock = false

    // Handle new & existing findings
    for (const ruleId of incomingFindingRuleIds) {
      const rule = rulesMap.get(ruleId)
      if (!rule) continue

      if (['SUSPEND', 'BLOCK_START'].includes(rule.action)) {
        hasCriticalOrBlock = true
      }

      if (session.openFindings.has(ruleId)) {
        // Existing finding
        const finding = session.openFindings.get(ruleId)
        finding.hitCount += 1
        finding.lastSeenAt = new Date()
        finding.cleanCount = 0
      } else {
        // New finding -> Record in DB & emit violation
        const findingRecord = await prisma.agentFinding.create({
          data: {
            sessionId: session.id,
            attemptId: session.attemptId || null,
            ruleId,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            hitCount: 1
          }
        })

        session.openFindings.set(ruleId, {
          id: findingRecord.id,
          ruleId,
          firstSeenAt: findingRecord.firstSeenAt,
          lastSeenAt: findingRecord.lastSeenAt,
          hitCount: 1,
          cleanCount: 0
        })

        // Emit ViolationEvent if bound to an exam attempt
        if (session.attemptId) {
          const eventType = CATEGORY_TO_VIOLATION[rule.category] || 'UNAUTHORIZED_APPLICATION'
          await prisma.violationEvent.create({
            data: {
              attemptId: session.attemptId,
              eventType,
              severity: rule.severity,
              source: 'AGENT_REPORT',
              metadata: {
                ruleId: rule.id,
                ruleName: rule.name,
                category: rule.category,
                action: rule.action
              }
            }
          })

          // If action is SUSPEND, transition attempt atomically via CTE state machine
          if (rule.action === 'SUSPEND') {
            try {
              await attemptStateMachine.transition(session.attemptId, 'SUSPENDED', {
                reason: `AGENT_RULE_TRIGGERED: ${rule.name}`,
                metadata: { ruleId: rule.id, ruleName: rule.name }
              })
              logger.warn({ attemptId: session.attemptId, ruleId }, 'Attempt transitioned to SUSPENDED due to agent rule')
            } catch (transitionErr) {
              // If already SUSPENDED or in terminal state, ignore transition conflict
              logger.debug({ err: transitionErr.message }, 'Attempt transition ignored')
            }
          }
        }
      }
    }

    // Handle cleared findings (2 consecutive clean reports)
    const openRuleIds = Array.from(session.openFindings.keys())
    for (const ruleId of openRuleIds) {
      if (!incomingFindingRuleIds.has(ruleId)) {
        const finding = session.openFindings.get(ruleId)
        finding.cleanCount += 1

        if (finding.cleanCount >= 2) {
          // Cleared!
          await prisma.agentFinding.update({
            where: { id: finding.id },
            data: { clearedAt: new Date() }
          })
          session.openFindings.delete(ruleId)
          logger.info({ sessionId: session.id, ruleId }, 'Agent finding cleared after 2 clean reports')

          // Check if attempt can auto-resume (if was suspended solely by this finding)
          if (session.attemptId && session.openFindings.size === 0) {
            try {
              const attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } })
              if (attempt && attempt.status === 'SUSPENDED' && attempt.statusReason?.startsWith('AGENT_RULE_TRIGGERED')) {
                await attemptStateMachine.transition(session.attemptId, 'ACTIVE', {
                  reason: 'AGENT_FINDING_CLEARED'
                })
                logger.info({ attemptId: session.attemptId }, 'Attempt auto-resumed after agent findings cleared')
              }
            } catch (resumeErr) {
              logger.debug({ err: resumeErr.message }, 'Auto-resume skipped')
            }
          }
        }
      }
    }

    // 10. Update session hot state
    session.lastSeq = seq
    session.lastSeenAt = now
    const previousState = session.state
    session.state = hasCriticalOrBlock ? 'DEGRADED' : 'HEALTHY'

    // Auto-resume if reconnecting after AGENT_STALE suspension
    if (previousState === 'STALE' && session.attemptId && !hasCriticalOrBlock) {
      try {
        const attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } })
        if (attempt && attempt.status === 'SUSPENDED' && attempt.statusReason === 'AGENT_STALE') {
          await attemptStateMachine.transition(session.attemptId, 'ACTIVE', {
            reason: 'AGENT_RECONNECTED'
          })
          logger.info({ attemptId: session.attemptId }, 'Attempt auto-resumed after agent reconnected')
        }
      } catch (resumeErr) {
        logger.debug({ err: resumeErr.message }, 'Auto-resume on reconnect skipped')
      }
    }

    // Write to DB on state change
    if (session.state !== previousState) {
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { state: session.state, lastSeq: seq }
      })

    }

    agentReportsTotal.inc({ result: 'success' })
    agentFindingsOpenGauge.set({ category: 'TOTAL' }, session.openFindings.size)

    const shouldReportNow = session.reportNow || false
    session.reportNow = false

    return {
      ok: true,
      nextHeartbeatMs: policy.heartbeatMs || 15000,
      policyVersion: policy.version,
      reportNow: shouldReportNow,
      exit: false
    }
  }
}

const reportService = new ReportService()

module.exports = {
  reportService,
  CLOCK_SKEW_WINDOW_MS,
  MIN_REPORT_INTERVAL_MS
}
