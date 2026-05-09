/**
 * auditLogger.js — Write entries to the AuditLog table
 */

/**
 * Log an action to the AuditLog table.
 * Safe to call without await — failures are swallowed so they
 * never crash the main request flow.
 *
 * @param {object} opts
 * @param {string} opts.userId     - ID of the user who performed the action
 * @param {string} opts.userRole   - 'admin' | 'faculty' | 'student' | 'invigilator'
 * @param {string} opts.action     - e.g. 'FACULTY_REGISTERED', 'STUDENT_APPROVED'
 * @param {string} [opts.details]  - Extra context string
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.facultyId]
 * @param {string} [opts.studentId]
 */
async function logAudit(opts) {
  try {
    await global.prisma.auditLog.create({
      data: {
        userId:    opts.userId    || null,
        userRole:  opts.userRole  || 'system',
        action:    opts.action,
        details:   opts.details   || null,
        ipAddress: opts.ipAddress || null,
        facultyId: opts.facultyId || null,
        studentId: opts.studentId || null,
      },
    })
  } catch (e) {
    // Non-critical — never let audit failures crash the app
    console.warn('[AuditLog] Failed to write:', e.message)
  }
}

module.exports = { logAudit }
