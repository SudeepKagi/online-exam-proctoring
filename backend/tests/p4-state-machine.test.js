const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  ATTEMPT_STATUS,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES
} = require('../src/modules/attempts/attempts.service')

describe('P4 Task 12 — Attempt State Machine Transition Table', () => {
  it('correctly reports terminal states', () => {
    assert.equal(TERMINAL_STATES.includes('SUBMITTED'), true)
    assert.equal(TERMINAL_STATES.includes('TIMED_OUT'), true)
    assert.equal(TERMINAL_STATES.includes('IN_PROGRESS'), false)
    assert.equal(TERMINAL_STATES.includes('NOT_STARTED'), false)
    assert.equal(TERMINAL_STATES.includes('SUSPENDED'), false)
  })

  it('validates all allowed transitions according to canonical 7-core-table schema', () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.NOT_STARTED, ['IN_PROGRESS'])
    assert.deepEqual(ALLOWED_TRANSITIONS.IN_PROGRESS, ['SUSPENDED', 'SUBMITTED', 'TIMED_OUT'])
    assert.deepEqual(ALLOWED_TRANSITIONS.SUSPENDED, ['IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT'])
    assert.deepEqual(ALLOWED_TRANSITIONS.SUBMITTED, [])
    assert.deepEqual(ALLOWED_TRANSITIONS.TIMED_OUT, [])
  })

  it('includes strictly the 5 canonical attempt statuses', () => {
    assert.deepEqual(Object.values(ATTEMPT_STATUS), [
      'NOT_STARTED',
      'IN_PROGRESS',
      'SUBMITTED',
      'SUSPENDED',
      'TIMED_OUT'
    ])
  })
})
