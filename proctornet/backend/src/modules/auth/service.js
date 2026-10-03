const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pLimit = require('p-limit')
const config = require('../../shared/config')
const { UnauthorizedError } = require('../../shared/errors')
const authRepository = require('./repository')
const { toUserDto } = require('./dto')

// Ensure threadpool has capacity for async native bcrypt
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '8'

// Limit concurrent bcrypt computations to avoid CPU starvation during login storms
const hashLimiter = pLimit(config.hashConcurrencyLimit || 10)

class AuthService {
  async comparePassword(plain, hashed) {
    return hashLimiter(() => bcrypt.compare(plain, hashed))
  }

  async hashPassword(plain) {
    return hashLimiter(() => bcrypt.hash(plain, config.bcryptRounds || 12))
  }

  generateTokens(user, role) {
    const payload = {
      id: user.id,
      role: role.toLowerCase(),
      email: user.email,
      name: user.name,
      departmentCode: user.departmentCode || null,
      semester: user.semester || null
    }

    const accessToken = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn || '15m'
    })

    const refreshToken = jwt.sign({ id: user.id, role: payload.role }, config.jwtSecret, {
      expiresIn: config.jwtRefreshExpiresIn || '7d'
    })

    return { accessToken, refreshToken }
  }

  async login(email, password) {
    const result = await authRepository.findUserAcrossRoles(email)
    if (!result) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const { user, role } = result

    // Check account status if applicable
    if (user.isSuspended) {
      throw new UnauthorizedError('Account is suspended. Please contact administrator.')
    }
    if (user.isApproved === false || user.approvalStatus === 'REJECTED') {
      throw new UnauthorizedError('Account is pending approval or has been rejected.')
    }

    const isMatch = await this.comparePassword(password, user.password)
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const tokens = this.generateTokens(user, role)
    const userDto = toUserDto(user, role)

    return {
      user: userDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }
}

module.exports = new AuthService()
