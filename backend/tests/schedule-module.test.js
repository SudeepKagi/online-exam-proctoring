'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  localDateTimeToUtcIso,
  computeEnd,
  validateWindow,
  formatWithZone,
  formatTimezoneLabel,
  datetimeLocalToUtcIso,
  utcIsoToDatetimeLocal
} = require('../src/shared/scheduleUtils')

// ---------------------------------------------------------------------------
// localDateTimeToUtcIso
// ---------------------------------------------------------------------------
describe('localDateTimeToUtcIso', () => {
  it('converts IST 14:00 to correct UTC (08:30 UTC)', () => {
    const result = localDateTimeToUtcIso('2026-11-10', '14:00', 'Asia/Kolkata')
    // IST = UTC+5:30, so 14:00 IST = 08:30 UTC
    assert.equal(result, '2026-11-10T08:30:00.000Z')
  })

  it('converts America/New_York 14:00 EST to correct UTC (19:00 UTC)', () => {
    // Nov 10 2026 — EDT ended Nov 1, so EST is in effect. EST = UTC-5
    const result = localDateTimeToUtcIso('2026-11-10', '14:00', 'America/New_York')
    assert.equal(result, '2026-11-10T19:00:00.000Z')
  })

  it('converts UTC 14:00 to same UTC (no offset)', () => {
    const result = localDateTimeToUtcIso('2026-11-10', '14:00', 'UTC')
    assert.equal(result, '2026-11-10T14:00:00.000Z')
  })

  it('handles midnight correctly for IST — 00:00 IST Nov 11 = 18:30 UTC Nov 10', () => {
    const result = localDateTimeToUtcIso('2026-11-11', '00:00', 'Asia/Kolkata')
    assert.equal(result, '2026-11-10T18:30:00.000Z')
  })

  it('handles DST boundary (America/New_York summer EDT = UTC-4)', () => {
    // July is EDT (UTC-4)
    const result = localDateTimeToUtcIso('2026-07-15', '10:00', 'America/New_York')
    assert.equal(result, '2026-07-15T14:00:00.000Z')
  })

  it('throws on empty ianaTimezone', () => {
    assert.throws(() => localDateTimeToUtcIso('2026-11-10', '14:00', ''))
  })

  it('throws on empty dateStr', () => {
    assert.throws(() => localDateTimeToUtcIso('', '14:00', 'UTC'))
  })

  it('throws on empty timeStr', () => {
    assert.throws(() => localDateTimeToUtcIso('2026-11-10', '', 'UTC'))
  })

  it('throws on invalid date string', () => {
    assert.throws(() => localDateTimeToUtcIso('not-a-date', '14:00', 'Asia/Kolkata'))
  })
})

// ---------------------------------------------------------------------------
// computeEnd
// ---------------------------------------------------------------------------
describe('computeEnd', () => {
  it('computes correct end for 60-minute exam starting at 08:30 UTC', () => {
    const { endUtcIso, lateEntryDeadlineUtcIso } = computeEnd('2026-11-10T08:30:00.000Z', 60, 15)
    assert.equal(endUtcIso, '2026-11-10T09:30:00.000Z')
    assert.equal(lateEntryDeadlineUtcIso, '2026-11-10T08:45:00.000Z')
  })

  it('defaults late entry to 15 minutes', () => {
    const { lateEntryDeadlineUtcIso } = computeEnd('2026-11-10T08:30:00.000Z', 60)
    assert.equal(lateEntryDeadlineUtcIso, '2026-11-10T08:45:00.000Z')
  })

  it('handles 0 late entry window', () => {
    const { lateEntryDeadlineUtcIso } = computeEnd('2026-11-10T08:30:00.000Z', 60, 0)
    assert.equal(lateEntryDeadlineUtcIso, '2026-11-10T08:30:00.000Z')
  })

  it('computes 3-hour (180 min) exam correctly', () => {
    const { endUtcIso } = computeEnd('2026-11-10T05:00:00.000Z', 180)
    assert.equal(endUtcIso, '2026-11-10T08:00:00.000Z')
  })

  it('throws on invalid startUtcIso', () => {
    assert.throws(() => computeEnd('not-a-date', 60))
  })

  it('throws on duration of 0', () => {
    assert.throws(() => computeEnd('2026-11-10T08:30:00.000Z', 0))
  })

  it('throws on negative duration', () => {
    assert.throws(() => computeEnd('2026-11-10T08:30:00.000Z', -5))
  })
})

// ---------------------------------------------------------------------------
// validateWindow
// ---------------------------------------------------------------------------
describe('validateWindow', () => {
  const nowFixed = '2026-11-10T08:00:00.000Z'

  it('passes for a start 5 minutes from now', () => {
    const start = '2026-11-10T08:05:00.000Z'
    const result = validateWindow(start, 60, 15, nowFixed)
    assert.equal(result.valid, true)
    assert.equal(result.errorCode, null)
  })

  it('fails START_IN_PAST when start is in the past', () => {
    const start = '2026-11-10T07:00:00.000Z'
    const result = validateWindow(start, 60, 15, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'START_IN_PAST')
  })

  it('fails START_TOO_SOON when start is < 2 minutes from now (1 min away)', () => {
    const start = '2026-11-10T08:01:00.000Z'
    const result = validateWindow(start, 60, 15, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'START_TOO_SOON')
  })

  it('passes exactly at the 2-minute boundary', () => {
    const start = '2026-11-10T08:02:00.000Z'
    const result = validateWindow(start, 60, 15, nowFixed)
    assert.equal(result.valid, true)
  })

  it('fails INVALID_DURATION when duration is 0', () => {
    const start = '2026-11-10T09:00:00.000Z'
    const result = validateWindow(start, 0, 15, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'INVALID_DURATION')
  })

  it('fails DURATION_EXCEEDS_WINDOW when duration > 480 minutes', () => {
    const start = '2026-11-10T09:00:00.000Z'
    const result = validateWindow(start, 481, 15, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'DURATION_EXCEEDS_WINDOW')
  })

  it('fails INVALID_LATE_ENTRY when late entry > 60 minutes', () => {
    const start = '2026-11-10T09:00:00.000Z'
    const result = validateWindow(start, 60, 61, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'INVALID_LATE_ENTRY')
  })

  it('fails LATE_ENTRY_EXCEEDS_DURATION when late entry >= duration', () => {
    const start = '2026-11-10T09:00:00.000Z'
    const result = validateWindow(start, 10, 10, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'LATE_ENTRY_EXCEEDS_DURATION')
  })

  it('fails INVALID_START_TIME on garbage input', () => {
    const result = validateWindow('not-a-date', 60, 15, nowFixed)
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, 'INVALID_START_TIME')
  })
})

