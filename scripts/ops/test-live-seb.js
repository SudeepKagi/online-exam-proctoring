'use strict'

const https = require('https')

const postData = JSON.stringify({
  configKey: '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'
})

const options = {
  hostname: 'proctornet.duckdns.org',
  port: 443,
  path: '/api/v1/seb/ping',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEB/3.10.3.960'
  }
}

const req = https.request(options, (res) => {
  let body = ''
  res.on('data', (d) => { body += d })
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`)
    console.log(`Response: ${body}`)
    process.exit(res.statusCode === 200 ? 0 : 1)
  })
})

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`)
  process.exit(1)
})

req.write(postData)
req.end()
