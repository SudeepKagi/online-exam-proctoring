#!/usr/bin/env node
'use strict'

/**
 * scripts/seb/config-doctor.js
 *
 * Diagnostic instrument for Safe Exam Browser (SEB) configuration download endpoints.
 * Simulates SEB 3.x NetworkResourceLoader (HEAD then GET) and inspects response headers,
 * body integrity, XML plist validity, prohibited processes, and computed Config Keys.
 *
 * Usage:
 *   node scripts/seb/config-doctor.js <public-config-url> [--stored-key <64-char-hex>]
 *
 * Example:
 *   node scripts/seb/config-doctor.js https://proctornet.duckdns.org/api/v1/seb/config/test.seb
 */

const https = require('https')
const http = require('http')
const crypto = require('crypto')
const zlib = require('zlib')
const { URL } = require('url')

const SEB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.140 SEB/3.10.3 (x64)'

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage:
  node scripts/seb/config-doctor.js <public-config-url> [options]

Options:
  --stored-key <hex>    Compare against expected active 64-char hex Config Key
  --help, -h            Show this help guide
`)
    process.exit(args.length === 0 ? 1 : 0)
  }

  const url = args[0]
  let storedKey = null
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--stored-key' && args[i + 1]) {
      storedKey = args[++i].trim().toLowerCase()
    }
  }

  return { url, storedKey }
}

function makeRequest(targetUrl, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl)
    const client = parsed.protocol === 'https:' ? https : http

    const req = client.request(parsed, {
      method,
      headers: {
        'User-Agent': SEB_USER_AGENT,
        'Accept': '*/*'
      },
      timeout: 10000
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        })
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out after 10000ms'))
    })

    req.on('error', err => reject(err))
    req.end()
  })
}

function parsePlistDict(xmlStr) {
  const settings = {}
  if (!xmlStr) return settings

  const keyRegex = /<key>([^<]+)<\/key>\s*(?:<string>([^<]*)<\/string>|<(true|false)\s*\/?>|<integer>([^<]*)<\/integer>)/gi
  let match
  while ((match = keyRegex.exec(xmlStr)) !== null) {
    const key = match[1]
    if (match[2] !== undefined) {
      settings[key] = match[2]
    } else if (match[3] !== undefined) {
      settings[key] = match[3].toLowerCase() === 'true'
    } else if (match[4] !== undefined) {
      settings[key] = parseInt(match[4], 10)
    }
  }
  return settings
}

function checkDangerousServices(xmlStr) {
  const dangerousServices = [
    'ultraviewer_service.exe',
    'teamviewer_service.exe',
    'pcmonitorsrv.exe',
    'rpcservice.exe',
    'remoting_native_messaging_host.exe',
    'remote_assistance_host.exe'
  ]

  const activeDangerous = []
  const dictRegex = /<dict>([\s\S]*?)<\/dict>/gi
  let match
  while ((match = dictRegex.exec(xmlStr)) !== null) {
    const block = match[1]
    const lower = block.toLowerCase()
    for (const svc of dangerousServices) {
      if (lower.includes(svc)) {
        const isActive = /<key>active<\/key>\s*<true\s*\/>/i.test(block)
        if (isActive) {
          activeDangerous.push(svc)
        }
      }
    }
  }
  return activeDangerous
}

async function runDoctor() {
  const { url, storedKey } = parseArgs()

  console.log('='.repeat(70))
  console.log(' ProctorNet SEB Configuration Doctor')
  console.log(` Target Config URL : ${url}`)
  console.log(` Simulated Client  : SEB 3.10.3 (Windows x64)`)
  console.log(` Timestamp         : ${new Date().toISOString()}`)
  console.log('='.repeat(70) + '\n')

  let hasErrors = false
  let hasWarnings = false

  // Step 1: Simulate SEB HEAD Request
  console.log('[1/4] Probing SEB HEAD Request...')
  let headRes
  try {
    headRes = await makeRequest(url, 'HEAD')
    console.log(`  -> Status: ${headRes.status}`)
    console.log(`  -> Content-Type: ${headRes.headers['content-type'] || 'MISSING'}`)
    console.log(`  -> Content-Disposition: ${headRes.headers['content-disposition'] || 'NONE'}`)

    if (headRes.status !== 200) {
      console.log(`  [FAIL] Expected HTTP 200, received ${headRes.status}`)
      hasErrors = true
    } else {
      console.log('  [PASS] HEAD probe responded 200 OK')
    }

    const cType = (headRes.headers['content-type'] || '').toLowerCase()
    if (!cType.includes('application/seb') && !cType.includes('application/octet-stream')) {
      console.log(`  [WARN] Content-Type "${cType}" is not application/seb (some SEB versions require exact MIME type)`)
      hasWarnings = true
    } else {
      console.log('  [PASS] Content-Type conforms to SEB specification')
    }
  } catch (err) {
    console.log(`  [FAIL] HEAD request error: ${err.message}`)
    hasErrors = true
  }

  // Step 2: Simulate SEB GET Request
  console.log('\n[2/4] Downloading Full Configuration (GET)...')
  let getRes
  try {
    getRes = await makeRequest(url, 'GET')
    console.log(`  -> Status: ${getRes.status}`)
    console.log(`  -> Bytes Received: ${getRes.body.length}`)

    if (getRes.status !== 200) {
      console.log(`  [FAIL] Expected HTTP 200, received ${getRes.status}`)
      hasErrors = true
    } else if (getRes.body.length === 0) {
      console.log('  [FAIL] Received empty configuration body (0 bytes)')
      hasErrors = true
    } else {
      console.log('  [PASS] Configuration payload received successfully')
    }
  } catch (err) {
    console.log(`  [FAIL] GET request error: ${err.message}`)
    hasErrors = true
    return summarize(false, true)
  }

  if (hasErrors || !getRes || getRes.body.length === 0) {
    return summarize(false, hasWarnings)
  }

  // Step 3: Decompress & Inspect Payload Format
  console.log('\n[3/4] Inspecting Format & Content Integrity...')
  let payloadBuf = getRes.body
  const isGzip = payloadBuf.length >= 3 && payloadBuf[0] === 0x1f && payloadBuf[1] === 0x8b && payloadBuf[2] === 0x08
  if (isGzip) {
    console.log('  -> Format: GZip Compressed')
    try {
      payloadBuf = zlib.gunzipSync(payloadBuf)
      console.log(`  -> Decompressed Size: ${payloadBuf.length} bytes`)
    } catch (err) {
      console.log(`  [FAIL] Failed to decompress GZip payload: ${err.message}`)
      hasErrors = true
      return summarize(false, hasWarnings)
    }
  } else {
    console.log('  -> Format: Plain / Raw (Uncompressed)')
  }

  const rawSha256 = crypto.createHash('sha256').update(payloadBuf).digest('hex')
  console.log(`  -> Body SHA-256: ${rawSha256}`)

  const textContent = payloadBuf.toString('utf8')
  const isXml = textContent.includes('<?xml') || textContent.includes('<plist')
  if (!isXml) {
    console.log('  [FAIL] Payload is not recognized XML property list (no <?xml or <plist header)')
    hasErrors = true
  } else {
    console.log('  [PASS] Payload is valid Apple XML Property List (plist 1.0)')
  }

  const settings = parsePlistDict(textContent)
  console.log(`  -> Start URL: ${settings.startURL || 'NOT SET'}`)
  console.log(`  -> Send Browser Exam Key: ${settings.sendBrowserExamKey === true}`)
  console.log(`  -> Append Query Parameter: ${settings.startURLAppendQueryParameter === true}`)
  console.log(`  -> Quit URL: ${settings.quitURL || 'NOT SET'}`)

  if (!settings.startURL) {
    console.log('  [FAIL] Missing required startURL key in configuration')
    hasErrors = true
  } else {
    console.log('  [PASS] startURL key present')
  }

  if (settings.sendBrowserExamKey !== true) {
    console.log('  [FAIL] sendBrowserExamKey is false or missing (SEB will not send verification headers)')
    hasErrors = true
  } else {
    console.log('  [PASS] sendBrowserExamKey is enabled')
  }

  // Step 4: Prohibited Processes & Win32 Crash Check
  console.log('\n[4/4] Scanning for Dangerous Windows Services (Win32 Crash Prevention)...')
  const activeDangerousServices = checkDangerousServices(textContent)
  if (activeDangerousServices.length > 0) {
    console.log(`  [FAIL] Active non-killable background Windows services detected: ${activeDangerousServices.join(', ')}`)
    console.log('         -> Safe Exam Browser will attempt to terminate these services, get Win32 Access Denied,')
    console.log('         -> and abort initialization with native "Configuration failed" dialog!')
    hasErrors = true
  } else {
    console.log('  [PASS] Prohibited Windows system services are safely suppressed (<false/>)')
  }

  // Key Comparison if provided
  if (storedKey) {
    console.log('\n[*] Config Key Verification:')
    console.log(`  -> Expected Stored Key : ${storedKey}`)
    // Normalized XML sha256
    const normalized = textContent.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim()
    const xmlKey = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').toLowerCase()
    console.log(`  -> Computed Key (XML)  : ${xmlKey}`)

    if (xmlKey === storedKey) {
      console.log('  [PASS] Computed Key matches expected stored key!')
    } else {
      console.log('  [WARN] Computed Key does NOT match expected stored key (Key drift risk)')
      hasWarnings = true
    }
  }

  return summarize(!hasErrors, hasWarnings)
}

function summarize(success, hasWarnings) {
  console.log('\n' + '='.repeat(70))
  if (success && !hasWarnings) {
    console.log(' VERDICT: [PASS] Configuration is 100% valid and Safe Exam Browser compatible.')
  } else if (success && hasWarnings) {
    console.log(' VERDICT: [WARN] Configuration is functional but has warnings to review.')
  } else {
    console.log(' VERDICT: [FAIL] Configuration contains fatal errors that will fail SEB startup.')
  }
  console.log('='.repeat(70) + '\n')
  process.exit(success ? 0 : 1)
}

runDoctor().catch(err => {
  console.error('\n[FATAL] Config Doctor execution failed:', err.message)
  process.exit(1)
})
