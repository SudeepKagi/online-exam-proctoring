require('dotenv').config()
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')

describe('High-Concurrency Load & Security Penetration Test Suite', () => {
  let BASE_URL = 'http://127.0.0.1:5000'
  let serverInstance = null
  let exam, faculty, students = [], questions = []

  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, ok: res.ok, data }
  }

  before(async () => {
    try {
      const ping = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(600) })
      if (!ping.ok) throw new Error()
    } catch (_) {
      const { server } = require('../src/app')
      await new Promise(r => {
        serverInstance = server.listen(0, () => {
          BASE_URL = `http://127.0.0.1:${serverInstance.address().port}`
          r()
        })
      })
    }
    await prisma.$connect()

    faculty = await prisma.user.create({
      data: { email: `fac_${Date.now()}@test.edu`, passwordHash: 'hash', fullName: 'Dr. LoadTest', role: 'FACULTY' }
    })
    exam = await prisma.exam.create({
      data: {
        title: 'High-Concurrency Stress Exam',
        courseCode: 'CS-LOAD-999',
        createdById: faculty.id,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 7200000),
        durationMinutes: 120,
        status: 'PUBLISHED'
      }
    })

    const qData = Array.from({ length: 20 }, (_, i) => ({
      examId: exam.id,
      questionText: `Concurrency Stress Question #${i + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: i % 4,
      marks: i < 3 ? 4 : 1,
      negativeMarks: i === 3 ? 1 : 0,
      displayOrder: i
    }))
    for (const q of qData) questions.push(await prisma.question.create({ data: q }))

    const sData = Array.from({ length: 100 }, (_, i) => ({
      email: `stud_load_${i}_${Date.now()}@test.edu`,
      passwordHash: 'hash',
      fullName: `Student Load #${i}`,
      role: 'STUDENT',
      institutionId: `USN-LOAD-${i}`
    }))
    await prisma.user.createMany({ data: sData })
    const created = await prisma.user.findMany({
      where: { email: { in: sData.map(s => s.email) } },
      select: { id: true, email: true, role: true }
    })

    students = created.map(s => ({
      ...s,
      token: signToken({ id: s.id, email: s.email, role: 'STUDENT' })
    }))

    await prisma.examAssignment.createMany({
      data: students.map(s => ({ examId: exam.id, userId: s.id, assignedRole: 'STUDENT' })),
      skipDuplicates: true
    })
  })

  after(async () => {
    if (exam?.id) await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
    if (faculty?.id) await prisma.user.delete({ where: { id: faculty.id } }).catch(() => {})
    if (students?.length) {
      await prisma.user.deleteMany({ where: { id: { in: students.map(s => s.id) } } }).catch(() => {})
    }
    if (serverInstance) await new Promise(r => serverInstance.close(r))
    await prisma.$disconnect()
  })

  it('1. Thundering Herd Exam Start: 100 concurrent requests in < 1500ms without answer leakage', async () => {
    const t0 = performance.now()
    const results = await Promise.all(
      students.map(s => api('/api/v1/attempts/start', {
        method: 'POST', body: { examId: exam.id }, token: s.token
      }))
    )
    const elapsed = performance.now() - t0

    assert.ok(elapsed < 1500, `Thundering herd must finish < 1500ms; took ${elapsed.toFixed(1)}ms`)
    assert.strictEqual(results.every(r => r.status === 200), true, 'All 100 requests must return 200')

    const dbAttempts = await prisma.examAttempt.findMany({ where: { examId: exam.id } })
    assert.strictEqual(dbAttempts.length, 100, 'All 100 ExamAttempt rows must exist in PostgreSQL')
    assert.strictEqual(dbAttempts.every(a => a.status === 'IN_PROGRESS'), true, 'All attempts IN_PROGRESS')

    for (const r of results) {
      const serialized = JSON.stringify(r.data?.questions || [])
      assert.strictEqual(serialized.includes('correctOptionIndex'), false, 'correctOptionIndex must never leak')
    }
  })

  it('2. Concurrent Batch Autosave Burst: 200 concurrent upserts with zero deadlocks', async () => {
    const attempts = await prisma.examAttempt.findMany({ where: { examId: exam.id }, take: 10 })
    const updates = []

    for (let i = 0; i < 200; i++) {
      const att = attempts[i % attempts.length]
      const stud = students.find(s => s.id === att.studentId)
      const q = questions[i % questions.length]
      updates.push(api(`/api/v1/attempts/${att.id}/answers`, {
        method: 'PUT',
        body: { answers: [{ questionId: q.id, selectedOptionIndex: i % 4, isBookmarked: i % 2 === 0 }] },
        token: stud.token
      }))
    }

    const results = await Promise.all(updates)
    assert.strictEqual(results.every(r => r.status === 200), true, 'Zero 500s or deadlocks across 200 upserts')
  })

  it('3. Double-Submit Race Condition: 20 simultaneous submits yield exactly 1 grading & 11.00 score', async () => {
    const stud = students[0]
    const att = await prisma.examAttempt.findFirst({ where: { examId: exam.id, studentId: stud.id } })

    await api(`/api/v1/attempts/${att.id}/answers`, {
      method: 'PUT',
      body: {
        answers: [
          { questionId: questions[0].id, selectedOptionIndex: questions[0].correctOptionIndex },
          { questionId: questions[1].id, selectedOptionIndex: questions[1].correctOptionIndex },
          { questionId: questions[2].id, selectedOptionIndex: questions[2].correctOptionIndex },
          { questionId: questions[3].id, selectedOptionIndex: (questions[3].correctOptionIndex + 1) % 4 }
        ]
      },
      token: stud.token
    })

    const submits = await Promise.all(
      Array.from({ length: 20 }, () => api(`/api/v1/attempts/${att.id}/submit`, {
        method: 'POST', token: stud.token
      }))
    )

    assert.strictEqual(submits.every(r => r.status === 200), true, 'All 20 submit calls return 200')
    const freshAtt = await prisma.examAttempt.findUnique({ where: { id: att.id } })
    assert.strictEqual(freshAtt.status, 'SUBMITTED')
    assert.strictEqual(Number(freshAtt.score).toFixed(2), '11.00', 'Score must equal 11.00 (12 - 1)')
  })

  it('4. Server-Authoritative Timer Expiry Enforcement: Rejects late answers with 409', async () => {
    const stud = students[1]
    const att = await prisma.examAttempt.findFirst({ where: { examId: exam.id, studentId: stud.id } })

    await prisma.examAttempt.update({
      where: { id: att.id },
      data: { expiresAt: new Date(Date.now() - 30000) }
    })

    const res = await api(`/api/v1/attempts/${att.id}/answers`, {
      method: 'PUT',
      body: { answers: [{ questionId: questions[5].id, selectedOptionIndex: 1 }] },
      token: stud.token
    })

    assert.ok([403, 409].includes(res.status), `Expected 403 or 409 for expired attempt, got ${res.status}`)
    const ans = await prisma.attemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId: att.id, questionId: questions[5].id } }
    })
    assert.strictEqual(ans, null, 'Expired answer must not be saved to DB')
  })

  it('5. Proctoring Micro-Batch Ingestion & Auto-Suspension: 60 rapid events increment count', async () => {
    const stud = students[2]
    const att = await prisma.examAttempt.findFirst({ where: { examId: exam.id, studentId: stud.id } })

    const events = Array.from({ length: 60 }, (_, i) => api('/api/v1/proctoring/events', {
      method: 'POST',
      body: {
        attemptId: att.id, examId: exam.id,
        eventType: i % 2 === 0 ? 'TAB_SWITCH' : 'FULLSCREEN_EXIT', severity: 'HIGH'
      },
      token: stud.token
    }))

    await Promise.all(events)
    await new Promise(r => setTimeout(r, 450))

    const logs = await prisma.proctoringLog.findMany({ where: { attemptId: att.id } })
    assert.strictEqual(logs.length, 60, 'All 60 proctoring events must be flushed to database')

    const updatedAtt = await prisma.examAttempt.findUnique({ where: { id: att.id } })
    assert.strictEqual(updatedAtt.violationCount, 60, 'ExamAttempt.violationCount must accurately be 60')
    assert.strictEqual(updatedAtt.status, 'SUSPENDED', 'Attempt must be auto-suspended after 50 violations')
  })

  it('6. Security & IDOR Negative Checks: Rejects cross-student mutation, unprivileged routes, and unauthenticated requests', async () => {
    const studA = students[3]
    const studB = students[4]
    const attB = await prisma.examAttempt.findFirst({ where: { examId: exam.id, studentId: studB.id } })

    const crossMutate = await api(`/api/v1/attempts/${attB.id}/answers`, {
      method: 'PUT', body: { answers: [{ questionId: questions[0].id, selectedOptionIndex: 1 }] }, token: studA.token
    })
    assert.strictEqual(crossMutate.status, 403, 'Cross-student answer mutation must return 403')

    const crossSubmit = await api(`/api/v1/attempts/${attB.id}/submit`, { method: 'POST', token: studA.token })
    assert.strictEqual(crossSubmit.status, 403, 'Cross-student submit must return 403')

    const forbiddenExam = await api('/api/v1/exams', { method: 'POST', body: { title: 'Hacked Exam' }, token: studA.token })
    assert.strictEqual(forbiddenExam.status, 403, 'Student creating exam must return 403')

    const forbiddenUsers = await api('/api/v1/users', { token: studA.token })
    assert.strictEqual(forbiddenUsers.status, 403, 'Student listing users must return 403')

    const unauthed = await api('/api/v1/attempts/start', { method: 'POST', body: { examId: exam.id } })
    assert.strictEqual(unauthed.status, 401, 'Unauthenticated request must return 401')
  })
})
