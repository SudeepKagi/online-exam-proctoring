'use strict'

const { ROLES, VALID_ROLES, normalizeRole } = require('./roles')
const {
  VIOLATION_TYPES,
  CLIENT_VIOLATION_MAP,
  CANONICAL_SEVERITY,
  FLAG_COOLDOWNS,
  normalizeViolationType,
  isValidViolationType
} = require('./violationTypes')

module.exports = {
  ROLES,
  VALID_ROLES,
  normalizeRole,
  VIOLATION_TYPES,
  CLIENT_VIOLATION_MAP,
  CANONICAL_SEVERITY,
  FLAG_COOLDOWNS,
  normalizeViolationType,
  isValidViolationType
}
