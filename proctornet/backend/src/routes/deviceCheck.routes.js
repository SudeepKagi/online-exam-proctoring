const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth.middleware')
const ctrl = require('../controllers/deviceCheck.controller')

router.post('/exam/device-check', authenticate, ctrl.runDeviceCheck)
router.post('/exam/livekit-token', authenticate, ctrl.getLiveKitToken)
router.post('/exam/snapshot', authenticate, ctrl.uploadSnapshot)
router.post('/exam/evidence-clip', authenticate, ctrl.uploadEvidenceClip)

module.exports = router
