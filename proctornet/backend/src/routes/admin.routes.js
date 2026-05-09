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
router.get   ('/faculty',              ctrl.listFaculty)
router.patch ('/faculty/:id/approve',  ctrl.approveFaculty)
router.patch ('/faculty/:id/reject',   ctrl.rejectFaculty)
router.patch ('/faculty/:id/suspend',  ctrl.suspendFaculty)
router.patch ('/faculty/:id/unsuspend', ctrl.unsuspendFaculty)

// ── Student management ─────────────────────────────
router.get   ('/students',             ctrl.listStudents)
router.patch ('/students/:id/approve', ctrl.approveStudent)
router.patch ('/students/:id/suspend', ctrl.suspendStudent)

// ── Platform settings ──────────────────────────────
router.get   ('/settings',  ctrl.getSettings)
router.patch ('/settings',  ctrl.updateSettings)

// ── Audit logs ─────────────────────────────────────
router.get('/audit-logs', ctrl.getAuditLogs)

// ── Announcements ──────────────────────────────────
router.post('/announcements', ctrl.createAnnouncement)
router.get ('/announcements', ctrl.listAnnouncements)

module.exports = router
