import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Student Route Explorer & Async Fault Injection Suite (§Phase 4 Route Group 1)', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let studentActor: any
  let testExamId: string

  const VIEWPORTS = [
    { name: 'Mobile', width: 360, height: 640 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1366, height: 768 },
  ]

  test.beforeAll(async ({ browser }) => {
    await resetCleanRoom()
    facultyActor = await createActor(browser, 'faculty')
    studentActor = await createActor(browser, 'student')

    // Faculty login
    await facultyActor.page.goto('/login?role=faculty')
    await facultyActor.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
    await facultyActor.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
    await facultyActor.page.locator('button[type="submit"]').click()
    await facultyActor.page.waitForURL((url: URL) => url.pathname.includes('/faculty'), { timeout: 15000 })

    // Student login
    await studentActor.page.goto('/login?role=student')
    await studentActor.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
    await studentActor.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
    await studentActor.page.locator('button[type="submit"]').click()
    await studentActor.page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })
    await studentActor.page.evaluate((email) => {
      localStorage.setItem('proctornet_email', email)
      localStorage.setItem('user', JSON.stringify({ email, role: 'STUDENT' }))
    }, SEEDED_STUDENTS[0].email)

    const now = Date.now()

    // Create and publish test exam
    const exRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Route Explorer Exam ${now}`,
      subject: 'SE-EXPLORE',
      courseCode: 'SE401',
      description: 'Exam for route group exploration and fault injection',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: false, screenShare: false, sebRequired: false }
    })
    testExamId = exRes.body?.exam?.id || exRes.body?.data?.id || exRes.body?.id

    await api.for(facultyActor).postRaw(`/api/v1/exams/${testExamId}/questions`, {
      questionText: 'Which background color token represents the enterprise light canvas?',
      options: ['#ffffff', '#fbfcfd', '#171721', '#edecfb'],
      correctOptionIndex: 1,
      marks: 10
    })

    const pubRes = await api.for(facultyActor).postRaw(`/api/v1/exams/${testExamId}/publish`, {})
    expect(pubRes.status).toBe(200)

    await setExamScheduleDates(testExamId, {
      startTime: new Date(now - 15 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })
  })

  test.afterAll(async () => {
    if (facultyActor?.context) await facultyActor.context.close().catch(() => {})
    if (studentActor?.context) await studentActor.context.close().catch(() => {})
  })

  // 1. Viewport Exploration & Overflow Check
  for (const vp of VIEWPORTS) {
    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Student Dashboard renders without horizontal overflow or dark classes`, async () => {
      const page = studentActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/student/dashboard')
      await page.waitForLoadState('networkidle')

      // Check for zero horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      // Verify strict light theme: no dark classes on html or body
      const darkClasses = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')
      })
      expect(darkClasses).toBe(false)
    })
  }

  // 2. Fault Injection: Student Dashboard 500 Network/Server Error
  test('2. Fault Injection: Dashboard recovers gracefully from 500 server error with AsyncStateView and retry button', async () => {
    const page = studentActor.page
    await page.setViewportSize({ width: 1366, height: 768 })

    let failRequest = true
    const isExamsApi = (url: URL) => url.pathname.endsWith('/student/exams') || url.pathname.endsWith('/exams')
    await page.route(url => isExamsApi(url), route => {
      if (failRequest) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'INTERNAL_ERROR',
            message: 'Database query timeout while retrieving student assessments.'
          })
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/student/dashboard')
    await page.waitForLoadState('networkidle')

    // Verify error state appears with reference ID and retry action
    const errorState = page.locator('[data-testid="async-state-error"]')
    await expect(errorState).toBeVisible({ timeout: 10000 })
    await expect(errorState).toContainText('Database query timeout')
    await expect(errorState).toContainText('Reference:')

    // Ensure it did NOT fall through to "No active examinations"
    const emptyState = page.locator('text=No active examinations')
    await expect(emptyState).not.toBeVisible()

    // Test Recovery: enable route and click Try Again
    failRequest = false
    const retryBtn = page.locator('[data-testid="async-state-retry-btn"]')
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    // Verify successful load of exams list
    await expect(errorState).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator(`text=${testExamId}`).or(page.locator('text=Route Explorer Exam'))).toBeVisible({ timeout: 10000 })

    await page.unroute(url => isExamsApi(url))
  })

  // 3. Fault Injection: Exam Arena 503 Initialization Failure
  test('3. Fault Injection: Arena preserves student session and shows reconnect view on transient 503 instead of kicking to dashboard', async () => {
    const page = studentActor.page
    await page.setViewportSize({ width: 1366, height: 768 })

    // Intercept attempt start to return 503 Service Unavailable
    let failAttemptStart = true
    const isStartApi = (url: URL) => url.pathname.includes('/attempts') && url.pathname.endsWith('/start')
    await page.route(url => isStartApi(url), route => {
      if (failAttemptStart) {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Exam coordination server is temporarily overloaded.'
          })
        })
      } else {
        route.continue()
      }
    })

    await page.goto(`/student/exams/${testExamId}/arena`)

    // Verify student stays on /arena and sees reconnection view
    await expect(page).toHaveURL(new RegExp(`/student/exams/${testExamId}/arena`))
    const reconnectBtn = page.locator('button', { hasText: 'Try Reconnecting' })
    await expect(reconnectBtn).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=The examination server encountered a temporary error')).toBeVisible()
    await expect(page.locator('text=Reference:')).toBeVisible()

    // Verify recovery: unroute and click Reconnect
    failAttemptStart = false
    await reconnectBtn.click()

    // Arena successfully loads question
    await expect(page.locator('text=Which background color token represents')).toBeVisible({ timeout: 15000 })

    await page.unroute(url => isStartApi(url))
  })

  // 4. Fault Injection: Student Results 404 Attempt Not Found
  test('4. Fault Injection: Results view displays mapped error with retry & dashboard link on 404', async () => {
    const page = studentActor.page
    await page.goto('/student/results/non-existent-attempt-id-99999')
    await page.waitForLoadState('networkidle')

    // Verify clean error card with Ref ID, Try Again and Return to Dashboard
    await expect(page.locator('text=Reference:')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button', { hasText: 'Try Again' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Return to Dashboard' })).toBeVisible()

    // Clicking Return to Dashboard safely navigates to /student/dashboard
    await page.locator('button', { hasText: 'Return to Dashboard' }).click()
    await page.waitForURL((url: URL) => url.pathname.includes('/student/dashboard'), { timeout: 10000 })
    expect(page.url()).toContain('/student/dashboard')
  })
})
