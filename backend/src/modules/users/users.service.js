const bcrypt = require('bcryptjs')
const { prisma } = require('../../infra/postgres/client')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { parseExcelBuffer } = require('./users.excel')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')

const USER_FIELDS = {
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

async function resolvePhotoUrls(user) {
  if (!user) return user
  const meta = user.profileMetadata || {}
  const faceDataUrl = meta.facePhotoDataUrl || (user.referencePhotoKey?.startsWith('data:') ? user.referencePhotoKey : null)
  const idDataUrl = meta.idCardPhotoDataUrl || (user.idCardPhotoKey?.startsWith('data:') ? user.idCardPhotoKey : null)

  const [s3RefUrl, s3IdUrl] = await Promise.all([
    (!faceDataUrl && user.referencePhotoKey) ? getPresignedReadUrl(user.referencePhotoKey).catch(() => null) : null,
    (!idDataUrl && user.idCardPhotoKey) ? getPresignedReadUrl(user.idCardPhotoKey).catch(() => null) : null
  ])

  return {
    ...user,
    referencePhotoUrl: faceDataUrl || s3RefUrl || (user.referencePhotoKey ? `/api/v1/media/photo/${user.id}/face` : null),
    idCardPhotoUrl: idDataUrl || s3IdUrl || (user.idCardPhotoKey ? `/api/v1/media/photo/${user.id}/id-card` : null)
  }
}

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
        select: USER_FIELDS
      }),
      prisma.user.count({ where })
    ])

    const formatted = await Promise.all(users.map(async u => {
      const resolved = await resolvePhotoUrls(u)
      return {
        ...resolved,
        name: u.fullName,
        usn: u.institutionId,
        department: u.profileMetadata?.department || 'CSE',
        isActive: u.status === 'ACTIVE'
      }
    }))

    return { users: formatted, total }
  }

  async listPendingApprovals({ limit = 50, offset = 0 } = {}) {
    return this.listUsers({ status: 'PENDING_APPROVAL', limit, offset })
  }

  async getUserById(id) {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_FIELDS })
    if (!user) return null
    const resolved = await resolvePhotoUrls(user)
    return { ...resolved, name: user.fullName, usn: user.institutionId, isActive: user.status === 'ACTIVE' }
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
    const normalized = normalizeRole(targetRole)
    const initialStatus = status || (normalized === ROLES.ADMIN || normalized === ROLES.INVIGILATOR ? 'ACTIVE' : 'PENDING_SETUP')

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        fullName: (fullName || name).trim(),
        role: targetRole,
        institutionId: (institutionId || usn || '').trim() || null,
        referencePhotoKey: referencePhotoKey || null,
        idCardPhotoKey: idCardPhotoKey || null,
        profileMetadata: profileMetadata || (normalized === ROLES.INVIGILATOR ? { generatedPasswordHint: rawPassword } : {}),
        status: initialStatus
      },
      select: USER_FIELDS
    })

    return { ...user, name: user.fullName, usn: user.institutionId, isActive: user.status === 'ACTIVE' }
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
      select: USER_FIELDS
    })

    return { ...user, name: user.fullName, usn: user.institutionId, isActive: user.status === 'ACTIVE' }
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
    } else if (targetStatus === 'SUSPENDED') {
      metadata.suspendedAt = new Date().toISOString()
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: targetStatus, profileMetadata: metadata },
      select: { id: true, email: true, status: true, profileMetadata: true }
    })

    if (targetStatus === 'SUSPENDED') {
      try {
        await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {})
      } catch (_) {}
      try {
        const { socketEmitter } = require('../../infra/websocket/emitter')
        socketEmitter.emitToUser(id, 'session:revoked', { reason: 'ACCOUNT_SUSPENDED' })
      } catch (_) {}
      try {
        const { markUserSuspension } = require('../auth/auth.routes')
        if (typeof markUserSuspension === 'function') markUserSuspension(id, true)
      } catch (_) {}
    } else if (targetStatus === 'ACTIVE') {
      try {
        const { markUserSuspension } = require('../auth/auth.routes')
        if (typeof markUserSuspension === 'function') markUserSuspension(id, false)
      } catch (_) {}
    }

    return updated
  }

  async adminResetPassword(id, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      const err = new Error('Password must be at least 6 characters')
      err.status = 400
      throw err
    }
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id }, data: { passwordHash } })
    return { success: true, message: 'Password reset successfully' }
  }

  async deleteUser(id) {
    try {
      return await prisma.user.delete({ where: { id }, select: { id: true, email: true } })
    } catch (err) {
      if (err.code === 'P2003') {
        const error = new Error('Cannot delete user because relational records (attempts, audit logs, or enrollments) exist. Deactivate or suspend the user instead.')
        error.status = 409
        error.code = 'ENTITY_IN_USE'
        throw error
      }
      throw err
    }
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
