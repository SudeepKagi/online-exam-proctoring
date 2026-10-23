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
      next(err)
    }
  },

  async listFaculty(req, res, next) {
    try {
      const { search, limit, offset, status } = req.query
      const result = await usersService.listUsers({ role: 'FACULTY', search, limit, offset, status })
      res.json({ faculty: result.users, total: result.total })
    } catch (err) {
      next(err)
    }
  },

  async listUsers(req, res, next) {
    try {
      const { role, search, limit, offset, status } = req.query
      const result = await usersService.listUsers({ role, search, limit, offset, status })
      res.json({ users: result.users, total: result.total })
    } catch (err) {
      next(err)
    }
  },

  async getUser(req, res, next) {
    try {
      const user = await usersService.getUserById(req.params.id)
      if (!user) return res.status(404).json({ error: { message: 'User not found' } })
      res.json({ user })
    } catch (err) {
      next(err)
    }
  },

  async createStudent(req, res, next) {
    try {
      const payload = { ...req.body, role: 'STUDENT' }
      const user = await usersService.createUser(payload)
      res.status(201).json({ message: 'Account Created Successfully', user, student: user })
    } catch (err) {
      next(err)
    }
  },

  async createFaculty(req, res, next) {
    try {
      const payload = { ...req.body, role: 'FACULTY' }
      const user = await usersService.createUser(payload)
      res.status(201).json({ message: 'Faculty Account Created', user, faculty: user })
    } catch (err) {
      next(err)
    }
  },

  async createUser(req, res, next) {
    try {
      const user = await usersService.createUser(req.body)
      res.status(201).json({ user })
    } catch (err) {
      next(err)
    }
  },

  async listPendingApprovals(req, res, next) {
    try {
      const { limit, offset } = req.query
      const result = await usersService.listPendingApprovals({ limit, offset })
      res.json({ users: result.users, pendingUsers: result.users, total: result.total })
    } catch (err) {
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
      next(err)
    }
  },

  async approveUser(req, res, next) {
    try {
      const user = await usersService.setUserStatus(req.params.id, 'ACTIVE')
      res.json({ success: true, message: 'User approved', user })
    } catch (err) {
      next(err)
    }
  },

  async rejectUser(req, res, next) {
    try {
      const reason = req.body?.reason || req.body?.rejectionReason || 'Verification rejected by administrator'
      const user = await usersService.setUserStatus(req.params.id, 'REJECTED', reason)
      res.json({ success: true, message: 'User registration rejected', user })
    } catch (err) {
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
      next(err)
    }
  },

  async unsuspendUser(req, res, next) {
    try {
      const user = await usersService.setUserStatus(req.params.id, 'ACTIVE')
      res.json({ success: true, message: 'User unsuspended', user })
    } catch (err) {
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
      next(err)
    }
  },

  async bulkParse(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: { message: 'Excel file (.xlsx) is required' } })
      }
      const parsed = await usersService.parseExcelBuffer(req.file.buffer)
      res.json({ count: parsed.length, accounts: parsed })
    } catch (err) {
      next(err)
    }
  },

  async bulkConfirm(req, res, next) {
    try {
      const accounts = req.body.accounts || req.body.users || []
      const results = await usersService.bulkCreateUsers(accounts)
      const successCount = results.filter(r => r.success).length
      res.json({ message: `Successfully created ${successCount} accounts`, total: accounts.length, results })
    } catch (err) {
      next(err)
    }
  },

  async importExcel(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: { message: 'Excel file (.xlsx) is required' } })
      }
      const parsed = await usersService.parseExcelBuffer(req.file.buffer)
      const results = await usersService.bulkCreateUsers(parsed)
      const importedCount = results.filter(r => r.success).length
      res.json({ message: `Successfully imported ${importedCount} accounts`, importedCount, total: parsed.length, results })
    } catch (err) {
      next(err)
    }
  },

  async adminResetPassword(req, res, next) {
    try {
      const { password, newPassword } = req.body
      const result = await usersService.adminResetPassword(req.params.id, newPassword || password)
      res.json(result)
    } catch (err) {
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
      next(err)
    }
  }
}

module.exports = usersController
