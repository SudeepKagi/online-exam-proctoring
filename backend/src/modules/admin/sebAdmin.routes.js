'use strict'

const express = require('express')
const { authenticateToken, requireRole } = require('../auth/auth.routes')
const sebAdminController = require('./sebAdmin.controller')

const router = express.Router()

// All routes require ADMIN role
router.use(authenticateToken)
router.use(requireRole('ADMIN'))

router.post('/config', sebAdminController.upload.single('file'), sebAdminController.uploadSebConfig)
router.get('/status', sebAdminController.getSebStatus)
router.delete('/config', sebAdminController.deleteSebConfig)

module.exports = router

