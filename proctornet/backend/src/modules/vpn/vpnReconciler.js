/**
 * modules/vpn/vpnReconciler.js
 * WireGuard Peer Reconciliation & Health Monitor (P8 Task 7 / ADR-010)
 *
 * Runs every 60s to:
 * 1. Synchronize live WireGuard interface state with active PostgreSQL exam attempts.
 * 2. Remove orphan peers (present on interface, absent in active attempts).
 * 3. Re-add missing peers (active attempt holds lease, interface lacks peer).
 * 4. Monitor handshake age; if stale > 3x keepalive (75s) for > 45s debounce:
 *    Emit server-originated VPN_DISCONNECT violation.
 *    - In 'enforce' mode: transition attempt to SUSPENDED.
 *    - In 'warn' mode: record violation warning only.
 */

const { getVpnProvider } = require('../../infra/vpn')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class VpnReconciler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || parseInt(process.env.VPN_RECONCILER_INTERVAL_MS || '60000', 10)
    this.keepaliveSeconds = 25
    this.staleThresholdMs = 3 * this.keepaliveSeconds * 1000 // 75,000 ms
    this.debounceMs = 45 * 1000 // 45,000 ms
    this.staleTracker = new Map() // publicKey -> timestamp first seen stale
    this.emittedDisconnects = new Set() // publicKey -> disconnect already emitted
    this.timer = null
    this.isRunning = false
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    logger.info({ intervalMs: this.intervalMs }, '[VpnReconciler] Background reconciler started')
    this._scheduleNext()
  }

  stop() {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    logger.info('[VpnReconciler] Background reconciler stopped')
  }

  _scheduleNext() {
    if (!this.isRunning) return
    this.timer = setTimeout(async () => {
      try {
        await this.reconcile()
      } catch (err) {
        logger.error({ error: err.message }, '[VpnReconciler] Error in reconciliation loop')
      } finally {
        this._scheduleNext()
      }
    }, this.intervalMs)
  }

  /**
   * Execute one reconciliation sweep
   */
  async reconcile() {
    const isVpnEnabled = process.env.VPN_ENABLED === 'true'
    if (!isVpnEnabled) {
      return { status: 'skipped', reason: 'VPN_ENABLED=false' }
    }

    const provider = getVpnProvider()
    const now = Date.now()

    // 1. Fetch active DB peers from active attempts via direct SQL join
    const rawPeers = await prisma.$queryRawUnsafe(`
      SELECT vp.id, vp.attempt_id AS "attemptId", vp.student_id AS "studentId",
             vp.ip_address AS "ipAddress", vp.public_key AS "publicKey",
             ea.status AS "attemptStatus", ea.exam_id AS "examId"
      FROM vpn_peers vp
      JOIN exam_attempts ea ON ea.id = vp.attempt_id
      WHERE vp.is_active = true AND ea.status IN ('READY', 'ACTIVE', 'SUSPENDED');
    `).catch(() => [])

    const activeDbPeers = (rawPeers || []).map(r => ({
      id: r.id,
      attemptId: r.attemptId,
      studentId: r.studentId,
      ipAddress: r.ipAddress,
      publicKey: r.publicKey,
      attempt: {
        id: r.attemptId,
        studentId: r.studentId,
        status: r.attemptStatus,
        examId: r.examId
      }
    }))

    const dbPeerMap = new Map(activeDbPeers.map(p => [p.publicKey, p]))

    // 2. Fetch live interface peers from provider
    const livePeers = await provider.listPeers()
    const livePeerMap = new Map(livePeers.map(p => [p.publicKey, p]))

    let orphansRemoved = 0
    let missingAdded = 0
    let disconnectsEmitted = 0

    // 3. Remove orphans (on WireGuard, but not active in DB)
    for (const livePeer of livePeers) {
      if (!dbPeerMap.has(livePeer.publicKey)) {
        logger.info({
          publicKeyPreview: livePeer.publicKey.substring(0, 8),
          allowedIps: livePeer.allowedIps
        }, '[VpnReconciler] Removing orphan peer from WireGuard')
        await provider.removePeer(livePeer.publicKey).catch(err => {
          logger.warn({ error: err.message }, '[VpnReconciler] Failed to remove orphan peer')
        })
        orphansRemoved++
        this.staleTracker.delete(livePeer.publicKey)
        this.emittedDisconnects.delete(livePeer.publicKey)
      }
    }

    // 4. Re-add missing peers (active in DB, missing on WireGuard)
    for (const dbPeer of activeDbPeers) {
      if (!livePeerMap.has(dbPeer.publicKey)) {
        logger.info({
          attemptId: dbPeer.attemptId,
          publicKeyPreview: dbPeer.publicKey.substring(0, 8),
          ip: dbPeer.ipAddress
        }, '[VpnReconciler] Re-adding missing peer to WireGuard')
        await provider.addPeer({
          publicKey: dbPeer.publicKey,
          ip: dbPeer.ipAddress
        }).catch(err => {
          logger.warn({ error: err.message }, '[VpnReconciler] Failed to re-add missing peer')
        })
        missingAdded++
      }
    }

    // 5. Inspect handshake age for active peers
    const enforcement = (process.env.VPN_ENFORCEMENT || 'none').toLowerCase()

    for (const dbPeer of activeDbPeers) {
      const livePeer = livePeerMap.get(dbPeer.publicKey)
      if (!livePeer) continue

      const latestHandshake = livePeer.latestHandshakeAt ? new Date(livePeer.latestHandshakeAt).getTime() : null
      const isStale = !latestHandshake || (now - latestHandshake) > this.staleThresholdMs

      if (isStale) {
        if (!this.staleTracker.has(dbPeer.publicKey)) {
          this.staleTracker.set(dbPeer.publicKey, now)
        } else {
          const firstStaleAt = this.staleTracker.get(dbPeer.publicKey)
          const staleDuration = now - firstStaleAt

          // If stale for > 45s debounce and not already emitted
          if (staleDuration >= this.debounceMs && !this.emittedDisconnects.has(dbPeer.publicKey)) {
            this.emittedDisconnects.add(dbPeer.publicKey)
            disconnectsEmitted++

            await this._handleDisconnect({
              dbPeer,
              enforcement,
              handshakeAgeMs: latestHandshake ? (now - latestHandshake) : null,
              staleDurationMs: staleDuration
            })
          }
        }
      } else {
        // Handshake is fresh: clear stale state
        this.staleTracker.delete(dbPeer.publicKey)
        this.emittedDisconnects.delete(dbPeer.publicKey)
      }
    }

    return {
      status: 'completed',
      activeDbPeers: activeDbPeers.length,
      livePeers: livePeers.length,
      orphansRemoved,
      missingAdded,
      disconnectsEmitted
    }
  }

  /**
   * Handle server-originated VPN_DISCONNECT event
   */
  async _handleDisconnect({ dbPeer, enforcement, handshakeAgeMs, staleDurationMs }) {
    logger.warn({
      attemptId: dbPeer.attemptId,
      publicKeyPreview: dbPeer.publicKey.substring(0, 8),
      enforcement,
      handshakeAgeMs,
      staleDurationMs
    }, '[VpnReconciler] Emitting server-originated VPN_DISCONNECT')

    if (enforcement !== 'enforce' && enforcement !== 'warn') {
      return
    }

    // Record violation in DB
    const severity = enforcement === 'enforce' ? 'HIGH' : 'MEDIUM'
    const description = enforcement === 'enforce'
      ? 'WireGuard tunnel handshake lost (> 120s) - Attempt suspended'
      : 'WireGuard tunnel handshake lost (> 120s)'

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO violation_events (attempt_id, event_type, severity, source, metadata, server_timestamp)
        VALUES ($1::uuid, 'VPN_DISCONNECT'::"ViolationType", $2::"Severity", 'SERVER_EVENT', $3::jsonb, now());
      `, dbPeer.attemptId, severity, JSON.stringify({ description }))
    } catch (vErr) {
      logger.warn({ error: vErr.message, attemptId: dbPeer.attemptId }, '[VpnReconciler] Failed to insert violation')
    }

    // If enforcement is 'enforce' and attempt is ACTIVE, suspend it
    if (enforcement === 'enforce' && dbPeer.attempt.status === 'ACTIVE') {
      try {
        const { attemptService } = require('../attempts/service')
        await attemptService.transitionState(dbPeer.attemptId, 'SUSPENDED', {
          actorId: 'system',
          actorRole: 'system',
          reason: 'VPN tunnel disconnected'
        })
        logger.info({ attemptId: dbPeer.attemptId }, '[VpnReconciler] Suspended attempt due to VPN disconnect')
      } catch (tErr) {
        logger.error({ error: tErr.message, attemptId: dbPeer.attemptId }, '[VpnReconciler] Failed to suspend attempt')
      }
    }

    // Emit event via WebSocket Redis emitter (C-06)
    try {
      const { socketEmitter } = require('../../infra/websocket/emitter')
      socketEmitter.emitToAttempt(dbPeer.attemptId, 'attempt:violation', {
        attemptId: dbPeer.attemptId,
        type: 'VPN_DISCONNECT',
        severity,
        description,
        enforcement
      })
    } catch (wsErr) {
      logger.warn({ error: wsErr.message }, '[VpnReconciler] Failed to emit WS violation')
    }
  }

  reset() {
    this.staleTracker.clear()
    this.emittedDisconnects.clear()
  }
}

const vpnReconciler = new VpnReconciler()

module.exports = {
  VpnReconciler,
  vpnReconciler
}
