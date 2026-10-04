/**
 * services/vpnService.js
 * Legacy Adapter for WireGuard VPN (Refactored for P8 / ADR-010)
 *
 * Replaces all shell string-interpolation, WSL, and hardcoded Azure IP/keys
 * with calls to the provider interface (getVpnProvider), atomic IPAM, and keyService.
 */

const { getVpnProvider } = require('../infra/vpn')
const { vpnIpam } = require('../modules/vpn/ipam')
const { vpnKeyService } = require('../modules/vpn/keyService')
const { prisma: defaultDb } = require('../infra/postgres/client')
const { logger } = require('../shared/logging')

/**
 * Generate a valid WireGuard-compatible Curve25519 (x25519) keypair
 */
function generateKeyPair() {
  return vpnKeyService.generateKeyPair()
}

/**
 * Format a WireGuard .conf file string
 */
function generateWireGuardClientConf({ clientPrivateKey, clientIp }) {
  return vpnKeyService.formatClientConf({
    clientPrivateKey,
    clientIp
  })
}

/**
 * Synchronize peer addition via provider interface (no shell interpolation)
 */
async function syncWireGuardAddPeer(publicKey, allowedIp) {
  try {
    const provider = getVpnProvider()
    await provider.addPeer({ publicKey, ip: allowedIp })
    logger.info({ publicKey: publicKey.substring(0, 8), allowedIp }, '[vpnService] Synced peer via provider')
  } catch (err) {
    logger.warn({ error: err.message }, '[vpnService] Peer sync warning')
  }
}

/**
 * Synchronize peer removal via provider interface (no shell interpolation)
 */
async function syncWireGuardRemovePeer(publicKey) {
  if (!publicKey) return
  try {
    const provider = getVpnProvider()
    await provider.removePeer(publicKey)
    logger.info({ publicKey: publicKey.substring(0, 8) }, '[vpnService] Removed peer via provider')
  } catch (err) {
    logger.warn({ error: err.message }, '[vpnService] Peer remove warning')
  }
}

/**
 * Issue or retrieve a WireGuard client configuration for a student taking an exam
 */
async function issueVpnConfig({ studentId, examId }) {
  const db = defaultDb

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, duration: true, status: true, vpnRequired: true }
  })

  if (!exam) {
    const err = new Error('Exam not found.')
    err.status = 404
    throw err
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, usn: true, email: true }
  })

  if (!student) {
    const err = new Error('Student account not found.')
    err.status = 404
    throw err
  }

  const now = new Date()
  const bufferMins = parseInt(process.env.VPN_KEY_EXPIRY_BUFFER_MINS || '10', 10)
  const durationMins = exam.duration || 60
  const expiryTime = new Date(now.getTime() + (durationMins + bufferMins) * 60 * 1000)

  // Use atomic IPAM allocation
  const peerIp = await vpnIpam.allocateIp(`exam_${examId}_student_${studentId}`)
  const { privateKey, publicKey } = generateKeyPair()

  const watermarkSeed = `WM-${student.usn}-${Date.now()}`
  const studentExam = await db.studentExam.upsert({
    where: {
      examId_studentId: { examId, studentId }
    },
    update: {
      vpnIp: peerIp,
      vpnKey: publicKey,
      vpnKeyExpiry: expiryTime
    },
    create: {
      studentId,
      examId,
      watermarkSeed,
      vpnIp: peerIp,
      vpnKey: publicKey,
      vpnKeyExpiry: expiryTime,
      status: 'READY'
    }
  })

  // Sync peer via configured provider
  await syncWireGuardAddPeer(publicKey, peerIp)

  const confContent = generateWireGuardClientConf({
    clientPrivateKey: privateKey,
    clientIp: peerIp
  })

  return {
    success: true,
    studentExamId: studentExam.id,
    vpnPeerIp: peerIp,
    vpnKey: publicKey,
    vpnKeyExpiry: expiryTime,
    config: confContent,
    serverIp: process.env.VPN_SERVER_IP || '127.0.0.1',
    serverPort: parseInt(process.env.VPN_SERVER_PORT || '51820', 10),
  }
}

/**
 * Fetch current VPN session status for a student
 */
async function getVpnStatus({ studentId, examId }) {
  const db = defaultDb

  const studentExam = await db.studentExam.findUnique({
    where: { studentId_examId: { studentId, examId } },
    select: {
      id: true,
      status: true,
      vpnKey: true,
      vpnPeerIp: true,
      vpnKeyExpiry: true
    }
  })

  if (!studentExam || !studentExam.vpnPeerIp) {
    return {
      active: false,
      message: 'No VPN configuration issued for this exam session.'
    }
  }

  const isExpired = studentExam.vpnKeyExpiry ? new Date(studentExam.vpnKeyExpiry) <= new Date() : true

  return {
    active: !isExpired,
    studentExamId: studentExam.id,
    vpnPeerIp: studentExam.vpnPeerIp,
    vpnKey: studentExam.vpnKey,
    vpnKeyExpiry: studentExam.vpnKeyExpiry,
    isExpired,
    serverIp: process.env.VPN_SERVER_IP || '127.0.0.1',
    serverPort: parseInt(process.env.VPN_SERVER_PORT || '51820', 10),
  }
}

/**
 * Revoke VPN peer access after exam completion
 */
async function revokeVpnPeer({ studentId, examId }) {
  const db = defaultDb

  const studentExam = await db.studentExam.findUnique({
    where: { studentId_examId: { studentId, examId } }
  })

  if (!studentExam) {
    const err = new Error('Student exam record not found.')
    err.status = 404
    throw err
  }

  if (studentExam.vpnKey) {
    await syncWireGuardRemovePeer(studentExam.vpnKey)
  }

  await vpnIpam.releaseIp(`exam_${examId}_student_${studentId}`).catch(() => {})

  await db.studentExam.update({
    where: { id: studentExam.id },
    data: { vpnKeyExpiry: new Date() }
  })

  return {
    success: true,
    message: 'VPN peer configuration successfully revoked.'
  }
}

module.exports = {
  generateKeyPair,
  generateWireGuardClientConf,
  issueVpnConfig,
  getVpnStatus,
  revokeVpnPeer,
  syncWireGuardAddPeer,
  syncWireGuardRemovePeer
}
