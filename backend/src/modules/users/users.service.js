const bcrypt = require('bcryptjs')
const ExcelJS = require('exceljs')
const { prisma } = require('../../infra/postgres/client')

class UsersService {
  async listUsers({ role, status, search, limit = 50, offset = 0 } = {}) {
    const where = {}
    if (role) {
      where.role = String(role).toUpperCase()
    }
    if (status) {
      where.status = String(status).toUpperCase()
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { institutionId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: Number(limit) || 50,
        skip: Number(offset) || 0,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          institutionId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          referencePhotoKey: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ])

    // Format safe response for frontend consumers
    const formatted = users.map(u => ({
      ...u,
      name: u.fullName,
      usn: u.institutionId,
      department: 'CSE',
      isActive: u.status === 'ACTIVE'
    }))

    return { users: formatted, total }
  }

  async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        institutionId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        referencePhotoKey: true,
        createdAt: true
      }
    })
    if (!user) return null
    return {
      ...user,
      name: user.fullName,
      usn: user.institutionId,
      isActive: user.status === 'ACTIVE'
    }
  }

  async createUser({ email, password, fullName, name, role = 'STUDENT', institutionId, usn, referencePhotoKey }) {
    if (!email || (!fullName && !name)) {
      const err = new Error('Email and name are required')
      err.status = 400
      throw err
    }

    const cleanEmail = email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (existing) {
      const err = new Error('User with this email already exists')
      err.status = 409
      throw err
    }

    const rawPassword = password || 'Default#1234'
    const passwordHash = await bcrypt.hash(rawPassword, 10)

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        fullName: (fullName || name).trim(),
        role: String(role).toUpperCase(),
        institutionId: (institutionId || usn || '').trim() || null,
        referencePhotoKey: referencePhotoKey || null,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        institutionId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        referencePhotoKey: true,
        createdAt: true
      }
    })

    return {
      ...user,
      name: user.fullName,
      usn: user.institutionId,
      isActive: user.status === 'ACTIVE'
    }
  }

  async updateUser(id, data) {
    const updateData = {}
    if (data.fullName || data.name) updateData.fullName = (data.fullName || data.name).trim()
    if (data.institutionId || data.usn) updateData.institutionId = (data.institutionId || data.usn).trim()
    if (data.role) updateData.role = String(data.role).toUpperCase()
    if (data.status) updateData.status = String(data.status).toUpperCase()
    if (data.referencePhotoKey) updateData.referencePhotoKey = data.referencePhotoKey
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        institutionId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        referencePhotoKey: true,
        createdAt: true
      }
    })

    return {
      ...user,
      name: user.fullName,
      usn: user.institutionId,
      isActive: user.status === 'ACTIVE'
    }
  }

  async setUserStatus(id, status) {
    const validStatus = String(status).toUpperCase() === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE'
    return prisma.user.update({
      where: { id },
      data: { status: validStatus },
      select: { id: true, email: true, status: true }
    })
  }

  async deleteUser(id) {
    return prisma.user.delete({
      where: { id },
      select: { id: true, email: true }
    })
  }

  async parseExcelBuffer(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('Excel workbook contains no sheets')
    }

    const rows = []
    let headerMap = {}

    worksheet.eachRow((row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      if (rowNumber === 1) {
        values.forEach((v, idx) => {
          const col = String(v || '').toLowerCase().trim()
          headerMap[col] = idx
        })
      } else {
        const getVal = (col) => {
          const idx = headerMap[col]
          return idx !== undefined && values[idx] !== undefined ? String(values[idx]).trim() : ''
        }

        const email = getVal('email')
        const name = getVal('name') || getVal('fullname') || getVal('full name')
        const usn = getVal('usn') || getVal('id') || getVal('institutionid') || getVal('employee id')
        const role = getVal('role') || 'STUDENT'
        const password = getVal('password') || 'Default#1234'

        if (email && name) {
          rows.push({ email, name, fullName: name, usn, institutionId: usn, role, password })
        }
      }
    })

    return rows
  }

  async bulkCreateUsers(accounts = []) {
    const results = []
    for (const acc of accounts) {
      try {
        const user = await this.createUser({
          email: acc.email,
          fullName: acc.name || acc.fullName,
          institutionId: acc.usn || acc.institutionId || acc.departmentCode,
          role: acc.role || 'STUDENT',
          password: acc.password || 'Default#1234'
        })
        results.push({ success: true, email: acc.email, user })
      } catch (err) {
        results.push({ success: false, email: acc.email, error: err.message })
      }
    }
    return results
  }
}

const usersService = new UsersService()
module.exports = { usersService, UsersService }
