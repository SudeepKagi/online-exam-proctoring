const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

describe('BUG-H06: Axios Client Interceptors for Idempotency-Key & Request-ID', async () => {
  const apiModuleUrl = pathToFileURL(path.join(__dirname, '../proctornet/frontend/src/utils/api.js')).href
  const { default: api, extractErrorMessage } = await import(apiModuleUrl)

  it('automatically adds X-Request-ID to outgoing requests', async () => {
    // Interceptor test on request config
    const reqInterceptor = api.interceptors.request.handlers[0].fulfilled
    const config = {
      headers: {},
      method: 'get',
      url: '/test'
    }

    const modified = await reqInterceptor(config)
    assert.ok(modified.headers['X-Request-ID'], 'X-Request-ID header must be present')
    assert.match(modified.headers['X-Request-ID'], /^([0-9a-fA-F-]+|req-.*)$/)
  })

  it('attaches Idempotency-Key header on state-mutating requests (POST, PUT, PATCH, DELETE)', async () => {
    const reqInterceptor = api.interceptors.request.handlers[0].fulfilled
    const methods = ['post', 'put', 'patch', 'delete']

    for (const method of methods) {
      const config = {
        headers: {},
        method,
        idempotencyKey: 'idem-test-key-12345',
        url: '/test'
      }
      const modified = await reqInterceptor(config)
      assert.equal(
        modified.headers['Idempotency-Key'],
        'idem-test-key-12345',
        `Idempotency-Key must be attached on ${method.toUpperCase()}`
      )
    }
  })

  it('does NOT attach Idempotency-Key header on GET requests', async () => {
    const reqInterceptor = api.interceptors.request.handlers[0].fulfilled
    const config = {
      headers: {},
      method: 'get',
      idempotencyKey: 'should-not-attach-on-get',
      url: '/test'
    }

    const modified = await reqInterceptor(config)
    assert.equal(
      modified.headers['Idempotency-Key'],
      undefined,
      'Idempotency-Key must not be attached to GET requests'
    )
  })

  it('extractErrorMessage safely normalizes all error structures', () => {
    // 1. Nested object in err.response.data.error
    const err1 = { response: { data: { error: { message: 'Nested error message', code: 'TEST_ERR' } } } }
    assert.equal(extractErrorMessage(err1), 'Nested error message')

    // 2. String in err.response.data.error
    const err2 = { response: { data: { error: 'Direct error string' } } }
    assert.equal(extractErrorMessage(err2), 'Direct error string')

    // 3. String in err.response.data.message
    const err3 = { response: { data: { message: 'Message field error' } } }
    assert.equal(extractErrorMessage(err3), 'Message field error')

    // 4. Standard Error object
    const err4 = new Error('Standard JS error')
    assert.equal(extractErrorMessage(err4), 'Standard JS error')

    // 5. Fallback on null/undefined
    assert.equal(extractErrorMessage(null, 'Custom fallback'), 'Custom fallback')
  })
})
