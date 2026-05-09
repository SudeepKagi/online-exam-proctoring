const express = require('express')
const router  = express.Router()
// Routes will be implemented in their respective steps
router.get('/ping', (req, res) => res.json({ route: 'answer', status: 'ok' }))
module.exports = router
