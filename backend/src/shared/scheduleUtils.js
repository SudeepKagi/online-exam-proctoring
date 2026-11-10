'use strict'

/**
 * scheduleUtils.js — Pure schedule utility functions.
 * No DB, no network, no side effects. Safe to import in both backend and frontend.
 *
 * Uses only built-in JS (Intl, Date). No luxon/dayjs/moment required.
 */

/**
 * Convert a local date+time string to a UTC ISO-8601 string.
 *
 * @param {string} dateStr   "YYYY-MM-DD"
 * @param {string} timeStr   "HH:MM" (24h, local time in the given timezone)
 * @param {string} ianaTimezone  e.g. "Asia/Kolkata", "America/New_York"
 * @returns {string}  UTC ISO string, e.g. "2026-11-10T08:30:00.000Z"
 *
 * Algorithm: construct an Intl.DateTimeFormat formatter for the target timezone
 * with a known UTC epoch, extract the wall-clock parts, then compute the offset
 * between UTC and local so we can invert it.
 */
function localDateTimeToUtcIso(dateStr, timeStr, ianaTimezone) {
  if (!dateStr || !timeStr || !ianaTimezone) {
    throw new Error('localDateTimeToUtcIso requires dateStr, timeStr, and ianaTimezone')
  }

  // Parse the local wall-clock datetime as if it were UTC (naive datetime)
  const naiveMs = Date.parse(`${dateStr}T${timeStr}:00.000Z`)
  if (isNaN(naiveMs)) throw new Error(`Invalid date/time: "${dateStr}T${timeStr}"`)

  // Determine the UTC offset for the given IANA timezone at the target local time.
  // We use the Intl trick: format a known UTC timestamp in the target timezone,
  // parse the result, and subtract to get the offset.
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
    // en-CA gives YYYY-MM-DD
    const localMs = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}.000Z`)
    return utcMs - localMs  // positive = UTC is ahead = timezone is behind UTC (e.g. NY)
  }

  // First approximation: treat naiveMs as UTC, compute offset at that point
  const offset1 = getOffsetMs(naiveMs)
  // The local time we want maps to UTC = localMs + offset
  const utcApprox = naiveMs + offset1
  // Recompute offset at the approximated UTC (handles DST transitions accurately)
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
function computeEnd(startUtcIso, durationMinutes, lateEntryMinutes = 15) {
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
function validateWindow(startUtcIso, durationMinutes, lateEntryMinutes = 15, nowUtcIso) {
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
function formatWithZone(utcIso, ianaTimezone) {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return 'Invalid date'

  // Date part: "10 Nov"
  const datePart = d.toLocaleDateString('en-GB', {
    timeZone: ianaTimezone,
    day: 'numeric',
    month: 'short'
  })

  // Time part: "2:00 PM"
  const timePart = d.toLocaleTimeString('en-US', {
    timeZone: ianaTimezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  // Timezone abbreviation: "IST", "EST", "EDT", etc.
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
function formatTimezoneLabel(ianaTimezone) {
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
 * This is the CORRECT replacement for the broken DEFAULT_SCHEDULE pattern that
 * did `d.getTime() - tzOffset` (which produces a fake UTC string that the backend
 * then treats as real UTC, shifting the time by the timezone offset).
 *
 * @param {string} datetimeLocalValue  Value from <input type="datetime-local">
 * @param {string} ianaTimezone        IANA timezone string
 * @returns {string}  UTC ISO string
 */
function datetimeLocalToUtcIso(datetimeLocalValue, ianaTimezone) {
  if (!datetimeLocalValue) throw new Error('datetimeLocalValue is required')
  // datetime-local format: "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
  const [datePart, timePart] = datetimeLocalValue.split('T')
  const timeOnly = timePart ? timePart.slice(0, 5) : '00:00'
  return localDateTimeToUtcIso(datePart, timeOnly, ianaTimezone)
}

/**
 * Convert a UTC ISO string to a datetime-local input value in a given timezone.
 * Inverse of datetimeLocalToUtcIso.
 *
 * @param {string} utcIso
 * @param {string} ianaTimezone
 * @returns {string}  "YYYY-MM-DDTHH:MM" for use in <input type="datetime-local">
 */
function utcIsoToDatetimeLocal(utcIso, ianaTimezone) {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return ''

  // Format in target timezone as YYYY-MM-DDTHH:MM
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

module.exports = {
  localDateTimeToUtcIso,
  computeEnd,
  validateWindow,
  formatWithZone,
  formatTimezoneLabel,
  datetimeLocalToUtcIso,
  utcIsoToDatetimeLocal
}

