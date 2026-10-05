/**
 * Canonical Role Constants (Task Q2.4 / Defect D-01)
 * 
 * Defines standard lowercase role identifiers and normalization helper.
 * All backend services, controllers, and authorization checks must reference ROLES.
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
  INVIGILATOR: 'invigilator'
})

const VALID_ROLES = Object.freeze(Object.values(ROLES))

function normalizeRole(role) {
  if (!role) return null
  const lower = String(role).trim().toLowerCase()
  if (VALID_ROLES.includes(lower)) {
    return lower
  }
  return null
}

module.exports = {
  ROLES,
  VALID_ROLES,
  normalizeRole
}
