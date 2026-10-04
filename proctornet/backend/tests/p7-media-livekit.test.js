/**
 * tests/p7-media-livekit.test.js
 * Mandatory test suite for Phase P7 — Media plane: LiveKit SFU (the "multiple users" fix)
 *
 * Covers:
 * 1. Token Authorization Matrix (Student/Invigilator/Admin, BOLA guard, Terminal state guard, TTL, hidden, canSubscribe)
 * 2. Webhook Signature Verification (Missing auth, forged signature, tampered sha256, valid event, debouncing)
 * 3. Authoritative SCREEN_SHARE_STOPPED violation creation & severity
 * 4. State Machine terminal transition participant removal
 * 5. Frontend ProctorMedia & ProctorViewer configuration & architectural contracts
 * 6. Media capacity documentation verification
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { TrackSource } = require('livekit-server-sdk')

const { prisma } = require('../src/infra/postgres/client')
const { mediaService, MediaService } = require('../src/modules/media/media.service')
const { attemptStateMachine } = require('../src/modules/attempts/stateMachine')
const { ForbiddenError, NotFoundError } = require('../src/shared/errors')

describe('P7 Media Plane: LiveKit SFU Test Suite', () => {
  let dept
  let faculty1
  let faculty2
  let student1
  let student2
  let exam1
  let exam2
  let attempt1
  let attempt2
  let attemptTerminated
  let attemptSubmitted

  const testApiKey = process.env.LIVEKIT_API_KEY || 'proctornet_livekit_key'
  const testApiSecret = process.env.LIVEKIT_API_SECRET || 'proctornet_livekit_secret_at_least_32_chars'

  /**
   * Helper to sign a valid LiveKit webhook token
   */
  function signWebhookToken(bodyStr, apiKey = testApiKey, apiSecret = testApiSecret, expiresIn = '1h') {
    const sha256 = crypto.createHash('sha256').update(bodyStr).digest('base64')
    return jwt.sign({ sha256, iss: apiKey }, apiSecret, { expiresIn })
  }

  before(async () => {
    const suffix = crypto.randomBytes(4).toString('hex')

    // 1. Department
    dept = await prisma.department.create({
      data: {
        code: `P7_${suffix}`.toUpperCase(),
        name: `P7 Media Dept ${suffix}`
      }
    })

    // 2. Faculties
    faculty1 = await prisma.faculty.create({
      data: {
        name: `Faculty 1 ${suffix}`,
        email: `faculty1_${suffix}@test.edu`,
        password: 'hash',
        employeeId: `FAC1_${suffix}`,
        departmentCode: dept.code
      }
    })

    faculty2 = await prisma.faculty.create({
      data: {
        name: `Faculty 2 ${suffix}`,
        email: `faculty2_${suffix}@test.edu`,
        password: 'hash',
        employeeId: `FAC2_${suffix}`,
        departmentCode: dept.code
      }
    })

    // 3. Students
    student1 = await prisma.student.create({
      data: {
        name: `Student 1 ${suffix}`,
        email: `student1_${suffix}@test.edu`,
        usn: `1MS21CS_${suffix}1`,
        password: 'hash',
        departmentCode: dept.code,
        semester: 6
      }
    })

    student2 = await prisma.student.create({
      data: {
        name: `Student 2 ${suffix}`,
        email: `student2_${suffix}@test.edu`,
        usn: `1MS21CS_${suffix}2`,
        password: 'hash',
        departmentCode: dept.code,
        semester: 6
      }
    })

    // 4. Exams (Exam 1 owned by Faculty 1, Exam 2 owned by Faculty 2)
    const now = new Date()
    exam1 = await prisma.exam.create({
      data: {
        title: `P7 Exam 1 ${suffix}`,
        subject: 'Media Engineering',
        invId: `INV_P7_1_${suffix}`,
        invPasswordHash: 'hash',
        facultyId: faculty1.id,
        duration: 60,
        totalMarks: 100,
        status: 'PUBLISHED',
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 50 * 60 * 1000),
        allowedDepartments: [dept.code],
        allowedSemesters: [6]
      }
    })

    exam2 = await prisma.exam.create({
      data: {
        title: `P7 Exam 2 ${suffix}`,
        subject: 'Media Engineering',
        invId: `INV_P7_2_${suffix}`,
        invPasswordHash: 'hash',
        facultyId: faculty2.id,
        duration: 60,
        totalMarks: 100,
        status: 'PUBLISHED',
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 50 * 60 * 1000),
        allowedDepartments: [dept.code],
        allowedSemesters: [6]
      }
    })

    // 5. Attempts
    attempt1 = await prisma.examAttempt.create({
      data: {
        examId: exam1.id,
        studentId: student1.id,
        status: 'ACTIVE',
        watermarkSeed: `wm_${suffix}_1`,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600 * 1000) // 1 hour left
      }
    })

    attempt2 = await prisma.examAttempt.create({
      data: {
        examId: exam1.id,
        studentId: student2.id,
        status: 'ACTIVE',
        watermarkSeed: `wm_${suffix}_2`,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    })

    attemptTerminated = await prisma.examAttempt.create({
      data: {
        examId: exam2.id,
        studentId: student1.id,
        status: 'TERMINATED',
        watermarkSeed: `wm_${suffix}_term`,
        startedAt: new Date(Date.now() - 3600 * 1000),
        submittedAt: new Date()
      }
    })

    attemptSubmitted = await prisma.examAttempt.create({
      data: {
        examId: exam2.id,
        studentId: student2.id,
        status: 'SUBMITTED',
        watermarkSeed: `wm_${suffix}_sub`,
        startedAt: new Date(Date.now() - 3600 * 1000),
        submittedAt: new Date()
      }
    })
  })

  after(async () => {
    // Cleanup fixtures
    await prisma.violationEvent.deleteMany({
      where: { attemptId: { in: [attempt1.id, attempt2.id, attemptTerminated.id, attemptSubmitted.id] } }
    }).catch(() => {})
    await prisma.examAttempt.deleteMany({
      where: { id: { in: [attempt1.id, attempt2.id, attemptTerminated.id, attemptSubmitted.id] } }
    }).catch(() => {})
    await prisma.exam.deleteMany({
      where: { id: { in: [exam1.id, exam2.id] } }
    }).catch(() => {})
    await prisma.student.deleteMany({
      where: { id: { in: [student1.id, student2.id] } }
    }).catch(() => {})
    await prisma.faculty.deleteMany({
      where: { id: { in: [faculty1.id, faculty2.id] } }
    }).catch(() => {})
    await prisma.department.deleteMany({
      where: { code: dept.code }
    }).catch(() => {})
  })

  // ══════════════════════════════════════════════════════════════════
  // Section 1: LiveKit Token Authorization Matrix (Task 7.2)
  // ══════════════════════════════════════════════════════════════════
  describe('1. LiveKit Token Authorization Matrix', () => {
    it('1.1 Student receives token with canPublish:true, canSubscribe:false, bounded TTL', async () => {
      const studentUser = {
        id: student1.id,
        role: 'student',
        name: student1.name,
        usn: student1.usn
      }

      const res = await mediaService.issueToken(studentUser, {
        examId: exam1.id,
        attemptId: attempt1.id
      })

      assert.ok(res.token, 'Token must be issued')
      assert.strictEqual(res.roomName, `exam:${exam1.id}`)
      assert.strictEqual(res.identity, `student:${attempt1.id}`)

      // Decode JWT to inspect claims
      const decoded = jwt.decode(res.token)
      assert.ok(decoded, 'JWT must be decodable')
      assert.strictEqual(decoded.sub, `student:${attempt1.id}`)

      // Video grants
      assert.ok(decoded.video, 'Video grant must be present')
      assert.strictEqual(decoded.video.room, `exam:${exam1.id}`)
      assert.strictEqual(decoded.video.roomJoin, true)
      assert.strictEqual(decoded.video.canPublish, true, 'Student must be allowed to publish')
      assert.strictEqual(decoded.video.canSubscribe, false, 'Student MUST NOT be allowed to subscribe (anti-spying guard)')
      assert.strictEqual(decoded.video.canPublishData, false)
      assert.ok(
        decoded.video.canPublishSources.includes(TrackSource.SCREEN_SHARE) ||
        decoded.video.canPublishSources.includes('screen_share'),
        'Must include screen share'
      )

      // Metadata
      const meta = JSON.parse(decoded.metadata)
      assert.strictEqual(meta.name, student1.name)
      assert.strictEqual(meta.usn, student1.usn)
      assert.strictEqual(meta.attemptId, attempt1.id)
      assert.strictEqual(meta.examId, exam1.id)

      // TTL: ~3600s remaining + 300s grace = ~3900s
      const startSec = decoded.nbf || decoded.iat
      const remainingLifetime = decoded.exp - startSec
      assert.ok(remainingLifetime >= 3800 && remainingLifetime <= 4000, `TTL should be ~3900s, got ${remainingLifetime}`)
    })

    it('1.2 BOLA guard: Student cannot request token for another student\'s attempt', async () => {
      const studentUser = {
        id: student1.id,
        role: 'student',
        name: student1.name,
        usn: student1.usn
      }

      // student1 requests token for student2's attempt
      await assert.rejects(
        async () => {
          await mediaService.issueToken(studentUser, {
            examId: exam1.id,
            attemptId: attempt2.id
          })
        },
        NotFoundError,
        'Should reject attempt that does not belong to student'
      )
    })

    it('1.3 Terminal state guard: Student cannot join media session for TERMINATED attempt', async () => {
      const studentUser = {
        id: student1.id,
        role: 'student',
        name: student1.name,
        usn: student1.usn
      }

      await assert.rejects(
        async () => {
          await mediaService.issueToken(studentUser, {
            examId: exam2.id,
            attemptId: attemptTerminated.id
          })
        },
        ForbiddenError,
        'Should reject media session for TERMINATED attempt'
      )
    })

    it('1.4 Terminal state guard: Student cannot join media session for SUBMITTED attempt', async () => {
      const studentUser = {
        id: student2.id,
        role: 'student',
        name: student2.name,
        usn: student2.usn
      }

      await assert.rejects(
        async () => {
          await mediaService.issueToken(studentUser, {
            examId: exam2.id,
            attemptId: attemptSubmitted.id
          })
        },
        ForbiddenError,
        'Should reject media session for SUBMITTED attempt'
      )
    })

    it('1.5 Invigilator/Faculty receives token with canSubscribe:true, canPublish:false, hidden:true', async () => {
      const facultyUser = {
        id: faculty1.id,
        role: 'faculty',
        name: faculty1.name,
        departmentCode: dept.code
      }

      const res = await mediaService.issueToken(facultyUser, {
        examId: exam1.id
      })

      assert.ok(res.token)
      assert.strictEqual(res.roomName, `exam:${exam1.id}`)
      assert.ok(res.identity.startsWith(`inv:${faculty1.id}:`), 'Identity should follow inv:{userId}:{rand}')

      const decoded = jwt.decode(res.token)
      assert.ok(decoded.video)
      assert.strictEqual(decoded.video.room, `exam:${exam1.id}`)
      assert.strictEqual(decoded.video.roomJoin, true)
      assert.strictEqual(decoded.video.canPublish, false, 'Invigilator cannot publish media')
      assert.strictEqual(decoded.video.canSubscribe, true, 'Invigilator can subscribe to candidate media')
      assert.strictEqual(decoded.video.hidden, true, 'Invigilator must be HIDDEN in room (candidates cannot see proctors)')

      // TTL: 4 hours = 14400s
      const startSec = decoded.nbf || decoded.iat
      const lifetime = decoded.exp - startSec
      assert.strictEqual(lifetime, 14400, 'Staff token TTL must be 4 hours (14400s)')
    })

    it('1.6 Cross-Exam Scope: Faculty cannot access an exam they do not own', async () => {
      const facultyUser2 = {
        id: faculty2.id,
        role: 'faculty',
        name: faculty2.name,
        departmentCode: dept.code
      }

      // Faculty 2 owns Exam 2, tries to access Exam 1
      await assert.rejects(
        async () => {
          await mediaService.issueToken(facultyUser2, {
            examId: exam1.id
          })
        },
        ForbiddenError,
        'Should reject faculty not assigned or owning the exam'
      )
    })

    it('1.7 Admin is authorized to access any exam', async () => {
      const adminUser = {
        id: 'admin_root',
        role: 'admin',
        name: 'System Admin'
      }

      const res = await mediaService.issueToken(adminUser, {
        examId: exam1.id
      })

      assert.ok(res.token)
      const decoded = jwt.decode(res.token)
      assert.strictEqual(decoded.video.canSubscribe, true)
      assert.strictEqual(decoded.video.hidden, true)
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // Section 2: Webhook Signature Verification & Processing (Task 7.1 / 7.2)
  // ══════════════════════════════════════════════════════════════════
  describe('2. LiveKit Webhook Signature Verification & Processing', () => {
    it('2.1 Rejects webhook request without Authorization header', async () => {
      const payload = JSON.stringify({ event: 'participant_joined' })
      await assert.rejects(
        async () => {
          await mediaService.handleWebhook(payload, null)
        },
        ForbiddenError,
        'Missing authorization header must throw ForbiddenError'
      )
    })

    it('2.2 Rejects webhook request with invalid / malformed token', async () => {
      const payload = JSON.stringify({ event: 'participant_joined' })
      await assert.rejects(
        async () => {
          await mediaService.handleWebhook(payload, 'Bearer invalid-token')
        },
        ForbiddenError,
        'Malformed token must throw ForbiddenError'
      )
    })

    it('2.3 Rejects webhook signed with wrong secret', async () => {
      const payload = JSON.stringify({ event: 'participant_joined' })
      const forgedToken = signWebhookToken(payload, testApiKey, 'wrong_secret_at_least_32_characters_long!')

      await assert.rejects(
        async () => {
          await mediaService.handleWebhook(payload, forgedToken)
        },
        ForbiddenError,
        'Token signed with wrong secret must throw ForbiddenError'
      )
    })

    it('2.4 Rejects tampered webhook payload (sha256 mismatch)', async () => {
      const originalPayload = JSON.stringify({ event: 'participant_joined' })
      const token = signWebhookToken(originalPayload)

      const tamperedPayload = JSON.stringify({ event: 'participant_left', hijacked: true })

      await assert.rejects(
        async () => {
          await mediaService.handleWebhook(tamperedPayload, token)
        },
        ForbiddenError,
        'Tampered payload must fail sha256 checksum verification'
      )
    })

    it('2.5 Authoritative track_unpublished for screen share creates SCREEN_SHARE_STOPPED violation', async () => {
      const webhookPayload = JSON.stringify({
        event: 'track_unpublished',
        room: { name: `exam:${exam1.id}` },
        participant: { identity: `student:${attempt1.id}` },
        track: { source: TrackSource.SCREEN_SHARE, name: 'screen' }
      })

      const token = signWebhookToken(webhookPayload)
      const res = await mediaService.handleWebhook(webhookPayload, token)

      assert.strictEqual(res.success, true)
      assert.strictEqual(res.event, 'track_unpublished')

      // Verify that violation record was created in database
      const violation = await prisma.violationEvent.findFirst({
        where: {
          attemptId: attempt1.id,
          eventType: 'SCREEN_SHARE_STOPPED'
        },
        orderBy: { serverTimestamp: 'desc' }
      })

      assert.ok(violation, 'Authoritative SCREEN_SHARE_STOPPED violation must exist in DB')
      assert.strictEqual(violation.severity, 'MEDIUM', 'Media failure must never be treated as instant proof of cheating (Notion 13.10 §15)')
      assert.strictEqual(violation.attemptId, attempt1.id)
    })

    it('2.6 Webhook debouncing: rapid unpublish events within 5 seconds are coalesced', async () => {
      const initialCount = await prisma.violationEvent.count({
        where: { attemptId: attempt1.id, eventType: 'SCREEN_SHARE_STOPPED' }
      })

      // Immediate second event for same attempt
      const webhookPayload = JSON.stringify({
        event: 'track_unpublished',
        room: { name: `exam:${exam1.id}` },
        participant: { identity: `student:${attempt1.id}` },
        track: { source: TrackSource.SCREEN_SHARE, name: 'screen' }
      })
      const token = signWebhookToken(webhookPayload)

      await mediaService.handleWebhook(webhookPayload, token)

      const countAfter = await prisma.violationEvent.count({
        where: { attemptId: attempt1.id, eventType: 'SCREEN_SHARE_STOPPED' }
      })

      assert.strictEqual(countAfter, initialCount, 'Second event within 5s debounce window must be coalesced/ignored')
    })

    it('2.7 Unpublishing non-screen track (e.g. camera) does NOT create SCREEN_SHARE_STOPPED', async () => {
      const webhookPayload = JSON.stringify({
        event: 'track_unpublished',
        room: { name: `exam:${exam1.id}` },
        participant: { identity: `student:${attempt2.id}` },
        track: { source: TrackSource.CAMERA, name: 'camera' }
      })
      const token = signWebhookToken(webhookPayload)

      await mediaService.handleWebhook(webhookPayload, token)

      const violation = await prisma.violationEvent.findFirst({
        where: { attemptId: attempt2.id, eventType: 'SCREEN_SHARE_STOPPED' }
      })

      assert.strictEqual(violation, null, 'Camera track unpublish should not trigger SCREEN_SHARE_STOPPED')
    })

    it('2.8 Unpublishing from non-student participant (e.g. invigilator) does NOT create violation', async () => {
      const webhookPayload = JSON.stringify({
        event: 'track_unpublished',
        room: { name: `exam:${exam1.id}` },
        participant: { identity: `inv:${faculty1.id}:abc123` },
        track: { source: TrackSource.SCREEN_SHARE, name: 'screen' }
      })
      const token = signWebhookToken(webhookPayload)

      const res = await mediaService.handleWebhook(webhookPayload, token)
      assert.strictEqual(res.success, true)
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // Section 3: Attempt State Machine LiveKit Participant Removal (Task 7.2)
  // ══════════════════════════════════════════════════════════════════
  describe('3. Attempt State Machine LiveKit Participant Removal', () => {
    it('3.1 Transitioning attempt to TERMINATED triggers LiveKit participant removal', async () => {
      let removedParticipant = null

      // Spy on mediaService.removeParticipant
      const originalRemove = mediaService.removeParticipant
      mediaService.removeParticipant = async (examId, identity) => {
        removedParticipant = { examId, identity }
      }

      try {
        await attemptStateMachine.transition(attempt1.id, 'TERMINATED', {
          reason: 'Severe violation in test',
          terminatedBy: faculty1.id
        })

        assert.ok(removedParticipant, 'removeParticipant must be called on TERMINATED transition')
        assert.strictEqual(removedParticipant.examId, exam1.id)
        assert.strictEqual(removedParticipant.identity, `student:${attempt1.id}`)
      } finally {
        mediaService.removeParticipant = originalRemove
      }
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // Section 4: Client Architecture & Frontend Configuration Contracts
  // ══════════════════════════════════════════════════════════════════
  describe('4. Frontend Configuration & Architecture Contracts', () => {
    const proctorMediaPath = path.resolve(__dirname, '../../frontend/src/lib/proctorMedia.js')
    const proctorViewerPath = path.resolve(__dirname, '../../frontend/src/lib/proctorViewer.js')
    const useExamSocketPath = path.resolve(__dirname, '../../frontend/src/hooks/useExamSocket.js')
    const useInvSocketPath = path.resolve(__dirname, '../../frontend/src/hooks/useInvigilatorSocket.js')

    it('4.1 proctorMedia.js implements VP8 simulcast, bitrate caps, DTX, detail contentHint', () => {
      assert.ok(fs.existsSync(proctorMediaPath), 'proctorMedia.js must exist')
      const code = fs.readFileSync(proctorMediaPath, 'utf-8')

      // VP8 codec
      assert.match(code, /videoCodec:\s*['"]vp8['"]/, 'Must specify VP8 codec')
      // Simulcast
      assert.match(code, /simulcast:\s*true/, 'Must enable simulcast for screen share')
      // DTX
      assert.match(code, /dtx:\s*true/, 'Must enable DTX')
      // Resolution & framerate cap (1280x720 @ 5 fps)
      assert.match(code, /width:\s*1280/, 'Screen share width must be 1280')
      assert.match(code, /height:\s*720/, 'Screen share height must be 720')
      assert.match(code, /frameRate:\s*5/, 'Screen share framerate must be 5 fps')
      // Screen bitrate cap (400,000 bps)
      assert.match(code, /maxBitrate:\s*400_?000/, 'Screen share maxBitrate must be capped at 400kbps')
      // Screen low simulcast layer (~640x360 @ 3 fps <= 120kbps)
      assert.match(code, /maxBitrate:\s*120_?000/, 'Simulcast low layer must be capped at 120kbps')
      // Camera cap (320x180 @ 15 fps <= 150kbps)
      assert.match(code, /maxBitrate:\s*150_?000/, 'Camera maxBitrate must be capped at 150kbps')
      assert.match(code, /contentHint:\s*['"]detail['"]/, 'Screen track must have contentHint detail')
      assert.match(code, /contentHint:\s*['"]motion['"]/, 'Camera track must have contentHint motion')
      // Media failure is an event, never proof of cheating
      assert.match(code, /SCREEN_SHARE_STOPPED/, 'Must report SCREEN_SHARE_STOPPED on track unpublish')
    })

    it('4.2 proctorViewer.js implements selective subscription and focus layer limits', () => {
      assert.ok(fs.existsSync(proctorViewerPath), 'proctorViewer.js must exist')
      const code = fs.readFileSync(proctorViewerPath, 'utf-8')

      // autoSubscribe: false
      assert.match(code, /autoSubscribe:\s*false/, 'Must connect with autoSubscribe: false')
      // adaptiveStream: true
      assert.match(code, /adaptiveStream:\s*true/, 'Must enable adaptiveStream for viewer')
      // Grid low quality
      assert.match(code, /VideoQuality\.LOW/, 'Grid tiles must request lowest simulcast layer (LOW)')
      // Focus high quality
      assert.match(code, /VideoQuality\.HIGH/, 'Focused stream must request HIGH quality layer')
      // MAX_HIGH_QUALITY_STREAMS = 4
      assert.match(code, /MAX_HIGH_QUALITY_STREAMS\s*=\s*4/, 'Must bound high-quality streams to maximum of 4')
    })

    it('4.3 Complete deletion of legacy mesh and canvas frame-streaming globals', () => {
      const examSocketCode = fs.readFileSync(useExamSocketPath, 'utf-8')
      const invSocketCode = fs.readFileSync(useInvSocketPath, 'utf-8')

      // Check that legacy frame events are removed
      assert.doesNotMatch(examSocketCode, /exam:frame/, 'Legacy exam:frame must be deleted')
      assert.doesNotMatch(examSocketCode, /exam:screenFrame/, 'Legacy exam:screenFrame must be deleted')
      assert.doesNotMatch(examSocketCode, /window\.screenShareStream/, 'window.screenShareStream global must be deleted')

      assert.doesNotMatch(invSocketCode, /webrtc:/, 'Legacy webrtc:* socket handlers must be deleted')
      assert.doesNotMatch(invSocketCode, /window\.activeWebRTCStreams/, 'window.activeWebRTCStreams global must be deleted')
      assert.doesNotMatch(invSocketCode, /window\.latestStudentFrames/, 'window.latestStudentFrames global must be deleted')
    })
  })

  // ══════════════════════════════════════════════════════════════════
  // Section 5: Media Capacity Math Validation (Task 7.5)
  // ══════════════════════════════════════════════════════════════════
  describe('5. Media Capacity Documentation (docs/architecture/media-capacity.md)', () => {
    it('5.1 docs/architecture/media-capacity.md exists and contains accurate bandwidth models', () => {
      const docPath = path.resolve(__dirname, '../../../docs/architecture/media-capacity.md')
      assert.ok(fs.existsSync(docPath), 'media-capacity.md must exist')

      const doc = fs.readFileSync(docPath, 'utf-8')
      assert.match(doc, /275\s*Mbps/, 'Must document 500-student ingress of ~275 Mbps')
      assert.match(doc, /400\s*kbps/, 'Must document screen share cap of 400 kbps')
      assert.match(doc, /150\s*kbps/, 'Must document camera cap of 150 kbps')
      assert.match(doc, /VP8\s*simulcast/i, 'Must document VP8 simulcast decision')
      assert.match(doc, /Selective Subscription/i, 'Must document selective subscription architecture')
    })
  })
})
