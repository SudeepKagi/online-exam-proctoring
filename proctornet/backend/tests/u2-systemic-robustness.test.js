const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'

const { app, server } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { register, bigintSerializedTotal } = require('../src/observability/metrics')

let testServer
let baseUrl
let adminToken
let facultyToken
let studentToken

function request(method, path, options = {}) {
  const { headers = {}, body = null } = options
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        }
      },
      (res) => {
        let raw = ''
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => {
          let json = null
          try {
            json = JSON.parse(raw)
          } catch (_) {
            json = raw
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw })
        })
      }
    )
    req.on('error', reject)
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body))
    }
    req.end()
  })
}

describe('Phase U2: Systemic Robustness & BigInt Serialization', () => {
  before(async () => {
    await new Promise((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        const addr = testServer.address()
        baseUrl = `http://127.0.0.1:${addr.port}`
        resolve()
      })
    })

    adminToken = signToken({ id: '00000000-0000-0000-0000-000000000001', role: 'admin', email: 'admin@proctornet.test' })
    facultyToken = signToken({ id: '00000000-0000-0000-0000-000000000002', role: 'faculty', email: 'faculty@proctornet.test' })
    studentToken = signToken({ id: '00000000-0000-0000-0000-000000000003', role: 'student', email: 'student@proctornet.test' })
  })

  after(async () => {
    if (testServer) {
      await new Promise(r => testServer.close(r))
    }
  })

  test('1. AuditLog returns string IDs and valid JSON via GET /api/v1/audit/logs', async () => {
    // Insert an audit row directly to test BigInt serialization
    await prisma.$executeRawUnsafe(`
      INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, timestamp)
      VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'ADMIN', 'U2_TEST_ACTION', 'System', now());
    `)

    const res = await request('GET', '/api/v1/audit/logs?limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    })

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    assert.ok(Array.isArray(res.body), 'Expected array of logs')
    assert.ok(res.body.length > 0, 'Expected at least 1 audit log')
    
    // Verify each ID is a string (not raw BigInt that would crash JSON.stringify)
    for (const log of res.body) {
      assert.equal(typeof log.id, 'string', `Expected log.id to be string, got ${typeof log.id}`)
      assert.ok(/^\d+$/.test(log.id), `Expected numeric string ID, got ${log.id}`)
    }
  })

  test('2. BigInt.prototype.toJSON fallback increments bigint_serialized_total metric', async () => {
    const beforeMetrics = await register.metrics()
    const matchBefore = beforeMetrics.match(/bigint_serialized_total\s+(\d+)/)
    const countBefore = matchBefore ? parseInt(matchBefore[1], 10) : 0

    // Force JSON serialization of an object with an unmapped BigInt
    const testPayload = { unmappedBigInt: BigInt('9007199254740993') }
    const serialized = JSON.stringify(testPayload)

    assert.equal(serialized, '{"unmappedBigInt":"9007199254740993"}')

    const afterMetrics = await register.metrics()
    const matchAfter = afterMetrics.match(/bigint_serialized_total\s+(\d+)/)
    const countAfter = matchAfter ? parseInt(matchAfter[1], 10) : 0

    assert.ok(countAfter > countBefore, `Expected metric count to increase (before: ${countBefore}, after: ${countAfter})`)
  })

  test('3. Public Config /api/v1/config returns valid JSON with llmEnabled & drivers', async () => {
    const res = await request('GET', '/api/v1/config')
    assert.equal(res.status, 200)
    assert.equal(typeof res.body.llmEnabled, 'boolean')
    assert.ok('vpnEnforcement' in res.body)
    assert.ok('cacheDriver' in res.body)
    assert.ok('queueDriver' in res.body)
  })

  test('4. Version endpoint /api/v1/version returns valid JSON without errors', async () => {
    const res = await request('GET', '/api/v1/version')
    assert.equal(res.status, 200)
    assert.ok(res.body.version)
  })

  test('5. Student exams endpoint returns 200, 403, or 404 without 500 error', async () => {
    const res = await request('GET', '/api/v1/student/exams', {
      headers: { Authorization: `Bearer ${studentToken}` }
    })
    assert.notEqual(res.status, 500, `Did not expect HTTP 500, got: ${JSON.stringify(res.body)}`)
    assert.ok([200, 403, 404].includes(res.status), `Expected 200, 403, or 404, got ${res.status}`)
  })
})
