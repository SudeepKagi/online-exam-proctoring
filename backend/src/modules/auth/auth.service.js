const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const authSql = require('./auth.sql')

const JWT_SECRET = process.env.JWT_SECRET || 'proctornet_super_secret_jwt_key_local_development_fallback_2026'
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '12h'

class AuthService {
  async authenticate(email, plainPassword, expectedRole = null) {
    if (!email || !plainPassword) {
      const err = new Error('Email and password are required')
      err.status = 400
      throw err
    }

    const user = await authSql.findUserByEmail(email)
    if (!user || !user.isActive) {
      const err = new Error('Invalid credentials or account is inactive')
      err.status = 401
      throw err
    }

    if (expectedRole && user.role !== expectedRole) {
      const err = new Error(`Access denied for role ${expectedRole}`)
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
    const { password, ...safeUser } = user
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
    const { password, ...safeUser } = user
    return safeUser
  }
}

const authService = new AuthService()
module.exports = { authService, AuthService }
