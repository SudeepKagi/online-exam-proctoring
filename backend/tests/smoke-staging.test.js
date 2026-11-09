'use strict'

const assert = require('assert')
const http = require('http')
const { describe, it } = require('node:test')
const { execFile } = require('child_process')
const path = require('path')

describe('Staging Smoke Script Invariants (scripts/ops/smoke-staging.js)', () => {
  it('passes all checks against an operational staging server in log mode', async () => {
    // Spin up an ephemeral mock server providing all tested endpoints
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`)

      if (url.pathname === '/healthz' || url.pathname === '/health') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
        })
        return res.end(JSON.stringify({ status: 'ok', service: 'ProctorNet Backend' }))
      }

      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        return res.end('<!DOCTYPE html><html><body><div id="root">ProctorNet</div></body></html>')
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'X-SafeExamBrowser-ConfigKeyHash, Content-Type, Authorization'
        })
        return res.end()
      }

      if (url.pathname === '/api/v1/seb/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ verified: true }))
      }

      if (url.pathname.startsWith('/api/v1/attempts/exams/') && url.pathname.endsWith('/start')) {
        // In log mode, unauthenticated or non-blocking attempt returns 401 or 404 (not 403 SEB_REQUIRED)
        res.writeHead(401, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Authentication required' }))
      }

      if (url.pathname.startsWith('/socket.io')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        return res.end('0{"sid":"mock_session_123","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}')
      }

      res.writeHead(404)
      res.end('Not Found')
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    const scriptPath = path.resolve(__dirname, '../../scripts/ops/smoke-staging.js')

    try {
      await new Promise((resolve, reject) => {
        execFile(
          process.execPath,
          [scriptPath, '--origin', `http://127.0.0.1:${port}`, '--seb-mode', 'log'],
          (err, stdout, stderr) => {
            if (err) {
              return reject(new Error(`Smoke script failed with code ${err.code}:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`))
            }
            assert.ok(stdout.includes('SUCCESS: All 8 checks passed cleanly.'))
            resolve()
          }
        )
      })
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('verifies enforce mode expectation when exam start returns 403 SEB_REQUIRED', async () => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`)

      if (url.pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ status: 'ok', service: 'ProctorNet Backend' }))
      }
      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        return res.end('<!DOCTYPE html><html><body><div id="root">ProctorNet</div></body></html>')
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Headers': 'X-SafeExamBrowser-ConfigKeyHash, Content-Type, Authorization'
        })
        return res.end()
      }
      if (url.pathname === '/api/v1/seb/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ verified: false }))
      }
      if (url.pathname.startsWith('/api/v1/attempts/exams/') && url.pathname.endsWith('/start')) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ code: 'SEB_REQUIRED', message: 'Safe Exam Browser is required' }))
      }
      if (url.pathname.startsWith('/socket.io')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        return res.end('0{"sid":"mock_session_456","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}')
      }
      res.writeHead(404)
      res.end()
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    const scriptPath = path.resolve(__dirname, '../../scripts/ops/smoke-staging.js')

    try {
      await new Promise((resolve, reject) => {
        execFile(
          process.execPath,
          [scriptPath, '--origin', `http://127.0.0.1:${port}`, '--seb-mode', 'enforce'],
          (err, stdout, stderr) => {
            if (err) {
              return reject(new Error(`Smoke script failed with code ${err.code}:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`))
            }
            assert.ok(stdout.includes('SUCCESS: All 8 checks passed cleanly.'))
            resolve()
          }
        )
      })
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})

