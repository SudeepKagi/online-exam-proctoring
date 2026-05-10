const express = require('express')
const router = express.Router()
const vpnService = require('../services/vpn.service')
const { authenticate } = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/role.middleware')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ──────────────────────────────────────────
// Student: Connect to VPN when exam starts
// POST /api/vpn/connect/:examId
// ──────────────────────────────────────────
router.post('/connect/:examId',
  authenticate,
  requireRole('student'),
  async (req, res) => {
    try {
      const { examId } = req.params
      const studentId = req.user.id
      
      // Check exam exists and is active
      const exam = await prisma.exam.findUnique({
        where: { id: examId }
      })
      
      if(!exam) {
        return res.status(404).json({ message: 'Exam not found' })
      }
      
      const now = new Date()
      if(now < new Date(exam.startTime)) {
        return res.status(403).json({ message: 'Exam has not started yet' })
      }
      
      if(now > new Date(exam.endTime)) {
        return res.status(403).json({ message: 'Exam has ended' })
      }
      
      // Check if student already has VPN key
      const existing = await prisma.studentExam.findFirst({
        where: { studentId, examId }
      })
      
      if(existing?.vpnKey) {
        // Return existing config
        const config = vpnService.buildConfigFile(
          existing.vpnPrivateKey,
          existing.vpnPeerIp
        )
        return res.json({
          success: true,
          alreadyConnected: true,
          config,
          peerIp: existing.vpnPeerIp,
          expiry: existing.vpnKeyExpiry
        })
      }
      
      // Generate new VPN config
      const vpnData = await vpnService.generateStudentConfig(
        studentId, 
        examId, 
        exam.endTime
      )
      
      res.json({
        success: true,
        config: vpnData.config,
        peerIp: vpnData.peerIp,
        expiry: vpnData.expiry,
        downloadUrl: `/api/vpn/config/${examId}`,
        instructions: {
          windows: 'Download config → Import in WireGuard app → Connect',
          mac: 'Download config → Import in WireGuard app → Connect',
          linux: 'sudo wg-quick up ./proctornet-exam.conf'
        }
      })
      
    } catch(err) {
      console.error('VPN connect error:', err)
      res.status(500).json({ message: 'Failed to generate VPN config' })
    }
  }
)

// ──────────────────────────────────────────
// Student: Download VPN config file
// GET /api/vpn/config/:examId
// ──────────────────────────────────────────
router.get('/config/:examId',
  authenticate,
  requireRole('student'),
  async (req, res) => {
    try {
      const { examId } = req.params
      const studentId = req.user.id
      
      const studentExam = await prisma.studentExam.findFirst({
        where: { studentId, examId }
      })
      
      if(!studentExam?.vpnPrivateKey) {
        return res.status(404).json({
          message: 'VPN config not found. Click Take Exam first.'
        })
      }
      
      const config = vpnService.buildConfigFile(
        studentExam.vpnPrivateKey,
        studentExam.vpnPeerIp
      )
      
      // Send as downloadable file
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', 'attachment; filename="proctornet-exam.conf"')
      res.send(config)
      
    } catch(err) {
      res.status(500).json({ message: 'Failed to get config' })
    }
  }
)

// ──────────────────────────────────────────
// Student: Check VPN connection status
// GET /api/vpn/status/:examId
// ──────────────────────────────────────────
router.get('/status/:examId',
  authenticate,
  async (req, res) => {
    try {
      const { examId } = req.params
      const studentId = req.user.id
      
      const studentExam = await prisma.studentExam.findFirst({
        where: { studentId, examId }
      })
      
      if(!studentExam?.vpnPeerIp) {
        return res.json({ connected: false, message: 'VPN not configured' })
      }
      
      const connected = await vpnService.isStudentConnected(studentExam.vpnPeerIp)
      
      res.json({
        connected,
        peerIp: studentExam.vpnPeerIp,
        expiry: studentExam.vpnKeyExpiry
      })
      
    } catch(err) {
      res.status(500).json({ connected: false })
    }
  }
)

// ──────────────────────────────────────────
// System: Revoke VPN on exam submit
// POST /api/vpn/revoke/:examId
// (called internally after submission)
// ──────────────────────────────────────────
router.post('/revoke/:examId',
  authenticate,
  async (req, res) => {
    try {
      const { examId } = req.params
      const studentId = req.user.id
      
      await vpnService.revokeStudentAccess(studentId, examId)
      
      res.json({ 
        success: true,
        message: 'VPN access revoked. Internet restored.'
      })
    } catch(err) {
      res.status(500).json({ success: false })
    }
  }
)

// ──────────────────────────────────────────
// Admin: Get VPN server status
// GET /api/vpn/server-status
// ──────────────────────────────────────────
router.get('/server-status',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const status = await vpnService.getServerStatus()
      res.json(status)
    } catch(err) {
      res.status(500).json({ isRunning: false })
    }
  }
)

// ──────────────────────────────────────────
// Admin: Force revoke student VPN
// POST /api/vpn/force-revoke
// ──────────────────────────────────────────
router.post('/force-revoke',
  authenticate,
  requireRole('admin', 'faculty'),
  async (req, res) => {
    try {
      const { studentId, examId } = req.body
      await vpnService.revokeStudentAccess(studentId, examId)
      res.json({ 
        success: true,
        message: 'VPN access force revoked'
      })
    } catch(err) {
      res.status(500).json({ success: false })
    }
  }
)

module.exports = router
