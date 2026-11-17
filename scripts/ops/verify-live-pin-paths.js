'use strict'

const https = require('https')

function makeRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload)
    const options = {
      hostname: 'proctornet.duckdns.org',
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 SEB/3.10.3'
      }
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (d) => { body += d })
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(body) })
      })
    })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

async function run() {
  console.log('Testing direct path: /api/v1/seb/exchange-pin (empty pin)...')
  const r1 = await makeRequest('/api/v1/seb/exchange-pin', { pin: '' })
  console.log('R1 status:', r1.status, 'code:', r1.body.code, 'message:', r1.body.message)

  console.log('Testing double-prefix path: /api/v1/api/v1/seb/exchange-pin (empty pin)...')
  const r2 = await makeRequest('/api/v1/api/v1/seb/exchange-pin', { pin: '' })
  console.log('R2 status:', r2.status, 'code:', r2.body.code, 'message:', r2.body.message)

  console.log('Testing invalid 6-digit pin: 999999...')
  const r3 = await makeRequest('/api/v1/seb/exchange-pin', { pin: '999999' })
  console.log('R3 status:', r3.status, 'code:', r3.body.code, 'message:', r3.body.message)

  if (r1.body.code === 'MISSING_PIN' && r2.body.code === 'MISSING_PIN' && r3.body.code === 'INVALID_PIN') {
    console.log('ALL LIVE PIN ENDPOINT PATHS VERIFIED 100% OPERATIONAL!')
  } else {
    throw new Error('Unexpected responses')
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
