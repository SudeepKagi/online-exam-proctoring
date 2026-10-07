const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')

describe('OS Telemetry Parser Unit Tests (Captured Fixtures)', () => {
  // ── 1. Windows tasklist CSV Parser ──
  describe('Windows tasklist CSV Parsing', () => {
    it('parses image names correctly and extracts normalized base names', () => {
      const fixtureCsv = [
        '"System Idle Process","0","Services","0","8 K"',
        '"System","4","Services","0","140 K"',
        '"smss.exe","372","Services","0","1,056 K"',
        '"csrss.exe","556","Services","0","4,832 K"',
        '"chrome.exe","10424","Console","1","245,612 K"',
        '"AnyDesk.exe","8412","Console","1","38,200 K"',
        '"obs64.exe","9912","Console","1","125,400 K"'
      ].join('\r\n')

      const processes = new Set()
      const lines = fixtureCsv.split(/\r?\n/)
      for (const line of lines) {
        if (!line.trim()) continue
        const match = line.match(/^"([^"]+)"/)
        if (match && match[1]) {
          const base = match[1].toLowerCase().replace(/\.exe$/i, '').trim()
          if (base) processes.add(base)
        }
      }

      assert.ok(processes.has('chrome'))
      assert.ok(processes.has('anydesk'))
      assert.ok(processes.has('obs64'))
      assert.ok(processes.has('smss'))
      assert.equal(processes.has('notepad'), false)
    })
  })

  // ── 2. macOS ps -axo Parser ──
  describe('macOS ps -axo Parsing', () => {
    it('parses command paths and extracts executable basenames without full paths', () => {
      const fixturePs = [
        '    1 /sbin/launchd',
        '  312 /usr/libexec/logd',
        ' 1204 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ' 1502 /Applications/AnyDesk.app/Contents/MacOS/AnyDesk',
        ' 1801 /Applications/OBS.app/Contents/MacOS/obs'
      ].join('\n')

      const processes = new Set()
      const lines = fixturePs.split(/\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = trimmed.split(/\s+/)
        if (parts.length >= 2) {
          const fullComm = parts.slice(1).join(' ')
          const base = path.basename(fullComm).toLowerCase().trim()
          if (base) processes.add(base)
        }
      }

      assert.ok(processes.has('google chrome'))
      assert.ok(processes.has('anydesk'))
      assert.ok(processes.has('obs'))
      assert.ok(processes.has('launchd'))
    })
  })

  // ── 3. Linux ps -eo Parser ──
  describe('Linux ps -eo Parsing', () => {
    it('parses process basenames accurately', () => {
      const fixturePs = [
        '    1 systemd',
        '  400 dbus-daemon',
        ' 1012 /usr/bin/python3',
        ' 2045 /opt/google/chrome/chrome',
        ' 3011 /usr/bin/obs'
      ].join('\n')

      const processes = new Set()
      const lines = fixturePs.split(/\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = trimmed.split(/\s+/)
        if (parts.length >= 2) {
          const comm = parts.slice(1).join(' ')
          const base = path.basename(comm).toLowerCase().trim()
          if (base) processes.add(base)
        }
      }

      assert.ok(processes.has('chrome'))
      assert.ok(processes.has('obs'))
      assert.ok(processes.has('python3'))
      assert.ok(processes.has('systemd'))
    })
  })

  // ── 4. macOS system_profiler JSON Parser ──
  describe('macOS system_profiler JSON Parsing', () => {
    it('extracts camera device names from system_profiler SPCameraDataType JSON', () => {
      const fixtureJson = JSON.stringify({
        SPCameraDataType: [
          { _name: 'FaceTime HD Camera', spcamera_unique_id: '0x1410000005ac8514' },
          { _name: 'OBS Virtual Camera', spcamera_unique_id: 'obs_virt_cam' }
        ]
      })

      const parsed = JSON.parse(fixtureJson)
      const items = parsed?.SPCameraDataType || []
      const cameraNames = items.map(c => c._name || '').filter(Boolean)

      assert.equal(cameraNames.length, 2)
      assert.ok(cameraNames.includes('FaceTime HD Camera'))
      assert.ok(cameraNames.includes('OBS Virtual Camera'))
    })
  })
})
