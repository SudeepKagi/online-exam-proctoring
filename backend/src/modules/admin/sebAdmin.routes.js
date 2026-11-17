'use strict'

const express = require('express')
const { authenticateToken, requireRole } = require('../auth/auth.routes')
const sebAdminController = require('./sebAdmin.controller')

const router = express.Router()

// Authenticated routes
router.use(authenticateToken)

// Mutations require ADMIN role; read-only status is available to ADMIN
router.post('/config', requireRole('ADMIN'), sebAdminController.upload.single('file'), sebAdminController.uploadSebConfig)
router.post('/inspect', requireRole('ADMIN'), sebAdminController.upload.single('file'), sebAdminController.inspectConfig)
router.get('/starter-config', requireRole('ADMIN'), sebAdminController.getStarterConfig)
router.get('/attempts', requireRole('ADMIN'), sebAdminController.getRecentAttempts)
router.get('/status', requireRole('ADMIN'), sebAdminController.getSebStatus)
router.patch('/mode', requireRole('ADMIN'), sebAdminController.updateSebMode)
router.delete('/config', requireRole('ADMIN'), sebAdminController.deleteSebConfig)

module.exports = router

