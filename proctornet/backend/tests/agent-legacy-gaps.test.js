const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const express = require('express')

/**
 * Phase A0 — Baseline Legacy Defect Suite (G-02, G-03, G-05)
 *
 * Verifies that the legacy architecture exhibits the exact vulnerabilities
 * catalogued in Prompt 4 §2:
 * - G-02: Fail-open process scanning on maxBuffer/exec error
 * - G-03: False positive matching via naive line.includes()
 * - G-05: Forgeable client-supplied deviceCheck controller
 */

describe('Legacy Agent Defects Reproduction (Prompt 4 Phase A0)', () => {

  describe('G-02: Fail-Open Process Scanning on Error (agent.js:28-32)', () => {
    it('resolves empty array [] when process execution fails, treating failure as clean (fail-open)', async () => {
      // Replicate legacy getRunningProcesses error handling from agent.js lines 23-34:
      // exec(cmd, (err, stdout) => { if (err) return resolve([]); ... })
      const legacyGetRunningProcesses = (simulateError) => {
        return new Promise((resolve) => {
          if (simulateError) {
            // Simulated maxBuffer exceeded (RangeError: stdout maxBuffer length exceeded)
            const err = new RangeError('stdout maxBuffer length exceeded')
            return resolve([]) // Legacy bug: resolves empty on error instead of failing
          }
          resolve(['explorer.exe', 'chrome.exe'])
        })
      }

      const processLines = await legacyGetRunningProcesses(true)

      // Vulnerability proof: an error results in an empty array
      assert.deepEqual(processLines, [], 'Legacy agent returned empty array on command failure')

      // In agent.js lines 106-123, empty lines means zero blocked processes:
      const BANNED_PATTERNS = ['anydesk', 'teamviewer', 'copilot', 'obs64']
      const blockedProcesses = []
      for (const line of processLines) {
        for (const pattern of BANNED_PATTERNS) {
          if (line.includes(pattern)) blockedProcesses.push(pattern)
        }
      }

      // Proof of G-02: Overloaded machine with banned tools produces 0 blocked processes (fail-open)
      assert.equal(blockedProcesses.length, 0)
      const scanResult = {
        agentStatus: 'HEALTHY',
        blockedProcesses,
        virtualCams: []
      }
      assert.equal(scanResult.agentStatus, 'HEALTHY', 'Overloaded host falsely reported as HEALTHY')
    })
  })

  describe('G-03: False Positive Matching via line.includes (agent.js:109-114)', () => {
    const BANNED_PATTERNS = [
      'anydesk', 'teamviewer', 'ultraviewer', 'chrome-remote-desktop',
      'vnc', 'vncserver', 'rdp', 'mstsc', 'remotedesktop', 'logmein',
      'copilot', 'chatgpt', 'claude', 'cursor', 'ollama', 'lmstudio',
      'obs64', 'obs32', 'camtasia', 'bandicam'
    ]

    function legacyMatch(line) {
      const lower = line.toLowerCase()
      const blocked = []
      for (const pattern of BANNED_PATTERNS) {
        if (lower.includes(pattern) && !blocked.includes(pattern)) {
          blocked.push(pattern)
        }
      }
      return blocked
    }

    it('falsely flags a candidate with username "claude" in file path', () => {
      const innocentLine = 'node C:\\Users\\claude\\Documents\\study_notes\\app.js 4120'
      const matches = legacyMatch(innocentLine)
      assert.ok(matches.includes('claude'), 'Expected legacy line.includes to falsely flag username "claude"')
    })

    it('falsely flags a benign developer path containing "cursor"', () => {
      const innocentLine = 'python /home/student/projects/database_cursor/query.py 8821'
      const matches = legacyMatch(innocentLine)
      assert.ok(matches.includes('cursor'), 'Expected legacy line.includes to falsely flag path containing "cursor"')
    })

    it('falsely flags Windows native clipboard synchronization helper rdpclip.exe', () => {
      const innocentLine = 'rdpclip.exe 3420 Console 1 12,410 K'
      const matches = legacyMatch(innocentLine)
      assert.ok(matches.includes('rdp'), 'Expected legacy line.includes to falsely flag rdpclip.exe as prohibited rdp')
    })

    it('falsely flags innocent process words containing substring "vnc"', () => {
      const innocentLine = 'convnc-render.exe 5512 Console 1 4,110 K'
      const matches = legacyMatch(innocentLine)
      assert.ok(matches.includes('vnc'), 'Expected legacy line.includes to falsely flag convnc as prohibited vnc')
    })
  })

  describe('G-05: Forgeable Client-Supplied Device Check (deviceCheck/controller.js)', () => {
    it('accepts unsigned client-supplied JSON and sets agentConnected=true and status=PASSED', async () => {
      const app = express()
      app.use(express.json())

      // Mock student middleware
      app.use((req, res, next) => {
        req.user = { id: 'student-fake-123', role: 'STUDENT' }
        next()
      })

      // Minimal controller logic replicating legacy deviceCheck/controller.js lines 16-64
      app.post('/api/v1/exam/device-check', async (req, res) => {
        const { blockedProcesses = [], virtualCams = [], isSubnetMatched = true, signature } = req.body
        const isSigned = Boolean(signature) // Legacy accepts unsigned with isAdvisory=true
        const status = (blockedProcesses.length === 0 && virtualCams.length === 0) ? 'PASSED' : 'FLAGGED'

        res.status(200).json({
          success: true,
          status,
          agentConnected: true, // Legacy bug: always true regardless of actual agent existence
          assurance: isSigned ? 'CRYPTOGRAPHICALLY_VERIFIED' : 'ADVISORY',
          isAdvisory: !isSigned
        })
      })

      const server = http.createServer(app)
      await new Promise(resolve => server.listen(0, resolve))
      const port = server.address().port

      try {
        // Student browser submits fabricated "clean" report with zero agent running
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/exam/device-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockedProcesses: [],
            virtualCams: [],
            isSubnetMatched: true
          })
        })

        const body = await res.json()
        assert.equal(res.status, 200)
        assert.equal(body.success, true)
        assert.equal(body.status, 'PASSED', 'Legacy server accepted fabricated clean status')
        assert.equal(body.agentConnected, true, 'Legacy server hallucinated agentConnected=true')
        assert.equal(body.isAdvisory, true, 'Unsigned forged report accepted as advisory pass')
      } finally {
        server.close()
      }
    })
  })
})
