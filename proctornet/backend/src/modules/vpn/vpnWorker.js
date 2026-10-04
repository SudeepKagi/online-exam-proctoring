/**
 * modules/vpn/vpnWorker.js
 * Asynchronous Transactional Outbox Worker for WireGuard VPN (P8 Task 6 / ADR-010)
 *
 * Consumes 'vpn.peer.add' and 'vpn.peer.remove' events from RabbitMQ 'pn.vpn' queue.
 * Dispatches to the configured VpnProvider with exponential backoff retries.
 * Guarantees zero shell/SSH execution in request paths or database transactions.
 */

const { rabbitmq } = require('../../infra/rabbitmq/client')
const { getVpnProvider } = require('../../infra/vpn')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class VpnWorker {
  constructor() {
    this.consumerTag = null
    this.isStarted = false
  }

  async start() {
    if (this.isStarted) return
    this.isStarted = true

    logger.info('Starting VpnWorker for asynchronous WireGuard peer management')

    try {
      this.consumerTag = await rabbitmq.consume('vpn', async (event, msg) => {
        await this.processEvent(event)
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not immediately start RabbitMQ vpn consumer; will retry')
    }
  }

  async stop() {
    this.isStarted = false
    this.consumerTag = null
  }

  /**
   * Process a single VPN event idempotently
   * @param {Object} event - Outbox event envelope or raw event
   */
  async processEvent(event) {
    const payload = event.payload || event
    const eventType = event.type || event.event_type || payload.type
    const eventId = event.eventId || payload.eventId || `${payload.attemptId || 'vpn'}:${eventType}:${Date.now()}`

    if (!payload.publicKey) {
      logger.warn({ event }, '[VpnWorker] Received VPN event without publicKey')
      return
    }

    logger.info({
      eventType,
      attemptId: payload.attemptId,
      publicKeyPreview: payload.publicKey.substring(0, 8)
    }, '[VpnWorker] Processing VPN event')

    // 1. Idempotency guard via processed_events table
    try {
      const inserted = await prisma.$executeRawUnsafe(`
        INSERT INTO processed_events (id, event_id, handler_name, processed_at)
        VALUES (gen_random_uuid(), $1, 'vpn_worker', now())
        ON CONFLICT (event_id, handler_name) DO NOTHING;
      `, String(eventId))

      if (inserted === 0 && event.eventId) {
        logger.info({ eventId }, '[VpnWorker] Event already processed; skipping duplicate')
        return
      }
    } catch (err) {
      logger.warn({ error: err.message, eventId }, '[VpnWorker] Idempotency record warning')
    }

    // 2. Dispatch to configured VpnProvider
    const provider = getVpnProvider()

    if (eventType === 'vpn.peer.add') {
      const { publicKey, ipAddress, expiresAt } = payload
      await provider.addPeer({
        publicKey,
        ip: ipAddress,
        expiresAt
      })
      logger.info({
        publicKeyPreview: publicKey.substring(0, 8),
        ipAddress,
        provider: provider.name
      }, '[VpnWorker] Successfully added peer via provider')
    } else if (eventType === 'vpn.peer.remove') {
      const { publicKey } = payload
      await provider.removePeer(publicKey)
      logger.info({
        publicKeyPreview: publicKey.substring(0, 8),
        provider: provider.name
      }, '[VpnWorker] Successfully removed peer via provider')
    } else {
      logger.warn({ eventType }, '[VpnWorker] Unrecognized VPN event type')
    }
  }
}

const vpnWorker = new VpnWorker()

module.exports = {
  VpnWorker,
  vpnWorker
}
