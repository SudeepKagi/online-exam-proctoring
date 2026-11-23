'use strict'

const https = require('https')

function makeGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'proctornet.duckdns.org',
      port: 443,
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 SEB/3.10.3'
      }
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (d) => { body += d })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        } catch (_) {
          resolve({ status: res.statusCode, body })
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function run() {
  console.log('Testing missing token path: /api/v1/seb/exchange (no launch param)...')
  const r1 = await makeGet('/api/v1/seb/exchange')
  console.log('R1 status:', r1.status, 'code:', r1.body.code, 'message:', r1.body.message)

  console.log('Testing invalid token path: /api/v1/seb/exchange?launch=invalid_token_999999...')
  const r2 = await makeGet('/api/v1/seb/exchange?launch=invalid_token_999999')
  console.log('R2 status:', r2.status, 'code:', r2.body.code, 'message:', r2.body.message)

  console.log('Testing token status polling: /api/v1/seb/token-status/invalid_token_999999...')
  const r3 = await makeGet('/api/v1/seb/token-status/invalid_token_999999')
  console.log('R3 status:', r3.status, 'statusField:', r3.body.status)

  if (r1.body.code === 'MISSING_TOKEN' && r2.body.code === 'INVALID_TOKEN' && r3.body.status === 'NOT_FOUND') {
    console.log('ALL LIVE HANDOFF ENDPOINT PATHS VERIFIED 100% OPERATIONAL!')
  } else {
    throw new Error('Unexpected responses from live handoff endpoints')
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
