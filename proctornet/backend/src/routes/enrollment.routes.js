const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/enrollment.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isStudent, isAdmin } = require('../middleware/role.middleware')

// ── Student Enrollment Endpoints ──────────────────────────────
router.post('/enrollment/consent', authenticate, isStudent, ctrl.submitConsent)
router.post('/enrollment/face',    authenticate, isStudent, ctrl.enrollFace)
router.post('/enrollment/id',      authenticate, isStudent, ctrl.enrollIdDocument)
router.get ('/enrollment/status',  authenticate, isStudent, ctrl.getEnrollmentStatus)

// ── Student Exam-Day Verification Endpoints ───────────────────
router.post('/exam/verify-face', authenticate, isStudent, ctrl.verifyExamFace)
router.post('/exam/verify-id',   authenticate, isStudent, ctrl.verifyExamId)

// ── Admin Review & Override Endpoints ─────────────────────────
router.get ('/admin/enrollments',             authenticate, isAdmin, ctrl.listEnrollmentSubmissions)
router.post('/admin/enrollments/:id/approve', authenticate, isAdmin, ctrl.approveEnrollment)
router.post('/admin/enrollments/:id/reject',  authenticate, isAdmin, ctrl.rejectEnrollment)
router.post('/admin/enrollments/override',    authenticate, isAdmin, ctrl.overrideEnrollment)

module.exports = router
