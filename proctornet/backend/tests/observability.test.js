process.env.NODE_ENV = 'test'
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { app, internalApp } = require('../src/app')

function makeRequest(path, headers = {}) {
  const targetApp = (['/metrics', '/readyz'].includes(path) && internalApp) ? internalApp : app
  return new Promise((resolve, reject) => {
    const server = http.createServer(targetApp)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers,
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => (body += chunk))
          res.on('end', () => {
            server.close(() => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body,
              })
            })
          })
        }
      )

      req.on('error', (err) => {
        server.close(() => reject(err))
      })

      req.end()
    })
  })
}

describe('Observability & Telemetry Verification Suite (P0)', () => {
  it('1. GET /metrics returns valid Prometheus metrics payload', async () => {
    const res = await makeRequest('/metrics')
    assert.equal(res.statusCode, 200, 'Metrics endpoint should respond with 200')
    assert.match(
      res.headers['content-type'] || '',
      /text\/plain/i,
      'Content-type should be Prometheus text/plain format'
    )
    assert.match(
      res.body,
      /proctornet_process_cpu_user_seconds_total/,
      'Should contain proctornet process CPU user seconds metric'
    )
    assert.match(
      res.body,
      /nodejs_eventloop_delay_seconds/,
      'Should contain event loop delay gauge metric'
    )
    assert.match(
      res.body,
      /http_request_duration_seconds/,
      'Should contain HTTP request duration histogram metric'
    )
  })

  it('2. Request ID Propagation: Echoes incoming X-Request-Id header', async () => {
    const customId = 'test-trace-id-abc-123'
    const res = await makeRequest('/health', { 'x-request-id': customId })
    assert.equal(res.statusCode, 200)
    assert.equal(
      res.headers['x-request-id'],
      customId,
      'Response X-Request-Id must echo incoming client request ID'
    )
  })

  it('3. Request ID Generation: Generates RFC-compliant UUID when X-Request-Id is omitted', async () => {
    const res = await makeRequest('/health')
    assert.equal(res.statusCode, 200)
    const returnedId = res.headers['x-request-id']
    assert.ok(returnedId, 'Response must include an X-Request-Id header')
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    assert.match(returnedId, uuidRegex, 'Generated request ID must be a valid UUID')
  })

  after(() => {
    setTimeout(() => process.exit(0), 100).unref()
  })
})
