'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

describe('Content Security Policy (CSP) Invariants', () => {
  test('1. Production CSP contains no localhost:9000 or 127.0.0.1:9000 references', () => {
    // Save current NODE_ENV
    const origEnv = process.env.NODE_ENV
    const origBucket = process.env.S3_BUCKET
    const origRegion = process.env.AWS_REGION

    process.env.NODE_ENV = 'production'
    process.env.S3_BUCKET = 'proctornet-storage-prod-858109978489'
    process.env.AWS_REGION = 'ap-south-1'

    // Delete require cache so security module evaluates with production env
    delete require.cache[require.resolve('../src/middleware/security')]
    const { helmetMiddleware } = require('../src/middleware/security')

    let headersSet = {}
    const req = { headers: {} }
    const res = {
      setHeader(k, v) {
        headersSet[k.toLowerCase()] = v
      },
      getHeader(k) {
        return headersSet[k.toLowerCase()]
      },
      removeHeader(k) {
        delete headersSet[k.toLowerCase()]
      }
    }
    const next = () => {}

    helmetMiddleware(req, res, next)

    const csp = headersSet['content-security-policy']
    assert.ok(csp, 'Content-Security-Policy header must be set')
    assert.strictEqual(csp.includes('localhost:9000'), false, 'CSP must NOT contain localhost:9000 in production')
    assert.strictEqual(csp.includes('127.0.0.1:9000'), false, 'CSP must NOT contain 127.0.0.1:9000 in production')
    assert.ok(csp.includes('proctornet-storage-prod-858109978489.s3.ap-south-1.amazonaws.com'), 'CSP must include real S3 bucket host')

    // Restore environment
    process.env.NODE_ENV = origEnv
    if (origBucket) process.env.S3_BUCKET = origBucket
    else delete process.env.S3_BUCKET
    if (origRegion) process.env.AWS_REGION = origRegion
    else delete process.env.AWS_REGION
    delete require.cache[require.resolve('../src/middleware/security')]
  })
})
