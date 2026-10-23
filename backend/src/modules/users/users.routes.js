const express = require('express')
const usersController = require('./users.controller')
const { authenticateToken, requireRole } = require('../auth/auth.routes')
const { prisma } = require('../../infra/postgres/client')

const router = express.Router()

// Admin dashboard summary stats
router.get('/admin/dashboard', authenticateToken, async (req, res, next) => {
  try {
    const [facultyCount, studentCount, examCount, flagCount, pendingStudents, pendingFaculty] = await Promise.all([
      prisma.user.count({ where: { role: 'FACULTY' } }).catch(() => 0),
      prisma.user.count({ where: { role: 'STUDENT' } }).catch(() => 0),
      prisma.exam.count().catch(() => 0),
      prisma.proctoringLog.count({ where: { severity: { in: ['HIGH', 'CRITICAL'] } } }).catch(() => 0),
      prisma.user.count({ where: { role: 'STUDENT', status: 'PENDING_APPROVAL' } }).catch(() => 0),
      prisma.user.count({ where: { role: 'FACULTY', status: 'PENDING_APPROVAL' } }).catch(() => 0)
    ])
    res.json({
      faculty: { total: facultyCount, pending: pendingFaculty },
      students: { total: studentCount, pending: pendingStudents },
      exams: { total: examCount, active: 0 },
      flags: { highSeverity: flagCount }
    })
  } catch (err) {
    next(err)
  }
})

// Departments stub (for onboarding and faculty creation)
router.get('/admin/departments', authenticateToken, (req, res) => {
  res.json({ departments: [{ code: 'CSE', name: 'Computer Science and Engineering' }] })
})
router.post('/admin/departments', authenticateToken, (req, res) => {
  res.status(201).json({ department: { code: req.body.code || 'CSE', name: req.body.name || 'Computer Science' } })
})

// Admin Approvals Queue & Photos
router.get('/admin/approvals', authenticateToken, requireRole('ADMIN'), usersController.listPendingApprovals)
router.get('/admin/users/:id/photos', authenticateToken, requireRole('ADMIN'), usersController.getUserPhotos)

// Admin Student Management
router.get('/admin/students', authenticateToken, usersController.listStudents)
router.get('/admin/students/pending', authenticateToken, usersController.listPendingApprovals)
router.post('/admin/students', authenticateToken, usersController.createStudent)
router.patch('/admin/students/:id/approve', authenticateToken, usersController.approveUser)
router.patch('/admin/students/:id/reject', authenticateToken, usersController.rejectUser)
router.patch('/admin/students/:id/suspend', authenticateToken, usersController.suspendUser)
router.patch('/admin/students/:id/unsuspend', authenticateToken, usersController.unsuspendUser)

// Admin Faculty Management
router.get('/admin/faculty', authenticateToken, usersController.listFaculty)
router.get('/admin/faculty/pending', authenticateToken, usersController.listPendingApprovals)
router.post('/admin/faculty', authenticateToken, usersController.createFaculty)
router.patch('/admin/faculty/:id/approve', authenticateToken, usersController.approveUser)
router.patch('/admin/faculty/:id/reject', authenticateToken, usersController.rejectUser)
router.patch('/admin/faculty/:id/suspend', authenticateToken, usersController.suspendUser)
router.patch('/admin/faculty/:id/unsuspend', authenticateToken, usersController.unsuspendUser)

// Admin Bulk Upload
router.post('/admin/bulk-upload/parse', authenticateToken, usersController.uploadMiddleware, usersController.bulkParse)
router.post('/admin/bulk-upload/confirm', authenticateToken, usersController.bulkConfirm)

// Cohort preview count
router.get('/students/count', authenticateToken, usersController.getStudentsCount)
router.get('/users/students/count', authenticateToken, usersController.getStudentsCount)

// Standard User Endpoints
router.get('/', authenticateToken, requireRole('ADMIN', 'FACULTY'), usersController.listUsers)
router.get('/users', authenticateToken, requireRole('ADMIN', 'FACULTY'), usersController.listUsers)
router.get('/:id', authenticateToken, requireRole('ADMIN', 'FACULTY'), usersController.getUser)
router.get('/users/:id', authenticateToken, requireRole('ADMIN', 'FACULTY'), usersController.getUser)
router.post('/', authenticateToken, requireRole('ADMIN'), usersController.createUser)
router.post('/users', authenticateToken, requireRole('ADMIN'), usersController.createUser)
router.post('/import-excel', authenticateToken, requireRole('ADMIN'), usersController.uploadMiddleware, usersController.importExcel)
router.post('/users/import-excel', authenticateToken, requireRole('ADMIN'), usersController.uploadMiddleware, usersController.importExcel)
router.patch('/:id/suspend', authenticateToken, requireRole('ADMIN'), usersController.suspendUser)
router.patch('/users/:id/suspend', authenticateToken, requireRole('ADMIN'), usersController.suspendUser)
router.patch('/:id/unsuspend', authenticateToken, requireRole('ADMIN'), usersController.unsuspendUser)
router.patch('/users/:id/unsuspend', authenticateToken, requireRole('ADMIN'), usersController.unsuspendUser)
router.post('/:id/reset-password', authenticateToken, requireRole('ADMIN'), usersController.adminResetPassword)
router.put('/:id', authenticateToken, requireRole('ADMIN'), usersController.updateUser)
router.patch('/:id', authenticateToken, requireRole('ADMIN'), usersController.updateUser)
router.put('/users/:id', authenticateToken, requireRole('ADMIN'), usersController.updateUser)
router.patch('/users/:id', authenticateToken, requireRole('ADMIN'), usersController.updateUser)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), usersController.deleteUser)
router.delete('/users/:id', authenticateToken, requireRole('ADMIN'), usersController.deleteUser)

module.exports = router
