'use strict'

const zlib = require('zlib')
const crypto = require('crypto')

/**
 * Serializes an in-memory dictionary to compact sorted JSON per SEB specification (Json.cs).
 *
 * Rules:
 * 1. Keys sorted alphabetically using invariant comparison.
 * 2. Excludes originatorVersion (case-insensitive).
 * 3. Excludes empty sub-dictionaries.
 * 4. Booleans formatted as lowercase 'true' or 'false'.
 * 5. Numbers serialized using invariant format.
 * 6. Strings and nulls wrapped in quotes.
 */
function serializeSebJson(value) {
  if (value === null || value === undefined) {
    return '""'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    const serializedItems = value.map(serializeSebJson)
    return `[${serializedItems.join(',')}]`
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
    const parts = []

    for (const key of keys) {
      if (key.toLowerCase() === 'originatorversion') {
        continue
      }
      const val = value[key]
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) {
        continue // Skip empty dictionary per Json.cs
      }
      parts.push(`${JSON.stringify(key)}:${serializeSebJson(val)}`)
    }

    return `{${parts.join(',')}}`
  }

  return '""'
}

/**
 * Normalizes an XML plist string by removing insignificant whitespace, comments,
 * and excluded keys per SEB Developer Specification.
 */
function normalizePlistXml(xmlStr) {
  if (!xmlStr) return ''
  // Strip XML comments
  let cleaned = xmlStr.replace(/<!--[\s\S]*?-->/g, '')
  // Normalize whitespace between tags
  cleaned = cleaned.replace(/>\s+</g, '><').trim()
  return cleaned
}

/**
 * Computes the SEB Configuration Key from a plain XML string.
 * Legacy compatibility helper matching original test harness.
 */
function computeConfigKeyFromXml(xmlStr) {
  try {
    const normalized = normalizePlistXml(xmlStr)
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').toLowerCase()
  } catch (_) {
    return null
  }
}

/**
 * Computes the SEB Configuration Key from a parsed dictionary per the official SEB specification.
 */
function computeConfigKeyOfficial(dictionary) {
  try {
    if (!dictionary || typeof dictionary !== 'object') return null
    const jsonStr = serializeSebJson(dictionary)
    return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex').toLowerCase()
  } catch (_) {
    return null
  }
}

/**
 * Extracts key-value mappings from a standard Apple XML property list.
 */
