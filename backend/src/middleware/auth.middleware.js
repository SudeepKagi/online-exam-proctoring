const { authenticateToken } = require('../modules/auth/auth.routes')

module.exports = {
  authenticate: authenticateToken,
  authenticateToken
}
