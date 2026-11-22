/**
 * Maps student API error codes to plain, human-friendly messages and one clear next action.
 * Invariant: Never shows raw error codes (e.g. EXAM_NOT_OPEN, 403, 500) to students.
 */

export function getSupportUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_SUPPORT_URL) return import.meta.env.VITE_SUPPORT_URL
    if (import.meta.env.VITE_SUPPORT_EMAIL) return `mailto:${import.meta.env.VITE_SUPPORT_EMAIL}`
  }
  return 'mailto:support@institution.edu'
}

/**
 * Maps an error or error response to student-friendly text and next action.
 *
 * @param {any} err - The error object or response
 * @param {object} [context] - Contextual data (e.g. { startTime, endTime, examTitle })
 * @returns {{ title: string, message: string, actionLabel: string, actionType: 'retry'|'dashboard'|'seb'|'wait'|'contact'|'login'|'camera', code: string }}
 */
export function mapStudentError(err, context = {}) {
  let code = ''
  let rawMessage = ''
  let requestId = null

  if (typeof err === 'string') {
    rawMessage = err
    code = err
  } else if (err?.response?.data) {
    const data = err.response.data
    code = data.code || (typeof data.error === 'object' ? data.error?.code : data.error) || ''
    rawMessage = data.message || (typeof data.error === 'object' ? data.error?.message : '') || ''
    requestId = data.requestId || data.refId || err.response.headers?.['x-request-id'] || null
  } else if (err?.code) {
    code = err.code
    rawMessage = err.message || ''
    requestId = err.requestId || null
  } else if (err?.message) {
    rawMessage = err.message
  }

  // Normalize code
  const normCode = String(code || rawMessage || '').toUpperCase()

  // Helper to attach referenceId consistently
  const withRef = (res) => ({ ...res, referenceId: requestId })

  // 1. Exam window errors
  if (normCode.includes('EXAM_NOT_OPEN') || rawMessage.toLowerCase().includes('not open yet')) {
    const startStr = context.startTime ? new Date(context.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'the scheduled start time'
    return withRef({
      code: 'EXAM_NOT_OPEN',
      title: 'Exam Not Open Yet',
      message: `This exam opens at ${startStr}. Please wait for the start time countdown to finish.`,
      actionLabel: 'Wait for Start Time',
      actionType: 'wait'
    })
  }

  if (normCode.includes('EXAM_ENDED') || rawMessage.toLowerCase().includes('window has ended')) {
    const endStr = context.endTime ? new Date(context.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'the scheduled end time'
    return withRef({
      code: 'EXAM_ENDED',
      title: 'Exam Window Closed',
      message: `This exam ended at ${endStr}. Submissions are no longer accepted for this exam.`,
      actionLabel: 'Return to Dashboard',
      actionType: 'dashboard'
    })
  }

  // 2. Safe Exam Browser errors
  if (normCode.includes('CONFIG_KEY_MISMATCH') || normCode.includes('SEB_HEADER_MISMATCH')) {
    return withRef({
      code: 'SEB_HEADER_MISMATCH',
      title: 'Safe Exam Browser Configuration Mismatch',
      message: 'The security configuration header did not match this server. Enter the 6-digit launch code displayed on your primary browser or sign in with your password to continue.',
      actionLabel: 'Enter Launch Code',
      actionType: 'seb_pin'
    })
  }

  if (normCode.includes('SEB_HEADER_MISSING')) {
    return withRef({
      code: 'SEB_HEADER_MISSING',
      title: 'Configuration Header Missing',
      message: 'The Safe Exam Browser security header was not detected. Enter your 6-digit launch code or sign in with your password.',
      actionLabel: 'Enter Launch Code',
      actionType: 'seb_pin'
    })
  }

  if (normCode.includes('SEB_REQUIRED') || rawMessage.toLowerCase().includes('safe exam browser is required')) {
    return withRef({
      code: 'SEB_REQUIRED',
      title: 'Secure Browser Required',
      message: 'This examination must be taken inside Safe Exam Browser. Please launch the secure browser to continue.',
      actionLabel: 'Open Secure Exam Browser',
      actionType: 'seb'
    })
  }

  if (normCode.includes('NO_ACTIVE_SEB_EXAM')) {
    return withRef({
      code: 'NO_ACTIVE_SEB_EXAM',
      title: 'No Upcoming Exam',
      message: 'No open or upcoming secure exam was found for your account in the launch window.',
      actionLabel: 'Return to Dashboard',
      actionType: 'dashboard'
    })
  }

  // 3. Attempt state errors
  if (normCode.includes('ATTEMPT_ALREADY_EXISTS') || rawMessage.toLowerCase().includes('already exists')) {
    return withRef({
      code: 'ATTEMPT_ALREADY_EXISTS',
      title: 'Exam Already Attempted',
      message: 'You have already submitted an attempt for this examination.',
      actionLabel: 'Return to Dashboard',
      actionType: 'dashboard'
    })
  }

  if (normCode.includes('ATTEMPT_TERMINATED') || rawMessage.toLowerCase().includes('terminated')) {
    return withRef({
      code: 'ATTEMPT_TERMINATED',
      title: 'Exam Session Closed',
      message: 'Your exam session was ended because proctoring policies were exceeded.',
      actionLabel: 'Contact Instructor',
      actionType: 'contact'
    })
  }

  if (normCode.includes('ATTEMPT_SUSPENDED') || rawMessage.toLowerCase().includes('suspended')) {
    return withRef({
      code: 'ATTEMPT_SUSPENDED',
      title: 'Session Paused',
      message: 'Your exam session has been temporarily paused by your invigilator. Please wait for them to resume your session.',
      actionLabel: 'Wait for Invigilator',
      actionType: 'wait'
    })
  }

  if (normCode.includes('EXAM_NOT_FOUND') || normCode.includes('ATTEMPT_NOT_FOUND')) {
    return withRef({
      code: 'NOT_FOUND',
      title: 'Exam Not Found',
      message: 'The requested examination could not be found. Please check your assigned exams on your dashboard.',
      actionLabel: 'Return to Dashboard',
      actionType: 'dashboard'
    })
  }

  // 4. Media & Camera errors
  if (normCode.includes('CAMERA_PERMISSION_DENIED') || rawMessage.toLowerCase().includes('camera permission') || rawMessage.toLowerCase().includes('webcam access was denied')) {
    return withRef({
      code: 'CAMERA_PERMISSION_DENIED',
      title: 'Camera Permission Needed',
      message: 'Camera access is required for proctoring. Please enable camera permissions in your browser address bar and try again.',
      actionLabel: 'Retry Camera Check',
      actionType: 'camera'
    })
  }

  if (normCode.includes('CAMERA_DISCONNECTED')) {
    return withRef({
      code: 'CAMERA_DISCONNECTED',
      title: 'Camera Disconnected',
      message: 'Your camera feed was interrupted. Please make sure your camera is connected and not in use by other applications.',
      actionLabel: 'Reconnect Camera',
      actionType: 'camera'
    })
  }

  // 5. Auth & Network errors
  if (normCode.includes('TOKEN_EXPIRED') || normCode.includes('UNAUTHORIZED') || err?.response?.status === 401) {
    return withRef({
      code: 'UNAUTHORIZED',
      title: 'Session Expired',
      message: 'Your login session has expired. Please sign in again to continue.',
      actionLabel: 'Sign In',
      actionType: 'login'
    })
  }

  if (normCode.includes('RATE_LIMIT_EXCEEDED') || err?.response?.status === 429) {
    return withRef({
      code: 'RATE_LIMIT_EXCEEDED',
      title: 'Please Wait a Moment',
      message: 'Too many requests were sent in a short time. Please wait a few seconds and try again.',
      actionLabel: 'Try Again',
      actionType: 'retry'
    })
  }

  if (!err?.response && (rawMessage.toLowerCase().includes('network') || normCode.includes('ECONNREFUSED'))) {
    return withRef({
      code: 'NETWORK_ERROR',
      title: 'Connection Issue',
      message: 'Unable to reach the examination server. Any answers you selected are buffered safely on your computer.',
      actionLabel: 'Check Connection & Retry',
      actionType: 'retry'
    })
  }

  // Fallback
  return withRef({
    code: 'GENERIC_ERROR',
    title: 'Something Went Wrong',
    message: rawMessage || 'An unexpected problem occurred while loading your exam. Please try again or reach out to support.',
    actionLabel: 'Try Again',
    actionType: 'retry'
  })
}

