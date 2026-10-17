const express = require('express')
const authRoutes = require('./auth/auth.routes')
const examsRoutes = require('./exams/exams.routes')
const attemptsRoutes = require('./attempts/attempts.routes')
const mediaRoutes = require('./media/media.routes')
const proctoringRoutes = require('./proctoring/proctoring.routes')
const usersRoutes = require('./users/users.routes')

const router = express.Router()

// Health & System Info
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ProctorNet API v1',
    timestamp: new Date().toISOString()
  })
})

router.get('/version', (req, res) => {
  res.status(200).json({
    version: '2.0.0',
    service: 'ProctorNet Standardized Core',
    timestamp: new Date().toISOString()
  })
})

router.get('/config', (req, res) => {
  res.status(200).json({
    vpnEnforcement: 'off',
    isVpnEnforced: false,
    mediaDriver: 'snapshot',
    llmEnabled: false,
    serverTime: new Date().toISOString()
  })
})

// Domain Subrouters with scoped prefixes
router.use('/auth', authRoutes)
router.use('/exams', examsRoutes)
router.use('/attempts', attemptsRoutes)
router.use('/media', mediaRoutes)
router.use('/proctoring', proctoringRoutes)
router.use('/users', usersRoutes)

// Specific role aliases
router.use('/student', examsRoutes)
router.use('/faculty', examsRoutes)

// Flat-mounted routes for backward compatibility
router.use('/', authRoutes)
router.use('/', usersRoutes)
router.use('/', attemptsRoutes)
router.use('/', mediaRoutes)
router.use('/', proctoringRoutes)

module.exports = router

