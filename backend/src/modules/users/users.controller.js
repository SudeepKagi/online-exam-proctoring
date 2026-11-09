const multer = require('multer')
const { usersService } = require('./users.service')

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })

const usersController = {
  uploadMiddleware: upload.single('file'),

  async listStudents(req, res, next) {
    try {
      const { search, limit, offset, status } = req.query
      const result = await usersService.listUsers({ role: 'STUDENT', search, limit, offset, status })
      res.json({ students: result.users, total: result.total })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async listFaculty(req, res, next) {
    try {
      const { search, limit, offset, status } = req.query
      const result = await usersService.listUsers({ role: 'FACULTY', search, limit, offset, status })
      res.json({ faculty: result.users, total: result.total })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async listUsers(req, res, next) {
    try {
      const { role, search, limit, offset, status } = req.query
      const result = await usersService.listUsers({ role, search, limit, offset, status })
      res.json({ users: result.users, total: result.total })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async getUser(req, res, next) {
    try {
      const user = await usersService.getUserById(req.params.id)
      if (!user) return res.status(404).json({ error: { message: 'User not found' } })
      res.json({ user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async createStudent(req, res, next) {
    try {
      const payload = { ...req.body, role: 'STUDENT' }
      const user = await usersService.createUser(payload)
      res.status(201).json({ message: 'Account Created Successfully', user, student: user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async createFaculty(req, res, next) {
    try {
      const payload = { ...req.body, role: 'FACULTY' }
      const user = await usersService.createUser(payload)
      res.status(201).json({ message: 'Faculty Account Created', user, faculty: user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async createUser(req, res, next) {
    try {
      const user = await usersService.createUser(req.body)
      res.status(201).json({ user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async listPendingApprovals(req, res, next) {
    try {
      const { limit, offset } = req.query
      const result = await usersService.listPendingApprovals({ limit, offset })
      res.json({ users: result.users, pendingUsers: result.users, total: result.total })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async getUserPhotos(req, res, next) {
    try {
      const { mediaService } = require('../media/media.service')
      const user = await usersService.getUserById(req.params.id)
      if (!user) return res.status(404).json({ error: { message: 'User not found' } })

      const referencePhotoUrl = user.referencePhotoUrl || (user.referencePhotoKey ? await mediaService.getReadUrl(user.referencePhotoKey).catch(() => null) : null)
      const idCardPhotoUrl = user.idCardPhotoUrl || (user.idCardPhotoKey ? await mediaService.getReadUrl(user.idCardPhotoKey).catch(() => null) : null)

      res.json({
        userId: user.id,
        referencePhotoKey: user.referencePhotoKey,
        idCardPhotoKey: user.idCardPhotoKey,
        referencePhotoUrl,
        idCardPhotoUrl
      })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async approveUser(req, res, next) {
    try {
      const user = await usersService.setUserStatus(req.params.id, 'ACTIVE')
      res.json({ success: true, message: 'User approved', user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async rejectUser(req, res, next) {
    try {
      const reason = req.body?.reason || req.body?.rejectionReason || 'Verification rejected by administrator'
      const user = await usersService.setUserStatus(req.params.id, 'REJECTED', reason)
      res.json({ success: true, message: 'User registration rejected', user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async updateUser(req, res, next) {
    try {
      const targetUserId = req.params.id
      if (req.user?.id && req.user.id === targetUserId) {
        if (req.body.role || req.body.status === 'SUSPENDED') {
          return res.status(400).json({
            code: 'CANNOT_MODIFY_OWN_ADMIN_ACCOUNT',
            message: 'Admins cannot alter the role or suspension status of their own account.'
          })
        }
      }
      const user = await usersService.updateUser(targetUserId, req.body)
      res.json({ success: true, user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async suspendUser(req, res, next) {
    try {
      const targetUserId = req.params.id
      if (req.user?.id && req.user.id === targetUserId) {
        return res.status(400).json({
          code: 'CANNOT_MODIFY_OWN_ADMIN_ACCOUNT',
          message: 'Admins cannot suspend their own account.'
        })
      }
      const user = await usersService.setUserStatus(targetUserId, 'SUSPENDED')
      res.json({ success: true, message: 'User suspended', user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async unsuspendUser(req, res, next) {
    try {
      const user = await usersService.setUserStatus(req.params.id, 'ACTIVE')
      res.json({ success: true, message: 'User unsuspended', user })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async deleteUser(req, res, next) {
    try {
      const targetUserId = req.params.id
      if (req.user?.id && req.user.id === targetUserId) {
        return res.status(400).json({
          code: 'CANNOT_MODIFY_OWN_ADMIN_ACCOUNT',
          message: 'Admins cannot delete their own account.'
        })
      }
      await usersService.deleteUser(targetUserId)
      res.json({ success: true, message: 'User deleted' })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async bulkParse(req, res, next) {
    const usersBulkController = require('./users.bulk.controller')
    return usersBulkController.bulkParse(req, res, next)
  },

  async bulkConfirm(req, res, next) {
    const usersBulkController = require('./users.bulk.controller')
    return usersBulkController.bulkConfirm(req, res, next)
  },

  async importExcel(req, res, next) {
    const usersBulkController = require('./users.bulk.controller')
    return usersBulkController.importExcel(req, res, next)
  },

  async adminResetPassword(req, res, next) {
    try {
      const { password, newPassword } = req.body
      const result = await usersService.adminResetPassword(req.params.id, newPassword || password)
      res.json(result)
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async getStudentsCount(req, res, next) {
    try {
      const { department, semester } = req.query
      const { prisma } = require('../../infra/postgres/client')
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE' },
        select: { profileMetadata: true }
      })
      const count = students.filter(s => {
        const meta = s.profileMetadata || {}
        const matchesDept = !department ||
          String(meta.department || '').toLowerCase().includes(department.toLowerCase()) ||
          department.toLowerCase().includes(String(meta.department || '').toLowerCase())
        const sSem = String(meta.semester || '').replace(/sem\s*/i, '').trim()
        const targetSem = String(semester || '').replace(/sem\s*/i, '').trim()
        return matchesDept && (!semester || sSem === targetSem)
      }).length
      return res.status(200).json({ status: 'success', count, department, semester })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  },

  async exportUserData(req, res, next) {
    try {
      const { prisma } = require('../../infra/postgres/client')
      const userId = req.params.userId || req.params.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          institutionId: true,
          referencePhotoKey: true,
          idCardPhotoKey: true,
          profileMetadata: true,
          createdAt: true
        }
      })

      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } })
      }

      // Fetch attempts with answers and proctoring logs (passwords and hashes strictly excluded)
      const attempts = await prisma.examAttempt.findMany({
        where: { studentId: userId },
        include: {
          exam: { select: { id: true, title: true, courseCode: true } },
          answers: { select: { questionId: true, selectedOptionIndex: true, updatedAt: true } },
          proctoringLogs: {
            select: { id: true, eventType: true, severity: true, evidenceKey: true, metadata: true, createdAt: true }
          }
        }
      })

      // Fetch readiness reports
      const readinessReports = await prisma.studentReadinessReport.findMany({
        where: { studentId: userId }
      })

      // Fetch consents
      const consents = await prisma.studentConsent.findMany({
        where: { studentId: userId }
      })

      return res.status(200).json({
        status: 'success',
        exportDate: new Date().toISOString(),
        user,
        attempts: attempts.map(a => ({
          id: a.id,
          exam: a.exam,
          status: a.status,
          score: a.score,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          reviewStatus: a.reviewStatus,
          isFlagged: a.isFlagged,
          answers: a.answers,
          proctoringLogs: a.proctoringLogs.map(l => ({
            id: String(l.id),
            eventType: l.eventType,
            severity: l.severity,
            hasEvidence: Boolean(l.evidenceKey),
            metadata: l.metadata,
            createdAt: l.createdAt
          }))
        })),
        readinessReports,
        consents
      })
    } catch (err) {
      console.error('Error in exportUserData:', err)
      next(err)
    }
  },

  async deleteUserEvidence(req, res, next) {
    try {
      const { prisma } = require('../../infra/postgres/client')
      const { deleteObject } = require('../../infra/s3/s3.client')
      const userId = req.params.userId || req.params.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, referencePhotoKey: true, idCardPhotoKey: true }
      })

      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } })
      }

      // 1. Find all attempts for user
      const attempts = await prisma.examAttempt.findMany({
        where: { studentId: userId },
        select: { id: true }
      })
      const attemptIds = attempts.map(a => a.id)

      // 2. Find all logs with evidenceKey
      const logs = await prisma.proctoringLog.findMany({
        where: {
          attemptId: { in: attemptIds },
          evidenceKey: { not: null }
        }
      })

      let s3DeletedCount = 0
      for (const log of logs) {
        if (log.evidenceKey) {
          try {
            await deleteObject(log.evidenceKey)
            s3DeletedCount++
          } catch (_) {}
        }
      }

      // 3. Clear evidenceKey in DB
      const updatedLogs = await prisma.proctoringLog.updateMany({
        where: {
          attemptId: { in: attemptIds },
          evidenceKey: { not: null }
        },
        data: { evidenceKey: null }
      })

      // 4. Delete user photos if stored in S3
      if (user.referencePhotoKey) {
        try {
          await deleteObject(user.referencePhotoKey)
          s3DeletedCount++
        } catch (_) {}
      }
      if (user.idCardPhotoKey) {
        try {
          await deleteObject(user.idCardPhotoKey)
          s3DeletedCount++
        } catch (_) {}
      }
      await prisma.user.update({
        where: { id: userId },
        data: { referencePhotoKey: null, idCardPhotoKey: null }
      })

      return res.status(200).json({
        status: 'success',
        message: 'Evidence purged successfully',
        deletedEvidenceCount: s3DeletedCount,
        clearedLogRecords: updatedLogs.count
      })
    } catch (err) {
      console.error('Error in deleteUserEvidence:', err)
      next(err)
    }
  }
}

module.exports = usersController
