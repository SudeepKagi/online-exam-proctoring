'use strict'

const { prisma } = require('../../infra/postgres/client')
const { agentSessionService } = require('./agentSessionService')
const { policyService } = require('./policyService')
const { ForbiddenError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

const DEFAULT_AGENT_STALE_MS = 45 * 1000 // 45 seconds

/**
 * Centralized Device Agent Companion Policy Evaluator (Prompt 12 / §W2)
 *
 * Single source of truth for:
 * 1. Pre-exam readiness status (/api/v1/agent/status/attempt/:id)
 * 2. Attempt activation guard (/api/v1/exams/:id/attempt)
 *
 * Strict invariants:
 * - Policy REQUIRED requires an ATTEMPT-scoped session for this exact attemptId.
 * - PRECHECK sessions are practice-only and NEVER satisfy the gate.
 * - Heartbeat must be fresh (< AGENT_STALE_MS).
 * - Build hash must match an active release (no hardcoded dev bypass in production).
 * - No active findings with action BLOCK_START.
 * - Staff waiver bypasses gate and is recorded.
 */
async function evaluateDeviceGate({ attemptId, exam, studentId: _studentId }) {
  if (!exam) return { passed: true, reason: 'NO_EXAM', state: 'NOT_PAIRED' }

  // 1. Policy check
  if (exam.deviceAgentPolicy !== 'REQUIRED') {
    return {
      passed: true,
      reason: 'POLICY_NOT_REQUIRED',
      state: 'OPTIONAL',
      policy: exam.deviceAgentPolicy
    }
  }

  if (!attemptId) {
    return {
      passed: false,
      code: 'AGENT_REQUIRED',
      state: 'NOT_PAIRED',
      reason: 'ATTEMPT_REQUIRED',
      message: 'Exam attempt identifier is required for companion device verification.',
      policy: exam.deviceAgentPolicy
    }
  }

  // 2. Staff Waiver check
  let waiver = null
  try {
    waiver = await prisma.deviceAgentWaiver.findUnique({
      where: { attemptId }
    })
  } catch (err) {
    logger.warn({ err: err.message, attemptId }, 'deviceAgentWaiver lookup error, defaulting to no waiver')
  }
  if (waiver) {
    return {
      passed: true,
      reason: 'STAFF_WAIVER',
      state: 'WAIVED',
      waiver: { reason: waiver.reason, grantedAt: waiver.createdAt },
      policy: exam.deviceAgentPolicy
    }
  }

  // 3. Attempt-scoped session lookup (NEVER fall back to student precheck)
  const session = await agentSessionService.getSessionByAttemptId(attemptId)
  if (!session || session.state === 'TERMINATED') {
    return {
      passed: false,
      code: 'AGENT_REQUIRED',
      state: 'NOT_PAIRED',
      reason: 'NOT_PAIRED',
      message: 'Start the Device Companion and enter the code shown here.',
      policy: exam.deviceAgentPolicy
    }
  }

  // 4. Heartbeat freshness check
  const staleThresholdMs = parseInt(process.env.AGENT_STALE_MS || `${DEFAULT_AGENT_STALE_MS}`, 10)
  const lastSeenMs = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0
  const elapsedMs = Date.now() - lastSeenMs

  if (elapsedMs > staleThresholdMs) {
    return {
      passed: false,
      code: 'AGENT_REQUIRED',
      state: 'LOST_CONNECTION',
      reason: 'LOST_CONNECTION',
      message: 'Device Companion connection lost. Ensure the companion application is running.',
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
      elapsedMs,
      policy: exam.deviceAgentPolicy,
      session
    }
  }

  // 5. Build hash verification
  const isProd = process.env.NODE_ENV === 'production'
  const e2eHash = process.env.E2E_AGENT_BUILD_HASH

  if (isProd) {
    const releaseCount = await prisma.agentRelease.count()
    if (releaseCount === 0) {
      logger.error('CRITICAL: deviceAgentPolicy is REQUIRED but agent_releases is empty in production')
      return {
        passed: false,
        code: 'AGENT_REQUIRED',
        state: 'UNAVAILABLE',
        reason: 'RELEASES_EMPTY',
        message: 'Device Companion verification is unavailable: No approved release configured.',
        policy: exam.deviceAgentPolicy,
        session
      }
    }

    const validRelease = await prisma.agentRelease.findFirst({
      where: {
        sha256: session.buildHash,
        revokedAt: null
      }
    })

    if (!validRelease) {
      return {
        passed: false,
        code: 'AGENT_REQUIRED',
        state: 'UNTRUSTED_BUILD',
        reason: 'UNTRUSTED_BUILD',
        message: 'Untrusted or outdated companion release. Please download the official release.',
        policy: exam.deviceAgentPolicy,
        session
      }
    }
  } else if (e2eHash && session.buildHash !== e2eHash) {
    const release = await prisma.agentRelease.findFirst({
      where: {
        sha256: session.buildHash,
        revokedAt: null
      }
    })
    if (!release) {
      return {
        passed: false,
        code: 'AGENT_REQUIRED',
        state: 'UNTRUSTED_BUILD',
        reason: 'UNTRUSTED_BUILD',
        message: 'Untrusted companion build hash.',
        policy: exam.deviceAgentPolicy,
        session
      }
    }
  }

  // 6. Check open findings for BLOCK_START actions
  if (session.openFindings && session.openFindings.size > 0) {
    const policy = await policyService.getLatestSignedPolicy()
    const rulesMap = new Map((policy.rules || []).map(r => [r.id, r]))

    for (const finding of session.openFindings.values()) {
      const rule = rulesMap.get(finding.ruleId)
      if (rule && rule.action === 'BLOCK_START') {
        return {
          passed: false,
          code: 'AGENT_REQUIRED',
          state: 'DEGRADED',
          reason: 'BLOCKING_FINDING',
          message: `Prohibited software detected: ${rule.name}. Close prohibited applications before entering.`,
          blockingRule: rule.name,
          policy: exam.deviceAgentPolicy,
          session
        }
      }
    }
  }

  // 7. Gate Passed
  const hasNonBlockingFindings = session.openFindings && session.openFindings.size > 0
  return {
    passed: true,
    code: null,
    state: hasNonBlockingFindings ? 'DEGRADED' : 'HEALTHY',
    reason: 'HEALTHY',
    lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
    policy: exam.deviceAgentPolicy,
    session
  }
}

/**
 * Throws ForbiddenError if gate is not passed (used by attempt activation)
 */
async function assertDeviceGate({ attemptId, exam, studentId }) {
  const result = await evaluateDeviceGate({ attemptId, exam, studentId })
  if (!result.passed) {
    throw new ForbiddenError(result.message, result.code || 'AGENT_REQUIRED')
  }
  return result
}

module.exports = {
  evaluateDeviceGate,
  assertDeviceGate,
  DEFAULT_AGENT_STALE_MS
}
