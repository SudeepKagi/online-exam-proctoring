'use strict'

const express = require('express')
const { authenticateToken, requireRole } = require('../auth/auth.routes')
const sebAdminController = require('./sebAdmin.controller')

const router = express.Router()

// Authenticated routes
router.use(authenticateToken)

// Mutations require ADMIN role; read-only status is available to ADMIN
router.post('/config', requireRole('ADMIN'), sebAdminController.upload.single('file'), sebAdminController.uploadSebConfig)
router.get('/status', requireRole('ADMIN'), sebAdminController.getSebStatus)
router.delete('/config', requireRole('ADMIN'), sebAdminController.deleteSebConfig)

module.exports = router

