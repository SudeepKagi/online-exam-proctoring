const express = require('express')

// Domain Module Controllers
const authController = require('./auth/controller')
const adminController = require('./admin/controller')
const facultyController = require('./faculty/controller')
const studentController = require('./student/controller')
const invigilatorController = require('./invigilator/controller')
const notificationsController = require('./notifications/controller')
const deviceCheckController = require('./deviceCheck/controller')

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

// Public System Config under /api/v1/config (Q3 Task 7)
router.get('/config', (req, res) => {
  const vpnEnforcement = process.env.VPN_ENABLED === 'true' || process.env.VPN_ENFORCEMENT === 'true'
  res.status(200).json({
    vpnEnforcement,
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

// Flat Mounted Subrouters (Device check, Media, Exams, Proctoring, etc.)
router.use('/', deviceCheckController)
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
