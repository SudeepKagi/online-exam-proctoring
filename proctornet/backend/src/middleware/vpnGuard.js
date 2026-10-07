/**
 * middleware/vpnGuard.js
 * Network Boundary Enforcement Middleware (P8 Task 8 / Notion 13.2, 13.15 / ADR-010)
 *
 * When VPN_ENABLED=true and VPN_ENFORCEMENT=enforce:
 * - Resolves true client IP from configured trusted proxies.
 * - Enforces that client IP matches the attempt's leased VPN IP in vpn_ip_pool.
 *
 * Security Invariant (Notion 13.2/13.15):
 * VPN presence is a BOUNDARY, NOT AUTHORIZATION, and NOT proof of physical location.
 * All standard authentication (JWT), RBAC, and ownership checks must still execute.
 */

const { prisma } = require('../infra/postgres/client')
const { logger } = require('../shared/logging')

function normalizeIp(ip) {
  if (!ip) return ''
  // Normalize IPv6-mapped IPv4 (e.g. ::ffff:10.8.0.2 -> 10.8.0.2)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7)
  }
  return ip
}

function resolveClientIp(req) {
  const trustedProxies = (process.env.TRUSTED_PROXIES || '127.0.0.1,::1')
    .split(',')
    .map(p => p.trim().toLowerCase())

  const directIp = normalizeIp(req.socket.remoteAddress || req.ip)

  // Only trust X-Forwarded-For if incoming direct connection is from a configured proxy
  if (trustedProxies.includes(directIp.toLowerCase()) && req.headers['x-forwarded-for']) {
    const forwardedIps = req.headers['x-forwarded-for'].split(',').map(s => s.trim())
    // Leftmost entry is original client
    return normalizeIp(forwardedIps[0])
  }

  return directIp
}

async function vpnGuard(req, res, next) {
  const isVpnEnabled = process.env.VPN_ENABLED === 'true'
  const isEnforcing = (process.env.VPN_ENFORCEMENT || '').toLowerCase() === 'enforce'

  // If VPN is disabled or not in 'enforce' mode, pass through cleanly
  if (!isVpnEnabled || !isEnforcing) {
    return next()
  }

  const attemptId = req.params.attemptId || req.body?.attemptId || req.headers['x-attempt-id']

  // If request has no attemptId context, let subsequent handlers validate or pass
  if (!attemptId) {
    return next()
  }

  try {
    // 1. Resolve true client IP
    const clientIp = resolveClientIp(req)

    // 2. Fetch leased IP for this attempt from database
    const lease = await prisma.vpnIpPool.findFirst({
      where: { attemptId }
    })

    if (!lease || !lease.ip) {
      logger.warn({ attemptId, clientIp }, '[vpnGuard] Request rejected: Attempt has no active VPN lease')
      return res.status(403).json({
        error: {
          code: 'VPN_REQUIRED',
          message: 'VPN tunnel connection is required to access exam-critical routes.'
        }
      })
    }

    const leasedIp = normalizeIp(lease.ip)

    // 3. Verify client IP matches leased VPN IP
    if (clientIp !== leasedIp) {
      logger.warn({
        attemptId,
        clientIp,
        leasedIp
      }, '[vpnGuard] Boundary violation: Request IP does not match leased VPN IP')

      // Record violation
      await prisma.$executeRawUnsafe(`
        INSERT INTO violation_events (attempt_id, event_type, severity, source, metadata, server_timestamp)
        VALUES ($1::uuid, 'VPN_IP_MISMATCH'::"ViolationType", 'HIGH'::"Severity", 'SERVER_EVENT', $2::jsonb, now());
      `, attemptId, JSON.stringify({ message: `IP mismatch: expected ${leasedIp}, got ${clientIp}` })).catch((err) => {
        logger.error({ error: err.message, attemptId }, 'Failed to record VPN_IP_MISMATCH violation')
      })

      return res.status(403).json({
        error: {
          code: 'VPN_IP_MISMATCH',
          message: 'Request client IP does not match the leased VPN tunnel IP.'
        }
      })
    }

    // IP matches: boundary satisfied (auth middleware will still authenticate user)
    next()
  } catch (err) {
    logger.error({ error: err.message, attemptId }, '[vpnGuard] Error resolving VPN lease')
    return res.status(500).json({
      error: {
        code: 'VPN_GUARD_ERROR',
        message: 'Internal error validating VPN network boundary.'
      }
    })
  }
}

module.exports = {
  vpnGuard,
  resolveClientIp,
  normalizeIp
}
