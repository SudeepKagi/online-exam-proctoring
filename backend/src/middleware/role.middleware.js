/**
 * role.middleware.js
 * Checks that req.user.role matches one of the allowed roles.
 * Must be used AFTER authenticate middleware.
 *
 * Usage:
 *   router.get('/route', authenticate, requireRole('admin'), handler)
 *   router.get('/route', authenticate, requireRole('admin','faculty'), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
      })
    }

    next()
  }
}

// Convenience shortcuts
const isAdmin       = requireRole('admin')
const isFaculty     = requireRole('faculty')
const isStudent     = requireRole('student')
const isInvigilator = requireRole('invigilator')
const isAdminOrFaculty = requireRole('admin', 'faculty')

module.exports = { requireRole, isAdmin, isFaculty, isStudent, isInvigilator, isAdminOrFaculty }
