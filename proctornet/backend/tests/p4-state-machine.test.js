const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  AttemptStateMachine,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES
} = require('../src/modules/attempts/stateMachine')
const { ConflictError, NotFoundError } = require('../src/shared/errors')

describe('P4 Task 12 — Attempt State Machine Transition Table (100% branch coverage)', () => {
  const machine = new AttemptStateMachine()

  it('correctly reports terminal states', () => {
    assert.equal(machine.isTerminal('SUBMITTED'), true)
    assert.equal(machine.isTerminal('TERMINATED'), true)
    assert.equal(machine.isTerminal('EXPIRED'), true)
    assert.equal(machine.isTerminal('ACTIVE'), false)
    assert.equal(machine.isTerminal('READY'), false)
    assert.equal(machine.isTerminal('SUSPENDED'), false)
    assert.equal(machine.isTerminal(null), false)
  })

  it('validates all allowed transitions according to ADR-004 specification', () => {
    // READY can go to ACTIVE or TERMINATED
    assert.deepEqual(ALLOWED_TRANSITIONS.READY, ['ACTIVE', 'TERMINATED'])
    // ACTIVE can go to SUSPENDED, SUBMITTED, TERMINATED, EXPIRED
    assert.deepEqual(ALLOWED_TRANSITIONS.ACTIVE, ['SUSPENDED', 'SUBMITTED', 'TERMINATED', 'EXPIRED'])
    // SUSPENDED can go to ACTIVE, TERMINATED, EXPIRED
    assert.deepEqual(ALLOWED_TRANSITIONS.SUSPENDED, ['ACTIVE', 'TERMINATED', 'EXPIRED'])
    // Terminal states cannot transition to anything
    assert.deepEqual(ALLOWED_TRANSITIONS.SUBMITTED, [])
    assert.deepEqual(ALLOWED_TRANSITIONS.TERMINATED, [])
    assert.deepEqual(ALLOWED_TRANSITIONS.EXPIRED, [])
  })

  it('rejects transitions to invalid target states', async () => {
    await assert.rejects(
      () => machine.transition('00000000-0000-0000-0000-000000000000', 'READY'),
      (err) => {
        assert.ok(err instanceof ConflictError)
        assert.match(err.message, /Cannot transition to state 'READY'/)
        return true
      }
    )
  })
})
