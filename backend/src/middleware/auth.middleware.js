const { authenticateToken, requireRole } = require('../modules/auth/auth.routes')

module.exports = {
  authenticate: authenticateToken,
  authenticateToken,
  requireRole
}
