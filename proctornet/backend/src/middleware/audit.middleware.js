const { logAudit } = require('../utils/auditLogger')
const { getClientIp } = require('../utils/helpers')

/**
 * audit.middleware.js
 * Automatically logs every mutating API request (POST/PUT/PATCH/DELETE)
 * to the AuditLog table. Runs after authenticate so req.user is available.
 *
 * Non-mutating (GET) and health-check routes are skipped.
 */
function auditRequest(req, res, next) {
  // Only log state-changing methods
  const LOGGED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
  if (!LOGGED_METHODS.includes(req.method)) return next()

  // Skip noisy or low-value routes
  const SKIP_PATHS = ['/health', '/api/student/exams/evidence']
  if (SKIP_PATHS.some(p => req.path.includes(p))) return next()

  const user = req.user || {}
  logAudit({
    userId:    user.id   || null,
    userRole:  user.role || 'anonymous',
    action:    `${req.method} ${req.path}`,
    details:   JSON.stringify({ body: sanitiseBody(req.body), params: req.params }),
    ipAddress: getClientIp(req),
    facultyId: user.role === 'faculty' ? user.id : null,
    studentId: user.role === 'student' ? user.id : null,
  })

  next()
}

/**
 * Remove sensitive fields from logged body.
 */
function sanitiseBody(body) {
  if (!body || typeof body !== 'object') return body
  const REDACT = ['password', 'invPassword', 'invPasswordHash', 'token']
  const safe   = { ...body }
  REDACT.forEach(k => { if (k in safe) safe[k] = '[REDACTED]' })
  return safe
}

module.exports = { auditRequest }
