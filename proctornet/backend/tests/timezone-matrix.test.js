const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { prisma } = require('../src/infra/postgres/client')

test.describe('Q1.1 Timezone Matrix & Timestamptz Invariance (E-02)', () => {
  let examId
  let facultyId

  test.before(async () => {
    // Ensure department exists
    await prisma.department.upsert({
      where: { code: 'CSE' },
      update: {},
      create: { code: 'CSE', name: 'Computer Science' }
    })

    const faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Timezone Faculty',
        email: `tz-faculty-${Date.now()}@test.edu`,
        password: 'hashed_password',
        departmentCode: 'CSE',
        employeeId: `EMP-TZ-${Date.now()}`
      }
    })
    facultyId = faculty.id
  })

  test('Database default timezone is UTC', async () => {
    const res = await prisma.$queryRawUnsafe(`SHOW timezone;`)
    assert.ok(res && res[0])
    const tz = res[0].TimeZone || res[0].timezone
    assert.equal(tz.toUpperCase(), 'UTC', `Expected DB timezone to be UTC, got ${tz}`)
  })

  test('timestamptz columns preserve exact instant regardless of session timezone', async () => {
    const fixedIso = '2026-10-05T12:00:00.000Z'
    const targetDate = new Date(fixedIso)

    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'Timezone Invariance Exam',
        subject: 'Timezone Studies',
        facultyId,
        startTime: targetDate,
        endTime: new Date(targetDate.getTime() + 3600000), // +1 hour
        duration: 60,
        totalMarks: 50,
        invId: `INV-TZ-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'DRAFT'
      }
    })
    examId = exam.id

    // Check across different session timezones
    const zones = ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']

    for (const zone of zones) {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL timezone TO '${zone}';`)
        return tx.$queryRawUnsafe(`
          SELECT 
            start_time,
            start_time AT TIME ZONE 'UTC' as start_utc,
            EXTRACT(EPOCH FROM start_time) as epoch_sec
          FROM exams 
          WHERE id = $1::uuid;
        `, examId)
      })

      assert.ok(rows && rows.length > 0)
      const epoch = Number(rows[0].epoch_sec)
      const expectedEpoch = Math.floor(targetDate.getTime() / 1000)
      assert.equal(epoch, expectedEpoch, `Epoch mismatch in timezone ${zone}: expected ${expectedEpoch}, got ${epoch}`)
    }
  })

  test('Relative deadline comparison (expires_at < now()) is session-timezone agnostic', async () => {
    // Create student
    const student = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Timezone Student',
        usn: `1TZ${Math.floor(Math.random() * 100000)}`,
        email: `tz-student-${Date.now()}@test.edu`,
        password: 'hashed_password',
        departmentCode: 'CSE',
        semester: 6
      }
    })

    // Create attempt expired 2 minutes ago
    const pastExpiresAt = new Date(Date.now() - 120000)
    const attempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        studentId: student.id,
        status: 'ACTIVE',
        watermarkSeed: crypto.randomBytes(8).toString('hex'),
        startedAt: new Date(Date.now() - 600000),
        expiresAt: pastExpiresAt
      }
    })

    const zones = ['UTC', 'Asia/Kolkata', 'America/Los_Angeles']

    for (const zone of zones) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL timezone TO '${zone}';`)
        return tx.$queryRawUnsafe(`
          SELECT 
            id,
            expires_at,
            (expires_at < now() - interval '30 seconds') as is_expired
          FROM exam_attempts
          WHERE id = $1::uuid;
        `, attempt.id)
      })

      assert.ok(result && result.length > 0)
      assert.equal(result[0].is_expired, true, `Expiry check failed in timezone ${zone}`)
    }
  })
})
