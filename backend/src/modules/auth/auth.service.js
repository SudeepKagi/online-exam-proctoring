const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const authSql = require('./auth.sql')

const JWT_SECRET = process.env.JWT_SECRET || 'proctornet_super_secret_jwt_key_local_development_fallback_2026'
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '12h'

class AuthService {
  async authenticate(identifier, plainPassword, expectedRole = null) {
    if (!identifier || !plainPassword) {
      const err = new Error('Identifier and password are required')
      err.status = 400
      throw err
    }

    const user = await authSql.findUserByEmail(identifier)
    if (!user) {
      const err = new Error('Invalid credentials')
      err.status = 401
      throw err
    }

    if (user.status === 'SUSPENDED') {
      const err = new Error('Account is suspended. Please contact institutional administrator.')
      err.status = 403
      throw err
    }

    if (expectedRole && String(user.role).toUpperCase() !== String(expectedRole).toUpperCase()) {
      const err = new Error(`Access denied: this account is not registered under ${expectedRole}`)
      err.status = 403
      throw err
    }

    const isMatch = await bcrypt.compare(plainPassword, user.password)
    if (!isMatch) {
      const err = new Error('Invalid credentials')
      err.status = 401
      throw err
    }

    const tokens = this.issueTokens(user)
    const { password, passwordHash, ...safeUser } = user
    return { user: safeUser, ...tokens }
  }

  async register({ email, password, name, role, referencePhotoS3Key }) {
    if (!email || !password || !name || !role) {
      const err = new Error('Missing required fields for registration')
      err.status = 400
      throw err
    }

    const existing = await authSql.findUserByEmail(email)
    if (existing) {
      const err = new Error('Email is already registered')
      err.status = 409
      throw err
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const newUser = await authSql.createUser({
      email,
      password: hashedPassword,
      name,
      role,
      referencePhotoS3Key
    })

    const tokens = this.issueTokens(newUser)
    return { user: newUser, ...tokens }
  }

  issueTokens(user) {
    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    }

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = jwt.sign({ sub: user.id, id: user.id }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
    return { accessToken, refreshToken, token: accessToken }
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return null
    }
  }

  async getUserById(id) {
    const user = await authSql.findUserById(id)
    if (!user) return null
    const { password, passwordHash, ...safeUser } = user
    return safeUser
  }

  async submitOnboarding(userId, { newPassword, department, semester, designation, phone, usn, fullName, referencePhotoKey, idCardPhotoKey }) {
    const user = await authSql.findUserById(userId)
    if (!user) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }

    const updates = {
      status: 'PENDING_APPROVAL',
      profileMetadata: {
        ...(user.profileMetadata || {}),
        department: department || user.profileMetadata?.department || 'CSE',
        semester: semester || user.profileMetadata?.semester || null,
        designation: designation || user.profileMetadata?.designation || null,
        phone: phone || user.profileMetadata?.phone || null,
        submittedAt: new Date().toISOString(),
        rejectionReason: null
      }
    }

    if (newPassword && newPassword.length >= 6) {
      updates.passwordHash = await bcrypt.hash(newPassword, 10)
    }
    if (referencePhotoKey) updates.referencePhotoKey = referencePhotoKey
    if (idCardPhotoKey) updates.idCardPhotoKey = idCardPhotoKey
    if (fullName) updates.fullName = fullName.trim()
    if (usn) updates.institutionId = usn.trim()

    const updated = await authSql.updateUserProfile(userId, updates)
    const tokens = this.issueTokens(updated)
    const { password, passwordHash, ...safeUser } = updated
    return { user: safeUser, ...tokens }
  }

  async updateSettings(userId, { fullName, phone, department, semester, designation, currentPassword, newPassword }) {
    const user = await authSql.findUserById(userId)
    if (!user) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }

    const updates = {
      profileMetadata: {
        ...(user.profileMetadata || {}),
        phone: phone !== undefined ? phone : user.profileMetadata?.phone,
        department: department !== undefined ? department : user.profileMetadata?.department,
        semester: semester !== undefined ? semester : user.profileMetadata?.semester,
        designation: designation !== undefined ? designation : user.profileMetadata?.designation
      }
    }

    if (fullName) updates.fullName = fullName.trim()

    if (newPassword) {
      if (!currentPassword) {
        const err = new Error('Current password is required to change password')
        err.status = 400
        throw err
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password)
      if (!isMatch) {
        const err = new Error('Current password is incorrect')
        err.status = 400
        throw err
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10)
    }

    const updated = await authSql.updateUserProfile(userId, updates)
    const { password, passwordHash, ...safeUser } = updated
    return safeUser
  }
}

const authService = new AuthService()
module.exports = { authService, AuthService }
