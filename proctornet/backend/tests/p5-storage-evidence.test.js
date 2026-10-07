const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const sharp = require('sharp')
const { prisma } = require('../src/infra/postgres/client')
const {
  s3Client,
  putObject,
  getObjectBuffer,
  headObject,
  buildIdentityKey,
  buildEvidenceKey,
  buildThumbKey,
  getPresignedReadUrl,
  batchPresignReadUrls
} = require('../src/infra/s3/s3.client')
const { presignService } = require('../src/modules/media/presignService')
const { evidenceWorker } = require('../src/modules/media/evidenceWorker')
const { retentionWorker } = require('../src/modules/media/retentionWorker')

describe('P5 Storage & Evidence Pipeline (S3, Direct Upload, Worker)', () => {
  let dept
  let studentA
  let studentB
  let faculty
  let exam
  let attemptA

  before(async () => {
    // Setup isolated test fixtures
    const suffix = crypto.randomBytes(4).toString('hex')
    dept = await prisma.department.create({
      data: {
        code: `P5_${suffix}`.toUpperCase(),
        name: `P5 Dept ${suffix}`
      }
    })

    faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: `Faculty P5 ${suffix}`,
        email: `faculty_p5_${suffix}@test.edu`,
        password: 'hash',
        employeeId: `EMP_P5_${suffix}`,
        departmentCode: dept.code
      }
    })

    studentA = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: `Student A ${suffix}`,
        email: `studentA_${suffix}@test.edu`,
        usn: `1DS20CS_${suffix}A`,
        password: 'hash',
        departmentCode: dept.code,
        semester: 6
      }
    })

    studentB = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: `Student B ${suffix}`,
        email: `studentB_${suffix}@test.edu`,
        usn: `1DS20CS_${suffix}B`,
        password: 'hash',
        departmentCode: dept.code,
        semester: 6
      }
    })

    exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: `P5 Storage Exam ${suffix}`,
        subject: 'Computer Science',
        invId: `INV_P5_${suffix}`,
        invPasswordHash: 'hash',
        facultyId: faculty.id,
        duration: 60,
        startTime: new Date(Date.now() - 10 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        totalMarks: 50,
        allowedDepartments: [dept.code],
        allowedSemesters: [6],
        status: 'PUBLISHED'
      }
    })

    attemptA = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentId: studentA.id,
        status: 'ACTIVE',
        watermarkSeed: 'seed_p5_test',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 50 * 60 * 1000)
      }
    })
  })

  after(async () => {
    try {
      if (exam) {
        await prisma.violationEvent.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
      }
      if (dept) {
        await prisma.violationEvent.deleteMany({ where: { attempt: { student: { departmentCode: dept.code } } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { student: { departmentCode: dept.code } } }).catch(() => {})
        await prisma.student.deleteMany({ where: { departmentCode: dept.code } }).catch(() => {})
        await prisma.faculty.deleteMany({ where: { departmentCode: dept.code } }).catch(() => {})
        await prisma.department.delete({ where: { code: dept.code } }).catch(() => {})
      }
    } catch {}
  })

  // ──────────────────────────────────────────────────────────
  // 1. Presign Policy Authorization & Boundary Gates
  // ──────────────────────────────────────────────────────────
  describe('Presign Policy Gates', () => {
    it('rejects presign request when evidence exceeds 300 KB limit', async () => {
      await assert.rejects(
        async () => {
          await presignService.generateUploadPresignedUrl(
            { id: studentA.id, role: 'student' },
            {
              purpose: 'EVIDENCE',
              attemptId: attemptA.id,
              contentType: 'image/webp',
              bytes: 350 * 1024 // 350 KB > 300 KB
            }
          )
        },
        (err) => {
          assert.equal(err.name, 'ValidationError')
          assert.ok(err.message.includes('300 KB'))
          return true
        }
      )
    })

    it('rejects presign request for unsupported content type', async () => {
      await assert.rejects(
        async () => {
          await presignService.generateUploadPresignedUrl(
            { id: studentA.id, role: 'student' },
            {
              purpose: 'EVIDENCE',
              attemptId: attemptA.id,
              contentType: 'application/x-sh',
              bytes: 50 * 1024
            }
          )
        },
        (err) => {
          assert.ok(err.name === 'ValidationError')
          return true
        }
      )
    })

    it('rejects presign request for another student attempt (BOLA guard)', async () => {
      await assert.rejects(
        async () => {
          await presignService.generateUploadPresignedUrl(
            { id: studentB.id, role: 'student' }, // Student B attempting upload to Student A's attempt
            {
              purpose: 'EVIDENCE',
              attemptId: attemptA.id,
              contentType: 'image/webp',
              bytes: 100 * 1024
            }
          )
        },
        (err) => {
          assert.equal(err.name, 'NotFoundError')
          return true
        }
      )
    })

    it('issues valid presigned direct upload policy for eligible candidate within budget', async () => {
      const policy = await presignService.generateUploadPresignedUrl(
        { id: studentA.id, role: 'student' },
        {
          purpose: 'EVIDENCE',
          attemptId: attemptA.id,
          contentType: 'image/webp',
          bytes: 120 * 1024
        }
      )

      assert.ok(policy.key.startsWith(`evidence/${exam.id}/${attemptA.id}/`))
      assert.ok(policy.url || policy.putUrl)
      assert.equal(policy.contentType, 'image/webp')
      assert.equal(policy.expiresIn, 120)
    })

    it('issues valid presigned upload for candidate profile identity photo (<= 2MB)', async () => {
      const policy = await presignService.generateUploadPresignedUrl(
        { id: studentA.id, role: 'student' },
        {
          purpose: 'IDENTITY_PHOTO',
          contentType: 'image/webp',
          bytes: 800 * 1024 // 800 KB <= 2MB
        }
      )

      assert.ok(policy.key.startsWith(`identity/${studentA.id}/profile-`))
      assert.equal(policy.expiresIn, 120)
    })
  })

  // ──────────────────────────────────────────────────────────
  // 2. Direct Upload Complete & Worker Processing
  // ──────────────────────────────────────────────────────────
  describe('Direct Upload Complete & Evidence Worker Idempotency', () => {
    let testEvidenceKey
    let testEventId

    it('finalizes direct upload, writes violation record and enqueues outbox event', async () => {
      testEvidenceKey = `evidence/${exam.id}/${attemptA.id}/${crypto.randomUUID()}.webp`

      // Generate a valid 400x300 WebP image buffer
      const testWebpBuffer = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 50, g: 120, b: 200 }
        }
      }).webp().toBuffer()

      // Upload buffer directly to S3 under testEvidenceKey
      await putObject(testEvidenceKey, testWebpBuffer, 'image/webp')

      // Complete upload via service
      const res = await presignService.completeUpload(
        { id: studentA.id, role: 'student' },
        {
          key: testEvidenceKey,
          purpose: 'EVIDENCE',
          attemptId: attemptA.id,
          eventType: 'MULTIPLE_FACES',
          clientTimestamp: new Date().toISOString()
        }
      )

      assert.equal(res.success, true)
      assert.equal(res.status, 'PENDING')
      testEventId = res.eventId

      // Verify DB row
      const violation = await prisma.violationEvent.findUnique({
        where: { id: BigInt(testEventId) }
      })
      assert.ok(violation)
      assert.equal(violation.evidenceKey, testEvidenceKey)
      assert.equal(violation.evidenceStatus, 'PENDING')

      // Verify outbox row
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          eventType: 'evidence.uploaded',
          payload: { path: ['eventId'], equals: testEventId }
        }
      })
      assert.ok(outbox)
    })

    it('evidence worker decodes valid image, generates 320px thumbnail, updates status to UPLOADED', async () => {
      const outcome = await evidenceWorker.processEvent({
        eventId: testEventId,
        attemptId: attemptA.id,
        examId: exam.id,
        evidenceKey: testEvidenceKey
      })

      assert.equal(outcome.status, 'UPLOADED')
      assert.ok(outcome.thumbKey.startsWith(`thumbs/${exam.id}/${attemptA.id}/`))

      // Check DB update
      const violation = await prisma.violationEvent.findUnique({
        where: { id: BigInt(testEventId) }
      })
      assert.equal(violation.evidenceStatus, 'UPLOADED')
      assert.equal(violation.thumbKey, outcome.thumbKey)

      // Verify thumbnail buffer in S3
      const thumbBuf = await getObjectBuffer(outcome.thumbKey)
      assert.ok(thumbBuf.length > 0)
      const meta = await sharp(thumbBuf).metadata()
      assert.equal(meta.width, 320)
      assert.equal(meta.format, 'webp')
    })

    it('evidence worker is strictly idempotent when processing same event a second time', async () => {
      const outcome2 = await evidenceWorker.processEvent({
        eventId: testEventId,
        attemptId: attemptA.id,
        examId: exam.id,
        evidenceKey: testEvidenceKey
      })

      assert.equal(outcome2.status, 'ALREADY_PROCESSED')
      assert.ok(outcome2.thumbKey)

      // DB violation record remains UPLOADED
      const violation = await prisma.violationEvent.findUnique({
        where: { id: BigInt(testEventId) }
      })
      assert.equal(violation.evidenceStatus, 'UPLOADED')
    })

    it('corrupt image input marks status FAILED but preserves the violation row intact', async () => {
      const corruptKey = `evidence/${exam.id}/${attemptA.id}/${crypto.randomUUID()}.webp`

      // Upload corrupt non-image bytes
      const corruptBytes = Buffer.from('Corrupt-Non-Image-Data-Payload-12345')
      await putObject(corruptKey, corruptBytes, 'image/webp')

      const corruptViolation = await prisma.violationEvent.create({
        data: {
          attemptId: attemptA.id,
          eventType: 'SUSPICIOUS_OBJECT',
          severity: 'MEDIUM',
          evidenceKey: corruptKey,
          evidenceStatus: 'PENDING'
        }
      })

      const outcome = await evidenceWorker.processEvent({
        eventId: String(corruptViolation.id),
        attemptId: attemptA.id,
        examId: exam.id,
        evidenceKey: corruptKey
      })

      assert.equal(outcome.status, 'FAILED')

      // Verify violation record is marked FAILED and still exists in DB
      const updated = await prisma.violationEvent.findUnique({
        where: { id: corruptViolation.id }
      })
      assert.ok(updated)
      assert.equal(updated.evidenceStatus, 'FAILED')
      assert.equal(updated.eventType, 'SUSPICIOUS_OBJECT')
    })
  })

  // ──────────────────────────────────────────────────────────
  // 3. Stored-URL Gate & 5-Minute Rounded Presigning (ADR-011)
  // ──────────────────────────────────────────────────────────
  describe('Stored-URL Gate & 5-Minute Rounded Presigning', () => {
    it('verifies that no database column contains persisted presigned URLs or amazonaws links', async () => {
      const violations = await prisma.violationEvent.findMany({
        where: { attemptId: attemptA.id },
        select: { evidenceKey: true, thumbKey: true }
      })

      for (const v of violations) {
        if (v.evidenceKey) {
          assert.equal(v.evidenceKey.includes('http://'), false)
          assert.equal(v.evidenceKey.includes('https://'), false)
          assert.equal(v.evidenceKey.includes('X-Amz-Signature'), false)
          assert.equal(v.evidenceKey.includes('.amazonaws.com'), false)
        }
        if (v.thumbKey) {
          assert.equal(v.thumbKey.includes('http://'), false)
          assert.equal(v.thumbKey.includes('https://'), false)
          assert.equal(v.thumbKey.includes('X-Amz-Signature'), false)
          assert.equal(v.thumbKey.includes('.amazonaws.com'), false)
        }
      }
    })

    it('generates identical presigned read URLs within 5-minute window for browser caching', async () => {
      const key = `evidence/${exam.id}/${attemptA.id}/sample.webp`

      const url1 = await getPresignedReadUrl(key, 600)
      const url2 = await getPresignedReadUrl(key, 600)

      assert.ok(url1)
      assert.ok(url2)
      // Exactly identical query strings (same X-Amz-Date and X-Amz-Signature)
      assert.equal(url1, url2)
    })

    it('batch presigns multiple keys with identical signing window', async () => {
      const keys = [
        `evidence/${exam.id}/${attemptA.id}/1.webp`,
        `evidence/${exam.id}/${attemptA.id}/2.webp`,
        `thumbs/${exam.id}/${attemptA.id}/1.webp`
      ]

      const batch = await batchPresignReadUrls(keys, 600)
      assert.equal(batch.length, 3)
      for (const item of batch) {
        assert.ok(item.url)
        assert.ok(item.url.includes('X-Amz-Expires=600'))
      }
    })
  })

  // ──────────────────────────────────────────────────────────
  // 4. Evidence Retention Purge Worker
  // ──────────────────────────────────────────────────────────
  describe('Evidence Retention Purge Worker', () => {
    it('deletes expired evidence objects from S3 and nullifies DB keys while preserving recent events', async () => {
      const oldKey = `evidence/${exam.id}/${attemptA.id}/old_${crypto.randomUUID()}.webp`
      const recentKey = `evidence/${exam.id}/${attemptA.id}/recent_${crypto.randomUUID()}.webp`

      // Upload mock objects to S3
      await putObject(oldKey, Buffer.from('old-evidence-bytes'), 'image/webp')
      await putObject(recentKey, Buffer.from('recent-evidence-bytes'), 'image/webp')

      // Create an expired violation event (200 days old)
      const expiredTimestamp = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000)
      const oldViolation = await prisma.violationEvent.create({
        data: {
          attemptId: attemptA.id,
          eventType: 'DEVTOOLS_OPENED',
          severity: 'HIGH',
          evidenceKey: oldKey,
          evidenceStatus: 'UPLOADED',
          serverTimestamp: expiredTimestamp
        }
      })

      // Create a recent violation event (5 days old)
      const recentTimestamp = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      const recentViolation = await prisma.violationEvent.create({
        data: {
          attemptId: attemptA.id,
          eventType: 'FULLSCREEN_EXIT',
          severity: 'MEDIUM',
          evidenceKey: recentKey,
          evidenceStatus: 'UPLOADED',
          serverTimestamp: recentTimestamp
        }
      })

      // Run retention purge with 180-day threshold
      const purgeReport = await retentionWorker.runRetentionPurge({ retentionDays: 180 })

      assert.ok(purgeReport.purgedEvents >= 1)

      // Verify expired event keys were nullified in DB
      const checkedOld = await prisma.violationEvent.findUnique({
        where: { id: oldViolation.id }
      })
      assert.equal(checkedOld.evidenceKey, null)
      assert.equal(checkedOld.evidenceStatus, 'NONE')

      // Verify recent event was completely preserved
      const checkedRecent = await prisma.violationEvent.findUnique({
        where: { id: recentViolation.id }
      })
      assert.equal(checkedRecent.evidenceKey, recentKey)
      assert.equal(checkedRecent.evidenceStatus, 'UPLOADED')

      // Verify recent object still exists in S3
      const recentBuf = await getObjectBuffer(recentKey)
      assert.ok(recentBuf.length > 0)

      // Verify audit log entry was created
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'EVIDENCE_RETENTION_PURGE' },
        orderBy: { id: 'desc' }
      })
      assert.ok(audit)
      assert.equal(audit.resourceType, 'VIOLATION_EVIDENCE')
    })
  })
})
