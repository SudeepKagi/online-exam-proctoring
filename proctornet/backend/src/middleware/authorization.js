const { ForbiddenError, UnauthorizedError } = require('../shared/errors')

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles.map(r => r.toLowerCase()) : [allowedRoles.toLowerCase()]

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new UnauthorizedError('Authentication required'))
    }

    const userRole = req.user.role.toLowerCase()
    if (!roles.includes(userRole)) {
      return next(new ForbiddenError(`Access restricted to roles: [${roles.join(', ')}]`))
    }

    next()
  }
}

module.exports = {
  requireRole
}
