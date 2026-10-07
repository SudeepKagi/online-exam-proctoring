const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pLimit = require('p-limit')
const config = require('../../shared/config')
const {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../shared/errors')
const authRepository = require('./repository')
const { toUserDto } = require('./dto')
const { ROLES, normalizeRole } = require('../../shared/roles')

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

  generateTokens(user, role, extra = {}) {
    const canonicalRole = normalizeRole(role) || String(role).toLowerCase()
    const payload = {
      id: user.id,
      role: canonicalRole,
      email: user.email || null,
      name: user.name || null,
      departmentCode: user.departmentCode || null,
      semester: user.semester || null,
      ...extra
    }

    const accessToken = jwt.sign(payload, config.jwtSecret, {
      expiresIn: extra.expiresIn || config.jwtExpiresIn || '15m'
    })

    const refreshToken = jwt.sign({ id: user.id, role: canonicalRole, ...extra }, config.jwtSecret, {
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

  async adminLogin(email, password) {
    const admin = await authRepository.findAdminByEmail(email)
    if (!admin) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const isMatch = await this.comparePassword(password, admin.password)
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const tokens = this.generateTokens(admin, ROLES.ADMIN)
    const userDto = toUserDto(admin, ROLES.ADMIN)

    return {
      user: userDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  async facultyLogin(email, password) {
    const faculty = await authRepository.findFacultyByEmail(email)
    if (!faculty) {
      throw new UnauthorizedError('Invalid credentials')
    }

    if (!faculty.isApproved) {
      throw new ForbiddenError('Your account is pending admin approval')
    }

    if (faculty.isSuspended) {
      throw new ForbiddenError('Your account has been suspended. Contact admin.')
    }

    const isMatch = await this.comparePassword(password, faculty.password)
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const tokens = this.generateTokens(faculty, ROLES.FACULTY)
    const userDto = toUserDto(faculty, ROLES.FACULTY)

    return {
      user: userDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  async studentLogin(usn, password) {
    if (!usn || !password) {
      throw new ValidationError('USN and password are required')
    }

    const student = await authRepository.findStudentByUsn(usn)
    if (!student) {
      throw new UnauthorizedError('Invalid credentials')
    }

    if (student.approvalStatus !== 'APPROVED') {
      throw new ForbiddenError('Your account is not yet approved')
    }

    if (student.isSuspended) {
      throw new ForbiddenError('Account suspended. Contact admin.')
    }

    const isMatch = await this.comparePassword(password, student.password)
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const tokens = this.generateTokens(student, ROLES.STUDENT)
    const userDto = toUserDto(student, ROLES.STUDENT)

    return {
      user: userDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  async invigilatorLogin({ invId, invPassword, examId, ipAddress = null }) {
    if (!invId || !invPassword || !examId) {
      throw new ValidationError('invId, invPassword and examId are required')
    }

    const exam = await authRepository.findExamById(examId)
    if (!exam) {
      throw new NotFoundError('Exam not found')
    }

    if (exam.invId !== invId) {
      throw new UnauthorizedError('Invalid invigilator credentials')
    }

    const isMatch = await this.comparePassword(invPassword, exam.invPasswordHash)
    if (!isMatch) {
      throw new UnauthorizedError('Invalid invigilator credentials')
    }

    const sessionExpiry = new Date(exam.endTime.getTime() + 30 * 60 * 1000)
    const secondsUntilExpiry = Math.max(Math.floor((sessionExpiry.getTime() - Date.now()) / 1000), 60)

    const session = await authRepository.createInvigilatorSession({
      examId,
      invId,
      sessionExpiry,
      ipAddress
    })

    const tokens = this.generateTokens(
      { id: session.id, name: `Invigilator ${invId}`, email: null },
      ROLES.INVIGILATOR,
      { examId, expiresIn: `${secondsUntilExpiry}s` }
    )

    const userDto = {
      id: session.invId,
      name: `Invigilator ${session.invId}`,
      role: ROLES.INVIGILATOR,
      examId,
      sessionId: session.id,
      sessionExpiry
    }

    return {
      user: userDto,
      session: {
        id: session.id,
        examId,
        invId,
        sessionExpiry,
        exam: { title: exam.title, subject: exam.subject }
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  async changePassword(userId, rawRole, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required')
    }
    if (newPassword.length < 6) {
      throw new ValidationError('New password must be at least 6 characters long')
    }

    const role = normalizeRole(rawRole)
    let userObj = null

    if (role === ROLES.STUDENT) {
      userObj = await authRepository.findStudentById(userId)
    } else if (role === ROLES.FACULTY) {
      userObj = await authRepository.findFacultyById(userId)
    } else if (role === ROLES.ADMIN) {
      userObj = await authRepository.findAdminById(userId)
    }

    if (!userObj) {
      throw new NotFoundError('User account not found')
    }

    const isMatch = await this.comparePassword(currentPassword, userObj.password)
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect')
    }

    const newHashed = await this.hashPassword(newPassword)

    if (role === ROLES.STUDENT) {
      await authRepository.updateStudentPassword(userId, newHashed)
    } else if (role === ROLES.FACULTY) {
      await authRepository.updateFacultyPassword(userId, newHashed)
    } else if (role === ROLES.ADMIN) {
      await authRepository.updateAdminPassword(userId, newHashed)
    }

    return { success: true, message: 'Password changed successfully' }
  }

  async getMe(reqUser) {
    if (!reqUser) throw new UnauthorizedError('Authentication required')
    const role = normalizeRole(reqUser.role)
    const id = reqUser.id

    if (role === ROLES.STUDENT) {
      const student = await authRepository.findStudentById(id)
      if (!student) throw new NotFoundError('Student not found')
      return toUserDto(student, ROLES.STUDENT)
    }

    if (role === ROLES.FACULTY) {
      const faculty = await authRepository.findFacultyById(id)
      if (!faculty) throw new NotFoundError('Faculty not found')
      return toUserDto(faculty, ROLES.FACULTY)
    }

    if (role === ROLES.ADMIN) {
      const admin = await authRepository.findAdminById(id)
      if (!admin) throw new NotFoundError('Admin not found')
      return toUserDto(admin, ROLES.ADMIN)
    }

    if (role === ROLES.INVIGILATOR) {
      const session = await authRepository.findInvigilatorSessionById(id)
      if (!session || !session.isActive) {
        throw new UnauthorizedError('Invigilator session has expired or is invalid')
      }
      return {
        id: session.invId,
        name: `Invigilator ${session.invId}`,
        role: ROLES.INVIGILATOR,
        examId: session.examId,
        exam: session.exam,
        sessionId: session.id,
        sessionExpiry: session.sessionExpiry
      }
    }

    return reqUser
  }

  async logout(userId) {
    return { success: true }
  }
}

module.exports = new AuthService()
