const express = require('express')
const router = express.Router()
const vpnCtrl = require('../controllers/vpn.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isStudent } = require('../middleware/role.middleware')

// All VPN routes require authentication and student role
router.use(authenticate, isStudent)

router.post('/issue/:examId', vpnCtrl.issueVpnConfig)
router.get('/status/:examId', vpnCtrl.getVpnStatus)
router.post('/revoke/:examId', vpnCtrl.revokeVpnPeer)

module.exports = router
