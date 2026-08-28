const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth.middleware')
const { isStudent, requireRole } = require('../middleware/role.middleware')
const ctrl = require('../controllers/deviceCheck.controller')

router.post('/exam/device-check', authenticate, isStudent, ctrl.runDeviceCheck)
router.post('/exam/livekit-token', authenticate, requireRole('student', 'invigilator', 'faculty'), ctrl.getLiveKitToken)
router.post('/exam/snapshot', authenticate, isStudent, ctrl.uploadSnapshot)
router.post('/exam/evidence-clip', authenticate, isStudent, ctrl.uploadEvidenceClip)

module.exports = router
