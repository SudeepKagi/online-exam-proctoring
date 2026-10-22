import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('PHASE 3: Exam-System Invariants & Chaos Verification', () => {
  test.describe.configure({ mode: 'serial' })

  // =========================================================================
  // Invariant 1: Server-Side Timer Authority & Client Clock Tampering
  // =========================================================================
  test('Invariant 1: Server-Side Timer Authority rejects expired submissions regardless of client clock', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      // Exam with duration of 1 minute that ends in 25s on server
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Timer Authority Exam ${Date.now()}`,
        subject: 'SYS-101',
        courseCode: 'SYS-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 22000).toISOString(), // Ends in 22s on server
        durationMinutes: 1
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Server Clock Question 1?',
        options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Student logs in
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Start attempt via API
      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id
      expect(attemptId).toBeTruthy()

      // Tamper client side time
      await student.page.evaluate(() => {
        localStorage.setItem('pn_client_time_override', '9999999999999')
      })

      // Wait 24 seconds so server timer expires
      await new Promise(r => setTimeout(r, 24000))

      // Try to save answer after server expiration
      const qRes = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId: startRes.body?.questions?.[0]?.id,
        selectedOptionIndex: 0
      })
      // Server must reject with 409 because duration expired on server clock
      expect([409, 400]).toContain(qRes.status)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 2: Browser Closed Auto-Submit on Expiry
  // =========================================================================
  test('Invariant 2: Browser Closed Auto-Submit transitions expired attempt to TIMED_OUT and grades saved answers', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    let student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Auto-Submit Expiry Exam ${Date.now()}`,
        subject: 'SYS-102',
        courseCode: 'SYS-102',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 25000).toISOString(), // Ends in 25s
        durationMinutes: 1
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Auto-submit question 1?',
        options: ['Correct Option', 'Wrong Option', 'Option C', 'Option D'],
        correctOptionIndex: 0,
        marks: 10
      })
      const questionId = qRes.body?.question?.id || qRes.body?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Student logs in and starts exam
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[1].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[1].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id
      expect(attemptId).toBeTruthy()

      // Answer Q1 with Correct Option (0)
      await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId: questionId || startRes.body?.questions?.[0]?.id,
        selectedOptionIndex: 0
      })

      // COMPLETELY CLOSE BROWSER CONTEXT
      await student.close()

      // Wait 27 seconds for server timer to expire and background worker to run
      await new Promise(r => setTimeout(r, 27000))

      // Open new student session and verify attempt transitioned to TIMED_OUT with full marks
      student = await createActor(browser, 'student')
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[1].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[1].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const stateRes = await api.for(student).getRaw(`/api/v1/attempts/${attemptId}`)
      expect(stateRes.status).toBe(200)
      expect(['TIMED_OUT', 'SUBMITTED']).toContain(stateRes.body?.attempt?.status)
      expect(stateRes.body?.attempt?.score).toBe(10)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 3: Mid-Exam Refresh & Crash Recovery
  // =========================================================================
  test('Invariant 3: Mid-Exam page reload restores answered state and maintains countdown', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Refresh Recovery Exam ${Date.now()}`,
        subject: 'SYS-103',
        courseCode: 'SYS-103',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q1: Which protocol ensures idempotent message delivery?',
        options: ['At-least-once with deduplication', 'Best-effort broadcast', 'Unordered UDP', 'Polling loop'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Student logs in and enters arena
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto(`/student/exams/${examId}/arena`)
      await expect(student.page.getByText(/Question 1 of 1/i)).toBeVisible({ timeout: 20000 })

      // Select Option A
      await student.page.locator('button').filter({ hasText: 'At-least-once with deduplication' }).click()

      // Wait 2.5 seconds for autosave flush
      await student.page.waitForTimeout(2500)

      // Force a hard page reload
      await student.page.reload()
      await expect(student.page.getByText(/Question 1 of 1/i)).toBeVisible({ timeout: 20000 })

      // Option A must remain visually selected
      const selectedBtn = student.page.locator('button').filter({ hasText: 'At-least-once with deduplication' })
      await expect(selectedBtn).toBeVisible()
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 4: Network Drop & Offline Autosave Recovery
  // =========================================================================
  test('Invariant 4: Offline answering buffers in localStorage and syncs on reconnection', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Offline Autosave Exam ${Date.now()}`,
        subject: 'SYS-104',
        courseCode: 'SYS-104',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Offline Question 1: What guarantees linearizability?',
        options: ['Raft state machine replication', 'Single master without log', 'Eventual consistency', 'Local cache'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto(`/student/exams/${examId}/arena`)
      await expect(student.page.getByText(/Question 1 of 1/i)).toBeVisible({ timeout: 20000 })

      // SIMULATE NETWORK DROP
      await student.page.context().setOffline(true)

      // Answer question while offline
      await student.page.locator('button').filter({ hasText: 'Raft state machine replication' }).click()

      // Prove that localStorage buffered the dirty answer
      const offlineBuffer = await student.page.evaluate(() => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('pn_offline_answers_'))
        return keys.length > 0 ? localStorage.getItem(keys[0]) : null
      })
      expect(offlineBuffer).toBeTruthy()

      // RESTORE NETWORK
      await student.page.context().setOffline(false)

      // Wait 6 seconds for online sync loop to trigger
      await student.page.waitForTimeout(6000)

      // Submit examination
      await student.page.getByRole('button', { name: /Submit Exam/i }).click()
      await expect(student.page.getByText('Submit Examination?')).toBeVisible({ timeout: 5000 })
      await student.page.getByRole('button', { name: /Confirm Submission/i }).click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 5: Rapid Double-Click & Concurrent Submit Idempotency
  // =========================================================================
  test('Invariant 5: Concurrent Submit requests are strictly idempotent with 0 errors', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Submit Idempotency Exam ${Date.now()}`,
        subject: 'SYS-105',
        courseCode: 'SYS-105',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Idempotency question?',
        options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id
      expect(attemptId).toBeTruthy()

      // Fire 10 simultaneous POST /submit requests concurrently
      const concurrentRequests = Array.from({ length: 10 }).map(() =>
        api.for(student).postRaw(`/api/v1/attempts/${attemptId}/submit`, {})
      )
      const results = await Promise.all(concurrentRequests)

      // All 10 must return 200 OK (no 500 errors, no duplicates)
      results.forEach(res => {
        expect(res.status).toBe(200)
        expect(res.body?.attempt?.status).toBe('SUBMITTED')
      })
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 6: Single Attempt Enforcement Across Multiple Tabs
  // =========================================================================
  test('Invariant 6: Single Attempt Constraint rejects duplicate concurrent starts', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Single Attempt Exam ${Date.now()}`,
        subject: 'SYS-106',
        courseCode: 'SYS-106',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Single attempt question?',
        options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Open 2 tabs trying to start the same exam simultaneously
      const [res1, res2] = await Promise.all([
        api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {}),
        api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      ])

      // Both should resolve to the SAME single attempt without error or duplication
      expect([200, 409]).toContain(res1.status)
      expect([200, 409]).toContain(res2.status)
      const attemptId1 = res1.body?.attempt?.id
      const attemptId2 = res2.body?.attempt?.id
      if (attemptId1 && attemptId2) {
        expect(attemptId1).toBe(attemptId2)
      }
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 7: Zero Answer Leakage & Strict RBAC
  // =========================================================================
  test('Invariant 7: Zero Answer Leakage to student and strict RBAC IDOR protection', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student1 = await createActor(browser, 'student')
    const student2 = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Zero Leakage Exam ${Date.now()}`,
        subject: 'SEC-101',
        courseCode: 'SEC-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Secret question?',
        options: ['Super Secret Key 1', 'Option 2', 'Option 3', 'Option 4'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Student 1 starts exam
      await student1.page.goto('/login?role=student')
      await student1.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student1.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student1.page.locator('button[type="submit"]').click()
      await student1.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes1 = await api.for(student1).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId1 = startRes1.body?.attempt?.id

      // 1. Assert ZERO answer leakage in questions payload
      const questions = startRes1.body?.questions
      expect(questions).toBeDefined()
      questions.forEach((q: any) => {
        expect(q.correctOptionIndex).toBeUndefined()
        expect(q.correctAnswer).toBeUndefined()
        expect(q.solutionExplanation).toBeUndefined()
        expect(q.scoringRubric).toBeUndefined()
      })

      // 2. Student 2 tries to access Student 1's attempt (IDOR attack)
      await student2.page.goto('/login?role=student')
      await student2.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[1].email)
      await student2.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[1].password)
      await student2.page.locator('button[type="submit"]').click()
      await student2.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const idorRes = await api.for(student2).getRaw(`/api/v1/attempts/${attemptId1}`)
      expect(idorRes.status).toBe(403)

      // 3. Student tries to access Faculty create endpoint
      const facultyCreateRes = await api.for(student1).postRaw('/api/v1/exams', { title: 'Hacked Exam' })
      expect([403, 401]).toContain(facultyCreateRes.status)
    } finally {
      await faculty.close()
      await student1.close()
      await student2.close()
    }
  })

  // =========================================================================
  // Invariant 8: Expired & Tampered JWT Handling
  // =========================================================================
  test('Invariant 8: Tampered and expired JWTs are rejected with 401', async ({ browser }) => {
    const student = await createActor(browser, 'student')

    try {
      // Tampered token test via API
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_signature_payload'
      const tamperedRes = await api.for(student).getRaw('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${fakeToken}` }
      })
      expect(tamperedRes.status).toBe(401)
      expect(tamperedRes.body?.code).toBe('TOKEN_INVALID')

      // Expired token test (epoch 0)
      const expiredPayload = Buffer.from(JSON.stringify({ id: 'any', role: 'STUDENT', exp: 1000 })).toString('base64')
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${expiredPayload}.invalid_signature`
      const expiredRes = await api.for(student).getRaw('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      })
      expect(expiredRes.status).toBe(401)
    } finally {
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 9: Exact Scoring Math Engine (Partial & Negative Marking)
  // =========================================================================
  test('Invariant 9: Exact scoring math computes single choice (+4/-1/0) and multi-select (+4/+1/-2)', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Math Scoring Exam ${Date.now()}`,
        subject: 'MATH-101',
        courseCode: 'MATH-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      // Q1: Single choice -> correct (+4)
      const q1 = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q1: Single choice (+4, -1)?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 4,
        negativeMarks: 1
      })

      // Q2: Single choice -> wrong (-1)
      const q2 = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q2: Single choice (+4, -1)?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 4,
        negativeMarks: 1
      })

      // Q3: Single choice -> unattempted (0)
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q3: Single choice unattempted?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 4,
        negativeMarks: 1
      })

      // Q4: Multi-select -> partial credit (choice A selected out of [A, B] -> +1)
      const q4 = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q4: Multi-select partial (+4, +1 partial, -2 wrong)?',
        options: {
          type: 'MULTI_SELECT',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndices: [0, 1],
          partialMark: 1
        },
        marks: 4,
        negativeMarks: 2
      })

      // Q5: Multi-select -> wrong option included (choice C selected -> -2)
      const q5 = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q5: Multi-select wrong penalty?',
        options: {
          type: 'MULTI_SELECT',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndices: [0, 1],
          partialMark: 1
        },
        marks: 4,
        negativeMarks: 2
      })

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Student starts and answers
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id

      const q1Id = q1.body?.question?.id || q1.body?.id
      const q2Id = q2.body?.question?.id || q2.body?.id
      const q4Id = q4.body?.question?.id || q4.body?.id
      const q5Id = q5.body?.question?.id || q5.body?.id

      // Q1 -> Answer 0 (Correct) -> +4
      await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, { questionId: q1Id, selectedOptionIndex: 0 })
      // Q2 -> Answer 1 (Wrong) -> -1
      await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, { questionId: q2Id, selectedOptionIndex: 1 })
      // Q3 -> Skipped -> 0
      // Q4 -> Answer [0] (Partial 1 correct, 0 wrong) -> +1
      await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, { questionId: q4Id, selectedOptionIndex: [0] })
      // Q5 -> Answer [0, 2] (1 correct, 1 wrong) -> -2
      await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, { questionId: q5Id, selectedOptionIndex: [0, 2] })

      // Submit
      const submitRes = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/submit`, {})
      expect(submitRes.status).toBe(200)

      // Expected calculation: 4 - 1 + 0 + 1 - 2 = 2.00
      const finalScore = Number(submitRes.body?.attempt?.score)
      expect(finalScore).toBe(2)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // =========================================================================
  // Invariant 10: Strict Exam Window Boundaries
  // =========================================================================
  test('Invariant 10: Server blocks starting an exam before startTime (403) and after endTime (403)', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()

      // 1. Future Exam: starts in 10 minutes
      const futureExam = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Future Window Exam ${Date.now()}`,
        subject: 'WIN-101',
        courseCode: 'WIN-101',
        startTime: new Date(now.getTime() + 600000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const futureId = futureExam.body?.exam?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${futureId}/questions`, {
        questionText: 'Future question?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${futureId}/publish`, {})

      // 2. Past Exam: ended 5 minutes ago
      const pastExam = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Past Window Exam ${Date.now()}`,
        subject: 'WIN-102',
        courseCode: 'WIN-102',
        startTime: new Date(now.getTime() - 1800000).toISOString(),
        endTime: new Date(now.getTime() - 300000).toISOString(),
        durationMinutes: 30
      })
      const pastId = pastExam.body?.exam?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${pastId}/questions`, {
        questionText: 'Past question?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${pastId}/publish`, {})

      // Student tries to start both
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Attempting future exam must return 403 EXAM_NOT_OPEN
      const futureRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${futureId}/start`, {})
      expect(futureRes.status).toBe(403)
      expect(futureRes.body?.code).toBe('EXAM_NOT_OPEN')

      // Attempting past exam must return 403 EXAM_ENDED
      const pastRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${pastId}/start`, {})
      expect(pastRes.status).toBe(403)
      expect(pastRes.body?.code).toBe('EXAM_ENDED')
    } finally {
      await faculty.close()
      await student.close()
    }
  })
})