// ---------------------------------------------------------------------------
// formatWithZone
// ---------------------------------------------------------------------------
describe('formatWithZone', () => {
  it('formats UTC 08:30Z in IST as "10 Nov, 2:00 PM IST" (or GMT+5:30 on some platforms)', () => {
    // 2026-11-10T08:30:00.000Z = 14:00 IST
    const result = formatWithZone('2026-11-10T08:30:00.000Z', 'Asia/Kolkata')
    assert.match(result, /10 Nov/)
    assert.match(result, /2:00 PM/)
    // Node.js ICU data may output "IST" or "GMT+5:30" depending on the platform
    assert.match(result, /IST|GMT\+5:30/)
  })

  it('formats UTC 19:00Z in New York as "10 Nov, 2:00 PM EST"', () => {
    // 2026-11-10T19:00:00.000Z = 14:00 EST
    const result = formatWithZone('2026-11-10T19:00:00.000Z', 'America/New_York')
    assert.match(result, /10 Nov/)
    assert.match(result, /2:00 PM/)
    assert.match(result, /EST|EDT/)
  })

  it('returns "Invalid date" for bad input', () => {
    const result = formatWithZone('not-a-date', 'Asia/Kolkata')
    assert.equal(result, 'Invalid date')
  })
})

// ---------------------------------------------------------------------------
// formatTimezoneLabel
// ---------------------------------------------------------------------------
describe('formatTimezoneLabel', () => {
  it('returns formatted label for Asia/Kolkata containing IST or GMT+5:30', () => {
    const result = formatTimezoneLabel('Asia/Kolkata')
    assert.match(result, /Asia\/Kolkata/)
    // Node.js ICU data may output "IST" or "GMT+5:30" depending on the platform
    assert.match(result, /IST|GMT\+5:30/)
  })

  it('returns formatted label for America/New_York containing EST or EDT', () => {
    const result = formatTimezoneLabel('America/New_York')
    assert.match(result, /America\/New_York/)
    assert.match(result, /EST|EDT/)
  })
})

// ---------------------------------------------------------------------------
// datetimeLocalToUtcIso
// ---------------------------------------------------------------------------
describe('datetimeLocalToUtcIso', () => {
  it('converts "2026-11-10T14:00" in Asia/Kolkata to "2026-11-10T08:30:00.000Z"', () => {
    const result = datetimeLocalToUtcIso('2026-11-10T14:00', 'Asia/Kolkata')
    assert.equal(result, '2026-11-10T08:30:00.000Z')
  })

  it('converts "2026-11-10T14:00" in America/New_York to "2026-11-10T19:00:00.000Z"', () => {
    const result = datetimeLocalToUtcIso('2026-11-10T14:00', 'America/New_York')
    assert.equal(result, '2026-11-10T19:00:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// utcIsoToDatetimeLocal
// ---------------------------------------------------------------------------
describe('utcIsoToDatetimeLocal', () => {
  it('converts "2026-11-10T08:30:00.000Z" to IST datetime-local "2026-11-10T14:00"', () => {
    const result = utcIsoToDatetimeLocal('2026-11-10T08:30:00.000Z', 'Asia/Kolkata')
    assert.equal(result, '2026-11-10T14:00')
  })

  it('converts "2026-11-10T19:00:00.000Z" to NY datetime-local "2026-11-10T14:00"', () => {
    const result = utcIsoToDatetimeLocal('2026-11-10T19:00:00.000Z', 'America/New_York')
    assert.equal(result, '2026-11-10T14:00')
  })

  it('returns empty string for invalid input', () => {
    const result = utcIsoToDatetimeLocal('not-a-date', 'Asia/Kolkata')
    assert.equal(result, '')
  })
})

// ---------------------------------------------------------------------------
// Round-trip tests: local → UTC → local
// ---------------------------------------------------------------------------
describe('round-trip conversion', () => {
  it('IST round-trip: "2026-11-10T14:00" → UTC → back to "2026-11-10T14:00"', () => {
    const original = '2026-11-10T14:00'
    const utc = datetimeLocalToUtcIso(original, 'Asia/Kolkata')
    const back = utcIsoToDatetimeLocal(utc, 'Asia/Kolkata')
    assert.equal(back, original)
  })

  it('NY round-trip: "2026-11-10T14:00" → UTC → back to "2026-11-10T14:00"', () => {
    const original = '2026-11-10T14:00'
    const utc = datetimeLocalToUtcIso(original, 'America/New_York')
    const back = utcIsoToDatetimeLocal(utc, 'America/New_York')
    assert.equal(back, original)
  })
})
