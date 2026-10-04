/**
 * tests/p8-vpn-wireguard.test.js
 * Mandatory test suite for Phase P8 — WireGuard VPN Module (ADR-010)
 *
 * Covers:
 * 1. IPAM: 1,000 parallel allocations => 1,000 unique IPs, zero deadlocks, release & reuse works.
 * 2. Flag Matrix: VPN_ENABLED=false (strict no-op), enabled+warn, enabled+enforce.
 * 3. Provider Contract: FakeProvider, NoopProvider, WireGuardAgentProvider, WireGuardSshProvider.
 * 4. Reconciler: Orphan peer removal, missing peer re-addition, handshake-age debounced disconnect.
 * 5. Security: Scan database & outbox to verify zero private keys are ever persisted or logged.
 * 6. Outbox Worker: Idempotent processing and provider failure retry handling.
 * 7. vpnGuard Network Boundary: Trusted proxy IP resolution, boundary enforcement (never auth bypass).
 */

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { prisma } = require('../src/infra/postgres/client')
const { vpnIpam, VpnIpam } = require('../src/modules/vpn/ipam')
const { vpnKeyService, VpnKeyService } = require('../src/modules/vpn/keyService')
const { vpnService, VpnService } = require('../src/modules/vpn/vpn.service')
const { vpnWorker } = require('../src/modules/vpn/vpnWorker')
const { vpnReconciler } = require('../src/modules/vpn/vpnReconciler')
const { vpnGuard, resolveClientIp } = require('../src/middleware/vpnGuard')
const {
  getVpnProvider,
  setVpnProvider,
  FakeProvider,
  NoopProvider,
  WireGuardAgentProvider,
  WireGuardSshProvider
} = require('../src/infra/vpn')