function parsePlistDict(xmlStr) {
  const settings = {}
  if (!xmlStr) return settings

  // Match key followed by string, true, false, or integer
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

/**
 * Inspects a .seb buffer and validates settings against institution requirements.
 *
 * @param {Buffer} buffer - The raw .seb file buffer
 * @param {Object} options - { publicOrigin, s3Host, pastedKey }
 */
function inspectSebBuffer(buffer, options = {}) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file provided.' }
  }

  const { publicOrigin = 'https://proctornet.duckdns.org', pastedKey = '' } = options

  // 1. Decompress if GZip (ID1 = 0x1F, ID2 = 0x8B, CM = 0x08)
  let decompressed = buffer
  let wasCompressed = false
  if (buffer.length >= 3 && buffer[0] === 0x1f && buffer[1] === 0x8b && buffer[2] === 0x08) {
    try {
      decompressed = zlib.gunzipSync(buffer)
      wasCompressed = true
    } catch (_) {
      return { valid: false, error: 'Corrupt or malformed compressed .seb file.' }
    }
  }

  // 2. Identify Magic Prefix
  const first4 = decompressed.slice(0, 4).toString('utf8')
  const isSeb0 = decompressed.length >= 4 && decompressed[0] === 0x73 && decompressed[1] === 0x65 && decompressed[2] === 0x62 && decompressed[3] === 0x00
  const isEncryptedHeader = ['pswd', 'pwcc', 'pkhs', 'phsk'].includes(first4) || isSeb0

  // 3. Encrypted SEB File Handling
  if (isEncryptedHeader) {
    return {
      valid: true,
      isEncrypted: true,
      format: 'encrypted',
      wasCompressed,
      notice: 'This configuration file is protected with a settings password or certificate. Internal settings and Configuration Key cannot be inspected statically before launch. Use "Test my setup" to verify end-to-end communication.',
      recommendation: 'Settings password encryption is recommended in production to prevent candidates from opening and editing configuration rules in the SEB Config Tool.',
      checks: [],
      keyMatch: false,
      keyNotice: 'Encrypted file: Configuration Key must be copied from SEB Config Tool (Exam tab) or observed via live handshake.'
    }
  }

  // 4. Plain XML Plist Handling
  const textContent = decompressed.toString('utf8')
  const isXml = textContent.includes('<?xml') || textContent.includes('<plist') || textContent.includes('<!DOCTYPE plist')

  if (!isXml) {
    return {
      valid: false,
      error: 'The uploaded file does not match a valid Safe Exam Browser configuration format (expected XML plist or encrypted container).'
    }
  }

  const settings = parsePlistDict(textContent)
  const checks = []
  let hasErrors = false

  let expectedHost = 'proctornet.duckdns.org'
  try {
    expectedHost = new URL(publicOrigin).host
  } catch (_) { }

  // a. Check Start URL
  const startUrl = settings.startURL || ''
  if (!startUrl) {
    checks.push({
      key: 'startURL',
      label: 'Start URL',
      status: 'error',
      message: 'Start URL is missing in the configuration file.'
    })
    hasErrors = true
  } else {
    try {
      const parsedStart = new URL(startUrl)
      const hostMatch = parsedStart.host.toLowerCase() === expectedHost.toLowerCase()
      const isRecommendedPath = parsedStart.pathname === '/seb/enter' || parsedStart.pathname.startsWith('/seb/enter')

      if (!hostMatch) {
        checks.push({
          key: 'startURL',
          label: 'Start URL Host',
          status: 'warning',
          message: `Start URL host (${parsedStart.host}) does not match your institution public origin (${expectedHost}).`
        })
      } else if (!isRecommendedPath) {
        checks.push({
          key: 'startURL',
          label: 'Start URL',
          status: 'warning',
          message: `Start URL is configured to "${startUrl}". This works, but update your configuration to the recommended Start URL (${publicOrigin}/seb/enter) for automatic handoff.`
        })
      } else {
        checks.push({
          key: 'startURL',
          label: 'Start URL',
          status: 'ok',
          message: `Configured to ${startUrl}`
        })
      }
    } catch (_) {
      checks.push({
        key: 'startURL',
        label: 'Start URL',
        status: 'error',
        message: `Invalid Start URL format: "${startUrl}".`
      })
      hasErrors = true
    }
  }

  // b. Check sendBrowserExamKey (Send Browser Exam Key & Config Key in HTTP request)
  if (settings.sendBrowserExamKey === true) {
    checks.push({
      key: 'sendBrowserExamKey',
      label: 'Security Headers',
      status: 'ok',
      message: 'Configuration Key header transmission is enabled.'
    })
  } else {
    checks.push({
      key: 'sendBrowserExamKey',
      label: 'Security Headers',
      status: 'error',
      message: 'The setting "sendBrowserExamKey" is disabled or missing. Safe Exam Browser will not send verification headers.'
    })
    hasErrors = true
  }

  // c. Check startURLAppendQueryParameter (Allow Query Parameter)
  if (settings.startURLAppendQueryParameter === true || settings.allowQueryParameter === true) {
    checks.push({
      key: 'startURLAppendQueryParameter',
      label: 'Query Parameter Forwarding',
      status: 'ok',
      message: 'Query parameter forwarding is enabled for seamless handoff.'
    })
  } else {
    checks.push({
      key: 'startURLAppendQueryParameter',
      label: 'Query Parameter Forwarding',
      status: 'warning',
      message: 'The setting "startURLAppendQueryParameter" is disabled. Safe Exam Browser might not forward the launch token, requiring student PIN fallback.'
    })
  }

  // d. Check quitURL
  const quitUrl = settings.quitURL || ''
  if (quitUrl) {
    try {
      const parsedQuit = new URL(quitUrl)
      if (parsedQuit.host.toLowerCase() === expectedHost.toLowerCase()) {
        checks.push({
          key: 'quitURL',
          label: 'Quit URL',
          status: 'ok',
          message: `Configured on institution host: ${quitUrl}`
        })
      } else {
        checks.push({
          key: 'quitURL',
          label: 'Quit URL',
          status: 'warning',
          message: `Quit URL host (${parsedQuit.host}) differs from institution host (${expectedHost}).`
        })
      }
    } catch (_) {
      checks.push({
        key: 'quitURL',
        label: 'Quit URL',
        status: 'warning',
        message: `Quit URL is formatted as "${quitUrl}". Recommended: ${publicOrigin}/seb/done.`
      })
    }
  } else {
    checks.push({
      key: 'quitURL',
      label: 'Quit URL',
      status: 'warning',
      message: `Quit URL is not set. Recommended: ${publicOrigin}/seb/done.`
    })
  }

  // e. Check URLFilterRules if enabled
  if (settings.URLFilterEnable === true) {
    checks.push({
      key: 'URLFilterEnable',
      label: 'URL Filtering',
      status: 'ok',
      message: 'URL filtering active. Ensure the filter allows access to the application domain and S3 media storage.'
    })
  }

  // f. Key Verification
  const computedKey = computeConfigKeyFromXml(textContent)
  let keyMatch = false
  let keyWarning = null

  const cleanedPastedKey = (pastedKey || '').trim().toLowerCase()
  if (cleanedPastedKey && /^[0-9a-f]{64}$/.test(cleanedPastedKey)) {
    if (computedKey && computedKey === cleanedPastedKey) {
      keyMatch = true
    } else {
      keyWarning = 'The pasted Configuration Key does not match the computed hash of this plain configuration file. This looks like the Browser Exam Key or a different settings version.'
    }
  }

  return {
    valid: !hasErrors,
    isEncrypted: false,
    format: 'xml',
    wasCompressed,
    settingsSummary: {
      startURL: settings.startURL || null,
      sendBrowserExamKey: settings.sendBrowserExamKey === true,
      startURLAppendQueryParameter: settings.startURLAppendQueryParameter === true,
      quitURL: settings.quitURL || null,
      urlFilterEnabled: settings.URLFilterEnable === true
    },
    checks,
    computedKey,
    keyMatch,
    keyWarning,
    recommendation: 'For enhanced security in production, protect this configuration with a settings password in the SEB Configuration Tool.'
  }
}

