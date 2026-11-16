'use strict'

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { toErrorEnvelope } = require('../src/shared/errors')
const { errorHandler } = require('../src/middleware/errorHandler')

describe('Error Handler Production Sanitization & Storage Mapping', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  test('1. Production 5xx unhandled error is generic and does not leak internal details', () => {
    const internalErr = new Error('Database connection failed at postgres://user:secret@10.0.1.25:5432/db')
    internalErr.statusCode = 500

    const envelope = toErrorEnvelope(internalErr, 'req-test-123')
    assert.strictEqual(envelope.code, 'INTERNAL_SERVER_ERROR')
    assert.strictEqual(envelope.message, 'An unexpected internal error occurred. Please try again.')
    assert.strictEqual(envelope.requestId, 'req-test-123')
    assert.strictEqual(JSON.stringify(envelope).includes('10.0.1.25'), false)
    assert.strictEqual(JSON.stringify(envelope).includes('secret'), false)
  })

  test('2. Storage failure (ECONNREFUSED on 9000) maps to STORAGE_UNAVAILABLE with 503 status', () => {
    const connErr = new Error('connect ECONNREFUSED 127.0.0.1:9000')
    connErr.code = 'ECONNREFUSED'
    connErr.port = 9000
    connErr.address = '127.0.0.1'
    connErr.syscall = 'connect'

    let statusCalled = null
    let jsonSent = null
    let headerSet = {}

    const req = {
      path: '/api/v1/admin/seb/config',
      method: 'POST',
      requestId: 'test-req-seb-probe'
    }
    const res = {
      status(s) {
        statusCalled = s
        return this
      },
      set(k, v) {
        headerSet[k] = v
        return this
      },
      json(data) {
        jsonSent = data
        return this
      }
    }

    errorHandler(connErr, req, res, () => {})

    assert.strictEqual(statusCalled, 503)
    assert.strictEqual(jsonSent.code, 'STORAGE_UNAVAILABLE')
    assert.strictEqual(jsonSent.message, 'Storage service is temporarily unavailable. Please try again.')
    assert.strictEqual(jsonSent.requestId, 'test-req-seb-probe')
    assert.strictEqual(JSON.stringify(jsonSent).includes('127.0.0.1'), false)
    assert.strictEqual(JSON.stringify(jsonSent).includes('9000'), false)
  })

  test('3. NoSuchBucket S3 error maps to STORAGE_UNAVAILABLE with 503 status', () => {
    const s3Err = new Error('The specified bucket does not exist')
    s3Err.name = 'NoSuchBucket'
    s3Err.$metadata = { service: 'S3', httpStatusCode: 404 }

    const envelope = toErrorEnvelope(s3Err, 'req-s3-nobucket')
    assert.strictEqual(envelope.code, 'STORAGE_UNAVAILABLE')
    assert.strictEqual(envelope.message, 'Storage service is temporarily unavailable. Please try again.')
    assert.strictEqual(envelope.requestId, 'req-s3-nobucket')
  })

  test('4. 4xx validation errors retain friendly message', () => {
    const valErr = new Error('Please select a valid examination time')
    valErr.statusCode = 400
    valErr.code = 'INVALID_SCHEDULE'

    const envelope = toErrorEnvelope(valErr, 'req-val-400')
    assert.strictEqual(envelope.code, 'INVALID_SCHEDULE')
    assert.strictEqual(envelope.message, 'Please select a valid examination time')
    assert.strictEqual(envelope.requestId, 'req-val-400')
  })
})
