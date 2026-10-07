process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const crypto = require('crypto')

const { app } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { ROLES } = require('../src/shared/roles')
const { computeReportSignature, verifyPolicySignature } = require('../src/utils/encryption')
const { agentSessionService } = require('../src/modules/agent/agentSessionService')
const { policyService } = require('../src/modules/agent/policyService')
const { agentSweeper } = require('../src/modules/agent/sweeper')
const { attemptRepository } = require('../src/modules/attempts/repository')

let server
let baseUrl

let facultyA, facultyB
let facultyAToken, facultyBToken
let adminUser, adminToken
let dept

const createdStudentIds = []
const createdExamIds = []

async function apiRequest(method, path, token, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const payload = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null

    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          let parsed
          try {
            parsed = JSON.parse(data)
          } catch {
            parsed = data
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          })
        })
      }
    )

    req.on('error', reject)
    if (payload) {
      req.write(payload)
    }
    req.end()
  })
}

async function createFixture(policy = 'REQUIRED', status = 'READY', studentName = 'Test Student') {
  const student = await prisma.student.create({
    data: {
      id: crypto.randomUUID(),
      name: studentName,
      email: `stu-${crypto.randomBytes(6).toString('hex')}@test.edu`,
      usn: `USN-${crypto.randomBytes(6).toString('hex')}`,
      departmentCode: dept.code,
      password: 'dummy'
    }
  })
  createdStudentIds.push(student.id)
  const token = signToken({ id: student.id, role: ROLES.STUDENT, email: student.email })

  const exam = await prisma.exam.create({
    data: {
      id: crypto.randomUUID(),
      title: `Exam ${policy} ${crypto.randomBytes(4).toString('hex')}`,
      subject: 'Computer Science',
      facultyId: facultyA.id,
      status: 'PUBLISHED',
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() + 7200000),
      duration: 60,
      invId: `INV-${crypto.randomBytes(6).toString('hex')}`,
      invPasswordHash: 'hash',
      deviceAgentPolicy: policy
    }
  })
  createdExamIds.push(exam.id)

  const attempt = await prisma.examAttempt.create({
    data: {
      id: crypto.randomUUID(),
      examId: exam.id,
      studentId: student.id,
      status,
      watermarkSeed: 'seed' + Date.now(),
      startedAt: status === 'ACTIVE' ? new Date() : null
    }
  })

  return { student, token, exam, attempt }
}

