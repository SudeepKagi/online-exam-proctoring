const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { matchTelemetry, normalizeExeName } = require('../src/matcher')

describe('Rule Matcher Engine & False-Positive Elimination Corpus (Prompt 4 §3.4)', () => {
  const SEED_RULES = [
    { id: 'r-remote-anydesk', category: 'REMOTE_ACCESS', name: 'AnyDesk Remote Desktop', matchers: { type: 'exeName', value: 'anydesk' }, enabled: true },
    { id: 'r-remote-teamviewer', category: 'REMOTE_ACCESS', name: 'TeamViewer Remote Control', matchers: { type: 'exeName', value: 'teamviewer' }, enabled: true },
    { id: 'r-capture-obs64', category: 'SCREEN_CAPTURE', name: 'OBS Studio (64-bit)', matchers: { type: 'exeName', value: 'obs64' }, enabled: true },
    { id: 'r-ai-claude', category: 'AI_ASSISTANT', name: 'Claude Desktop Assistant', matchers: { type: 'exeName', value: 'claude' }, enabled: true },
    { id: 'r-ai-cursor', category: 'AI_ASSISTANT', name: 'Cursor AI IDE', matchers: { type: 'exeName', value: 'cursor' }, enabled: true },
    { id: 'r-ai-ollama', category: 'AI_ASSISTANT', name: 'Ollama LLM Server', matchers: { type: 'exeName', value: 'ollama' }, enabled: true },
    { id: 'r-session-rdpclip', category: 'REMOTE_SESSION', name: 'Inbound Remote Desktop Session (rdpclip)', matchers: { type: 'exeName', value: 'rdpclip' }, enabled: true },
    { id: 'r-session-mstsc', category: 'REMOTE_SESSION', name: 'Outbound Remote Desktop Client (mstsc)', matchers: { type: 'exeName', value: 'mstsc' }, enabled: true },
    { id: 'r-vcam-obs', category: 'VIRTUAL_CAMERA', name: 'OBS Virtual Camera Driver', matchers: { type: 'deviceName', value: 'obs virtual camera' }, enabled: true },
    { id: 'r-vcam-manycam', category: 'VIRTUAL_CAMERA', name: 'ManyCam Virtual Webcam', matchers: { type: 'deviceName', value: 'manycam' }, enabled: true },
    { id: 'r-vm-detected', category: 'VIRTUAL_MACHINE', name: 'Virtual Machine Environment', matchers: {}, enabled: true },
    { id: 'r-display-multi', category: 'DISPLAY', name: 'Multiple Display Monitors', matchers: {}, enabled: true }
  ]

  // ── 1. Positive Corpus: Matches genuine violations ──
  describe('Positive Corpus (Seed Rule Matches)', () => {
    it('detects prohibited remote access tools by exact executable name', () => {
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['chrome', 'anydesk', 'explorer']),
          displayCount: 1,
          cameraNames: ['Integrated Webcam'],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      assert.equal(res.findings.length, 1)
      assert.equal(res.findings[0].ruleId, 'r-remote-anydesk')
    })

    it('detects screen recording software (OBS 64-bit)', () => {
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['obs64', 'spotify']),
          displayCount: 1,
          cameraNames: ['Integrated Webcam'],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      assert.equal(res.findings.length, 1)
      assert.equal(res.findings[0].ruleId, 'r-capture-obs64')
    })

    it('detects virtual webcam hardware drivers by device friendly name', () => {
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['chrome']),
          displayCount: 1,
          cameraNames: ['OBS Virtual Camera', 'FaceTime HD Camera'],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      assert.equal(res.cameras.virtual.length, 1)
      assert.equal(res.cameras.virtual[0], 'OBS Virtual Camera')
      assert.ok(res.findings.some(f => f.ruleId === 'r-vcam-obs' || f.evidence?.includes('Virtual')))
    })

    it('detects virtual machine hypervisors and multiple displays', () => {
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['chrome']),
          displayCount: 2,
          cameraNames: ['Integrated Webcam'],
          vmIndicators: ['virtualbox']
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      const ruleIds = res.findings.map(f => f.ruleId)
      assert.ok(ruleIds.includes('r-vm-detected'))
      assert.ok(ruleIds.includes('r-display-multi'))
    })
  })

  // ── 2. Negative Corpus: Eliminates Legacy False Positives (G-03) ──
  describe('Negative Corpus (False Positive Defect G-03 Elimination)', () => {
    it('does NOT trigger r-ai-claude when student username is "claude" in path', () => {
      // In legacy agent: line.includes('claude') matched "C:\Users\claude\AppData\Local\Google\Chrome.exe"
      // In new agent: process base name is 'chrome', which never equals 'claude'
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['chrome', 'code', 'explorer', 'svchost']),
          displayCount: 1,
          cameraNames: ['Integrated Webcam'],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      const ruleIds = res.findings.map(f => f.ruleId)
      assert.ok(!ruleIds.includes('r-ai-claude'), 'Must not match user named claude')
    })

    it('does NOT trigger r-ai-cursor when a project directory path contains "cursor"', () => {
      // Legacy agent matched path: "c:\projects\cursor-animation\build\app.exe"
      // New agent matches basename 'app', which does not equal 'cursor'
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['app', 'node', 'terminal']),
          displayCount: 1,
          cameraNames: ['Integrated Webcam'],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      const ruleIds = res.findings.map(f => f.ruleId)
      assert.ok(!ruleIds.includes('r-ai-cursor'), 'Must not match path containing cursor')
    })

    it('does NOT trigger false alarms on Windows svchost or standard system processes', () => {
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['svchost', 'csrss', 'smss', 'lsass', 'services', 'winlogon', 'dwm']),
          displayCount: 1,
          cameraNames: ['Integrated Webcam'],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      assert.equal(res.findings.length, 0, 'Clean system processes must produce zero findings')
    })

    it('does NOT trigger remote access when words contain "vnc" as substring (e.g. unrelated tools)', () => {
      // Legacy agent: 'vnc' substring matched words like 'advanced' or 'vnc_notes'
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['advanced_calc', 'vnc_doc_viewer']),
          displayCount: 1,
          cameraNames: [],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      assert.equal(res.findings.length, 0, 'Substring vnc matches must not falsely flag')
    })

    it('documents known architectural limitation: renamed copy gap', () => {
      // An unprivileged user who renames anydesk.exe to notepad.exe cannot be detected
      // solely by executable base name without deeper hash/Authenticode inspection
      const collectorOutput = {
        ok: true,
        data: {
          processes: new Set(['notepad']), // Renamed anydesk
          displayCount: 1,
          cameraNames: [],
          vmIndicators: []
        }
      }

      const res = matchTelemetry(collectorOutput, SEED_RULES)
      // Acknowledged threat model boundary: base name equality cannot catch renamed binary
      assert.equal(res.findings.length, 0)
    })
  })
})
