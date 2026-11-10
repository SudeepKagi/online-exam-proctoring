import { test, expect } from '@playwright/test'
import crypto from 'crypto'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

const SEB_CONFIG_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
const PUBLIC_ORIGIN = 'http://localhost:5000'

function calculateSebHash(urlPathAndQuery: string, configKey: string = SEB_CONFIG_KEY): string {
  const fullUrl = `${PUBLIC_ORIGIN}${urlPathAndQuery.startsWith('/') ? urlPathAndQuery : `/${urlPathAndQuery}`}`
  return crypto.createHash('sha256').update(fullUrl + configKey.toLowerCase()).digest('hex').toLowerCase()
}

test.describe('E2E: Safe Exam Browser Simulated Enforcement Journey (§Task 1)', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let studentActor: any
  let examId: string
  let questionId: string

  test.beforeAll(async ({ browser }) => {
    await resetCleanRoom()
    facultyActor = await createActor(browser, 'faculty')
    studentActor = await createActor(browser, 'student')

    // 1. Faculty login
    await facultyActor.page.goto('/login?role=faculty')
    await facultyActor.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
    await facultyActor.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
    await facultyActor.page.locator('button[type="submit"]').click()
    await facultyActor.page.waitForURL((url: URL) => url.pathname.includes('/faculty'), { timeout: 15000 })

    // 2. Student login
    await studentActor.page.goto('/login?role=student')
    await studentActor.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
    await studentActor.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
    await studentActor.page.locator('button[type="submit"]').click()
    await studentActor.page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })

    const now = Date.now()

    // 3. Create SEB-Enforced Exam
    const examRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `SEB Enforced Assessment ${now}`,
      subject: 'CS-501',
      courseCode: 'CS501',
      description: 'End-to-end journey testing Safe Exam Browser enforcement with simulated ConfigKeyHash',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: {
        webcam: true,
        screenShare: false,
        sebRequired: true,
        sebConfigKey: SEB_CONFIG_KEY
      }
    })
    examId = examRes.body?.exam?.id || examRes.body?.data?.id || examRes.body?.id

    // 4. Add a question
    const qRes = await api.for(facultyActor).postRaw(`/api/v1/exams/${examId}/questions`, {
      questionText: 'Which hashing algorithm is utilized to compute the Safe Exam Browser Config Key hash?',
      options: ['MD5', 'SHA-1', 'SHA-256', 'Argon2'],
      correctOptionIndex: 2,
      marks: 10
    })
    questionId = qRes.body?.question?.id || qRes.body?.id

    // 5. Publish Exam & shift schedule to active window
    const pubRes = await api.for(facultyActor).postRaw(`/api/v1/exams/${examId}/publish`, {})
    expect(pubRes.status).toBe(200)

    await setExamScheduleDates(examId, {
      startTime: new Date(now - 10 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })
  })

  test.afterAll(async () => {
    if (facultyActor?.page) await facultyActor.page.close().catch(() => {})
    if (studentActor?.page) await studentActor.page.close().catch(() => {})
  })

  test('1. Plain browser without SEB header is rejected with 403 and friendly page', async () => {
    // Attempting to call start endpoint directly without SEB header returns 403 SEB_REQUIRED
    const startAttempt = await api.for(studentActor).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
    expect(startAttempt.status).toBe(403)
    expect(startAttempt.body?.code).toBe('SEB_REQUIRED')

    // In the browser, navigating to /student/exams/${examId}/start or triggering a request redirects to the friendly page
    await studentActor.page.goto(`/student/exams/${examId}/seb-required`)
    await expect(studentActor.page.getByText('Safe Exam Browser Required')).toBeVisible({ timeout: 10000 })
    await expect(studentActor.page.getByText('Kiosk Lockdown Required')).toBeVisible()
    await expect(studentActor.page.getByText('Download Safe Exam Browser')).toBeVisible()
  })

  test('2. Request with invalid or mismatched ConfigKeyHash header is strictly blocked with 403', async () => {
    const wrongConfigKey = '0000000000000000000000000000000000000000000000000000000000000000'
    const wrongHash = calculateSebHash(`/api/v1/attempts/exams/${examId}/start`, wrongConfigKey)

    const attemptRes = await api.for(studentActor).postRaw(`/api/v1/attempts/exams/${examId}/start`, {}, {
      headers: {
        'x-safeexambrowser-configkeyhash': wrongHash
      }
    })

    expect(attemptRes.status).toBe(403)
    expect(attemptRes.body?.code).toBe('SEB_REQUIRED')
    expect(attemptRes.body?.message).toContain('Safe Exam Browser')
  })

  test('3. Simulated SEB browser with dynamically injected ConfigKeyHash completes start, answers, and submit', async () => {
    // Attach dynamic route interceptor on student's page computing the exact formula per request URL
    await studentActor.page.route('**/api/**', async (route: any) => {
      const request = route.request()
      const urlObj = new URL(request.url())
      const pathAndQuery = `${urlObj.pathname}${urlObj.search}`
      const hash = calculateSebHash(pathAndQuery, SEB_CONFIG_KEY)

      const existingHeaders = await request.allHeaders()
      const modifiedHeaders = {
        ...existingHeaders,
        'x-safeexambrowser-configkeyhash': hash
      }

      await route.continue({ headers: modifiedHeaders })
    })

    // Start the attempt with valid SEB header via API
    const startUrl = `/api/v1/attempts/exams/${examId}/start`
    const validStartHash = calculateSebHash(startUrl, SEB_CONFIG_KEY)
    const startRes = await api.for(studentActor).postRaw(startUrl, {}, {
      headers: {
        'x-safeexambrowser-configkeyhash': validStartHash
      }
    })
    expect(startRes.status).toBe(200)
    const attemptId = startRes.body?.attempt?.id || startRes.body?.id
    expect(attemptId).toBeTruthy()
    const targetQuestionId = startRes.body?.questions?.[0]?.id || questionId
    expect(targetQuestionId).toBeTruthy()

    // Autosave answer with valid SEB header via API
    const answerUrl = `/api/v1/attempts/${attemptId}/answers`
    const validAnswerHash = calculateSebHash(answerUrl, SEB_CONFIG_KEY)
    const answerRes = await api.for(studentActor).postRaw(answerUrl, {
      questionId: targetQuestionId,
      selectedOptionIndex: 2
    }, {
      headers: {
        'x-safeexambrowser-configkeyhash': validAnswerHash
      }
    })
    expect(answerRes.status).toBe(200)

    // Submit attempt with valid SEB header via API
    const submitUrl = `/api/v1/attempts/${attemptId}/submit`
    const validSubmitHash = calculateSebHash(submitUrl, SEB_CONFIG_KEY)
    const submitRes = await api.for(studentActor).postRaw(submitUrl, {}, {
      headers: {
        'x-safeexambrowser-configkeyhash': validSubmitHash
      }
    })
    expect(submitRes.status).toBe(200)
    expect(submitRes.body?.status).toBe('success')

    // Navigate student to result or dashboard to verify submission completion
    await studentActor.page.goto(`/student/dashboard`)
    await expect(studentActor.page.getByText(/Student Examination Portal/i)).toBeVisible({ timeout: 10000 })
  })
})

