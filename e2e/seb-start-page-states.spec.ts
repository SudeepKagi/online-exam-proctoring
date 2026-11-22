import { test, expect } from '@playwright/test'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

const SEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.140 SEB/3.10.3 (x64)'

test.describe('E2E: SEB Start Page States & Non-Dead-End Resilience (§Phase 1 Hop 4-6)', () => {
  test.describe.configure({ mode: 'serial' })

  let examId: string
  let validLaunchToken: string
  let validPin: string

  test.beforeAll(async ({ request }) => {
    await resetCleanRoom()

    // 1. Authenticate as faculty to create a published exam requiring SEB
    const facultyLogin = await request.post('/api/v1/auth/login', {
      data: {
        email: SEEDED_FACULTY.email,
        password: SEEDED_FACULTY.password
      }
    })
    expect(facultyLogin.status()).toBe(200)

    const now = Date.now()
    const examRes = await request.post('/api/v1/exams', {
      data: {
        title: `SEB Start Page States Exam ${now}`,
        subject: 'SEB-102',
        courseCode: 'SEB102',
        description: 'Testing every start-page state and non-dead-end error resilience',
        startTime: new Date(now + 60 * 60 * 1000).toISOString(),
        endTime: new Date(now + 120 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        proctoringConfig: {
          webcam: false,
          screenShare: false,
          sebRequired: true,
          sebConfigKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
        }
      }
    })
    expect(examRes.status()).toBe(201)
    const examBody = await examRes.json()
    examId = examBody.exam?.id || examBody.id

    // Add required question
    await request.post(`/api/v1/exams/${examId}/questions`, {
      data: {
        questionText: 'What is the color of the enterprise light canvas?',
        options: ['#ffffff', '#fbfcfd', '#000000', '#171721'],
        correctOptionIndex: 1,
        marks: 5
      }
    })

    // Publish exam
    await request.post(`/api/v1/exams/${examId}/publish`, { data: {} })
    await setExamScheduleDates(examId, {
      startTime: new Date(now - 10 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })

    // 2. Generate a valid launch token as student
    const studentLogin = await request.post('/api/v1/auth/login', {
      data: {
        email: SEEDED_STUDENTS[0].email,
        password: SEEDED_STUDENTS[0].password
      }
    })
    expect(studentLogin.status()).toBe(200)

    const launchRes = await request.post('/api/v1/seb/launch-link', {
      data: { examId }
    })
    expect(launchRes.status()).toBe(200)
    const launchData = await launchRes.json()
    validLaunchToken = launchData.launchToken
    validPin = launchData.pin
    expect(validLaunchToken).toBeTruthy()
    expect(validPin).toMatch(/^\d{6}$/)
  })

  test('State 1: Valid forwarded token auto-exchanges and transitions to start lobby', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    await page.goto(`/seb/enter?launch=${encodeURIComponent(validLaunchToken)}`)

    // Should auto-exchange and navigate to student exam start page or dashboard
    await page.waitForURL((url: URL) => url.pathname.includes(`/student/exams/${examId}/start`) || url.pathname.includes('/student/dashboard'), { timeout: 15000 })
    expect(page.url()).not.toContain('/login')
    await context.close()
  })

  test('State 2: Invalid forwarded token shows friendly error with Ref ID, PIN form and password fallback', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    await page.goto('/seb/enter?launch=invalid_tampered_token_0000000000')

    // Must show friendly error message with Ref ID
    await expect(page.getByText(/Ref: #/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Invalid/i)).toBeVisible()

    // Must display 6-digit code form (never a dead end)
    await expect(page.locator('input#seb-pin-input')).toBeVisible()

    // Must show password fallback link
    await expect(page.getByRole('button', { name: /Sign in with password instead/i })).toBeVisible()

    // Must stay on /seb/enter, never kicked to /login
    expect(page.url()).toContain('/seb/enter')
    expect(page.url()).not.toContain('/login')
    await context.close()
  })

  test('State 3: Expired forwarded token shows friendly error with Ref ID and PIN form', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    await page.goto('/seb/enter?error=expired')

    // Must show expired message
    await expect(page.getByText(/expired/i)).toBeVisible({ timeout: 10000 })

    // Must display 6-digit code form
    await expect(page.locator('input#seb-pin-input')).toBeVisible()

    // Must show password fallback
    await expect(page.getByRole('button', { name: /Sign in with password instead/i })).toBeVisible()
    await context.close()
  })

  test('State 4: No token on /seb/enter presents launch code form directly with password option', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    await page.goto('/seb/enter')

    await expect(page.getByText('Enter Launch Code')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input#seb-pin-input')).toBeVisible()
    await expect(page.getByRole('button', { name: /Continue to exam/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in with password instead/i })).toBeVisible()
    await context.close()
  })

  test('State 5: Start page error resilience shows Ref ID, PIN form, password fallback and diagnostics link', async ({ browser }) => {
    // Authenticate student to access start page
    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    // Sign in via UI inside SEB using manual=1
    await page.goto('/login?manual=1')
    await page.locator('input[type="text"]').fill(SEEDED_STUDENTS[1].email)
    await page.locator('input[type="password"]').fill(SEEDED_STUDENTS[1].password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })

    // Force error response on start attempt to verify UI resilience
    await page.route(`**/api/v1/attempts/exams/${examId}/start`, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'CONFIG_KEY_MISMATCH',
          message: 'Safe Exam Browser configuration check failed. Configuration Key header mismatch.',
          requestId: 'err-test-8492'
        })
      })
    })

    await page.goto(`/student/exams/${examId}/start`)

    // Look for Start Exam button and click
    const startBtn = page.getByRole('button', { name: /Start Exam/i })
    await startBtn.waitFor({ state: 'visible', timeout: 15000 })
    await startBtn.click()

    // Must render the error resilience card (never a dead end!)
    await expect(page.locator('[data-testid="seb-error-resilience-card"]')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Ref: #err-test-8492/i)).toBeVisible()

    // Must show 6-digit fallback PIN input
    await expect(page.locator('[data-testid="seb-fallback-pin-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="seb-fallback-pin-submit"]')).toBeVisible()

    // Must show password fallback button
    await expect(page.locator('[data-testid="error-signin-password-fallback"]')).toBeVisible()

    // Must show diagnostics link
    await expect(page.locator('[data-testid="error-diagnostics-link"]')).toBeVisible()

    await context.close()
  })
})
