'use strict'

const assert = require('assert')
const { describe, it, before } = require('node:test')
const path = require('path')
const { pathToFileURL } = require('url')

describe('Student System Check & Error Mapping Unit Tests', () => {
  let evaluateClockSkew
  let evaluateLatency
  let evaluateOperatingSystem
  let mapStudentError

  before(async () => {
    const sysCheckPath = pathToFileURL(path.resolve(__dirname, '../../frontend/src/lib/systemCheck.js')).href
    const sysCheckModule = await import(sysCheckPath)
    evaluateClockSkew = sysCheckModule.evaluateClockSkew
    evaluateLatency = sysCheckModule.evaluateLatency
    evaluateOperatingSystem = sysCheckModule.evaluateOperatingSystem

    const errorsPath = pathToFileURL(path.resolve(__dirname, '../../frontend/src/lib/studentErrors.js')).href
    const errorsModule = await import(errorsPath)
    mapStudentError = errorsModule.mapStudentError
  })

  describe('1. Server vs Client Clock Skew Checks', () => {
    it('passes with zero warning when client and server clocks are within 2 minutes', () => {
      const now = Date.now()
      // Exactly synchronized
      const syncResult = evaluateClockSkew(now, now)
      assert.strictEqual(syncResult.passed, true)
      assert.strictEqual(syncResult.warning, false)
      assert.strictEqual(syncResult.blocked, false)
      assert.strictEqual(syncResult.skewMinutes, 0)

      // 45 seconds ahead
      const skew45s = evaluateClockSkew(now + 45000, now)
      assert.strictEqual(skew45s.passed, true)
      assert.strictEqual(skew45s.warning, false)
      assert.strictEqual(skew45s.blocked, false)
      assert.ok(skew45s.message.includes('Clock in sync'))

      // 1 minute 50 seconds behind (still <= 2 min)
      const skew110s = evaluateClockSkew(now - 110000, now)
      assert.strictEqual(skew110s.passed, true)
      assert.strictEqual(skew110s.warning, false)
      assert.strictEqual(skew110s.blocked, false)
    })

    it('warns when clock skew exceeds 2 minutes, but NEVER blocks the student', () => {
      const now = Date.now()
      // 5 minutes ahead
      const skew5m = evaluateClockSkew(now + 5 * 60 * 1000, now)
      assert.strictEqual(skew5m.passed, true)
      assert.strictEqual(skew5m.warning, true)
      assert.strictEqual(skew5m.blocked, false, 'Clock skew must never block the student')
      assert.strictEqual(skew5m.skewMinutes, 5)
      assert.ok(skew5m.message.includes('5 min'))

      // 10 minutes behind
      const skew10m = evaluateClockSkew(now - 10 * 60 * 1000, now)
      assert.strictEqual(skew10m.passed, true)
      assert.strictEqual(skew10m.warning, true)
      assert.strictEqual(skew10m.blocked, false)
      assert.strictEqual(skew10m.skewMinutes, 10)
    })

    it('handles ISO string inputs and invalid dates gracefully without throwing', () => {
      const nowIso = new Date().toISOString()
      const validRes = evaluateClockSkew(nowIso, nowIso)
      assert.strictEqual(validRes.passed, true)
      assert.strictEqual(validRes.blocked, false)

      const invalidRes = evaluateClockSkew('invalid-date', nowIso)
      assert.strictEqual(invalidRes.passed, true)
      assert.strictEqual(invalidRes.warning, true)
      assert.strictEqual(invalidRes.blocked, false)
    })
  })

  describe('2. Internet Latency & Round-Trip Measurement', () => {
    it('rates sub-150ms round trips as Good', () => {
      const res = evaluateLatency(48)
      assert.strictEqual(res.passed, true)
      assert.strictEqual(res.rating, 'Good')
      assert.strictEqual(res.latencyMs, 48)
      assert.ok(res.message.includes('Fast connection'))
    })

    it('rates 150ms–600ms round trips as Fair', () => {
      const res = evaluateLatency(320)
      assert.strictEqual(res.passed, true)
      assert.strictEqual(res.rating, 'Fair')
      assert.ok(res.message.includes('Stable connection'))
    })

    it('warns on latency > 600ms without blocking', () => {
      const res = evaluateLatency(950)
      assert.strictEqual(res.passed, true, 'High latency warns rather than blocks')
      assert.strictEqual(res.rating, 'Poor')
      assert.ok(res.message.includes('High latency'))
    })
  })

  describe('3. Computer & Operating System Compatibility', () => {
    it('confirms Windows compatibility for SEB required exams', () => {
      const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      const res = evaluateOperatingSystem(true, winUA)
      assert.strictEqual(res.isWindows, true)
      assert.strictEqual(res.compatible, true)
      assert.ok(res.message.includes('Windows computer detected'))
    })

    it('provides clear support message for non-Windows devices on SEB exams', () => {
      const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      const res = evaluateOperatingSystem(true, macUA)
      assert.strictEqual(res.isWindows, false)
      assert.strictEqual(res.compatible, false)
      assert.ok(res.message.includes('configured for Windows'))
      assert.ok(res.supportContact)

      const linuxUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      const linuxRes = evaluateOperatingSystem(true, linuxUA)
      assert.strictEqual(linuxRes.compatible, false)
    })

    it('permits all operating systems when SEB is not required', () => {
      const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      const res = evaluateOperatingSystem(false, macUA)
      assert.strictEqual(res.compatible, true)
    })
  })

  describe('4. Student Error Mapping & Actionable Guidance', () => {
    it('maps EXAM_NOT_OPEN to friendly message with scheduled start time and wait action', () => {
      const startTime = new Date(Date.now() + 3600000).toISOString()
      const mapped = mapStudentError({ code: 'EXAM_NOT_OPEN' }, { startTime })
      assert.strictEqual(mapped.code, 'EXAM_NOT_OPEN')
      assert.strictEqual(mapped.title, 'Exam Not Open Yet')
      assert.ok(mapped.message.includes('opens at'))
      assert.strictEqual(mapped.actionType, 'wait')
      assert.strictEqual(mapped.actionLabel, 'Wait for Start Time')
    })

    it('maps EXAM_ENDED to friendly message with scheduled end time and dashboard action', () => {
      const endTime = new Date(Date.now() - 3600000).toISOString()
      const mapped = mapStudentError({ code: 'EXAM_ENDED' }, { endTime })
      assert.strictEqual(mapped.code, 'EXAM_ENDED')
      assert.strictEqual(mapped.title, 'Exam Window Closed')
      assert.strictEqual(mapped.actionType, 'dashboard')
      assert.strictEqual(mapped.actionLabel, 'Return to Dashboard')
    })

    it('maps SEB_REQUIRED to plain language without jargon', () => {
      const mapped = mapStudentError({ code: 'SEB_REQUIRED' })
      assert.strictEqual(mapped.code, 'SEB_REQUIRED')
      assert.strictEqual(mapped.title, 'Secure Browser Required')
      assert.strictEqual(mapped.actionLabel, 'Open Secure Exam Browser')
      assert.strictEqual(mapped.actionType, 'seb')
      assert.ok(!mapped.message.includes('hash'), 'Student text must not contain "hash"')
      assert.ok(!mapped.message.includes('config key'), 'Student text must not contain "config key"')
    })

    it('maps ATTEMPT_ALREADY_EXISTS and ATTEMPT_TERMINATED to clear guidance', () => {
      const exists = mapStudentError({ code: 'ATTEMPT_ALREADY_EXISTS' })
      assert.strictEqual(exists.title, 'Exam Already Attempted')
      assert.strictEqual(exists.actionType, 'dashboard')

      const term = mapStudentError({ code: 'ATTEMPT_TERMINATED' })
      assert.strictEqual(term.title, 'Exam Session Closed')
      assert.strictEqual(term.actionType, 'contact')
      assert.strictEqual(term.actionLabel, 'Contact Instructor')
    })

    it('maps network failures to offline buffer reassurance', () => {
      const netErr = mapStudentError(new Error('Network Error: Failed to fetch'))
      assert.strictEqual(netErr.code, 'NETWORK_ERROR')
      assert.ok(netErr.message.includes('buffered safely'))
      assert.strictEqual(netErr.actionType, 'retry')
    })
  })
})
