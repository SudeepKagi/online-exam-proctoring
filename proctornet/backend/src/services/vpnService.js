const crypto = require('crypto')
const { exec } = require('child_process')
const { PrismaClient } = require('@prisma/client')

/**
 * Generate a valid WireGuard-compatible Curve25519 (x25519) keypair
 * Returns Base64-encoded private and public keys.
 */
function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519')

  const privateKeyBase64 = privateKey
    .export({ type: 'pkcs8', format: 'der' })
    .subarray(-32)
    .toString('base64')

  const publicKeyBase64 = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('base64')

  return { privateKey: privateKeyBase64, publicKey: publicKeyBase64 }
}

/**
 * Synchronize peer addition directly with live WireGuard kernel interface (wg0)
 */
function syncWireGuardAddPeer(publicKey, allowedIp) {
  const vpnServerIp = process.env.VPN_SERVER_IP || '20.198.83.12'
  const sshKeyPath = process.env.VPN_SSH_KEY_PATH
  const sshUser = process.env.VPN_SSH_USER || 'azureuser'
  const isWin = process.platform === 'win32'

  let cmd
  if (isWin && sshKeyPath) {
    cmd = `ssh -i "${sshKeyPath}" -o StrictHostKeyChecking=no ${sshUser}@${vpnServerIp} "sudo wg set wg0 peer '${publicKey}' allowed-ips ${allowedIp}/32"`
  } else if (!isWin) {
    cmd = `sudo wg set wg0 peer '${publicKey}' allowed-ips ${allowedIp}/32`
  } else {
    cmd = `wsl -d Ubuntu -u root wg set wg0 peer '${publicKey}' allowed-ips ${allowedIp}/32`
  }

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.warn('[vpnService] Live WireGuard sync note:', stderr || err.message)
    } else {
      console.log(`[vpnService] ✅ Synced peer ${publicKey.substring(0, 8)}... (${allowedIp}) to wg0 on ${vpnServerIp}`)
    }
  })
}

/**
 * Synchronize peer removal directly with live WireGuard kernel interface (wg0)
 */
function syncWireGuardRemovePeer(publicKey) {
  if (!publicKey) return
  const vpnServerIp = process.env.VPN_SERVER_IP || '20.198.83.12'
  const sshKeyPath = process.env.VPN_SSH_KEY_PATH
  const sshUser = process.env.VPN_SSH_USER || 'azureuser'
  const isWin = process.platform === 'win32'

  let cmd
  if (isWin && sshKeyPath) {
    cmd = `ssh -i "${sshKeyPath}" -o StrictHostKeyChecking=no ${sshUser}@${vpnServerIp} "sudo wg set wg0 peer '${publicKey}' remove"`
  } else if (!isWin) {
    cmd = `sudo wg set wg0 peer '${publicKey}' remove`
  } else {
    cmd = `wsl -d Ubuntu -u root wg set wg0 peer '${publicKey}' remove`
  }

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.warn('[vpnService] Live WireGuard remove note:', stderr || err.message)
    } else {
      console.log(`[vpnService] 🛑 Removed peer ${publicKey.substring(0, 8)}... from wg0 on ${vpnServerIp}`)
    }
  })
}

/**
 * Allocate next available IP address in 10.0.0.0/24 subnet (10.0.0.2 -> 10.0.0.254)
 */
async function allocatePeerIp(prismaClient) {
  const activeStudentExams = await prismaClient.studentExam.findMany({
    where: {
      vpnPeerIp: { not: null },
      OR: [
        { vpnKeyExpiry: { gt: new Date() } },
        { status: { in: ['PENDING', 'IN_PROGRESS', 'PAUSED'] } }
      ]
    },
    select: { vpnPeerIp: true }
  })

  const usedIps = new Set(activeStudentExams.map(se => se.vpnPeerIp))

  for (let i = 2; i <= 254; i++) {
    const candidateIp = `10.0.0.${i}`
    if (!usedIps.has(candidateIp)) {
      return candidateIp
    }
  }

  throw new Error('VPN Subnet IP pool exhausted (maximum 253 concurrent active peers reached).')
}

/**
 * Issue or retrieve a WireGuard client configuration for a student taking an exam
 */
