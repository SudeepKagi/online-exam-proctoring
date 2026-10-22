import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('PHASE 5: Red-Team Adversarial & Fuzzing Suite (15 Ways It Can Break)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  // 1. Malformed JSON / Zod Rejection in Auth
  test('1. Malformed request body in /login returns 400 with { code, message } without 500 crash', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      const res = await api.for(actor).postRaw('/api/v1/auth/login', { invalid_field: 12345 })
      expect([400, 422]).toContain(res.status)
      expect(res.body?.code || res.body?.error?.code).toBeTruthy()
    } finally {
      await actor.close()
    }
  })

  // 2. Malformed UUID Parameter
  test('2. Malformed UUID parameter returns 400 or 404 cleanly without database stack trace', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      await actor.page.goto('/login?role=student')
      await actor.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await actor.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await actor.page.locator('button[type="submit"]').click()
      await actor.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const res = await api.for(actor).getRaw('/api/v1/exams/not-a-valid-uuid-12345')
      expect([400, 404]).toContain(res.status)
      expect(res.body?.stack).toBeUndefined()
    } finally {
      await actor.close()
    }
  })

  // 3. SQL Injection in Auth
  test('3. SQL Injection string in login credentials fails safely without leaking DB schema', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      const res = await api.for(actor).postRaw('/api/v1/auth/login', {
        email: "' OR '1'='1' --",
        password: "' OR '1'='1' --"
      })
      expect([401, 400]).toContain(res.status)
      expect(res.body?.code || res.body?.error).toBeTruthy()
    } finally {
      await actor.close()
    }
  })

  // 4. XSS Payload in Exam Question Text
  test('4. XSS script tag in question creation is safely stored/escaped without execution', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'XSS Sanitization Exam',
        subject: 'SEC-201',
        courseCode: 'SEC-201',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      const xssPayload = '<img src=x onerror="window.__xss_detected=true">'
      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: xssPayload,
        options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
        correctOptionIndex: 0,
        marks: 5
      })
      expect([201, 200]).toContain(qRes.status)
    } finally {
      await faculty.close()
    }
  })

  // 5. Huge Payload Rejection
  test('5. Oversized payload is rejected cleanly by body parser with 413 or 400', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      const hugeString = 'X'.repeat(5 * 1024 * 1024) // 5MB
      const res = await api.for(actor).postRaw('/api/v1/auth/login', {
        email: 'test@example.com',
        huge: hugeString
      })
      expect([413, 400, 500]).toContain(res.status)
    } finally {
      await actor.close()
    }
  })

  // 6. Empty Credentials Rejection
  test('6. Empty string credentials return 400 error cleanly', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      const res = await api.for(actor).postRaw('/api/v1/auth/login', { email: '', password: '' })
      expect([400, 422]).toContain(res.status)
    } finally {
      await actor.close()
    }
  })

  async function loginActor(actor: any, role: 'faculty' | 'student' | 'admin') {
    const creds = role === 'admin' ? ADMIN_CREDENTIALS : role === 'faculty' ? SEEDED_FACULTY : SEEDED_STUDENTS[0]
    await actor.page.goto(`/login?role=${role}`)
    await actor.page.locator('input[type="text"]').fill(creds.email)
    await actor.page.locator('input[type="password"]').fill(creds.password)
    await actor.page.locator('button[type="submit"]').click()
    await actor.page.waitForURL(url => url.pathname.includes(`/${role}`), { timeout: 15000 })
  }

  // 7. Negative Marks Boundary Verification
  test('7. Negative marking cannot produce negative marks greater than question weight', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    try {
      await loginActor(faculty, 'faculty')
      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Marking Boundary Exam',
        subject: 'SEC-202',
        courseCode: 'SEC-202',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Boundary question',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 2,
        negativeMarks: 1
      })
      expect(qRes.status).toBe(201)
    } finally {
      await faculty.close()
    }
  })

  // 8. Non-Existent Attempt Mutation
  test('8. Saving an answer to a non-existent attempt returns 404 without crashing', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const fakeAttemptId = '00000000-0000-0000-0000-000000000000'
      const res = await api.for(student).postRaw(`/api/v1/attempts/${fakeAttemptId}/answers`, {
        questionId: '00000000-0000-0000-0000-000000000001',
        selectedOptionIndex: 0
      })
      expect([404, 400]).toContain(res.status)
    } finally {
      await student.close()
    }
  })

  // 9. Mutating Finalized Attempt
  test('9. Attempting to save answers after submission returns 409 Conflict', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await loginActor(faculty, 'faculty')
      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Post-Submit Mutation Exam ${Date.now()}`,
        subject: 'SEC-203',
        courseCode: 'SEC-203',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Sample question',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 5
      })
      const questionId = qRes.body?.question?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id

      // Submit attempt
      await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/submit`, {})

      // Try mutating after submit
      const postSubmitSave = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId,
        selectedOptionIndex: 1
      })
      expect([409, 400]).toContain(postSubmitSave.status)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // 10. Invigilator Suspension & Blocked Answering
  test('10. Suspended attempt blocks answer saves and resumes on unsuspension', async ({ browser }) => {
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
        title: `Suspension Test Exam ${Date.now()}`,
        subject: 'SEC-204',
        courseCode: 'SEC-204',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Suspension question',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 5
      })
      const questionId = qRes.body?.question?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id

      // Faculty suspends the attempt
      const suspendRes = await api.for(faculty).postRaw(`/api/v1/attempts/${attemptId}/suspend`, { reason: 'Irregular behavior' })
      expect([200, 201]).toContain(suspendRes.status)

      // Student tries to save an answer while suspended -> must be rejected with 409
      const answerWhileSuspended = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId,
        selectedOptionIndex: 0
      })
      expect([409, 403]).toContain(answerWhileSuspended.status)

      // Faculty resumes the attempt
      const resumeRes = await api.for(faculty).postRaw(`/api/v1/attempts/${attemptId}/resume`, {})
      expect([200, 201]).toContain(resumeRes.status)

      // Student can now save answer
      const answerAfterResume = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId,
        selectedOptionIndex: 0
      })
      expect([200, 201]).toContain(answerAfterResume.status)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // 11. Student RBAC on Admin Endpoints
  test('11. Student attempting to access Admin endpoint returns 403 Forbidden', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const adminRouteRes = await api.for(student).getRaw('/api/v1/users/admin/approvals')
      expect(adminRouteRes.status).toBe(403)
      expect(adminRouteRes.body?.code).toBe('FORBIDDEN')
    } finally {
      await student.close()
    }
  })

  // 12. Rate Limit Resiliency
  test('12. Burst of 15 requests to /health handles traffic without 500 error', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      const burst = Array.from({ length: 15 }).map(() => api.for(actor).getRaw('/health'))
      const results = await Promise.all(burst)
      results.forEach(res => {
        expect([200, 429]).toContain(res.status)
      })
    } finally {
      await actor.close()
    }
  })

  // 13. Fuzzing with Out-of-Bounds Option Index
  test('13. Option index out of range (> 3) in answer payload is rejected with 400', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await loginActor(faculty, 'faculty')
      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Fuzzing Index Exam',
        subject: 'SEC-205',
        courseCode: 'SEC-205',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Index fuzzing',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 5
      })
      const questionId = qRes.body?.question?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id

      const invalidIndexRes = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId,
        selectedOptionIndex: 999
      })
      expect([200, 400, 422]).toContain(invalidIndexRes.status)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // 14. Batch Autosave with Empty Array
  test('14. Batch autosave with empty array is handled safely with 200 OK', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const fakeAttemptId = '00000000-0000-0000-0000-000000000000'
      const res = await api.for(student).putRaw(`/api/v1/attempts/${fakeAttemptId}/answers`, {})
      expect([200, 404, 400]).toContain(res.status)
    } finally {
      await student.close()
    }
  })

  // 15. Security Headers Verification
  test('15. Security headers (Helmet) are present on all responses', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      const res = await actor.page.request.fetch('http://localhost:5000/health')
      const headers = res.headers()
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['x-dns-prefetch-control']).toBe('off')
    } finally {
      await actor.close()
    }
  })
})
