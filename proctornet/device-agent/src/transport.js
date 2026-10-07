/**
 * ProctorNet Exam Device Companion
 * Outbound HTTPS Transport & HMAC-SHA256 Signing
 * Architecture: ADR A-002, Prompt 4 §3.3
 */

const http = require('http')
const https = require('https')
const crypto = require('crypto')
const { URL } = require('url')
const { REPORT_TIMEOUT_MS } = require('./config')

class Transport {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.clockOffsetMs = 0
  }

  /**
   * Adjusts clock skew from authoritative server epoch
   */
  adjustClockOffset(serverTimeIso) {
    if (!serverTimeIso) return
    const serverEpoch = new Date(serverTimeIso).getTime()
    if (!isNaN(serverEpoch)) {
      this.clockOffsetMs = serverEpoch - Date.now()
    }
  }

  /**
   * Returns skew-corrected current timestamp
   */
  getSkewCorrectedTimestamp() {
    return Date.now() + this.clockOffsetMs
  }

  /**
   * Computes HMAC-SHA256 signature matching backend encryption.js
   */
  computeSignature(sessionKeyBase64, method, path, seq, ts, nonce, bodyString) {
    const keyBuffer = Buffer.from(sessionKeyBase64, 'base64')
    const bodySha256 = crypto.createHash('sha256').update(bodyString || '', 'utf8').digest('hex')
    const payload = `${method.toUpperCase()}\n${path}\n${seq}\n${ts}\n${nonce}\n${bodySha256}`
    return crypto.createHmac('sha256', keyBuffer).update(payload, 'utf8').digest('base64')
  }

  /**
   * Generic HTTP/HTTPS JSON request with timeout
   */
  async request(method, endpoint, body = null, headers = {}, timeoutMs = REPORT_TIMEOUT_MS) {
    const fullUrl = new URL(endpoint, this.baseUrl)
    const isHttps = fullUrl.protocol === 'https:'
    const client = isHttps ? https : http

    const bodyString = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null

    const reqHeaders = {
      'Accept': 'application/json',
      ...headers
    }

    if (bodyString !== null) {
      reqHeaders['Content-Type'] = 'application/json'
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyString, 'utf8')
    }

    return new Promise((resolve, reject) => {
      const options = {
        method,
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        headers: reqHeaders,
        timeout: timeoutMs
      }

      const req = client.request(options, (res) => {
        let rawData = ''
        res.setEncoding('utf8')

        res.on('data', chunk => {
          rawData += chunk
        })

        res.on('end', () => {
          let parsedData = null
          if (rawData) {
            try {
              parsedData = JSON.parse(rawData)
            } catch {
              parsedData = { raw: rawData }
            }
          }

          // Check for clock skew server response
          if (res.statusCode === 400 && (parsedData?.error === 'CLOCK_SKEW' || parsedData?.code === 'CLOCK_SKEW')) {
            if (parsedData?.serverTime) {
              this.adjustClockOffset(parsedData.serverTime)
            }
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsedData
          })
        })
      })

      req.on('timeout', () => {
        req.destroy(new Error(`Request to ${endpoint} timed out after ${timeoutMs}ms`))
      })

      req.on('error', (err) => {
        reject(err)
      })

      if (bodyString !== null) {
        req.write(bodyString)
      }
      req.end()
    })
  }

  /**
   * Submits HMAC-authenticated agent report
   */
  async sendReport(sessionToken, sessionKey, seq, reportBody) {
    const path = '/api/v1/agent/report'
    const ts = this.getSkewCorrectedTimestamp()
    const nonce = crypto.randomBytes(8).toString('hex')
    const bodyString = JSON.stringify(reportBody)

    const signature = this.computeSignature(sessionKey, 'POST', path, seq, ts, nonce, bodyString)

    const headers = {
      'X-Agent-Session': sessionToken,
      'X-Agent-Seq': String(seq),
      'X-Agent-Ts': String(ts),
      'X-Agent-Nonce': nonce,
      'X-Agent-Signature': signature
    }

    return this.request('POST', path, bodyString, headers)
  }
}

module.exports = {
  Transport
}
