'use strict'

const assert = require('assert')
const { describe, it } = require('node:test')
const {
  formatViolationType,
  LEGACY_VIOLATION_LABELS
} = require('../src/shared/violationTypes')

describe('Violation Type Legacy Label Formatting', () => {
  it('formats SCREEN_SHARE_ENDED as "Screen share ended (legacy)"', () => {
    assert.strictEqual(formatViolationType('SCREEN_SHARE_ENDED'), 'Screen share ended (legacy)')
  })

  it('formats SCREEN_SHARE_STOPPED as "Screen share ended (legacy)"', () => {
    assert.strictEqual(formatViolationType('SCREEN_SHARE_STOPPED'), 'Screen share ended (legacy)')
  })

  it('formats SCREEN_RECORDING as "Screen recording (legacy)"', () => {
    assert.strictEqual(formatViolationType('SCREEN_RECORDING'), 'Screen recording (legacy)')
  })

  it('passes through active canonical violation types untouched', () => {
    assert.strictEqual(formatViolationType('TAB_SWITCH'), 'TAB_SWITCH')
    assert.strictEqual(formatViolationType('FULLSCREEN_EXIT'), 'FULLSCREEN_EXIT')
    assert.strictEqual(formatViolationType('CAMERA_DISCONNECTED'), 'CAMERA_DISCONNECTED')
  })

  it('handles null, undefined or empty types gracefully', () => {
    assert.strictEqual(formatViolationType(null), '')
    assert.strictEqual(formatViolationType(undefined), '')
    assert.strictEqual(formatViolationType(''), '')
  })
})
