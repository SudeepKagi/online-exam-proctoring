/**
 * vpnRevoke.job.js — VPN key revocation job
 * 
 * NOTE: The actual cron logic lives in vpn.service.js → startAutoRevoke().
 * This file previously contained a duplicate auto-executing cron that ran
 * on require(), causing DB queries before the connection was established.
 * 
 * The vpn.service.js cron is now started from app.js AFTER prisma.$connect()
 * succeeds. This file is kept for reference but no longer self-executes.
 */

async function revokeExpiredKeys() {
  try {
    if (!global.prisma) {
      console.warn('[VPN Revoke] global.prisma not available, skipping')
      return
    }

    const expired = await global.prisma.studentExam.findMany({
      where: {
        vpnKeyExpiry: { lt: new Date() },
        vpnKey: { not: null },
        status: { in: ['SUBMITTED', 'TERMINATED'] },
      },
    })

    if (expired.length > 0) {
      console.log(`[VPN Revoke] Found ${expired.length} expired VPN keys to revoke`)
      for (const se of expired) {
        await global.prisma.studentExam.update({
          where: { id: se.id },
          data: { vpnKey: null, vpnKeyExpiry: null },
        })
      }
    }
  } catch (e) {
    console.error('[VPN Revoke] Error:', e.message)
  }
}

module.exports = { revokeExpiredKeys }
