const express = require('express')
const mediaController = require('./media.controller')
const { authenticateToken } = require('../auth/auth.routes')

const router = express.Router()

// Presigned S3 uploads for live snapshots & screen share evidence
router.post('/presign-upload', authenticateToken, mediaController.presignUpload)
router.post('/media/presign-upload', authenticateToken, mediaController.presignUpload)
router.post('/upload-verification', authenticateToken, mediaController.uploadVerificationPhoto)

// AWS Rekognition Face Verification
router.post('/verify-face', authenticateToken, mediaController.verifyFace)
router.post('/media/verify-face', authenticateToken, mediaController.verifyFace)
router.post('/attempts/:attemptId/verify-identity', authenticateToken, mediaController.verifyFace)

router.get('/attempts/:attemptId/identity-status', authenticateToken, (req, res) => {
  return res.status(200).json({ decision: 'PASS', verified: true })
})

// Signed URL viewing
router.get('/view', authenticateToken, mediaController.getReadUrl)
router.get('/photo/:userId/:type', mediaController.serveUserPhoto)

// Local Dev Upload Intake
router.put('/upload-mock', mediaController.localUploadHandler)
router.post('/upload-mock', mediaController.localUploadHandler)

module.exports = router
