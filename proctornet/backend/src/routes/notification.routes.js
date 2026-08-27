const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/notification.controller')
const { authenticate } = require('../middleware/auth.middleware')

// GET /api/notifications - Real role-tailored notifications for authenticated user
router.get('/', authenticate, ctrl.getNotifications)

module.exports = router