async function issueVpnConfig({ studentId, examId }) {
  const db = global.prisma || new PrismaClient()

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, duration: true, status: true }
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

  let studentExam = await db.studentExam.findUnique({
    where: { studentId_examId: { studentId, examId } }
  })

  const now = new Date()
  const bufferMins = parseInt(process.env.VPN_KEY_EXPIRY_BUFFER_MINS || '10', 10)
  const durationMins = exam.duration || 60
  const expiryTime = new Date(now.getTime() + (durationMins + bufferMins) * 60 * 1000)

  // Check if active unexpired VPN config already exists for this session
  if (studentExam && studentExam.vpnPrivateKey && studentExam.vpnPeerIp && studentExam.vpnKeyExpiry && new Date(studentExam.vpnKeyExpiry) > now) {
    syncWireGuardAddPeer(studentExam.vpnKey, studentExam.vpnPeerIp)

    const confContent = generateWireGuardClientConf({
      clientPrivateKey: studentExam.vpnPrivateKey,
      clientIp: studentExam.vpnPeerIp
    })

    return {
      success: true,
      reused: true,
      studentExamId: studentExam.id,
      vpnPeerIp: studentExam.vpnPeerIp,
      vpnKey: studentExam.vpnKey,
      vpnKeyExpiry: studentExam.vpnKeyExpiry,
      config: confContent,
      serverIp: process.env.VPN_SERVER_IP || '20.198.83.12',
      serverPort: parseInt(process.env.VPN_SERVER_PORT || '51820', 10),
    }
  }

  // Generate new keypair and allocate IP
  const { privateKey, publicKey } = generateKeyPair()
  const peerIp = await allocatePeerIp(db)

  if (studentExam) {
    studentExam = await db.studentExam.update({
      where: { id: studentExam.id },
      data: {
        vpnKey: publicKey,
        vpnPrivateKey: privateKey,
        vpnPeerIp: peerIp,
        vpnKeyExpiry: expiryTime
      }
    })
  } else {
    const watermarkSeed = `WM-${student.usn}-${Date.now()}`
    studentExam = await db.studentExam.create({
      data: {
        studentId,
        examId,
        watermarkSeed,
        assignedQuestionIds: [],
        vpnKey: publicKey,
        vpnPrivateKey: privateKey,
        vpnPeerIp: peerIp,
        vpnKeyExpiry: expiryTime,
        status: 'PENDING'
      }
    })
  }

  // Sync peer live to WireGuard kernel interface
  syncWireGuardAddPeer(publicKey, peerIp)

  const confContent = generateWireGuardClientConf({
    clientPrivateKey: privateKey,
    clientIp: peerIp
  })

  return {
    success: true,
    reused: false,
    studentExamId: studentExam.id,
    vpnPeerIp: peerIp,
    vpnKey: publicKey,
    vpnKeyExpiry: expiryTime,
    config: confContent,
    serverIp: process.env.VPN_SERVER_IP || '20.198.83.12',
    serverPort: parseInt(process.env.VPN_SERVER_PORT || '51820', 10),
  }
}

/**
 * Format a WireGuard .conf file string
 */
function generateWireGuardClientConf({ clientPrivateKey, clientIp }) {
  const serverPubKey = process.env.VPN_SERVER_PUBLIC_KEY || 'wmESrH5SWn6ES7dV/sVtKsZkifBJcjHjwXy5EBc4pVc='
  const serverIp = process.env.VPN_SERVER_IP || '20.198.83.12'
  const serverPort = process.env.VPN_SERVER_PORT || '51820'
  const dnsIp = process.env.VPN_DNS || '1.1.1.1, 8.8.8.8'
  const allowedIps = process.env.VPN_ALLOWED_IPS || '0.0.0.0/0'

  return `[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIp}/24
DNS = ${dnsIp}

[Peer]
PublicKey = ${serverPubKey}
Endpoint = ${serverIp}:${serverPort}
AllowedIPs = ${allowedIps}
PersistentKeepalive = 25
`
}

/**
 * Fetch current VPN session status for a student
 */
async function getVpnStatus({ studentId, examId }) {
  const db = global.prisma || new PrismaClient()

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
    serverIp: process.env.VPN_SERVER_IP || '20.198.83.12',
    serverPort: parseInt(process.env.VPN_SERVER_PORT || '51820', 10),
  }
}

/**
 * Revoke VPN peer access after exam completion
 */
async function revokeVpnPeer({ studentId, examId }) {
  const db = global.prisma || new PrismaClient()

  const studentExam = await db.studentExam.findUnique({
    where: { studentId_examId: { studentId, examId } }
  })

  if (!studentExam) {
    const err = new Error('Student exam record not found.')
    err.status = 404
    throw err
  }

  // Remove peer live from WireGuard kernel interface
  syncWireGuardRemovePeer(studentExam.vpnKey)

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
  issueVpnConfig,
  getVpnStatus,
  revokeVpnPeer
}
