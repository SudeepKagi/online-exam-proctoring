'use strict'

const { tokenService } = require('../../proctornet/backend/src/modules/auth/tokenService')
const { ROLES } = require('../../proctornet/backend/src/shared/roles')

/**
 * Creates a real session in auth_sessions and returns a valid access token with `sid`
 * (§1 CI-C, SEC-1, C1.3)
 *
 * @param {Object} user User object with { id, role, email }
 * @param {Object} [options] Optional examId, ip, userAgent
 * @returns {Promise<{ token: string, accessToken: string, sid: string, familyId: string }>}
 */
async function loginAs(user, options = {}) {
  const role = (user.role || ROLES.STUDENT).toUpperCase()
  const userId = user.id

  const session = await tokenService.createSession({
    userId,
    role,
    examId: options.examId || null,
    ip: options.ip || '127.0.0.1',
    userAgent: options.userAgent || 'ProctorNet-TestRunner'
  })

  return {
    token: session.accessToken,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    sid: session.sid,
    familyId: session.familyId,
    session
  }
}

module.exports = {
  loginAs
}
