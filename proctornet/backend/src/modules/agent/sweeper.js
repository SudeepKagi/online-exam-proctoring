const { prisma } = require('../../infra/postgres/client')
const { agentSessionService } = require('./agentSessionService')
const { attemptStateMachine } = require('../attempts/stateMachine')
const { logger } = require('../../shared/logging')
const { agentSessionsGauge } = require('../../observability/metrics')

const DEFAULT_STALE_THRESHOLD_MS = 60 * 1000 // 60s (3 * 15s interval + 15s grace)

class AgentSweeper {
  constructor() {
    this.timer = null
    this.intervalMs = 15000 // Run every 15s
    this.isRunning = false
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.sweep().catch(err => {
        logger.error({ err }, 'Error during agent sweeper cycle')
      })
    }, this.intervalMs)
    this.timer.unref() // Don't block process exit
    this.isRunning = true
    logger.info('Agent companion heartbeat sweeper started')
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isRunning = false
  }

  /**
   * Run one sweep cycle over active sessions
   */
  async sweep(staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS) {
    const now = Date.now()
    const sessions = agentSessionService.getAllHotSessions()

    for (const session of sessions) {
      if (session.state === 'TERMINATED') continue

      const elapsed = now - (session.lastSeenAt || 0)
      if (elapsed > staleThresholdMs && session.state !== 'STALE') {
        // Transition session to STALE
        session.state = 'STALE'
        session.dirty = true

        await prisma.agentSession.update({
          where: { id: session.id },
          data: { state: 'STALE' }
        }).catch(err => logger.error({ err, sessionId: session.id }, 'Failed to persist STALE session'))

        agentSessionsGauge.set({ state: 'STALE' }, 1)

        // If session is linked to an attempt, check if policy is REQUIRED
        if (session.attemptId) {
          const attempt = await prisma.examAttempt.findUnique({
            where: { id: session.attemptId },
            include: { exam: true }
          })

          if (attempt && attempt.status === 'ACTIVE') {
            // Check if waiver exists
            const waiver = await prisma.deviceAgentWaiver.findUnique({
              where: { attemptId: attempt.id }
            })

            if (!waiver && attempt.exam.deviceAgentPolicy === 'REQUIRED') {
              // 1. Emit AGENT_DISCONNECTED violation
              await prisma.violationEvent.create({
                data: {
                  attemptId: attempt.id,
                  eventType: 'AGENT_DISCONNECTED',
                  severity: 'HIGH',
                  source: 'AGENT_SWEEPER',
                  metadata: {
                    sessionId: session.id,
                    elapsedMs: elapsed,
                    reason: 'Agent companion heartbeat missed > 60s'
                  }
                }
              }).catch(err => logger.error({ err }, 'Failed to record AGENT_DISCONNECTED violation'))

              // 2. Transition attempt to SUSPENDED via CTE state machine (pauses exam timer)
              try {
                await attemptStateMachine.transition(attempt.id, 'SUSPENDED', {
                  reason: 'AGENT_STALE',
                  metadata: {
                    sessionId: session.id,
                    disconnectTime: new Date().toISOString()
                  }
                })
                logger.warn({ attemptId: attempt.id }, 'Attempt transitioned to SUSPENDED due to disconnected REQUIRED agent companion')
              } catch (transErr) {
                logger.debug({ err: transErr.message }, 'Attempt transition ignored by sweeper')
              }
            }
          }
        }
      }
    }
  }
}

const agentSweeper = new AgentSweeper()

module.exports = {
  agentSweeper,
  DEFAULT_STALE_THRESHOLD_MS
}