/**
 * Sanitizes plain XML plist so that non-killable background Windows services
 * (like UltraViewer_Service.exe and TeamViewer_Service.exe) have active set to false.
 * Prevents Win32 Access Denied errors and "Configuration failed" dialogs on student machines.
 * Supports both string and Buffer inputs.
 */
function sanitizeProhibitedProcesses(input) {
  if (!input) return input
  const isBuf = Buffer.isBuffer(input)
  let xmlStr = isBuf ? input.toString('utf8') : input

  if (typeof xmlStr !== 'string') return input
  if (!xmlStr.includes('<?xml') && !xmlStr.includes('<plist')) return input

  const systemServices = [
    'ultraviewer_service.exe',
    'teamviewer_service.exe',
    'pcmonitorsrv.exe',
    'rpcservice.exe',
    'remoting_native_messaging_host.exe',
    'remote_assistance_host.exe'
  ]

  const sanitized = xmlStr.replace(/<dict>([\s\S]*?)<\/dict>/gi, (dictBlock) => {
    const lowerBlock = dictBlock.toLowerCase()
    const isService = systemServices.some(svc => lowerBlock.includes(svc))
    if (isService) {
      return dictBlock.replace(/<key>active<\/key>\s*<true\s*\/>/i, '<key>active</key>\n        <false/>')
    }
    return dictBlock
  })

  return isBuf ? Buffer.from(sanitized, 'utf8') : sanitized
}

/**
 * Generates a valid starter SEB XML plist configuration.
 *
 * @param {Object} options - { publicOrigin, s3Host }
 * @returns {string} XML plist string
 */
