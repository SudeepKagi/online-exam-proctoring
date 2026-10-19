const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const authSql = require('./auth.sql')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')

const JWT_SECRET = process.env.JWT_SECRET || 'proctornet_super_secret_jwt_key_local_development_fallback_2026'
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '12h'

function err(msg, status = 400) {
  const e = new Error(msg)
  e.status = status
  return e
}

class AuthService {
  async authenticate(identifier, plainPassword, expectedRole = null) {
    if (!identifier || !plainPassword) throw err('Identifier and password are required', 400)
    const user = await authSql.findUserByEmail(identifier)
    if (!user) throw err('Invalid credentials', 401)
    if (user.status === 'SUSPENDED') throw err('Account is suspended. Please contact institutional administrator.', 403)
    if (expectedRole && String(user.role).toUpperCase() !== String(expectedRole).toUpperCase()) {
      throw err(`Access denied: this account is not registered under ${expectedRole}`, 403)
    }

    const isMatch = await bcrypt.compare(plainPassword, user.password)
    if (!isMatch) throw err('Invalid credentials', 401)

    const tokens = this.issueTokens(user)
    const { password, passwordHash, ...safeUser } = user
    return { user: safeUser, ...tokens }
  }

  async register({ email, password, name, role, referencePhotoS3Key }) {
    if (!email || !password || !name || !role) throw err('Missing required fields for registration', 400)
    const existing = await authSql.findUserByEmail(email)
    if (existing) throw err('Email is already registered', 409)

    const hashedPassword = await bcrypt.hash(password, 12)
    const newUser = await authSql.createUser({
      email, password: hashedPassword, name, role, referencePhotoS3Key
    })

    const tokens = this.issueTokens(newUser)
    return { user: newUser, ...tokens }
  }

  issueTokens(user) {
    const payload = { sub: user.id, id: user.id, email: user.email, role: user.role, name: user.name }
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
    const [refUrl, idUrl] = await Promise.all([
      user.referencePhotoKey ? getPresignedReadUrl(user.referencePhotoKey).catch(() => null) : null,
      user.idCardPhotoKey ? getPresignedReadUrl(user.idCardPhotoKey).catch(() => null) : null
    ])
    const { password, passwordHash, ...safeUser } = user
    return {
      ...safeUser,
      referencePhotoUrl: refUrl || (user.referencePhotoKey?.startsWith('data:') ? user.referencePhotoKey : null),
      idCardPhotoUrl: idUrl || (user.idCardPhotoKey?.startsWith('data:') ? user.idCardPhotoKey : null)
    }
  }

  async forgotPassword(identifier, role = null) {
    if (!identifier) {
      const err = new Error('Identifier is required')
      err.status = 400
      throw err
    }
    const user = await authSql.findUserByEmail(identifier)
    if (!user) {
      const err = new Error('No account found with provided email or USN')
      err.status = 404
      throw err
    }
    if (role && String(user.role).toUpperCase() !== String(role).toUpperCase()) {
      const err = new Error(`Account found is registered as ${user.role}, not ${role}`)
      err.status = 400
      throw err
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await authSql.updateUserProfile(user.id, {
      profileMetadata: { ...(user.profileMetadata || {}), resetOtp: otp, resetOtpExpiresAt: expiresAt }
    })
    return { success: true, message: 'Password reset code generated', resetOtpPreview: otp }
  }

  async resetPassword({ identifier, otp, newPassword }) {
    if (!identifier || !otp || !newPassword) {
      const err = new Error('Identifier, OTP, and new password are required')
      err.status = 400
      throw err
    }
    const user = await authSql.findUserByEmail(identifier)
    if (!user) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }
    const storedOtp = user.profileMetadata?.resetOtp
    const storedExpiry = user.profileMetadata?.resetOtpExpiresAt
    if (!storedOtp || String(storedOtp).trim() !== String(otp).trim()) {
      const err = new Error('Invalid verification code')
      err.status = 400
      throw err
    }
    if (storedExpiry && new Date(storedExpiry) < new Date()) {
      const err = new Error('Verification code has expired')
      err.status = 400
      throw err
    }
    if (newPassword.length < 6) {
      const err = new Error('Password must be at least 6 characters')
      err.status = 400
      throw err
    }
    const passwordHash = await bcrypt.hash(newPassword, 10)
    const { resetOtp, resetOtpExpiresAt, ...cleanMeta } = user.profileMetadata || {}
    await authSql.updateUserProfile(user.id, { passwordHash, profileMetadata: cleanMeta })
    return { success: true, message: 'Password reset successfully' }
  }

  async submitOnboarding(userId, payload = {}) {
    const { newPassword, password, department, semester, designation, phone, usn, institutionId, fullName, referencePhotoKey, idCardPhotoKey, profileMetadata } = payload
    const user = await authSql.findUserById(userId)
    if (!user) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }

    const pwd = newPassword || password
    if (!pwd || pwd.length < 8) {
      const err = new Error('New password must be at least 8 characters long')
      err.status = 400
      throw err
    }

    const meta = profileMetadata || {}
    const rawDept = department || meta.department || user.profileMetadata?.department || 'Computer Science and Engineering'
    const rawSem = semester || meta.semester || user.profileMetadata?.semester || 'Sem 6'
    const normSem = String(rawSem).startsWith('Sem') ? String(rawSem) : `Sem ${rawSem}`
    const normDept = String(rawDept).trim()

    const passwordHash = await bcrypt.hash(pwd, 12)
    const updates = {
      passwordHash,
      status: 'PENDING_APPROVAL',
      profileMetadata: {
        ...(user.profileMetadata || {}),
        ...meta,
        department: normDept,
        semester: normSem,
        designation: designation || meta.designation || user.profileMetadata?.designation || null,
        phone: phone || meta.phone || user.profileMetadata?.phone || null,
        submittedAt: new Date().toISOString(),
        rejectionReason: null
      }
    }

    if (referencePhotoKey) {
      updates.referencePhotoKey = referencePhotoKey
      if (referencePhotoKey.startsWith('data:')) updates.profileMetadata.facePhotoDataUrl = referencePhotoKey
    }
    if (idCardPhotoKey) {
      updates.idCardPhotoKey = idCardPhotoKey
      if (idCardPhotoKey.startsWith('data:')) updates.profileMetadata.idCardPhotoDataUrl = idCardPhotoKey
    }
    if (fullName) updates.fullName = fullName.trim()
    const instId = institutionId || usn
    if (instId) updates.institutionId = instId.trim()

    const updated = await authSql.updateUserProfile(userId, updates)
    const tokens = this.issueTokens(updated)
    const { password: _p, passwordHash: _ph, ...safeUser } = updated
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
