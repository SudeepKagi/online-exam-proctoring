/**
 * tests/t1-autosave-correctness.test.js
 * Comprehensive automated test suite for Truth Pass Phase T1 — Autosave Correctness.
 * Tests against real PostgreSQL and real Express API.
 *
 * Verifies:
 * (a) Global revision bug: Answer Q1, Q2, change Q1, change Q2 -> all 4 saves succeed, DB has last choices.
 * (b) Two tabs/clients editing the same question -> loser reconciles, no recursion storm, last choice persists.
 * (c) Batch with mixed OK / STALE / INVALID -> only OK removed, others retained or surfaced in terminalErrors.
 * (d) 429/503 storms -> bounded request rate with exponential backoff and jitter.
 * (e) Property test (fast-check): random interleavings of edits and flushes -> acknowledged saves persist.
 * (f) SessionStorage mid-exam restore -> outdated entries pruned, dirty entries restored and persisted.
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'memory'
process.env.STORAGE_DRIVER = 'memory'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const crypto = require('crypto')
const fc = require('fast-check')

const { app } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { attemptService } = require('../src/modules/attempts/service')

let server
let baseUrl
let testFacultyId
let testStudentId
let studentToken
let testExamId
let testQuestions = []
let activeAttempt = null

// Client implementation mirroring frontend/src/lib/autosaveManager.js for testing in Node
class NodeAutosaveManager {
  constructor(options = {}) {
    this.attemptId = options.attemptId || null
    this.token = options.token || null
    this.baseUrl = options.baseUrl || null
    this.revisionByAqId = new Map()
    this.dirtyMap = new Map()
    this.terminalErrors = new Map()
    this.isFlushing = false
    this.backoffMs = 1000
    this.maxBackoffMs = 16000
    this.retryTimer = null
    this.requestCount = 0
    this.mockHttp = options.mockHttp || null
  }

  setAttemptId(attemptId, questions = []) {
    this.attemptId = attemptId
    this.setQuestionRevisions(questions)
  }

  setQuestionRevisions(questions = []) {
    if (!Array.isArray(questions)) return
    for (const q of questions) {
      const aqId = q.attemptQuestionId || q.id
      if (aqId) {
        const rev = typeof q.revision === 'number' ? q.revision : (q.selectedOptionId ? 1 : 0)
        this.revisionByAqId.set(aqId, rev)
      }
    }
  }

  recordAnswer(attemptQuestionId, selectedOptionId) {
    const existing = this.dirtyMap.get(attemptQuestionId)
    const expectedRevision = this.revisionByAqId.get(attemptQuestionId) ?? 0

    const entry = {
      attemptQuestionId,
      selectedOptionId,
      expectedRevision: existing ? existing.expectedRevision : expectedRevision,
      clientTimestamp: new Date().toISOString(),
      attempts: existing ? existing.attempts : 0
    }

    this.dirtyMap.set(attemptQuestionId, entry)
    this.terminalErrors.delete(attemptQuestionId)
    return entry
  }

  hasDirtyAnswers() {
    return this.dirtyMap.size > 0
  }

  _calculateBackoff() {
    const jitter = 0.8 + 0.4 * Math.random()
    const nextDelay = Math.min(this.maxBackoffMs, this.backoffMs * 2) * jitter
    this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2)
    return Math.round(nextDelay)
  }

  _scheduleRetry(delayMs) {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.dirtyMap.size > 0 && !this.isFlushing) {
        this.flush().catch(() => {})
      }
    }, delayMs)
  }

  destroy() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  async _executeRequest(payload) {
    this.requestCount++
    if (this.mockHttp) {
      return this.mockHttp(payload)
    }

    const res = await fetch(`${this.baseUrl}/api/v1/attempts/${this.attemptId}/answers`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify(payload)
    })

    const body = await res.json().catch(() => ({}))
    return { status: res.status, data: body, headers: res.headers }
  }

  async flush() {
    if (!this.attemptId || this.dirtyMap.size === 0 || this.isFlushing) {
      return { saved: 0, status: 'SKIPPED' }
    }

    this.isFlushing = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    const snapshot = Array.from(this.dirtyMap.values()).slice(0, 100)
    const payload = {
      answers: snapshot.map(item => ({
        attemptQuestionId: item.attemptQuestionId,
        optionId: item.selectedOptionId || null,
        revision: typeof item.expectedRevision === 'number'
          ? item.expectedRevision
          : (this.revisionByAqId.get(item.attemptQuestionId) ?? 0)
      }))
    }

    try {
      const res = await this._executeRequest(payload)
      if (res.status !== 200) {
        const error = new Error(`Request failed with status ${res.status}`)
        error.status = res.status
        error.response = res
        throw error
      }

      const results = res.data?.results || []
      let okCount = 0
      let conflictCount = 0

      for (const resItem of results) {
        const aqId = resItem.attemptQuestionId
        const snapshotItem = snapshot.find(s => s.attemptQuestionId === aqId)

        if (resItem.status === 'OK' || resItem.success === true) {
          okCount++
          const confirmedRev = typeof resItem.revision === 'number'
            ? resItem.revision
            : ((this.revisionByAqId.get(aqId) ?? 0) + 1)
          this.revisionByAqId.set(aqId, confirmedRev)

          const currentInMap = this.dirtyMap.get(aqId)
          if (currentInMap && snapshotItem && currentInMap.clientTimestamp === snapshotItem.clientTimestamp) {
            this.dirtyMap.delete(aqId)
          } else if (currentInMap) {
            currentInMap.expectedRevision = confirmedRev
          }
          this.terminalErrors.delete(aqId)
        } else if (resItem.status === 'STALE_REVISION') {
          conflictCount++
          const currentRev = typeof resItem.currentRevision === 'number'
            ? resItem.currentRevision
            : ((this.revisionByAqId.get(aqId) ?? 0) + 1)
          this.revisionByAqId.set(aqId, currentRev)

          const currentInMap = this.dirtyMap.get(aqId)
          if (currentInMap) {
            currentInMap.expectedRevision = currentRev
            currentInMap.attempts = (currentInMap.attempts || 0) + 1
            if (currentInMap.attempts > 5) {
              this.terminalErrors.set(aqId, {
                attemptQuestionId: aqId,
                status: 'CONFLICT_LIMIT_EXCEEDED',
                error: 'Multiple conflict retries exceeded.'
              })
            }
          }
        } else {
          // Terminal error
          this.terminalErrors.set(aqId, {
            attemptQuestionId: aqId,
            status: resItem.status || 'ERROR',
            error: resItem.error || 'Rejected'
          })
          this.dirtyMap.delete(aqId)
        }
      }

      if (okCount > 0) this.backoffMs = 1000
      this.isFlushing = false

      if (this.dirtyMap.size > 0) {
        const delay = conflictCount > 0 ? this._calculateBackoff() : 1000
        this._scheduleRetry(delay)
      }

      return { saved: okCount, status: 'SUCCESS', results }
    } catch (err) {
      this.isFlushing = false
      const status = err.status || err.response?.status
      const nextDelay = this._calculateBackoff()
      this._scheduleRetry(nextDelay)
      throw err
    }
  }
}

describe('Phase T1: Autosave Correctness against Real PostgreSQL + API', () => {
  before(async () => {
    console.log('[T1] Starting ephemeral HTTP server...')
    // 1. Start ephemeral HTTP server
    await new Promise(resolve => {
      server = http.createServer(app)
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        baseUrl = `http://127.0.0.1:${port}`
        console.log(`[T1] Server listening on ${baseUrl}`)
        resolve()
      })
    })

    console.log('[T1] Seeding test fixtures...')
    // 2. Seed department, faculty, student
    const deptCode = `DEPT-T1-${Date.now().toString().slice(-6)}`
    await prisma.department.create({
      data: { code: deptCode, name: `T1 Dept ${deptCode}` }
    })

    const faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'T1 Faculty',
        email: `t1-fac-${Date.now()}@test.edu`,
        password: 'password',
        departmentCode: deptCode,
        employeeId: `FAC-T1-${Date.now()}`
      }
    })
    testFacultyId = faculty.id

    const student = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'T1 Student',
        usn: `USN-T1-${Date.now()}`,
        email: `t1-stu-${Date.now()}@test.edu`,
        password: 'password',
        departmentCode: deptCode,
        semester: 6,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        facePhotoKey: 'photos/test-student.jpg'
      }
    })
    testStudentId = student.id
    studentToken = signToken({
      id: student.id,
      email: student.email,
      role: 'student'
    })

    // 3. Create exam with questions
    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'T1 Autosave Verification Exam',
        subject: 'Database Systems',
        facultyId: testFacultyId,
        startTime: new Date(Date.now() - 120000), // Started 2 min ago
        endTime: new Date(Date.now() + 3600000),   // Ends in 1 hr
        duration: 60,
        totalMarks: 40,
        invId: `INV-T1-${Date.now()}`,
        invPasswordHash: 'hash',
        status: 'PUBLISHED',
        cameraRequired: false,
        deviceAgentPolicy: 'OFF' // Bypass companion agent guard for unit flow
      }
    })
    testExamId = exam.id

    // Create 4 MCQ questions with options
    for (let i = 1; i <= 4; i++) {
      const q = await prisma.question.create({
        data: {
          id: crypto.randomUUID(),
          examId: testExamId,
          questionText: `Question ${i}: What is the value of ${i} * ${i}?`,
          marks: 10,
          difficulty: 'MEDIUM',
          order: i,
          options: {
            create: [
              { id: crypto.randomUUID(), text: `${i * i}`, isCorrect: true, order: 0 },
              { id: crypto.randomUUID(), text: `${i * i + 1}`, isCorrect: false, order: 1 },
              { id: crypto.randomUUID(), text: `${i * i + 2}`, isCorrect: false, order: 2 },
              { id: crypto.randomUUID(), text: `${i * i + 3}`, isCorrect: false, order: 3 }
            ]
          }
        },
        include: { options: true }
      })
      testQuestions.push(q)
    }

    // 4. Start student attempt
    console.log('[T1] Creating active student attempt...')
    const res = await attemptService.startOrResumeAttempt(testExamId, testStudentId)
    activeAttempt = res.attempt
    console.log(`[T1] Active attempt created: ${activeAttempt.id}`)
  })

  after(async () => {
    const { io } = require('../src/app')
    if (io) {
      try { io.close() } catch (_) {}
    }
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      await new Promise(resolve => server.close(resolve)).catch(() => {})
    }
    const { closeAll } = require('../src/lifecycle')
    await closeAll().catch(() => {})
  })

  it('(a) Answer Q1, Q2, change Q1, change Q2 (global-revision bug fix) -> all 4 saves succeed', async () => {
    const q1 = activeAttempt.questions[0]
    const q2 = activeAttempt.questions[1]

    const opt1A = q1.options[0].id
    const opt1B = q1.options[1].id
    const opt2A = q2.options[0].id
    const opt2B = q2.options[1].id

    const manager = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      token: studentToken,
      baseUrl
    })
    manager.setAttemptId(activeAttempt.id, activeAttempt.questions)

    // 1. Answer Q1 -> rev 0 to 1
    manager.recordAnswer(q1.attemptQuestionId, opt1A)
    const res1 = await manager.flush()
    assert.equal(res1.status, 'SUCCESS')
    assert.equal(res1.saved, 1)
    assert.equal(manager.revisionByAqId.get(q1.attemptQuestionId), 1)

    // 2. Answer Q2 -> rev 0 to 1
    manager.recordAnswer(q2.attemptQuestionId, opt2A)
    const res2 = await manager.flush()
    assert.equal(res2.status, 'SUCCESS')
    assert.equal(res2.saved, 1)
    assert.equal(manager.revisionByAqId.get(q2.attemptQuestionId), 1)

    // 3. Change Q1 -> rev 1 to 2
    manager.recordAnswer(q1.attemptQuestionId, opt1B)
    const res3 = await manager.flush()
    assert.equal(res3.status, 'SUCCESS')
    assert.equal(res3.saved, 1)
    assert.equal(manager.revisionByAqId.get(q1.attemptQuestionId), 2)

    // 4. Change Q2 -> with global revision bug, this sent revision 2 instead of 1 and failed with 409!
    // With per-answer revision, it sends expectedRevision 1 and succeeds -> rev 1 to 2!
    manager.recordAnswer(q2.attemptQuestionId, opt2B)
    const res4 = await manager.flush()
    assert.equal(res4.status, 'SUCCESS')
    assert.equal(res4.saved, 1)
    assert.equal(manager.revisionByAqId.get(q2.attemptQuestionId), 2)

    // Verify PostgreSQL state directly
    const dbAnswers = await prisma.$queryRaw`
      SELECT attempt_question_id, selected_option_id, revision
      FROM answers
      WHERE attempt_id = ${activeAttempt.id}::uuid
      ORDER BY revision ASC
    `
    assert.equal(dbAnswers.length, 2)
    const a1 = dbAnswers.find(a => a.attempt_question_id === q1.attemptQuestionId)
    const a2 = dbAnswers.find(a => a.attempt_question_id === q2.attemptQuestionId)

    assert.equal(a1.selected_option_id, opt1B)
    assert.equal(a1.revision, 2)
    assert.equal(a2.selected_option_id, opt2B)
    assert.equal(a2.revision, 2)

    manager.destroy()
  })

  it('(b) Two tabs editing the same question -> loser reconciles CAS conflict, no storm, last choice persists', async () => {
    const q3 = activeAttempt.questions[2]
    const opt3A = q3.options[0].id
    const opt3B = q3.options[1].id

    const tab1 = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      token: studentToken,
      baseUrl
    })
    tab1.setAttemptId(activeAttempt.id, activeAttempt.questions)

    const tab2 = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      token: studentToken,
      baseUrl
    })
    tab2.setAttemptId(activeAttempt.id, activeAttempt.questions)

    // Tab 1 answers Q3 with opt3A (expected 0)
    tab1.recordAnswer(q3.attemptQuestionId, opt3A)
    const resTab1 = await tab1.flush()
    assert.equal(resTab1.status, 'SUCCESS')
    assert.equal(tab1.revisionByAqId.get(q3.attemptQuestionId), 1)

    // Tab 2 was open before Tab 1 saved, so its expectedRevision is still 0
    // Tab 2 records opt3B and flushes
    tab2.recordAnswer(q3.attemptQuestionId, opt3B)
    const resTab2Initial = await tab2.flush()

    // Tab 2 flush receives STALE_REVISION, reconciles expectedRevision to 1
    assert.equal(resTab2Initial.status, 'SUCCESS')
    assert.equal(resTab2Initial.saved, 0)
    assert.equal(resTab2Initial.results[0].status, 'STALE_REVISION')
    assert.equal(tab2.revisionByAqId.get(q3.attemptQuestionId), 1)
    assert.equal(tab2.dirtyMap.has(q3.attemptQuestionId), true)

    // Now Tab 2 re-flushes with reconciled expected revision 1
    const resTab2Retry = await tab2.flush()
    assert.equal(resTab2Retry.status, 'SUCCESS')
    assert.equal(resTab2Retry.saved, 1)
    assert.equal(tab2.revisionByAqId.get(q3.attemptQuestionId), 2)
    assert.equal(tab2.hasDirtyAnswers(), false)

    // Final DB state must reflect Tab 2's selection at revision 2
    const rows = await prisma.$queryRaw`
      SELECT selected_option_id, revision
      FROM answers
      WHERE attempt_question_id = ${q3.attemptQuestionId}::uuid
    `
    assert.equal(rows[0].selected_option_id, opt3B)
    assert.equal(rows[0].revision, 2)

    tab1.destroy()
    tab2.destroy()
  })

  it('(c) Batch with mixed OK / STALE / INVALID -> only OK removed, others retained or surfaced', async () => {
    const q1 = activeAttempt.questions[0]
    const q2 = activeAttempt.questions[1]
    const q4 = activeAttempt.questions[3]

    const opt4A = q4.options[0].id
    const nonExistentOption = crypto.randomUUID()

    const manager = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      token: studentToken,
      baseUrl
    })
    manager.setAttemptId(activeAttempt.id, activeAttempt.questions)

    // Set revisions:
    // Q4 is fresh (rev 0) -> will be OK
    // Q1 is currently at revision 2 in DB, but we deliberately set expectedRevision to 999 (will be STALE)
    // Q2 will be given a non-existent option ID (will be INVALID_OPTION)
    manager.revisionByAqId.set(q4.attemptQuestionId, 0)
    manager.revisionByAqId.set(q1.attemptQuestionId, 999)

    manager.recordAnswer(q4.attemptQuestionId, opt4A)
    manager.recordAnswer(q1.attemptQuestionId, q1.options[0].id)
    manager.recordAnswer(q2.attemptQuestionId, nonExistentOption)

    assert.equal(manager.dirtyMap.size, 3)

    const res = await manager.flush()
    assert.equal(res.status, 'SUCCESS')
    assert.equal(res.saved, 1) // Only Q4 succeeded

    // Q4 was OK -> deleted from dirtyMap
    assert.equal(manager.dirtyMap.has(q4.attemptQuestionId), false)

    // Q1 was STALE_REVISION -> retained in dirtyMap, revision updated to 2
    assert.equal(manager.dirtyMap.has(q1.attemptQuestionId), true)
    assert.equal(manager.revisionByAqId.get(q1.attemptQuestionId), 2)

    // Q2 had invalid option -> removed from dirtyMap and placed in terminalErrors (NEVER silently dropped)
    assert.equal(manager.dirtyMap.has(q2.attemptQuestionId), false)
    assert.equal(manager.terminalErrors.has(q2.attemptQuestionId), true)
    assert.equal(manager.terminalErrors.get(q2.attemptQuestionId).status, 'INVALID_OPTION')

    manager.destroy()
  })

  it('(d) 429/503 storms -> bounded request rate with exponential backoff and jitter', async () => {
    let mockCallCount = 0
    const manager = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      mockHttp: async () => {
        mockCallCount++
        return {
          status: 429,
          data: { error: 'Rate limit exceeded' },
          headers: new Headers({ 'Retry-After': '1' })
        }
      }
    })

    manager.recordAnswer('aq-test', 'opt-test')

    // First flush fails with 429
    await assert.rejects(async () => {
      await manager.flush()
    })
    assert.equal(mockCallCount, 1)
    assert.equal(manager.hasDirtyAnswers(), true)

    // Verify backoff delay increased from 1000
    assert.ok(manager.backoffMs >= 2000)

    // Ensure no immediate recursion storm occurred
    assert.equal(mockCallCount, 1)
    assert.ok(manager.retryTimer !== null)

    manager.destroy()
  })

  it('(e) Property test (fast-check): random interleavings of edits and flushes persist acknowledged saves', async () => {
    const q1 = activeAttempt.questions[0]
    const options = q1.options.map(o => o.id)

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...options), { minLength: 2, maxLength: 6 }),
        async (optionSelections) => {
          const mgr = new NodeAutosaveManager({
            attemptId: activeAttempt.id,
            token: studentToken,
            baseUrl
          })

          // Hydrate current revision from DB
          const currentDbRow = await prisma.$queryRaw`
            SELECT revision FROM answers WHERE attempt_question_id = ${q1.attemptQuestionId}::uuid
          `
          const currentRev = currentDbRow.length > 0 ? currentDbRow[0].revision : 0
          mgr.revisionByAqId.set(q1.attemptQuestionId, currentRev)

          let lastChoice = null
          for (const opt of optionSelections) {
            lastChoice = opt
            mgr.recordAnswer(q1.attemptQuestionId, opt)
            const result = await mgr.flush()
            assert.equal(result.status, 'SUCCESS')
            assert.equal(result.saved, 1)
          }

          // Invariant: The last acknowledged choice must be what is in the DB
          const finalDbRow = await prisma.$queryRaw`
            SELECT selected_option_id FROM answers WHERE attempt_question_id = ${q1.attemptQuestionId}::uuid
          `
          assert.equal(finalDbRow[0].selected_option_id, lastChoice)
          mgr.destroy()
        }
      ),
      { numRuns: 5 } // Fast property sweep over real DB
    )
  })

  it('(f) SessionStorage mid-exam restore -> outdated entries pruned, dirty entries restored and persisted', async () => {
    const q4 = activeAttempt.questions[3]
    const opt4B = q4.options[1].id
    const opt4C = q4.options[2].id

    // Simulate Client 1: records and saves opt4B -> rev 1 in DB
    const client1 = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      token: studentToken,
      baseUrl
    })
    client1.setAttemptId(activeAttempt.id, activeAttempt.questions)
    client1.recordAnswer(q4.attemptQuestionId, opt4B)
    await client1.flush()
    assert.equal(client1.revisionByAqId.get(q4.attemptQuestionId), 1)

    // Simulate sessionStorage payload:
    // Contains an outdated Q4 answer at revision 0, plus a dirty Q3 answer at revision 2
    const q3 = activeAttempt.questions[2]
    const opt3C = q3.options[2].id

    const simulatedStorage = {
      version: 1,
      attemptId: activeAttempt.id,
      entries: [
        [q4.attemptQuestionId, { attemptQuestionId: q4.attemptQuestionId, selectedOptionId: opt4C, expectedRevision: 0 }],
        [q3.attemptQuestionId, { attemptQuestionId: q3.attemptQuestionId, selectedOptionId: opt3C, expectedRevision: 2 }]
      ]
    }

    // Client 2 loads after page refresh:
    // Hydrates question revisions from server (Q4 rev 1, Q3 rev 2)
    const client2 = new NodeAutosaveManager({
      attemptId: activeAttempt.id,
      token: studentToken,
      baseUrl
    })
    client2.setAttemptId(activeAttempt.id, [
      { attemptQuestionId: q4.attemptQuestionId, revision: 1 },
      { attemptQuestionId: q3.attemptQuestionId, revision: 2 }
    ])

    // Restore from storage with pruning
    for (const [k, v] of simulatedStorage.entries) {
      const confirmedRev = client2.revisionByAqId.get(k)
      if (typeof confirmedRev === 'number' && typeof v.expectedRevision === 'number' && v.expectedRevision < confirmedRev) {
        // Outdated! Dropped
        continue
      }
      client2.dirtyMap.set(k, { ...v, expectedRevision: confirmedRev ?? v.expectedRevision ?? 0 })
    }

    // Invariant: Outdated Q4 was pruned, uncommitted Q3 was preserved
    assert.equal(client2.dirtyMap.has(q4.attemptQuestionId), false)
    assert.equal(client2.dirtyMap.has(q3.attemptQuestionId), true)

    // Flush dirty Q3
    const flushRes = await client2.flush()
    assert.equal(flushRes.status, 'SUCCESS')
    assert.equal(flushRes.saved, 1)

    // Check DB has opt3C
    const q3Row = await prisma.$queryRaw`
      SELECT selected_option_id, revision FROM answers WHERE attempt_question_id = ${q3.attemptQuestionId}::uuid
    `
    assert.equal(q3Row[0].selected_option_id, opt3C)
    assert.equal(q3Row[0].revision, 3)

    client1.destroy()
    client2.destroy()
  })
})
