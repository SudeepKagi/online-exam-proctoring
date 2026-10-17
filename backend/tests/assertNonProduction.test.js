'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isNonProductionDatabase,
  assertNonProduction
} = require('../src/infra/postgres/assertNonProduction')

describe('assertNonProduction Guard', () => {
  it('correctly classifies local and safe database hosts', () => {
    assert.strictEqual(isNonProductionDatabase('postgresql://postgres:postgres@localhost:5432/db'), true)
    assert.strictEqual(isNonProductionDatabase('postgresql://postgres:postgres@127.0.0.1:5432/db'), true)
    assert.strictEqual(isNonProductionDatabase('postgresql://postgres:postgres@postgres:5432/db'), true)
    assert.strictEqual(isNonProductionDatabase('postgresql://postgres:postgres@remote-host:5432/my_app_test'), true)
    assert.strictEqual(isNonProductionDatabase('postgresql://postgres:postgres@remote-host:5432/my_app_ci'), true)
    assert.strictEqual(isNonProductionDatabase('postgresql://postgres:postgres@remote-host:5432/my_app_dev'), true)
  })

  it('correctly identifies remote production databases as unsafe', () => {
    assert.strictEqual(isNonProductionDatabase('postgresql://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'), false)
    assert.strictEqual(isNonProductionDatabase('postgresql://user:pass@prod-db.xyz.rds.amazonaws.com:5432/proctornet'), false)
  })

  it('allows safe local databases when assertNonProduction is invoked', () => {
    const origUrl = process.env.DATABASE_URL
    try {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/proctornet_dev'
      assert.doesNotThrow(() => {
        assertNonProduction('test-suite')
      })
    } finally {
      process.env.DATABASE_URL = origUrl
    }
  })
})
