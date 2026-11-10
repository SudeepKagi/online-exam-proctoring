/**
 * scheduleUtils.js — Pure schedule utility functions for the frontend.
 * Uses only browser-standard Intl and Date APIs. Zero external dependencies.
 */

/**
 * Convert a local date+time string to a UTC ISO-8601 string.
 *
 * @param {string} dateStr   "YYYY-MM-DD"
 * @param {string} timeStr   "HH:MM" (24h, local time in the given timezone)
 * @param {string} ianaTimezone  e.g. "Asia/Kolkata", "America/New_York"
 * @returns {string}  UTC ISO string, e.g. "2026-11-10T08:30:00.000Z"
 */
export function localDateTimeToUtcIso(dateStr, timeStr, ianaTimezone) {
  if (!dateStr || !timeStr || !ianaTimezone) {
    throw new Error('localDateTimeToUtcIso requires dateStr, timeStr, and ianaTimezone')
  }

  const naiveMs = Date.parse(`${dateStr}T${timeStr}:00.000Z`)
  if (isNaN(naiveMs)) throw new Error(`Invalid date/time: "${dateStr}T${timeStr}"`)

  const getOffsetMs = (utcMs) => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: ianaTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    })
    const parts = fmt.formatToParts(new Date(utcMs))
    const p = {}
    for (const { type, value } of parts) p[type] = value
    const localMs = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}.000Z`)
    return utcMs - localMs
  }

  const offset1 = getOffsetMs(naiveMs)
  const utcApprox = naiveMs + offset1
  const offset2 = getOffsetMs(utcApprox)

  return new Date(naiveMs + offset2).toISOString()
}

/**
 * Compute exam end time and late-entry deadline from a UTC start.
 *
 * @param {string} startUtcIso      UTC ISO string
 * @param {number} durationMinutes  Exam duration in minutes (> 0)
 * @param {number} lateEntryMinutes Window after startTime in which students can still join (default 15)
 * @returns {{ endUtcIso: string, lateEntryDeadlineUtcIso: string }}
 */
export function computeEnd(startUtcIso, durationMinutes, lateEntryMinutes = 15) {
  const startMs = new Date(startUtcIso).getTime()
  if (isNaN(startMs)) throw new Error(`Invalid startUtcIso: "${startUtcIso}"`)
  const dur = Number(durationMinutes)
  if (!dur || dur <= 0) throw new Error('durationMinutes must be > 0')
  const late = Number(lateEntryMinutes) || 0

  return {
    endUtcIso: new Date(startMs + dur * 60000).toISOString(),
    lateEntryDeadlineUtcIso: new Date(startMs + late * 60000).toISOString()
  }
}

/**
 * Validate an exam scheduling window.
 *
 * @param {string} startUtcIso
 * @param {number} durationMinutes
 * @param {number} lateEntryMinutes
 * @param {string|number} nowUtcIso  Current UTC ISO or ms (defaults to Date.now())
 * @returns {{ valid: boolean, errorCode: string|null, message: string|null }}
 */
export function validateWindow(startUtcIso, durationMinutes, lateEntryMinutes = 15, nowUtcIso) {
  const startMs = new Date(startUtcIso).getTime()
  if (isNaN(startMs)) {
    return { valid: false, errorCode: 'INVALID_START_TIME', message: 'Start time is not a valid date.' }
  }

  const nowMs = nowUtcIso ? new Date(nowUtcIso).getTime() : Date.now()
  const dur = Number(durationMinutes)

  if (startMs < nowMs) {
    return { valid: false, errorCode: 'START_IN_PAST', message: 'Exam start time cannot be in the past.' }
  }

  const twoMinutesFromNow = nowMs + 2 * 60000
  if (startMs < twoMinutesFromNow) {
    return { valid: false, errorCode: 'START_TOO_SOON', message: 'Exam must start at least 2 minutes from now.' }
  }

  if (!dur || dur <= 0) {
    return { valid: false, errorCode: 'INVALID_DURATION', message: 'Exam duration must be greater than 0 minutes.' }
  }

  if (dur > 480) {
    return { valid: false, errorCode: 'DURATION_EXCEEDS_WINDOW', message: 'Exam duration cannot exceed 480 minutes (8 hours).' }
  }

  const late = Number(lateEntryMinutes) || 0
  if (late < 0 || late > 60) {
    return { valid: false, errorCode: 'INVALID_LATE_ENTRY', message: 'Late entry window must be between 0 and 60 minutes.' }
  }

  if (late >= dur) {
    return { valid: false, errorCode: 'LATE_ENTRY_EXCEEDS_DURATION', message: 'Late entry window cannot be longer than the exam duration.' }
  }

  return { valid: true, errorCode: null, message: null }
}

/**
 * Format a UTC ISO string as a human-readable local time with timezone abbreviation.
 *
 * @param {string} utcIso           UTC ISO string
 * @param {string} ianaTimezone     e.g. "Asia/Kolkata"
 * @returns {string}                e.g. "10 Nov, 2:00 PM IST"
 */
export function formatWithZone(utcIso, ianaTimezone) {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return 'Invalid date'

  const datePart = d.toLocaleDateString('en-GB', {
    timeZone: ianaTimezone,
    day: 'numeric',
    month: 'short'
  })

  const timePart = d.toLocaleTimeString('en-US', {
    timeZone: ianaTimezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const tzPart = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    timeZoneName: 'short'
  }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value || ianaTimezone

  return `${datePart}, ${timePart} ${tzPart}`
}

/**
 * Get a user-friendly timezone label for display.
 * @param {string} ianaTimezone
 * @returns {string} e.g. "Asia/Kolkata (IST)"
 */
export function formatTimezoneLabel(ianaTimezone) {
  try {
    const abbr = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'short'
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || ''
    return abbr ? `${ianaTimezone} (${abbr})` : ianaTimezone
  } catch {
    return ianaTimezone
  }
}

/**
 * Convert a datetime-local input value (like "2026-11-10T14:00") to UTC ISO
 * using the browser/system's detected IANA timezone.
 *
 * @param {string} datetimeLocalValue  Value from <input type="datetime-local">
 * @param {string} ianaTimezone        IANA timezone string
 * @returns {string}  UTC ISO string
 */
export function datetimeLocalToUtcIso(datetimeLocalValue, ianaTimezone) {
  if (!datetimeLocalValue) throw new Error('datetimeLocalValue is required')
  const [datePart, timePart] = datetimeLocalValue.split('T')
  const timeOnly = timePart ? timePart.slice(0, 5) : '00:00'
  return localDateTimeToUtcIso(datePart, timeOnly, ianaTimezone)
}

/**
 * Convert a UTC ISO string to a datetime-local input value in a given timezone.
 *
 * @param {string} utcIso
 * @param {string} ianaTimezone
 * @returns {string}  "YYYY-MM-DDTHH:MM" for use in <input type="datetime-local">
 */
export function utcIsoToDatetimeLocal(utcIso, ianaTimezone) {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return ''

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false
  })
  const parts = fmt.formatToParts(d)
  const p = {}
  for (const { type, value } of parts) p[type] = value
  const h = p.hour === '24' ? '00' : p.hour
  return `${p.year}-${p.month}-${p.day}T${h}:${p.minute}`
}

/**
 * Detect client user's IANA timezone.
 * @returns {string} e.g. "Asia/Kolkata"
 */
export function getClientTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  } catch {
    return 'Asia/Kolkata'
  }
}

