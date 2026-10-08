/**
 * service.js
 * Core authentication service for ProctorNet (Phase S2 Stabilization).
 * Integrates unified tokenService for dual-token sessions, rotation, and server-side revocation.
 */

const bcrypt = require('bcrypt')
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
const { tokenService } = require('./tokenService')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../observability/logger')

// Ensure threadpool has capacity for async native bcrypt
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '8'

// Limit concurrent bcrypt computations to avoid CPU starvation (Appendix B / S2: 2 on lite, 10 elsewhere)
const hashLimiter = pLimit(config.hashConcurrencyLimit || 2)

class AuthService {
  async comparePassword(plain, hashed) {
    if (!plain || !hashed) return false
    return hashLimiter(() => bcrypt.compare(plain, hashed))
  }

  async hashPassword(plain) {
    return hashLimiter(() => bcrypt.hash(plain, config.bcryptRounds || 10))
  }

  /**
   * Unified login for email-based credentials
   */
  async login(email, password, { ip = null, userAgent = null } = {}) {
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

    const session = await tokenService.createSession({
      userId: user.id,
      role,
      ip,
      userAgent
    })

    const userDto = toUserDto(user, role)

    return {
      user: userDto,
      session
    }
  }

  /**
   * Admin Login
   */
  async adminLogin(email, password, { ip = null, userAgent = null } = {}) {
    const admin = await authRepository.findAdminByEmail(email)
    if (!admin) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const isMatch = await this.comparePassword(password, admin.password)
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const session = await tokenService.createSession({
      userId: admin.id,
      role: ROLES.ADMIN,
      ip,
      userAgent
    })

    const userDto = toUserDto(admin, ROLES.ADMIN)

    return {
      user: userDto,
      session
    }
  }

  /**
   * Faculty Login
   */
  async facultyLogin(email, password, { ip = null, userAgent = null } = {}) {
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

    const session = await tokenService.createSession({
      userId: faculty.id,
      role: ROLES.FACULTY,
      ip,
      userAgent
    })

    const userDto = toUserDto(faculty, ROLES.FACULTY)

    return {
      user: userDto,
      session
    }
  }

  /**
   * Student Login with Concurrent-Session Policy (Phase S2)
   */
  async studentLogin(usn, password, { ip = null, userAgent = null, io = null } = {}) {
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

    // Concurrent-session policy for students:
    // Check if student has an ACTIVE exam attempt
    const activeAttempt = await prisma.examAttempt.findFirst({
      where: {
        studentId: student.id,
        status: 'ACTIVE'
      }
    })

    if (activeAttempt) {
      logger.warn(
        { studentId: student.id, attemptId: activeAttempt.id, ip },
        'Student logging in while attempt is ACTIVE: superseding old session and recording concurrent event'
      )

      // Notify previous connected device via socket if available
      if (io) {
        io.to(`student:${student.id}`).emit('session:replaced', {
          reason: 'A new session was opened on another device/browser.',
          timestamp: new Date().toISOString()
        })
      }

      // Record audit / violation event for concurrent session
      try {
        await prisma.violationEvent.create({
          data: {
            id: crypto.randomUUID(),
            attemptId: activeAttempt.id,
            eventType: 'TAB_SWITCH',
            severity: 'HIGH',
            metadata: {
              type: 'CONCURRENT_LOGIN',
              detail: 'Student initiated login from another browser/IP during an active examination session',
              ip
            }
          }
        })
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to record concurrent login violation event')
      }
    }

    // A new student login supersedes all old active sessions
    await tokenService.revokeAllUserSessions(student.id, 'SUPERSEDED')

    const session = await tokenService.createSession({
      userId: student.id,
      role: ROLES.STUDENT,
      examId: activeAttempt?.id || null,
      ip,
      userAgent
    })

    const userDto = toUserDto(student, ROLES.STUDENT)

    return {
      user: userDto,
      session
    }
  }

  /**
   * Invigilator Login (Exam-scoped, bounded lifetime, refresh restricted)
   */
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

    // Invigilator credentials valid until exam window end + 30 min (S2 Specification)
    const maxValidUntil = new Date(new Date(exam.endTime).getTime() + 30 * 60 * 1000)
    if (Date.now() > maxValidUntil.getTime()) {
      throw new UnauthorizedError('Invigilator credentials expired (exam ended + 30m)')
    }

    const secondsUntilExpiry = Math.max(Math.floor((maxValidUntil.getTime() - Date.now()) / 1000), 60)

    const legacySession = await authRepository.createInvigilatorSession({
      examId,
      invId,
      sessionExpiry: maxValidUntil,
      ipAddress
    })

    const session = await tokenService.createSession({
      userId: legacySession.id,
      role: ROLES.INVIGILATOR,
      examId,
      ip: ipAddress,
      refreshTtlSec: secondsUntilExpiry,
      accessTtlSec: Math.min(secondsUntilExpiry, 900)
    })

    const userDto = {
      id: legacySession.invId,
      name: `Invigilator ${legacySession.invId}`,
      role: ROLES.INVIGILATOR,
      examId,
      sessionId: legacySession.id,
      sessionExpiry: maxValidUntil
    }

    return {
      user: userDto,
      session: {
        id: legacySession.id,
        examId,
        invId,
        sessionExpiry: maxValidUntil,
        exam: { title: exam.title, subject: exam.subject },
        accessToken: session.accessToken,
        refreshToken: session.refreshToken
      }
    }
  }

  /**
   * Rotate Refresh Token (Phase S2)
   */
  async refreshSession(rawRefreshToken, { ip = null, userAgent = null } = {}) {
    return tokenService.rotateSession(rawRefreshToken, { ip, userAgent })
  }

  /**
   * Change Password and Revoke All Active Sessions
   */
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

    // Invalidate every active session for this user immediately upon password change
    await tokenService.revokeAllUserSessions(userId, 'PASSWORD_CHANGED')

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

  /**
   * Terminate current session
   */
  async logout(userId, sid = null) {
    if (sid) {
      await tokenService.revokeSession(sid, 'LOGOUT')
    } else if (userId) {
      await tokenService.revokeAllUserSessions(userId, 'LOGOUT')
    }
    return { success: true }
  }

  /**
   * Terminate all sessions for user
   */
  async logoutAll(userId) {
    if (userId) {
      await tokenService.revokeAllUserSessions(userId, 'LOGOUT_ALL')
    }
    return { success: true }
  }
}

const authServiceInstance = new AuthService()
authServiceInstance.authService = authServiceInstance
module.exports = authServiceInstance