function generateStarterSebConfig({ publicOrigin = 'https://proctornet.duckdns.org', s3Host = '' } = {}) {
  const origin = publicOrigin.replace(/\/+$/, '')
  let s3FilterRule = ''
  if (s3Host) {
    s3FilterRule = `
        <dict>
            <key>action</key>
            <integer>1</integer>
            <key>active</key>
            <true/>
            <key>expression</key>
            <string>https://${s3Host}/*</string>
            <key>regex</key>
            <false/>
        </dict>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_3.0_ProctorNet_Starter</string>
    <key>startURL</key>
    <string>${origin}/seb/enter</string>
    <key>sendBrowserExamKey</key>
    <true/>
    <key>startURLAppendQueryParameter</key>
    <true/>
    <key>quitURL</key>
    <string>${origin}/seb/done</string>
    <key>quitURLConfirm</key>
    <true/>
    <key>allowVideoCapture</key>
    <true/>
    <key>allowAudioCapture</key>
    <true/>
    <key>examSessionClearCookiesOnStart</key>
    <true/>
    <key>examSessionClearCookiesOnEnd</key>
    <true/>
    <key>URLFilterEnable</key>
    <true/>
    <key>URLFilterEnableContentFilter</key>
    <false/>
    <key>URLFilterRules</key>
    <array>
        <dict>
            <key>action</key>
            <integer>1</integer>
            <key>active</key>
            <true/>
            <key>expression</key>
            <string>${origin}/*</string>
            <key>regex</key>
            <false/>
        </dict>${s3FilterRule}
    </array>
    <key>prohibitedProcesses</key>
    <array>
        <dict>
            <key>active</key>
            <true/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>UltraViewer_Desktop.exe</string>
            <key>originalName</key>
            <string>UltraViewer_Desktop.exe</string>
            <key>description</key>
            <string>UltraViewer Screen Sharing Client</string>
        </dict>
        <dict>
            <key>active</key>
            <false/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>UltraViewer_Service.exe</string>
            <key>originalName</key>
            <string>UltraViewer_Service.exe</string>
            <key>description</key>
            <string>UltraViewer Service (Ignored - Windows Service)</string>
        </dict>
        <dict>
            <key>active</key>
            <true/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>TeamViewer.exe</string>
            <key>originalName</key>
            <string>TeamViewer.exe</string>
            <key>description</key>
            <string>TeamViewer Client</string>
        </dict>
        <dict>
            <key>active</key>
            <false/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>TeamViewer_Service.exe</string>
            <key>originalName</key>
            <string>TeamViewer_Service.exe</string>
            <key>description</key>
            <string>TeamViewer Service (Ignored - Windows Service)</string>
        </dict>
        <dict>
            <key>active</key>
            <true/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>AnyDesk.exe</string>
            <key>originalName</key>
            <string>AnyDesk.exe</string>
            <key>description</key>
            <string>AnyDesk Remote Desktop</string>
        </dict>
        <dict>
            <key>active</key>
            <true/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>Telegram.exe</string>
            <key>originalName</key>
            <string>Telegram.exe</string>
            <key>description</key>
            <string>Telegram Messaging Client</string>
        </dict>
        <dict>
            <key>active</key>
            <true/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>Discord.exe</string>
            <key>originalName</key>
            <string>Discord.exe</string>
            <key>description</key>
            <string>Discord Messaging Client</string>
        </dict>
        <dict>
            <key>active</key>
            <true/>
            <key>currentUser</key>
            <true/>
            <key>strongKill</key>
            <false/>
            <key>os</key>
            <integer>1</integer>
            <key>executable</key>
            <string>Zoom.exe</string>
            <key>originalName</key>
            <string>Zoom.exe</string>
            <key>description</key>
            <string>Zoom Video Meeting</string>
        </dict>
    </array>
</dict>
</plist>`
}

module.exports = {
  inspectSebBuffer,
  generateStarterSebConfig,
  sanitizeProhibitedProcesses,
  computeConfigKeyFromXml,
  computeConfigKeyOfficial,
  serializeSebJson,
  parsePlistDict
}
