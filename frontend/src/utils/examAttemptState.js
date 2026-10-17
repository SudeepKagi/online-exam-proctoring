/**
 * Authoritative Exam & Attempt Lifecycle Helper (BUG D)
 * Unifies finished state detection across all student interfaces.
 */

export const FINISHED_ATTEMPT_STATUSES = [
  'SUBMITTED',
  'EXPIRED',
  'TERMINATED',
  'TIMED_OUT'
]

/**
 * Determine whether an exam attempt is in a finalized / finished state.
 * Evaluates attempt.status, studentStatus, isSubmitted flag, or exam status.
 *
 * @param {Object} exam Exam object (or nested attempt)
 * @returns {boolean} True if attempt is finished, preventing re-entry
 */
export function isAttemptFinished(exam) {
  if (!exam) return false

  const attemptStatus = exam.attempt?.status
  if (attemptStatus && FINISHED_ATTEMPT_STATUSES.includes(attemptStatus)) {
    return true
  }

  const studentStatus = exam.studentStatus
  if (studentStatus && FINISHED_ATTEMPT_STATUSES.includes(studentStatus)) {
    return true
  }

  if (typeof exam.status === 'string' && FINISHED_ATTEMPT_STATUSES.includes(exam.status)) {
    return true
  }

  if (exam.isSubmitted === true) {
    return true
  }

  return false
}
