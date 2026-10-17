'use strict'

/**
 * Shared Canonical Role Constants
 *
 * Defines standard lowercase role identifiers and normalization helper.
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  INVIGILATOR: 'invigilator',
  STUDENT: 'student'
})

const VALID_ROLES = Object.freeze(Object.values(ROLES))

function normalizeRole(role) {
  if (!role) return null
  const lower = String(role).trim().toLowerCase()
  return VALID_ROLES.includes(lower) ? lower : null
}

module.exports = {
  ROLES,
  VALID_ROLES,
  normalizeRole
}
