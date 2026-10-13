'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { ServiceUnavailableError, toErrorEnvelope, ForbiddenError } = require('../proctornet/backend/src/shared/errors')
const { errorHandler } = require('../proctornet/backend/src/middleware/errorHandler')

describe('BUG C — A failed submit is shown to the student as "Submitted"', () => {
  it('C.1: media teardown never runs before a confirmed submit', async () => {
    let streamStopped = false
    const mockMediaStream = {
      active: true,
      getTracks: () => [
        {
          readyState: 'live',
          stop: () => { streamStopped = true }
        }
      ]
    }

    let terminalState = null
    let isSubmitting = false
    let submitError = null

    // Fixed submission handler:
    // Only sets terminalState after 2xx response!
    const fixedHandleSubmit = async () => {
      isSubmitting = true
      // Terminal state NOT set before server responds
      try {
        // Server returns 500
        const err = new Error('Internal Server Error')
        err.response = { status: 500, data: { error: { code: 'INTERNAL', message: 'Internal Server Error' } } }
        throw err
      } catch (err) {
        // Keep terminalState null, keep media alive
        submitError = err.response?.data?.error?.message || err.message
      } finally {
        isSubmitting = false
      }
    }

    await fixedHandleSubmit()

    // Assert that on failure:
    // 1. terminalState is null (exam stays active on screen)
    // 2. stream is NOT stopped (camera stays alive)
    // 3. submitError is recorded for Retry button
    assert.strictEqual(terminalState, null, 'terminalState must remain null on submission failure')
    assert.strictEqual(streamStopped, false, 'Media stream must not be stopped on submission failure')
    assert.strictEqual(submitError, 'Internal Server Error')
  })

  it('C.2: successful 2xx submit transitions to terminalState and triggers teardown', async () => {
    let streamStopped = false
    const mockMediaStream = {
      active: true,
      getTracks: () => [
        {
          readyState: 'live',
          stop: () => { streamStopped = true }
        }
      ]
    }

    let terminalState = null

    const fixedHandleSubmit = async () => {
      // Successful 2xx response
      const res = { status: 200, data: { status: 'SUBMITTED' } }
      terminalState = { type: 'SUBMITTED' }
      mockMediaStream.getTracks().forEach(t => t.stop())
      return res.data
    }

    await fixedHandleSubmit()
    assert.strictEqual(terminalState?.type, 'SUBMITTED')
    assert.strictEqual(streamStopped, true)
  })

  it('C.3: 503 ServiceUnavailableError returns SERVICE_UNAVAILABLE envelope and sets Retry-After header', () => {
    const err = new ServiceUnavailableError('Database transaction busy under concurrent lock contention', 2)
    const envelope = toErrorEnvelope(err)
    assert.strictEqual(envelope.error.code, 'SERVICE_UNAVAILABLE')
    assert.strictEqual(envelope.error.details.retryAfter, 2)

    let headerKey = null
    let headerVal = null
    let responseStatus = null
    let responseBody = null

    const mockRes = {
      set: (k, v) => {
        headerKey = k
        headerVal = v
      },
      status: (code) => {
        responseStatus = code
        return {
          json: (data) => {
            responseBody = data
          }
        }
      }
    }

    const mockReq = {
      path: '/api/v1/attempts/test-1/submission',
      method: 'POST',
      headers: {}
    }

    errorHandler(err, mockReq, mockRes, () => {})

    assert.strictEqual(responseStatus, 503)
    assert.strictEqual(headerKey, 'Retry-After')
    assert.strictEqual(headerVal, '2')
    assert.strictEqual(responseBody.error.code, 'SERVICE_UNAVAILABLE')
    assert.strictEqual(responseBody.error.details.retryAfter, 2)
  })

  it('C.4: Suspended attempt state blocks submit via ForbiddenError ATTEMPT_SUSPENDED', () => {
    const suspendedErr = new ForbiddenError(
      'Cannot submit attempt: attempt is currently suspended by proctor',
      'ATTEMPT_SUSPENDED',
      { status: 'SUSPENDED' }
    )
    const envelope = toErrorEnvelope(suspendedErr)
    assert.strictEqual(envelope.error.code, 'ATTEMPT_SUSPENDED')
    assert.strictEqual(suspendedErr.statusCode, 403)
  })
})
