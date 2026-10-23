'use strict'

const { usersService } = require('./users.service')

const usersBulkController = {
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

module.exports = usersBulkController
