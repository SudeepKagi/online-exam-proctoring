const { ForbiddenError, UnauthorizedError } = require('../shared/errors')
const { normalizeRole } = require('../shared/roles')

function requireRole(allowedRoles) {
  const rawList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const roles = rawList.map(r => normalizeRole(r) || String(r).toLowerCase())

  const middleware = (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new UnauthorizedError('Authentication required'))
    }

    const userRole = normalizeRole(req.user.role)
    if (!roles.includes(userRole)) {
      return next(new ForbiddenError(`Access restricted to roles: [${roles.join(', ')}]`))
    }

    next()
  }

  middleware.allowedRoles = roles
  return middleware
}

module.exports = {
  requireRole
}
