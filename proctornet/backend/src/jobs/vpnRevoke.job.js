/**
 * vpnRevoke.job.js — Cron job to revoke expired WireGuard VPN keys
 * Full implementation in Step 75
 */
const cron = require('node-cron')

// Check every minute for expired VPN keys
cron.schedule('* * * * *', async () => {
  try {
    const expired = await global.prisma.studentExam.findMany({
      where: {
        vpnKeyExpiry: { lt: new Date() },
        vpnKey: { not: null },
        status: { in: ['SUBMITTED', 'TERMINATED'] },
      },
    })

    if (expired.length > 0) {
      console.log(`[VPN Cron] Found ${expired.length} expired VPN keys to revoke`)
      // Full revocation logic in Step 75 (requires WireGuard on server)
      for (const se of expired) {
        await global.prisma.studentExam.update({
          where: { id: se.id },
          data: { vpnKey: null, vpnKeyExpiry: null },
        })
      }
    }
  } catch (e) {
    // DB not connected in early development — safe to ignore
  }
})

console.log('[VPN Cron] Started — checking every minute for expired keys')
