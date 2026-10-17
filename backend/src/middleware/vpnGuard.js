const { prisma } = require('../infra/postgres/client')
const { logger } = require('../shared/logging')

function normalizeIp(ip) {
  if (!ip) return ''
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7)
  }
  return ip
}

function resolveClientIp(req) {
  const directIp = normalizeIp(req.socket?.remoteAddress || req.ip)
  if (req.headers && req.headers['x-forwarded-for']) {
    const forwardedIps = req.headers['x-forwarded-for'].split(',').map(s => s.trim())
    return normalizeIp(forwardedIps[0])
  }
  return directIp
}

async function vpnGuard(req, res, next) {
  const isVpnEnabled = process.env.VPN_ENABLED === 'true'
  if (!isVpnEnabled) {
    return next()
  }

  const attemptId = req.params.attemptId || req.body?.attemptId || req.headers?.['x-attempt-id']
  if (!attemptId) {
    return next()
  }

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true }
    })

    if (!attempt || !attempt.exam || !attempt.exam.requireVpn) {
      return next()
    }

    const clientIp = resolveClientIp(req)
    const vpnSubnet = process.env.VPN_SUBNET || '10.8.0.'
    if (!clientIp.startsWith(vpnSubnet)) {
      logger.warn({ attemptId, clientIp, vpnSubnet }, '[vpnGuard] Client IP does not match required VPN subnet')
      return res.status(403).json({
        error: {
          code: 'VPN_REQUIRED',
          message: 'This examination requires connection through institutional VPN subnet.'
        }
      })
    }

    return next()
  } catch (err) {
    logger.warn({ error: err.message }, '[vpnGuard] Error checking VPN requirement')
    return next()
  }
}

module.exports = {
  vpnGuard,
  resolveClientIp
}