describe('Exam Device Companion Server Module (Prompt 4 Phase A1)', () => {
  before(async () => {
    // Start HTTP server on dynamic port
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Setup Department
    dept = await prisma.department.upsert({
      where: { code: 'CS_AGENT_TEST' },
      update: {},
      create: { code: 'CS_AGENT_TEST', name: 'Computer Science Agent Testing' }
    })

    // Setup Faculty & Admin
    facultyA = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Faculty Agent A',
        email: `fac-a-${Date.now()}@test.edu`,
        employeeId: `EMP-A-${Date.now()}`,
        departmentCode: dept.code,
        password: 'dummy'
      }
    })
    facultyAToken = signToken({ id: facultyA.id, role: ROLES.FACULTY, email: facultyA.email })

    facultyB = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Faculty Agent B',
        email: `fac-b-${Date.now()}@test.edu`,
        employeeId: `EMP-B-${Date.now()}`,
        departmentCode: dept.code,
        password: 'dummy'
      }
    })
    facultyBToken = signToken({ id: facultyB.id, role: ROLES.FACULTY, email: facultyB.email })

    adminUser = await prisma.admin.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Admin Agent Test',
        email: `admin-${Date.now()}@test.edu`,
        password: 'dummy'
      }
    })
    adminToken = signToken({ id: adminUser.id, role: ROLES.ADMIN, email: adminUser.email })

    // Seed agent rules
    await policyService.seedRulesIfEmpty()

    // Ensure clean releases table for integration tests
    await prisma.agentRelease.deleteMany({}).catch(() => {})
  })

  after(async () => {
    agentSweeper.stop()
    agentSessionService.clearHotSessions()

    // Cleanup attempts, findings, sessions, waivers
    for (const examId of createdExamIds) {
      const attempts = await prisma.examAttempt.findMany({ where: { examId }, select: { id: true } }).catch(() => [])
      const attemptIds = (attempts || []).map(a => a.id)
      if (attemptIds.length > 0) {
        await prisma.agentFinding.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.agentSession.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.agentPairing.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.deviceAgentWaiver.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.violationEvent.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.auditLog.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
      }
      await prisma.examAttempt.deleteMany({ where: { examId } }).catch(() => {})
      await prisma.exam.deleteMany({ where: { id: examId } }).catch(() => {})
    }

    for (const studentId of createdStudentIds) {
      await prisma.agentPairing.deleteMany({ where: { studentId } }).catch(() => {})
      await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => {})
    }

    if (facultyA) await prisma.faculty.deleteMany({ where: { id: facultyA.id } }).catch(() => {})
    if (facultyB) await prisma.faculty.deleteMany({ where: { id: facultyB.id } }).catch(() => {})
    if (adminUser) await prisma.admin.deleteMany({ where: { id: adminUser.id } }).catch(() => {})
    await prisma.agentRelease.deleteMany({}).catch(() => {})

    if (server) await new Promise((res) => server.close(res))
    setTimeout(() => process.exit(0), 1000).unref()
  })

  // ── 1. Pairing Tests ──
  describe('Pairing Flow (Code Generation, Peppered Hash, Single Use, Rate Limits)', () => {
    let fix

    before(async () => {
      fix = await createFixture('REQUIRED', 'READY')
    })

    it('generates an 8-character Crockford pairing code for an attempt (happy path)', async () => {
      const res = await apiRequest('POST', `/api/v1/attempts/${fix.attempt.id}/agent/pairing-code`, fix.token)
      assert.equal(res.status, 201)
      assert.ok(res.body.code, 'Pairing code present')
      assert.equal(res.body.code.length, 8, '8 characters')
      assert.match(res.body.code, /^[2-9A-HJ-NP-Z]{8}$/, 'Crockford charset')
      assert.equal(res.body.scope, 'ATTEMPT')
      assert.ok(res.body.expiresAt)
    })

    it('pairs companion agent using code and returns session credentials + signed policy', async () => {
      // 1. Generate code
      const codeRes = await apiRequest('POST', `/api/v1/attempts/${fix.attempt.id}/agent/pairing-code`, fix.token)
      assert.equal(codeRes.status, 201)
      const code = codeRes.body.code

      // 2. Pair
      const pairRes = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code,
        agentVersion: '1.0.0',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-hash-a1',
        deviceId: 'device-win-101'
      })

      assert.equal(pairRes.status, 200, JSON.stringify(pairRes.body))
      assert.ok(pairRes.body.sessionToken, 'sessionToken returned')
      assert.ok(pairRes.body.sessionKey, 'sessionKey returned')
      assert.ok(pairRes.body.policy, 'policy bundle returned')
      assert.equal(pairRes.body.heartbeatMs, 15000)
      assert.ok(pairRes.body.serverTime)

      // Verify Ed25519 signature on policy bundle
      const { signature, publicKey, ...unsignedBundle } = pairRes.body.policy
      assert.ok(signature, 'Policy signature exists')
      assert.ok(publicKey, 'Policy public key exists')
      const isSigValid = verifyPolicySignature(unsignedBundle, signature, publicKey)
      assert.equal(isSigValid, true, 'Policy signature cryptographically verified')
    })

    it('prevents code reuse: consuming the pairing code a second time returns 409 Conflict', async () => {
      const codeRes = await apiRequest('POST', `/api/v1/attempts/${fix.attempt.id}/agent/pairing-code`, fix.token)
      const code = codeRes.body.code

      // First pair: 200 OK
      const pair1 = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code,
        agentVersion: '1.0.0',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-hash-a1'
      })
      assert.equal(pair1.status, 200)

      // Replay pair: 409 Conflict
      const pair2 = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code,
        agentVersion: '1.0.0',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-hash-a1'
      })
      assert.equal(pair2.status, 409, 'Replay rejected with 409')
    })

    it('rejects outdated agent versions (< 1.0.0) with 400 Bad Request', async () => {
      const codeRes = await apiRequest('POST', `/api/v1/attempts/${fix.attempt.id}/agent/pairing-code`, fix.token)
      const code = codeRes.body.code

      const pairRes = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code,
        agentVersion: '0.8.2',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-hash-a1'
      })
      assert.equal(pairRes.status, 400)
      assert.match(pairRes.body.error?.message || pairRes.body.message, /outdated/i)
    })

    it('enforces pairing code rate limit per student (max 5 active codes)', async () => {
      const rateLimitFix = await createFixture('REQUIRED', 'READY')
      for (let i = 0; i < 5; i++) {
        const res = await apiRequest('POST', `/api/v1/student/agent/pairing-code`, rateLimitFix.token)
        assert.equal(res.status, 201)
      }

      // 6th request fails with 429
      const sixth = await apiRequest('POST', `/api/v1/student/agent/pairing-code`, rateLimitFix.token)
      assert.equal(sixth.status, 429, 'Rate limit triggered')
    })
  })

  // ── 2. Report Authentication & Security Rules ──
  describe('Report Authentication & Security Rules (HMAC, Seq, Skew, Replay, Privacy)', () => {
    let fix
    let sessionToken
    let sessionKey
    let seqCounter = 0

    before(async () => {
      fix = await createFixture('REQUIRED', 'READY')
      const codeRes = await apiRequest('POST', `/api/v1/attempts/${fix.attempt.id}/agent/pairing-code`, fix.token)
      assert.equal(codeRes.status, 201)

      const pairRes = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code: codeRes.body.code,
        agentVersion: '1.0.0',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-hash-report'
      })
      assert.equal(pairRes.status, 200, JSON.stringify(pairRes.body))
      sessionToken = pairRes.body.sessionToken
      sessionKey = pairRes.body.sessionKey
    })

    function signReport(body, seq, ts, nonce) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      const signature = computeReportSignature(
        sessionKey,
        'POST',
        '/api/v1/agent/report',
        seq,
        ts,
        nonce,
        bodyStr
      )
      return {
        'x-agent-session': sessionToken,
        'x-agent-seq': String(seq),
        'x-agent-ts': String(ts),
        'x-agent-nonce': nonce,
        'x-agent-signature': signature
      }
    }

    it('accepts valid HMAC-signed telemetry report with sequential sequence number', async () => {
      seqCounter += 1
      const body = {
        seq: seqCounter,
        findings: [],
        display: { count: 1 },
        session: { remote: false },
        vm: { indicators: [] },
        cameras: { virtual: [] },
        collection: { ok: true, errors: [] }
      }
      const headers = signReport(body, seqCounter, Date.now(), crypto.randomBytes(8).toString('hex'))

      const res = await apiRequest('POST', '/api/v1/agent/report', null, body, headers)
      assert.equal(res.status, 200)
      assert.equal(res.body.ok, true)
      assert.equal(res.body.nextHeartbeatMs, 15000)
    })

    it('rejects report with invalid HMAC signature with 401 Unauthorized', async () => {
      seqCounter += 1
      const body = { seq: seqCounter, findings: [] }
      const headers = signReport(body, seqCounter, Date.now(), crypto.randomBytes(8).toString('hex'))
      // Tamper signature
      headers['x-agent-signature'] = 'tampered-signature-base64=='

      const res = await apiRequest('POST', '/api/v1/agent/report', null, body, headers)
      assert.equal(res.status, 401)
    })

    it('rejects clock skew exceeding 60 seconds with 400 CLOCK_SKEW and serverTime', async () => {
      seqCounter += 1
      const body = { seq: seqCounter, findings: [] }
      const skewedTs = Date.now() - 120000 // 2 minutes in past
      const headers = signReport(body, seqCounter, skewedTs, crypto.randomBytes(8).toString('hex'))

      const res = await apiRequest('POST', '/api/v1/agent/report', null, body, headers)
      assert.equal(res.status, 400)
      assert.equal(res.body.error, 'CLOCK_SKEW')
      assert.ok(res.body.serverTime)
    })

    it('rejects non-monotonic sequence numbers (seq <= lastSeq) with 409 Conflict', async () => {
      // Replay an earlier sequence number (<= lastSeq, which is 1)
      const nonMonotonicSeq = 1
      const body = { seq: nonMonotonicSeq, findings: [] }
      const headers = signReport(body, nonMonotonicSeq, Date.now(), crypto.randomBytes(8).toString('hex'))

      const res = await apiRequest('POST', '/api/v1/agent/report', null, body, headers)
      assert.equal(res.status, 409)
      assert.match(res.body.error?.message || res.body.message, /sequence number/i)
    })

    it('rejects replayed nonce with 409 Conflict', async () => {
      seqCounter += 1
      const body = { seq: seqCounter, findings: [] }
      const nonce = crypto.randomBytes(8).toString('hex')
      const headers1 = signReport(body, seqCounter, Date.now(), nonce)

      // First submit: 200 OK
      const res1 = await apiRequest('POST', '/api/v1/agent/report', null, body, headers1)
      assert.equal(res1.status, 200)

      // Replay same nonce with next seq
      seqCounter += 1
      const body2 = { seq: seqCounter, findings: [] }
      const headers2 = signReport(body2, seqCounter, Date.now(), nonce)

      const res2 = await apiRequest('POST', '/api/v1/agent/report', null, body2, headers2)
      assert.equal(res2.status, 409)
      assert.match(res2.body.error?.message || res2.body.message, /replay detected/i)
    })

    it('strictly enforces privacy contract: rejects payload containing forbidden keys (processes)', async () => {
      seqCounter += 1
      const forbiddenBody = {
        seq: seqCounter,
        findings: [],
        processes: ['cmd.exe', 'explorer.exe'] // Forbidden!
      }
      const headers = signReport(forbiddenBody, seqCounter, Date.now(), crypto.randomBytes(8).toString('hex'))

      const res = await apiRequest('POST', '/api/v1/agent/report', null, forbiddenBody, headers)
      assert.equal(res.status, 400)
      assert.match(res.body.error?.message || res.body.message || JSON.stringify(res.body), /privacy contract violation/i)
    })
  })

  // ── 3. Finding Lifecycle & State Machine Transitions ──
  describe('Finding Lifecycle (Open -> Dedupe -> Clear -> Auto-Resume)', () => {
    let fix
    let sessionToken
    let sessionKey
    let seq = 0

    before(async () => {
      fix = await createFixture('REQUIRED', 'ACTIVE')

      const codeRes = await apiRequest('POST', `/api/v1/attempts/${fix.attempt.id}/agent/pairing-code`, fix.token)
      assert.equal(codeRes.status, 201)

      const pairRes = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code: codeRes.body.code,
        agentVersion: '1.0.0',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-lifecycle'
      })
      assert.equal(pairRes.status, 200, JSON.stringify(pairRes.body))
      sessionToken = pairRes.body.sessionToken
      sessionKey = pairRes.body.sessionKey
    })

    function sendReport(findings) {
      seq += 1
      const body = {
        seq,
        findings,
        display: { count: 1 },
        session: { remote: false },
        vm: { indicators: [] },
        cameras: { virtual: [] }
      }
      const bodyStr = JSON.stringify(body)
      const nonce = crypto.randomBytes(8).toString('hex')
      const ts = Date.now()
      const signature = computeReportSignature(sessionKey, 'POST', '/api/v1/agent/report', seq, ts, nonce, bodyStr)
      return apiRequest('POST', '/api/v1/agent/report', null, body, {
        'x-agent-session': sessionToken,
        'x-agent-seq': String(seq),
        'x-agent-ts': String(ts),
        'x-agent-nonce': nonce,
        'x-agent-signature': signature
      })
    }

    it('opens new finding, creates ViolationEvent, and transitions ACTIVE attempt to SUSPENDED', async () => {
      // Send finding for AnyDesk (Action: SUSPEND)
      const res = await sendReport([{ ruleId: 'r-remote-anydesk', evidence: 'anydesk.exe' }])
      assert.equal(res.status, 200)

      // Verify finding in DB
      const finding = await prisma.agentFinding.findFirst({
        where: { ruleId: 'r-remote-anydesk', attemptId: fix.attempt.id }
      })
      assert.ok(finding, 'AgentFinding recorded')
      assert.equal(finding.hitCount, 1)
      assert.equal(finding.clearedAt, null)

      // Verify ViolationEvent recorded
      const violation = await prisma.violationEvent.findFirst({
        where: { attemptId: fix.attempt.id, eventType: 'REMOTE_SESSION_DETECTED' }
      })
      assert.ok(violation, 'ViolationEvent created')

      // Verify attempt transitioned to SUSPENDED via state machine
      const attempt = await prisma.examAttempt.findUnique({ where: { id: fix.attempt.id } })
      assert.equal(attempt.status, 'SUSPENDED', 'Attempt was suspended')
      assert.match(attempt.statusReason, /AGENT_RULE_TRIGGERED/i)
    })

    it('clears finding after 2 consecutive clean reports and auto-resumes attempt', async () => {
      // 1st clean report
      const clean1 = await sendReport([])
      assert.equal(clean1.status, 200)

      // Finding still open
      let finding = await prisma.agentFinding.findFirst({
        where: { ruleId: 'r-remote-anydesk', attemptId: fix.attempt.id }
      })
      assert.equal(finding.clearedAt, null, 'Not cleared on 1st clean report')

      // 2nd clean report
      const clean2 = await sendReport([])
      assert.equal(clean2.status, 200)

      // Finding now cleared
      finding = await prisma.agentFinding.findFirst({
        where: { ruleId: 'r-remote-anydesk', attemptId: fix.attempt.id }
      })
      assert.ok(finding.clearedAt !== null, 'Finding marked cleared on 2nd clean report')

      // Attempt auto-resumed back to ACTIVE!
      const attempt = await prisma.examAttempt.findUnique({ where: { id: fix.attempt.id } })
      assert.equal(attempt.status, 'ACTIVE', 'Attempt auto-resumed to ACTIVE')
    })
  })

  // ── 4. Enforcement Hooks & Waivers ──
  describe('Enforcement Hooks & Staff Waivers (REQUIRED vs OPTIONAL vs Waiver)', () => {
    let fixReq
    let fixOpt

    before(async () => {
      fixReq = await createFixture('REQUIRED', 'READY', 'Student Hook Req')
      fixOpt = await createFixture('OPTIONAL', 'READY', 'Student Hook Opt')
    })

    it('blocks start for REQUIRED exam when no companion agent is paired', async () => {
      // Attempt activation should fail (return null) because policy is REQUIRED and no session exists
      const activated = await attemptRepository.activateReadyAttempt(fixReq.exam.id, fixReq.student.id)
      assert.equal(activated, null, 'SQL guard blocked activation without companion session')
    })

    it('allows start for OPTIONAL exam without companion agent', async () => {
      const activated = await attemptRepository.activateReadyAttempt(fixOpt.exam.id, fixOpt.student.id)
      assert.ok(activated, 'Activation succeeded for OPTIONAL exam')
      assert.equal(activated.status, 'ACTIVE')
    })

    it('allows start for REQUIRED exam when audited staff waiver is granted', async () => {
      // Grant waiver via staff endpoint
      const waiverRes = await apiRequest(
        'POST',
        `/api/v1/staff/attempts/${fixReq.attempt.id}/agent/waiver`,
        facultyAToken,
        { reason: 'Lab hardware temporary exception authorized by instructor' }
      )
      assert.equal(waiverRes.status, 200)
      assert.equal(waiverRes.body.success, true)

      // Now activateReadyAttempt succeeds!
      const activated = await attemptRepository.activateReadyAttempt(fixReq.exam.id, fixReq.student.id)
      assert.ok(activated, 'Activation succeeded with staff waiver')
      assert.equal(activated.status, 'ACTIVE')
    })
  })

  // ── 5. Sweeper (Stale Disconnect -> Suspend -> Reconnect) ──
  describe('Sweeper & Heartbeat Disconnect Detection', () => {
    let sweepFix
    let sessionToken
    let sessionKey
    let seq = 0

    before(async () => {
      sweepFix = await createFixture('REQUIRED', 'ACTIVE', 'Student Sweeper')

      const codeRes = await apiRequest('POST', `/api/v1/attempts/${sweepFix.attempt.id}/agent/pairing-code`, sweepFix.token)
      assert.equal(codeRes.status, 201)

      const pairRes = await apiRequest('POST', '/api/v1/agent/pair', null, {
        code: codeRes.body.code,
        agentVersion: '1.0.0',
        os: 'win',
        arch: 'x64',
        buildHash: 'test-build-sweeper'
      })
      assert.equal(pairRes.status, 200)
      sessionToken = pairRes.body.sessionToken
      sessionKey = pairRes.body.sessionKey
    })

    it('sweeper transitions session to STALE and attempt to SUSPENDED when heartbeat elapsed > 60s', async () => {
      const session = await agentSessionService.getSessionByToken(sessionToken)
      assert.ok(session)

      // Simulate heartbeat timestamp in past (70 seconds ago)
      session.lastSeenAt = Date.now() - 70000

      // Run one sweep cycle with 60s threshold
      await agentSweeper.sweep(60000)

      // Verify session became STALE
      assert.equal(session.state, 'STALE')

      // Verify attempt transitioned to SUSPENDED with reason AGENT_STALE
      const attempt = await prisma.examAttempt.findUnique({ where: { id: sweepFix.attempt.id } })
      assert.equal(attempt.status, 'SUSPENDED')
      assert.equal(attempt.statusReason, 'AGENT_STALE')

      // Verify AGENT_DISCONNECTED violation
      const violation = await prisma.violationEvent.findFirst({
        where: { attemptId: sweepFix.attempt.id, eventType: 'AGENT_DISCONNECTED' }
      })
      assert.ok(violation, 'AGENT_DISCONNECTED violation emitted')
    })

    it('auto-resumes attempt when disconnected agent reconnects with a fresh clean report', async () => {
      seq += 1
      const body = {
        seq,
        findings: [],
        display: { count: 1 },
        session: { remote: false },
        vm: { indicators: [] },
        cameras: { virtual: [] }
      }
      const bodyStr = JSON.stringify(body)
      const nonce = crypto.randomBytes(8).toString('hex')
      const ts = Date.now()
      const signature = computeReportSignature(sessionKey, 'POST', '/api/v1/agent/report', seq, ts, nonce, bodyStr)

      const res = await apiRequest('POST', '/api/v1/agent/report', null, body, {
        'x-agent-session': sessionToken,
        'x-agent-seq': String(seq),
        'x-agent-ts': String(ts),
        'x-agent-nonce': nonce,
        'x-agent-signature': signature
      })
      assert.equal(res.status, 200)

      // Attempt auto-resumed back to ACTIVE!
      const attempt = await prisma.examAttempt.findUnique({ where: { id: sweepFix.attempt.id } })
      assert.equal(attempt.status, 'ACTIVE')
      assert.equal(attempt.statusReason, 'AGENT_RECONNECTED')
    })
  })

  // ── 6. BOLA Cross-Tenant Security Matrix ──
  describe('BOLA Cross-Tenant Security Matrix', () => {
    let fixA, fixB

    before(async () => {
      fixA = await createFixture('REQUIRED', 'READY', 'Student BOLA A')
      fixB = await createFixture('REQUIRED', 'READY', 'Student BOLA B')
    })

    it('rejects student B generating pairing code for student A attempt with 403 Forbidden', async () => {
      const res = await apiRequest('POST', `/api/v1/attempts/${fixA.attempt.id}/agent/pairing-code`, fixB.token)
      assert.equal(res.status, 403)
      assert.match(res.body.error?.message || res.body.message, /only generate pairing codes for your own/i)
    })

    it('rejects student B viewing companion status for student A attempt with 403 Forbidden', async () => {
      const res = await apiRequest('GET', `/api/v1/attempts/${fixA.attempt.id}/agent/status`, fixB.token)
      assert.equal(res.status, 403)
      assert.match(res.body.error?.message || res.body.message, /only view companion status for your own/i)
    })

    it('rejects faculty B granting waiver for faculty A exam attempt with 403 Forbidden', async () => {
      const res = await apiRequest(
        'POST',
        `/api/v1/staff/attempts/${fixA.attempt.id}/agent/waiver`,
        facultyBToken,
        { reason: 'Unauthorized waiver attempt' }
      )
      assert.equal(res.status, 403)
      assert.match(res.body.error?.message || res.body.message, /only grant waivers for exams you own/i)
    })
  })

  after(async () => {
    agentSweeper.stop()
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    process.exit(0)
  })
})
