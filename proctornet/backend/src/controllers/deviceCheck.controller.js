const { createLiveKitToken } = require('../services/livekit.service')
const { storeSnapshot, storeEvidenceClip } = require('../services/minio.service')

// Known forbidden remote desktop software
const BANNED_PROCESSES = [
  'anydesk', 'teamviewer', 'ultraviewer', 'chrome-remote-desktop',
  'vnc', 'vncserver', 'rdp', 'mstsc', 'remotedesktop', 'logmein'
]

// Known virtual camera software
const BANNED_VIRTUAL_CAMS = [
  'obs virtual camera', 'manycam', 'vmix', 'camwiz', 'e2esoft'
]

/**
 * BYOD Pre-Exam Device Check Endpoint
 */
async function runDeviceCheck(req, res) {
  try {
    const { studentId, studentExamId, runningProcesses = [], virtualCams = [], clientIp } = req.body

    const foundBlockedProcesses = runningProcesses.filter((proc) =>
      BANNED_PROCESSES.some((banned) => proc.toLowerCase().includes(banned))
    )

    const foundVirtualCams = virtualCams.filter((cam) =>
      BANNED_VIRTUAL_CAMS.some((banned) => cam.toLowerCase().includes(banned))
    )

    // Check subnet (Flag if mobile hotspot range, e.g. 192.168.43.x or 172.20.10.x)
    const reqIp = clientIp || req.ip || ''
    const isHotspot = reqIp.startsWith('192.168.43.') || reqIp.startsWith('172.20.10.')

    const status = (foundBlockedProcesses.length > 0 || foundVirtualCams.length > 0) ? 'BLOCKED' : (isHotspot ? 'FLAGGED' : 'PASSED')

    const log = await global.prisma.deviceCheckLog.create({
      data: {
        studentId: studentId || req.user?.id || 'unknown',
        studentExamId: studentExamId || null,
        agentConnected: true,
        blockedProcesses: foundBlockedProcesses,
        virtualCams: foundVirtualCams,
        isSubnetMatched: !isHotspot,
        clientIp: reqIp,
        status,
      },
    })

    // Emit real-time WebSocket alert if blocked or flagged
    if (global.io && (foundBlockedProcesses.length > 0 || foundVirtualCams.length > 0 || isHotspot)) {
      global.io.emit('device_alert', {
        studentId: log.studentId,
        status,
        blockedProcesses: foundBlockedProcesses,
        virtualCams: foundVirtualCams,
        isHotspot,
        timestamp: new Date(),
      })
    }

    return res.json({
      success: status === 'PASSED',
      status,
      blockedProcesses: foundBlockedProcesses,
      virtualCams: foundVirtualCams,
      isHotspotAlert: isHotspot,
      message: status === 'PASSED'
        ? 'BYOD device readiness check passed'
        : 'Security violation: Blocked software or virtual camera driver detected.',
    })
  } catch (err) {
    console.error('[DeviceCheck Controller Error]:', err)
    return res.status(500).json({ error: 'Device check evaluation failed' })
  }
}

/**
 * Issue LiveKit Room WebRTC Token
 */
async function getLiveKitToken(req, res) {
  try {
    const { roomName, isPublisher = true } = req.body
    const identity = req.user ? (req.user.usn || req.user.email || req.user.id) : `user_${Date.now()}`

    const token = createLiveKitToken(roomName || 'proctor-room', identity, isPublisher)
    return res.json({
      token,
      wsUrl: process.env.LIVEKIT_URL || 'ws://localhost:7880',
      identity,
      roomName,
    })
  } catch (err) {
    console.error('[LiveKit Token Error]:', err)
    return res.status(500).json({ error: 'Failed to issue LiveKit WebRTC token' })
  }
}

/**
 * Receive Periodic Snapshot (10-15s)
 */
async function uploadSnapshot(req, res) {
  try {
    const { studentExamId, frameBase64, frameType } = req.body
    if (!studentExamId || !frameBase64) {
      return res.status(400).json({ error: 'Missing studentExamId or frameBase64' })
    }

    const snapshotUrl = await storeSnapshot(studentExamId, frameBase64, frameType)
    return res.json({ success: true, snapshotUrl })
  } catch (err) {
    console.error('[Upload Snapshot Error]:', err)
    return res.status(500).json({ error: 'Failed to upload snapshot' })
  }
}

/**
 * Receive 60s Evidence Clip
 */
async function uploadEvidenceClip(req, res) {
  try {
    const { studentExamId, violationType, clipBase64, severity = 'MEDIUM' } = req.body
    if (!studentExamId || !clipBase64) {
      return res.status(400).json({ error: 'Missing parameters' })
    }

    const clipUrl = await storeEvidenceClip(studentExamId, violationType, clipBase64)

    const evidence = await global.prisma.evidenceClip.create({
      data: {
        studentExamId,
        violationType: violationType || 'PROCTOR_FLAG',
        severity,
        clipUrl: clipUrl || '',
      },
    })

    return res.json({ success: true, evidence })
  } catch (err) {
    console.error('[Upload Evidence Clip Error]:', err)
    return res.status(500).json({ error: 'Failed to upload evidence clip' })
  }
}

module.exports = {
  runDeviceCheck,
  getLiveKitToken,
  uploadSnapshot,
  uploadEvidenceClip,
}
