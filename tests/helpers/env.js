'use strict'

/**
 * ProctorNet Test Database Guard (§1 CI-C, C1.1, Appendix B)
 *
 * Preloaded via `node --require tests/helpers/env.js` or invoked from test setups.
 * Refuses to run unless:
 * 1. NODE_ENV === 'test'
 * 2. DATABASE_URL is defined
 * 3. host is one of localhost, 127.0.0.1, postgres, postgres-test
 * 4. database name contains 'test' (e.g. proctornet_test)
 *
 * Exits with code 2 immediately if invoked against a production or shared database.
 */

function guardTestDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[TEST GUARD] Refusing to run tests when NODE_ENV is "${process.env.NODE_ENV}". Must be "test".`)
    process.exit(2)
  }

  const rawDbUrl = process.env.DATABASE_URL
  if (!rawDbUrl) {
    console.error('[TEST GUARD] Refusing to run tests without DATABASE_URL defined.')
    process.exit(2)
  }

  try {
    const u = new URL(rawDbUrl)
    const host = u.hostname.toLowerCase()
    const dbName = u.pathname.replace(/^\//, '').split('?')[0].toLowerCase()

    const allowedHosts = ['localhost', '127.0.0.1', 'postgres', 'postgres-test']
    const isAllowedHost = allowedHosts.includes(host) || (process.env.CI === 'true' && host === 'localhost')
    const isTestDb = dbName.includes('test') || dbName.includes('ci')

    const sanitizedUrl = `${u.protocol}//${u.username ? '***:***@' : ''}${host}:${u.port || '5432'}/${dbName}`

    if (!isAllowedHost || !isTestDb) {
      console.error(`[TEST GUARD] Refusing to run tests against non-test DB: ${sanitizedUrl}`)
      process.exit(2)
    }
  } catch (err) {
    console.error(`[TEST GUARD] Malformed DATABASE_URL: ${err.message}`)
    process.exit(2)
  }

  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379'
  }
  if (!process.env.RABBITMQ_URL) {
    process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672'
  }
}

// Execute guard automatically on import
guardTestDatabase()

module.exports = {
  guardTestDatabase,
  isTestEnv: true
}
