'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  sanitizeProhibitedProcesses,
  generateStarterSebConfig
} = require('../src/modules/seb/sebConfigChecker')

describe('SEB Service Sanitization & Media Capture Configuration', () => {
  it('sanitizes background Windows services from prohibitedProcesses in SEB XML plists', () => {
    const rawPlist = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>prohibitedProcesses</key>
  <array>
    <dict>
      <key>active</key>
      <true/>
      <key>currentUser</key>
      <true/>
      <key>description</key>
      <string></string>
      <key>executable</key>
      <string>Discord.exe</string>
      <key>originalName</key>
      <string>Discord.exe</string>
      <key>os</key>
      <integer>1</integer>
    </dict>
    <dict>
      <key>active</key>
      <true/>
      <key>currentUser</key>
      <true/>
      <key>description</key>
      <string></string>
      <key>executable</key>
      <string>UltraViewer_Service.exe</string>
      <key>originalName</key>
      <string>UltraViewer_Service.exe</string>
      <key>os</key>
      <integer>1</integer>
    </dict>
    <dict>
      <key>active</key>
      <true/>
      <key>currentUser</key>
      <true/>
      <key>description</key>
      <string></string>
      <key>executable</key>
      <string>TeamViewer_Service.exe</string>
      <key>originalName</key>
      <string>TeamViewer_Service.exe</string>
      <key>os</key>
      <integer>1</integer>
    </dict>
  </array>
</dict>
</plist>`

    const sanitizedBuffer = sanitizeProhibitedProcesses(Buffer.from(rawPlist, 'utf8'))
    const sanitizedXml = sanitizedBuffer.toString('utf8')

    // Discord.exe must remain active: true
    assert.match(sanitizedXml, /<string>Discord\.exe<\/string>/)
    const discordMatch = sanitizedXml.match(/<dict>[\s\S]*?<string>Discord\.exe<\/string>[\s\S]*?<\/dict>/)
    assert.ok(discordMatch, 'Discord dict must exist')
    assert.match(discordMatch[0], /<key>active<\/key>\s*<true\s*\/>/)

    // UltraViewer_Service.exe must be active: false so SEB will not attempt Process.Kill() on Session 0 service
    const uvMatch = sanitizedXml.match(/<dict>[\s\S]*?<string>UltraViewer_Service\.exe<\/string>[\s\S]*?<\/dict>/)
    assert.ok(uvMatch, 'UltraViewer_Service dict must exist')
    assert.match(uvMatch[0], /<key>active<\/key>\s*<false\s*\/>/)

    // TeamViewer_Service.exe must be active: false
    const tvMatch = sanitizedXml.match(/<dict>[\s\S]*?<string>TeamViewer_Service\.exe<\/string>[\s\S]*?<\/dict>/)
    assert.ok(tvMatch, 'TeamViewer_Service dict must exist')
    assert.match(tvMatch[0], /<key>active<\/key>\s*<false\s*\/>/)
  })

  it('safely passes non-XML or encrypted buffers without alteration', () => {
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])
    const result = sanitizeProhibitedProcesses(binaryData)
    assert.deepEqual(result, binaryData)
  })

  it('generateStarterSebConfig includes allowVideoCapture and allowAudioCapture enabled', () => {
    const starterXml = generateStarterSebConfig('https://proctornet.duckdns.org/seb/enter')
    assert.match(starterXml, /<key>allowVideoCapture<\/key>\s*<true\s*\/>/, 'Must allow video capture for proctoring camera')
    assert.match(starterXml, /<key>allowAudioCapture<\/key>\s*<true\s*\/>/, 'Must allow audio capture for proctoring microphone')
    assert.match(starterXml, /<key>sendBrowserExamKey<\/key>\s*<true\s*\/>/, 'Must send browser exam key')
    assert.match(starterXml, /<string>https:\/\/proctornet\.duckdns\.org\/seb\/enter<\/string>/)
  })
})
