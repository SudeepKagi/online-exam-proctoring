const express  = require('express')
const router   = express.Router()
const ctrl     = require('../controllers/admin.controller')
const { authenticate }  = require('../middleware/auth.middleware')
const { isAdmin }       = require('../middleware/role.middleware')
const { auditRequest }  = require('../middleware/audit.middleware')

// All admin routes require JWT + admin role + audit logging
router.use(authenticate, isAdmin, auditRequest)

// ── Dashboard ──────────────────────────────────────
router.get('/dashboard',        ctrl.getDashboardStats)

// ── Faculty management ─────────────────────────────
router.get   ('/faculty',               ctrl.listFaculty)
router.get   ('/faculty/pending',       ctrl.listPendingFaculty)
router.patch ('/faculty/:id/approve',   ctrl.approveFaculty)
router.patch ('/faculty/:id/reject',    ctrl.rejectFaculty)
router.patch ('/faculty/:id/suspend',   ctrl.suspendFaculty)
router.patch ('/faculty/:id/unsuspend', ctrl.unsuspendFaculty)

// ── Student management ─────────────────────────────
router.get   ('/students',               ctrl.listStudents)
router.get   ('/students/pending',       ctrl.listPendingStudents)
router.patch ('/students/:id/approve',   ctrl.approveStudent)
router.patch ('/students/:id/reject',    ctrl.rejectStudent)
router.patch ('/students/:id/suspend',   ctrl.suspendStudent)
router.patch ('/students/:id/unsuspend', ctrl.unsuspendStudent)

// ── Exam oversight ─────────────────────────────────
router.get   ('/exams',            ctrl.listExams)
router.get   ('/exams/all',        ctrl.listExams)   // alias
router.get   ('/exams/:id',        ctrl.getExam)
router.patch ('/exams/:id/pause',  ctrl.pauseExam)
router.patch ('/exams/:id/resume', ctrl.resumeExam)

// ── Invigilator sessions ───────────────────────────
router.get   ('/invigilator-sessions',             ctrl.listInvigilatorSessions)
router.patch ('/invigilator-sessions/:id/revoke',  ctrl.revokeInvigilatorSession)

// ── Platform settings ──────────────────────────────
router.get   ('/settings', ctrl.getSettings)
router.patch ('/settings', ctrl.updateSettings)

// ── Audit logs ─────────────────────────────────────
router.get('/audit-logs', ctrl.getAuditLogs)

// ── Violations ─────────────────────────────────────
router.get('/violations',         ctrl.getViolations)
router.get('/violations/summary', ctrl.getViolationsSummary)

// ── Announcements ──────────────────────────────────
router.post  ('/announcements',      ctrl.createAnnouncement)
router.get   ('/announcements',      ctrl.listAnnouncements)
router.delete('/announcements/:id',  ctrl.deleteAnnouncement)

// ── Reports ────────────────────────────────────────
router.get('/reports', ctrl.getReports)

module.exports = router
