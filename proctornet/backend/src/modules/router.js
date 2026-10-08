const express = require('express')

// Domain Module Controllers
const authController = require('./auth/controller')
const adminController = require('./admin/controller')
const facultyController = require('./faculty/controller')
const studentController = require('./student/controller')
const invigilatorController = require('./invigilator/controller')
const notificationsController = require('./notifications/controller')
const { agentController } = require('./agent')

// High-Throughput & Specialized Domain Controllers
const examController = require('./exams/controller')
const questionController = require('./questions/controller')
const attemptController = require('./attempts/controller')
const answerController = require('./answers/controller')
const submissionController = require('./submissions/controller')
const proctoringController = require('./proctoring/controller')
const resultController = require('./results/controller')
const mediaController = require('./media/controller')
const auditController = require('./audit/controller')
const vpnController = require('./vpn/controller')

const router = express.Router()

// Health check under /api/v1/health
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ProctorNet API v1',
    timestamp: new Date().toISOString()
  })
})

// Build & Release Version Metadata under /api/v1/version (S5 / CI-10)
router.get('/version', (req, res) => {
  const { getVersion } = require('../utils/version')
  res.status(200).json(getVersion())
})

// Public System Config under /api/v1/config (Q3 Task 7 / R-11)
router.get('/config', (req, res) => {
  const rawMode = (process.env.VPN_ENFORCEMENT || (process.env.VPN_ENABLED === 'true' ? 'enforce' : 'off')).toLowerCase().trim()
  let vpnEnforcement = 'off'
  if (rawMode === 'enforce' || rawMode === 'true') {
    vpnEnforcement = 'enforce'
  } else if (rawMode === 'warn') {
    vpnEnforcement = 'warn'
  }

  const config = require('../shared/config')
  const mediaDriver = config.mediaDriver

  res.status(200).json({
    vpnEnforcement,
    isVpnEnforced: vpnEnforcement !== 'off',
    mediaDriver,
    // R4: AI question generation — UI hides the button when llmEnabled is false
    llmEnabled: config.llmProvider !== 'none' && Boolean(config.llmApiKey),
    llmProvider: config.llmProvider,
    // R4: Driver info (useful for debugging / admin dashboard)
    queueDriver: config.queueDriver,
    cacheDriver: config.cacheDriver,
    autosaveMaxBatch: 100,
    serverTime: new Date().toISOString()
  })
})

// Role & Entity-Scoped Subrouters
router.use('/auth', authController)
router.use('/admin', adminController)
router.use('/faculty', facultyController)
router.use('/student', studentController)
router.use('/enrollment', (req, res, next) => {
  req.url = '/enrollment' + req.url
  studentController(req, res, next)
})
router.use('/invigilator', invigilatorController)
router.use('/notifications', notificationsController)

// Flat Mounted Subrouters (Agent, Media, Exams, Proctoring, etc.)
router.use('/', agentController)
router.use('/', examController)
router.use('/', questionController)
router.use('/', attemptController)
router.use('/', answerController)
router.use('/', submissionController)
router.use('/', proctoringController)
router.use('/', resultController)
router.use('/', mediaController)
router.use('/', auditController)
router.use('/', vpnController)

module.exports = router