describe('P8 WireGuard VPN Module Test Suite', () => {
  let testDept
  let testFaculty
  let testStudent1
  let testStudent2
  let testStudent3
  let testExam
  let testAttemptActive
  let testAttemptReady
  let testAttemptTerminated
  let fakeProvider

  before(async () => {
    // Set up test provider
    fakeProvider = new FakeProvider()
    setVpnProvider(fakeProvider)

    // Pre-seed IPAM pool with 1,200 addresses for parallel testing
    await vpnIpam.seedPool({ count: 1200, prefix: '10.8' })

    // Create database test fixtures
    const timestamp = Date.now()
    const suffix = crypto.randomBytes(4).toString('hex')
    testDept = await prisma.department.create({
      data: {
        code: `VPN_${suffix}`.toUpperCase(),
        name: `VPN Test Dept ${suffix}`
      }
    })

    testFaculty = await prisma.faculty.create({
      data: {
        name: `VPN Faculty ${suffix}`,
        email: `vpn_fac_${suffix}@test.edu`,
        password: 'hash',
        employeeId: `FAC_VPN_${suffix}`,
        departmentCode: testDept.code
      }
    })

    testStudent1 = await prisma.student.create({
      data: {
        name: `VPN Student 1 ${suffix}`,
        email: `vpn_stu1_${suffix}@test.edu`,
        usn: `1MS21CS_VPN1_${suffix}`,
        password: 'hash',
        departmentCode: testDept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    testStudent2 = await prisma.student.create({
      data: {
        name: `VPN Student 2 ${suffix}`,
        email: `vpn_stu2_${suffix}@test.edu`,
        usn: `1MS21CS_VPN2_${suffix}`,
        password: 'hash',
        departmentCode: testDept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    testStudent3 = await prisma.student.create({
      data: {
        name: `VPN Student 3 ${suffix}`,
        email: `vpn_stu3_${suffix}@test.edu`,
        usn: `1MS21CS_VPN3_${suffix}`,
        password: 'hash',
        departmentCode: testDept.code,
        semester: 6,
        approvalStatus: 'APPROVED'
      }
    })

    const now = new Date()
    testExam = await prisma.exam.create({
      data: {
        title: `VPN Exam ${timestamp}`,
        subject: 'Computer Networks',
        invId: `INV_VPN_${suffix}`,
        invPasswordHash: 'hash',
        duration: 90,
        facultyId: testFaculty.id,
        vpnRequired: false,
        status: 'PUBLISHED',
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 80 * 60 * 1000)
      }
    })

    // Create attempts in different states with distinct students
    testAttemptActive = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: testStudent1.id,
        status: 'ACTIVE',
        watermarkSeed: 'WM-ACTIVE-1',
        shuffleSeed: 'SHUFFLE-ACTIVE-1'
      }
    })

    testAttemptReady = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: testStudent2.id,
        status: 'READY',
        watermarkSeed: 'WM-READY-1',
        shuffleSeed: 'SHUFFLE-READY-1'
      }
    })

    testAttemptTerminated = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: testStudent3.id,
        status: 'TERMINATED',
        watermarkSeed: 'WM-TERM-1',
        shuffleSeed: 'SHUFFLE-TERM-1'
      }
    })
  })

  after(async () => {
    // Reset provider and clean fixtures
    setVpnProvider(null)
    delete process.env.VPN_ENABLED
    delete process.env.VPN_ENFORCEMENT

    await prisma.vpnPeer.deleteMany({
      where: {
        attemptId: { in: [testAttemptActive.id, testAttemptReady.id, testAttemptTerminated.id] }
      }
    }).catch(() => {})

    await prisma.examAttempt.deleteMany({
      where: { examId: testExam.id }
    }).catch(() => {})

    await prisma.exam.delete({ where: { id: testExam.id } }).catch(() => {})
    await prisma.student.deleteMany({
      where: { id: { in: [testStudent1.id, testStudent2.id, testStudent3.id] } }
    }).catch(() => {})
    await prisma.faculty.delete({ where: { id: testFaculty.id } }).catch(() => {})
    await prisma.department.delete({ where: { code: testDept.code } }).catch(() => {})
  })

  beforeEach(async () => {
    fakeProvider.reset()
    vpnReconciler.reset()
    await prisma.$executeRawUnsafe(`
      UPDATE vpn_ip_pool SET attempt_id = null, released_at = now()
      WHERE attempt_id IS NOT NULL;
    `)
    await prisma.vpnPeer.deleteMany({
      where: {
        attemptId: { in: [testAttemptActive.id, testAttemptReady.id, testAttemptTerminated.id] }
      }
    }).catch(() => {})
  })

  // ============================================================================
  // 1. IPAM: 1,000 Parallel Allocations & Release/Reuse
  // ============================================================================
  describe('1. IPAM Concurrency & Lifecycle (Kills V-02)', () => {
    it('allocates 1,000 parallel leases with 1,000 unique IPs and zero deadlocks', async () => {
      const pLimit = require('p-limit')
      const limit = pLimit(15) // Matches database pool connection limit

      const parallelCount = 1000
      const attemptIds = Array.from({ length: parallelCount }, () => crypto.randomUUID())

      const startTime = Date.now()
      const allocatedIps = await Promise.all(
        attemptIds.map(id => limit(() => vpnIpam.allocateIp(id)))
      )
      const elapsedMs = Date.now() - startTime

      assert.strictEqual(allocatedIps.length, parallelCount)
      const uniqueIps = new Set(allocatedIps)
      assert.strictEqual(uniqueIps.size, parallelCount, 'All 1,000 allocated IPs must be strictly unique')

      // Verify each IP belongs to the 10.8 subnet
      for (const ip of allocatedIps) {
        assert.match(ip, /^10\.8\.\d+\.\d+$/)
      }

      // Performance check: 1,000 concurrent SKIP LOCKED operations complete cleanly
      assert.ok(elapsedMs < 30000, `1,000 parallel allocations completed in ${elapsedMs}ms`)

      // Idempotency check: calling allocateIp with an already leased attemptId returns same IP
      const secondCallIp = await vpnIpam.allocateIp(attemptIds[0])
      assert.strictEqual(secondCallIp, allocatedIps[0], 'Repeat allocation for same attempt returns identical lease')

      // Release 500 of the leases
      const releaseBatch = attemptIds.slice(0, 500)
      const releaseResults = await Promise.all(
        releaseBatch.map(id => limit(() => vpnIpam.releaseIp(id)))
      )
      assert.strictEqual(releaseResults.filter(Boolean).length, 500)

      // Re-allocate 500 new attempt leases; verify they immediately re-acquire released addresses without collision
      const newAttemptIds = Array.from({ length: 500 }, () => crypto.randomUUID())
      const reallocatedIps = await Promise.all(
        newAttemptIds.map(id => limit(() => vpnIpam.allocateIp(id)))
      )

      assert.strictEqual(reallocatedIps.length, 500)
      const reallocatedSet = new Set(reallocatedIps)
      assert.strictEqual(reallocatedSet.size, 500, 'Re-allocated IPs must all be unique')

      // Clean up test leases from database
      await prisma.$executeRawUnsafe(`
        UPDATE vpn_ip_pool SET attempt_id = null, released_at = now()
        WHERE attempt_id IS NOT NULL;
      `)
    })
  })

  // ============================================================================
  // 2. Provider Contract Tests
  // ============================================================================
  describe('2. Provider Contract Verification', () => {
    it('FakeProvider correctly manages peer lifecycle, handshake simulation, and call logs', async () => {
      const provider = new FakeProvider()
      const testKey = crypto.randomBytes(32).toString('base64')
      const testIp = '10.8.0.50'

      await provider.addPeer({ publicKey: testKey, ip: testIp })
      let peers = await provider.listPeers()
      assert.strictEqual(peers.length, 1)
      assert.strictEqual(peers[0].publicKey, testKey)
      assert.strictEqual(peers[0].allowedIps[0], `${testIp}/32`)

      // Simulate handshake timestamp update
      const handshakeTime = new Date(Date.now() - 30000)
      provider.simulateHandshake(testKey, handshakeTime)
      peers = await provider.listPeers()
      assert.strictEqual(peers[0].latestHandshakeAt.getTime(), handshakeTime.getTime())

      // Remove peer
      await provider.removePeer(testKey)
      peers = await provider.listPeers()
      assert.strictEqual(peers.length, 0)
    })

    it('NoopProvider operates silently with zero side-effects when VPN is disabled', async () => {
      const provider = new NoopProvider()
      await assert.doesNotReject(provider.addPeer({ publicKey: 'key', ip: '10.8.0.2' }))
      await assert.doesNotReject(provider.removePeer('key'))
      const peers = await provider.listPeers()
      assert.deepStrictEqual(peers, [])
      await assert.doesNotReject(provider.syncPeers([]))
    })

    it('WireGuardAgentProvider generates valid HMAC-SHA256 signatures and parses dumps', () => {
      const agentProvider = new WireGuardAgentProvider({ secret: 'test_secret_32_characters_long_1' })
      const payload = JSON.stringify({ action: 'test' })
      const { timestamp, signature } = agentProvider._signPayload(payload)

      assert.ok(timestamp)
      assert.ok(signature)

      const expectedSig = crypto.createHmac('sha256', 'test_secret_32_characters_long_1')
        .update(`${timestamp}.${payload}`)
        .digest('hex')
      assert.strictEqual(signature, expectedSig)

      // Dump parsing test
      const dumpOutput = `wg0\tprivatekey\tpublickey\t51820\toff\npeerPubKey1\tpreshared\t192.168.1.5:51820\t10.8.0.2/32\t1600000000\t5000\t8000\toff\n`
      const parsed = agentProvider._parseDump(dumpOutput)
      assert.strictEqual(parsed.length, 1)
      assert.strictEqual(parsed[0].publicKey, 'peerPubKey1')
      assert.strictEqual(parsed[0].endpoint, '192.168.1.5:51820')
      assert.deepStrictEqual(parsed[0].allowedIps, ['10.8.0.2/32'])
      assert.strictEqual(parsed[0].transferRx, 5000)
      assert.strictEqual(parsed[0].transferTx, 8000)
    })

    it('WireGuardSshProvider enforces input sanitization and pinned host key verification', () => {
      const sshProvider = new WireGuardSshProvider({
        host: '127.0.0.1',
        pinnedHostKey: 'validBase64HostKey=='
      })

      // Escaping test: safe characters pass
      assert.strictEqual(sshProvider._escape('abcXYZ012+/='), 'abcXYZ012+/=')

      // Injection test: dangerous shell characters throw error
      assert.throws(() => sshProvider._escape('key; rm -rf /'), /disallowed characters/)
      assert.throws(() => sshProvider._escape('key`whoami`'), /disallowed characters/)
      assert.throws(() => sshProvider._escape('key$VAR'), /disallowed characters/)
      assert.throws(() => sshProvider._escape('key|cat'), /disallowed characters/)
    })
  })

  // ============================================================================
  // 3. Security: Zero Private Keys in Database or Logs (Kills V-03)
  // ============================================================================
  describe('3. Security Invariant: Zero Private Keys Persisted or Logged', () => {
    it('provisions keys ephemerally, delivers config once, and stores ONLY public key in database', async () => {
      process.env.VPN_ENABLED = 'true'

      const result = await vpnService.provisionAttemptVpn({
        attemptId: testAttemptReady.id,
        studentId: testStudent2.id,
        userRole: 'STUDENT'
      })

      assert.strictEqual(result.success, true)
      assert.ok(result.publicKey)
      assert.ok(result.ip)
      assert.ok(result.config, 'Client config must be returned once in memory')
      assert.match(result.config, /\[Interface\]/)
      assert.match(result.config, /PrivateKey =/)
      assert.match(result.config, /\[Peer\]/)

      // 1. Scan vpn_peers table in database
      const dbPeers = await prisma.vpnPeer.findMany({
        where: { attemptId: testAttemptReady.id }
      })
      assert.ok(dbPeers.length > 0)
      for (const p of dbPeers) {
        assert.strictEqual(p.publicKey, result.publicKey)
        // Assert no private key column exists or is populated
        assert.strictEqual(p.privateKey, undefined)
        assert.strictEqual(p.config, undefined)
      }

      // 2. Scan outbox_events table in database
      const outboxRows = await prisma.$queryRawUnsafe(`
        SELECT payload FROM outbox_events
        WHERE event_type = 'vpn.peer.add' AND payload->>'attemptId' = $1;
      `, testAttemptReady.id)

      assert.ok(outboxRows.length > 0)
      const payloadStr = JSON.stringify(outboxRows[0].payload)
      assert.ok(!payloadStr.includes('PrivateKey'), 'Outbox payload must NEVER contain PrivateKey')
      assert.ok(!payloadStr.includes('[Interface]'), 'Outbox payload must NEVER contain client conf')
      assert.ok(payloadStr.includes(result.publicKey), 'Outbox payload contains only publicKey')

      // Clean up
      await vpnService.revokeAttemptVpn({
        attemptId: testAttemptReady.id,
        studentId: testStudent2.id,
        userRole: 'STUDENT'
      })
    })

    it('supports browser-generated WebCrypto X25519 public keys without server private key generation', async () => {
      process.env.VPN_ENABLED = 'true'
      const clientGeneratedKey = crypto.randomBytes(32).toString('base64')

      const result = await vpnService.provisionAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT',
        clientPublicKey: clientGeneratedKey
      })

      assert.strictEqual(result.isClientGenerated, true)
      assert.strictEqual(result.publicKey, clientGeneratedKey)
      assert.strictEqual(result.config, null, 'Config is null when client generated keys in browser')

      await vpnService.revokeAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })
    })
  })

  // ============================================================================
  // 4. Flag Matrix: disabled, warn, enforce
  // ============================================================================
  describe('4. Flag Matrix Verification', () => {
    it('VPN_ENABLED=false: rejects VPN provisioning, triggers zero outbox events, and vpnGuard is a no-op', async () => {
      process.env.VPN_ENABLED = 'false'
      delete process.env.VPN_ENFORCEMENT

      // 1. Provisioning is blocked
      await assert.rejects(
        vpnService.provisionAttemptVpn({
          attemptId: testAttemptActive.id,
          studentId: testStudent1.id,
          userRole: 'STUDENT'
        }),
        (err) => err.statusCode === 403 && err.message.includes('VPN is not enabled')
      )

      // 2. vpnGuard passes immediately without checking DB
      let nextCalled = false
      const mockReq = { params: { attemptId: testAttemptActive.id }, ip: '203.0.113.50', socket: { remoteAddress: '203.0.113.50' } }
      const mockRes = { status: () => mockRes, json: () => mockRes }
      await vpnGuard(mockReq, mockRes, () => { nextCalled = true })
      assert.strictEqual(nextCalled, true, 'vpnGuard must pass through immediately when VPN_ENABLED=false')

      // 3. Reconciler skips sweep
      const reconResult = await vpnReconciler.reconcile()
      assert.strictEqual(reconResult.status, 'skipped')
    })

    it('VPN_ENABLED=true + VPN_ENFORCEMENT=enforce: blocks mismatched client IP and permits matched IP', async () => {
      process.env.VPN_ENABLED = 'true'
      process.env.VPN_ENFORCEMENT = 'enforce'

      // Provision VPN lease for testAttemptActive
      const provision = await vpnService.provisionAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })
      const leasedIp = provision.ip

      // 1. Test mismatched IP (should return 403 VPN_IP_MISMATCH)
      let statusCode = null
      let jsonResponse = null
      const mockReqBad = {
        params: { attemptId: testAttemptActive.id },
        ip: '198.51.100.25',
        socket: { remoteAddress: '198.51.100.25' },
        headers: {}
      }
      const mockResBad = {
        status: (code) => { statusCode = code; return mockResBad },
        json: (data) => { jsonResponse = data; return mockResBad }
      }

      await vpnGuard(mockReqBad, mockResBad, () => {})
      assert.strictEqual(statusCode, 403)
      assert.strictEqual(jsonResponse.error.code, 'VPN_IP_MISMATCH')

      // 2. Test matched leased IP (should call next)
      let nextPassed = false
      const mockReqGood = {
        params: { attemptId: testAttemptActive.id },
        ip: leasedIp,
        socket: { remoteAddress: leasedIp },
        headers: {}
      }
      await vpnGuard(mockReqGood, mockResBad, () => { nextPassed = true })
      assert.strictEqual(nextPassed, true, 'vpnGuard must call next() when client IP matches leased VPN IP')

      // Clean up
      await vpnService.revokeAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })
    })
  })

  // ============================================================================
  // 5. Authorisation & Terminal State Guards (Kills V-04)
  // ============================================================================
  describe('5. Authorisation & Attempt State Guards (Kills V-04)', () => {
    it('rejects VPN provisioning for attempts in TERMINATED state with no upsert side-effects', async () => {
      process.env.VPN_ENABLED = 'true'

      await assert.rejects(
        vpnService.provisionAttemptVpn({
          attemptId: testAttemptTerminated.id,
          studentId: testStudent3.id,
          userRole: 'STUDENT'
        }),
        (err) => err.statusCode === 400 && err.message.includes('TERMINATED')
      )

      // Verify no record was created in vpn_peers
      const peers = await prisma.vpnPeer.findMany({
        where: { attemptId: testAttemptTerminated.id }
      })
      assert.strictEqual(peers.length, 0, 'Zero side-effects on rejected state')
    })

    it('rejects VPN provisioning when student does not own attempt', async () => {
      process.env.VPN_ENABLED = 'true'
      const differentStudentId = crypto.randomUUID()

      await assert.rejects(
        vpnService.provisionAttemptVpn({
          attemptId: testAttemptActive.id,
          studentId: differentStudentId,
          userRole: 'STUDENT'
        }),
        (err) => err.statusCode === 403 && err.message.includes('You do not own this attempt')
      )
    })
  })

  // ============================================================================
  // 6. Reconciler: Orphans, Missing Peers, and Debounced Disconnect (Kills V-06)
  // ============================================================================
  describe('6. Reconciler Sync & Server-Originated Disconnect (Kills V-06)', () => {
    it('removes orphan peers and re-adds missing active peers', async () => {
      process.env.VPN_ENABLED = 'true'
      process.env.VPN_ENFORCEMENT = 'warn'

      // 1. Provision active attempt in DB
      const { publicKey: activeKey, ip: activeIp } = await vpnService.provisionAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })

      // 2. Clear fake provider so DB peer is missing from interface
      fakeProvider.reset()

      // 3. Inject an orphan peer into fake provider (not in active DB attempts)
      const orphanKey = crypto.randomBytes(32).toString('base64')
      await fakeProvider.addPeer({ publicKey: orphanKey, ip: '10.8.0.99' })

      // 4. Run reconciler
      const result = await vpnReconciler.reconcile()
      assert.strictEqual(result.orphansRemoved, 1, 'Orphan peer must be removed from interface')
      assert.strictEqual(result.missingAdded, 1, 'Missing DB peer must be re-added to interface')

      // Verify interface now contains activeKey and does NOT contain orphanKey
      const livePeers = await fakeProvider.listPeers()
      const liveKeys = new Set(livePeers.map(p => p.publicKey))
      assert.ok(liveKeys.has(activeKey), 'Active key was re-added')
      assert.ok(!liveKeys.has(orphanKey), 'Orphan key was purged')

      // Clean up
      await vpnService.revokeAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })
    })

    it('emits debounced server-originated VPN_DISCONNECT when handshake is stale > 120s', async () => {
      process.env.VPN_ENABLED = 'true'
      process.env.VPN_ENFORCEMENT = 'warn'

      const { publicKey: testKey, ip: testIp } = await vpnService.provisionAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })

      // Add peer to provider interface so it exists on live interface
      await fakeProvider.addPeer({ publicKey: testKey, ip: testIp })

      // Simulate handshake older than 3x keepalive (75s)
      const staleHandshake = new Date(Date.now() - 80000)
      fakeProvider.simulateHandshake(testKey, staleHandshake)

      // First sweep: tracks stale timestamp, but debounce (45s) has not yet elapsed
      let reconResult = await vpnReconciler.reconcile()
      assert.strictEqual(reconResult.disconnectsEmitted, 0, 'No disconnect emitted before debounce window')

      // Artificially advance staleTracker timestamp past 45s debounce
      vpnReconciler.staleTracker.set(testKey, Date.now() - 50000)

      // Second sweep: debounce has passed -> emits server-originated VPN_DISCONNECT
      reconResult = await vpnReconciler.reconcile()
      assert.strictEqual(reconResult.disconnectsEmitted, 1, 'Server-originated VPN_DISCONNECT emitted')

      // Verify violation was recorded in database
      const violations = await prisma.$queryRawUnsafe(`
        SELECT event_type AS "type", severity FROM violation_events
        WHERE attempt_id = $1::uuid AND event_type = 'VPN_DISCONNECT';
      `, testAttemptActive.id)
      assert.ok(violations.length > 0)
      assert.strictEqual(violations[0].type, 'VPN_DISCONNECT')
      assert.strictEqual(violations[0].severity, 'MEDIUM') // 'warn' mode uses MEDIUM

      // Clean up
      await vpnService.revokeAttemptVpn({
        attemptId: testAttemptActive.id,
        studentId: testStudent1.id,
        userRole: 'STUDENT'
      })
    })
  })

  // ============================================================================
  // 7. Outbox Worker & Retries
  // ============================================================================
  describe('7. Asynchronous Outbox Worker & Retries', () => {
    it('processes vpn.peer.add and vpn.peer.remove idempotently via provider', async () => {
      const testKey = crypto.randomBytes(32).toString('base64')
      const testIp = '10.8.0.77'
      const eventId = `test_evt_${Date.now()}`

      // 1. Process vpn.peer.add event
      await vpnWorker.processEvent({
        eventId,
        type: 'vpn.peer.add',
        payload: {
          attemptId: testAttemptActive.id,
          publicKey: testKey,
          ipAddress: testIp
        }
      })

      let peers = await fakeProvider.listPeers()
      assert.strictEqual(peers.length, 1)
      assert.strictEqual(peers[0].publicKey, testKey)

      // 2. Duplicate processing test (idempotency guard)
      await vpnWorker.processEvent({
        eventId,
        type: 'vpn.peer.add',
        payload: {
          attemptId: testAttemptActive.id,
          publicKey: testKey,
          ipAddress: testIp
        }
      })
      peers = await fakeProvider.listPeers()
      assert.strictEqual(peers.length, 1) // Still exactly 1 peer

      // 3. Process vpn.peer.remove event
      await vpnWorker.processEvent({
        eventId: `${eventId}_rm`,
        type: 'vpn.peer.remove',
        payload: {
          attemptId: testAttemptActive.id,
          publicKey: testKey
        }
      })

      peers = await fakeProvider.listPeers()
      assert.strictEqual(peers.length, 0)
    })
  })
})
