const bcrypt = require('bcryptjs')
const { prisma } = require('../../infra/postgres/client')
const { parseExcelBuffer } = require('./users.excel')

class UsersService {
  async listUsers({ role, status, search, limit = 50, offset = 0 } = {}) {
    const where = {}
    if (role) where.role = String(role).toUpperCase()
    if (status) where.status = String(status).toUpperCase()
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
          idCardPhotoKey: true,
          profileMetadata: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ])

    const formatted = users.map(u => ({
      ...u,
      name: u.fullName,
      usn: u.institutionId,
      department: u.profileMetadata?.department || 'CSE',
      isActive: u.status === 'ACTIVE'
    }))

    return { users: formatted, total }
  }

  async listPendingApprovals({ limit = 50, offset = 0 } = {}) {
    return this.listUsers({ status: 'PENDING_APPROVAL', limit, offset })
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
        idCardPhotoKey: true,
        profileMetadata: true,
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

  async createUser({ email, password, fullName, name, role = 'STUDENT', institutionId, usn, referencePhotoKey, idCardPhotoKey, profileMetadata, status }) {
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

    const targetRole = String(role).toUpperCase()
    const rawPassword = password || 'Default#1234'
    const passwordHash = await bcrypt.hash(rawPassword, 10)
    const initialStatus = status || (targetRole === 'ADMIN' || targetRole === 'INVIGILATOR' ? 'ACTIVE' : 'PENDING_SETUP')

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        fullName: (fullName || name).trim(),
        role: targetRole,
        institutionId: (institutionId || usn || '').trim() || null,
        referencePhotoKey: referencePhotoKey || null,
        idCardPhotoKey: idCardPhotoKey || null,
        profileMetadata: profileMetadata || (targetRole === 'INVIGILATOR' ? { generatedPasswordHint: rawPassword } : {}),
        status: initialStatus
      },
      select: {
        id: true,
        institutionId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        referencePhotoKey: true,
        idCardPhotoKey: true,
        profileMetadata: true,
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
    if (data.idCardPhotoKey) updateData.idCardPhotoKey = data.idCardPhotoKey
    if (data.profileMetadata) updateData.profileMetadata = data.profileMetadata
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
        idCardPhotoKey: true,
        profileMetadata: true,
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

  async setUserStatus(id, status, reason = null) {
    const targetStatus = String(status).toUpperCase()
    const existing = await prisma.user.findUnique({ where: { id }, select: { profileMetadata: true } })
    const metadata = { ...(existing?.profileMetadata || {}) }

    if (targetStatus === 'REJECTED') {
      metadata.rejectionReason = reason || 'Identity photo or credential verification rejected'
      metadata.rejectedAt = new Date().toISOString()
    } else if (targetStatus === 'ACTIVE') {
      metadata.rejectionReason = null
      metadata.approvedAt = new Date().toISOString()
    }

    return prisma.user.update({
      where: { id },
      data: { status: targetStatus, profileMetadata: metadata },
      select: { id: true, email: true, status: true, profileMetadata: true }
    })
  }

  async deleteUser(id) {
    return prisma.user.delete({
      where: { id },
      select: { id: true, email: true }
    })
  }

  async parseExcelBuffer(buffer) {
    return parseExcelBuffer(buffer)
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
          password: acc.password || 'Default#1234',
          status: 'PENDING_SETUP'
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
