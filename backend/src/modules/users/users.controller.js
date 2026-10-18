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

      let referencePhotoUrl = null
      let idCardPhotoUrl = null

      if (user.referencePhotoKey) {
        referencePhotoUrl = await mediaService.getReadUrl(user.referencePhotoKey).catch(() => null)
      }
      if (user.idCardPhotoKey) {
        idCardPhotoUrl = await mediaService.getReadUrl(user.idCardPhotoKey).catch(() => null)
      }

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

  async suspendUser(req, res, next) {
    try {
      const user = await usersService.setUserStatus(req.params.id, 'SUSPENDED')
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
      await usersService.deleteUser(req.params.id)
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
  }
}

module.exports = usersController
