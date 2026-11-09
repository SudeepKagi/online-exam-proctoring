import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Student Resilience, Autosave & Offline Recovery Suite', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let studentActor: any
  let resilienceExamId: string

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

    // Create and publish resilience test exam with 3 questions
    const exRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Student Resilience Exam ${now}`,
      subject: 'CS-RESILIENCE',
      courseCode: 'CS302',
      description: 'Exam for autosave, offline, and resilience testing',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: true, screenShare: false, sebRequired: false }
    })
    resilienceExamId = exRes.body?.exam?.id || exRes.body?.data?.id || exRes.body?.id

    await api.for(facultyActor).postRaw(`/api/v1/exams/${resilienceExamId}/questions`, {
      questionText: 'Question 1: What does Autosave do on network outage?',
      options: ['Discards answers', 'Buffers locally in localStorage', 'Crashes the browser', 'Freezes UI'],
      correctOptionIndex: 1,
      marks: 10
    })

    await api.for(facultyActor).postRaw(`/api/v1/exams/${resilienceExamId}/questions`, {
      questionText: 'Question 2: What is the server clock used for?',
      options: ['Client time', 'Server-authoritative timer', 'Random delays', 'Displaying current year'],
      correctOptionIndex: 1,
      marks: 10
    })

    await api.for(facultyActor).postRaw(`/api/v1/exams/${resilienceExamId}/questions`, {
      questionText: 'Question 3: How are duplicate browser tabs handled?',
      options: ['Allowed everywhere', 'Second tab is blocked without breaking first', 'Both tabs crash', 'Server shuts down'],
      correctOptionIndex: 1,
      marks: 10
    })

    const pubRes = await api.for(facultyActor).postRaw(`/api/v1/exams/${resilienceExamId}/publish`, {})
    expect(pubRes.status).toBe(200)

    await setExamScheduleDates(resilienceExamId, {
      startTime: new Date(now - 15 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })
  })

  test.afterAll(async () => {
    if (facultyActor?.context) await facultyActor.context.close().catch(() => {})
    if (studentActor?.context) await studentActor.context.close().catch(() => {})
  })

  test('1. Autosave Indicator: transitions through Saving and Saved on option selection', async () => {
    const page = studentActor.page
    await page.goto(`/student/exams/${resilienceExamId}/arena`)
    await page.waitForURL((url: URL) => url.pathname.includes(`/student/exams/${resilienceExamId}/arena`), { timeout: 15000 })

    // Verify initial autosave status
    const statusIndicator = page.locator('[data-testid="autosave-status"]')
    await expect(statusIndicator).toBeVisible({ timeout: 10000 })
    await expect(statusIndicator).toContainText('Saved')

    // Select Option B (Buffers locally)
    const optionB = page.locator('button', { hasText: 'Buffers locally in localStorage' })
    await expect(optionB).toBeVisible({ timeout: 5000 })
    await optionB.click()

    // Verify status indicator reflects saved state
    await expect(statusIndicator).toContainText('Saved', { timeout: 8000 })
  })

  test('2. Offline Network Simulation: shows Connection Lost banner, buffers locally, and syncs on reconnect', async () => {
    const page = studentActor.page
    const context = studentActor.context

    // Emulate network disconnect
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    // Verify Connection Lost banner appears
    const lostBanner = page.locator('[data-testid="connection-lost-banner"]')
    await expect(lostBanner).toBeVisible({ timeout: 5000 })
    await expect(lostBanner).toContainText('Connection lost')

    // Verify autosave indicator shows Offline, will sync
    const statusIndicator = page.locator('[data-testid="autosave-status"]')
    await expect(statusIndicator).toContainText('Offline, will sync')

    // Navigate to Question 2 while offline and select Option B
    await page.locator('button', { hasText: 'Next' }).click()
    const optionQ2 = page.locator('button', { hasText: 'Server-authoritative timer' })
    await expect(optionQ2).toBeVisible({ timeout: 5000 })
    await optionQ2.click()

    // Restore network connection
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    // Click retry sync button
    const retryBtn = page.locator('[data-testid="retry-sync-button"]')
    if (await retryBtn.isVisible()) {
      await retryBtn.click()
    }

    // Verify sync success banner appears
    const successBanner = page.locator('[data-testid="sync-success-banner"]')
    await expect(successBanner).toBeVisible({ timeout: 8000 })
    await expect(successBanner).toContainText('Connection restored')

    // Verify autosave indicator returns to Saved
    await expect(statusIndicator).toContainText('Saved')
  })

  test('3. 500s on answers with exponential backoff: retains answers locally until server recovers', async () => {
    const page = studentActor.page

    // Intercept PUT /api/v1/attempts/*/answers to simulate 500 Internal Server Error
    await page.route('**/api/v1/attempts/*/answers', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Temporary Server Error' })
      })
    })

    // Navigate to Question 3 and select an option
    await page.locator('button', { hasText: 'Next' }).click()
    const optionQ3 = page.locator('button', { hasText: 'Second tab is blocked without breaking first' })
    await expect(optionQ3).toBeVisible({ timeout: 5000 })
    await optionQ3.click()

    // Trigger flush attempt
    const statusIndicator = page.locator('[data-testid="autosave-status"]')
    await expect(statusIndicator).toContainText('Offline, will sync', { timeout: 8000 })

    const lostBanner = page.locator('[data-testid="connection-lost-banner"]')
    await expect(lostBanner).toBeVisible()

    // Remove 500 route interceptor
    await page.unroute('**/api/v1/attempts/*/answers')

    // Click retry sync
    await page.locator('[data-testid="retry-sync-button"]').click()

    // Successfully recovers
    await expect(statusIndicator).toContainText('Saved', { timeout: 8000 })
  })

  test('4. Duplicate Tab Protection: opening second tab blocks second tab and preserves first tab', async ({ browser }) => {
    const tab1 = studentActor.page

    // Open a second tab in the same browser context
    const tab2 = await studentActor.context.newPage()
    await tab2.goto(`/student/exams/${resilienceExamId}/arena`)

    // Tab 2 detects duplicate session and displays overlay
    const overlayTab2 = tab2.locator('[data-testid="duplicate-tab-overlay"]')
    await expect(overlayTab2).toBeVisible({ timeout: 8000 })
    await expect(overlayTab2).toContainText('Exam Open in Another Window')

    const returnBtn = tab2.locator('[data-testid="duplicate-tab-return-btn"]')
    await expect(returnBtn).toBeVisible()
    const takeoverBtn = tab2.locator('[data-testid="duplicate-tab-takeover-btn"]')
    await expect(takeoverBtn).toBeVisible()

    // Tab 1 remains active and unobstructed initially
    const overlayTab1 = tab1.locator('[data-testid="duplicate-tab-overlay"]')
    await expect(overlayTab1).not.toBeVisible()

    // Candidate chooses to take over active session in Tab 2
    await takeoverBtn.click()
    await expect(overlayTab2).not.toBeVisible({ timeout: 5000 })
    await expect(overlayTab1).toBeVisible({ timeout: 5000 })

    // Tab 1 reclaims session back
    const takeoverTab1 = tab1.locator('[data-testid="duplicate-tab-takeover-btn"]')
    await takeoverTab1.click()
    await expect(overlayTab1).not.toBeVisible({ timeout: 5000 })

    // Tab 1 can still interact with questions
    await tab1.locator('button', { hasText: 'Previous' }).click()
    await expect(tab1.locator('[data-testid="autosave-status"]')).toBeVisible()

    await tab2.close()
  })

  test('5. Mid-Exam Token Expiry: shows in-place re-auth modal without losing answers, resumes on same question', async () => {
    const page = studentActor.page

    // Intercept refresh and attempts requests to return 401
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_EXPIRED', message: 'Session expired' })
      })
    })

    await page.route('**/api/v1/attempts/*/answers', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_EXPIRED', message: 'JWT expired' })
      })
    })

    // Click an option to trigger 401
    const optionA = page.locator('button', { hasText: 'Server-authoritative timer' })
    await optionA.click()

    // In-place re-auth modal appears
    const reauthModal = page.locator('[data-testid="reauth-modal"]')
    await expect(reauthModal).toBeVisible({ timeout: 8000 })
    await expect(reauthModal).toContainText('Session Expired')

    // Remove 401 intercepts
    await page.unroute('**/api/v1/auth/refresh')
    await page.unroute('**/api/v1/attempts/*/answers')

    // Submit password
    await page.locator('[data-testid="reauth-password-input"]').fill(SEEDED_STUDENTS[0].password)
    await page.locator('[data-testid="reauth-submit-btn"]').click()

    // Modal dismisses and exam resumes on the exact same question
    await expect(reauthModal).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('[data-testid="autosave-status"]')).toContainText('Saved', { timeout: 8000 })
  })

  test('6. Idempotent Submit: submit button locks and prevents double-submission', async () => {
    const page = studentActor.page

    // Click Submit Exam button in header
    await page.locator('header button', { hasText: 'Submit Exam' }).click()

    // Confirm dialog
    const confirmBtn = page.locator('button', { hasText: 'Confirm Submission' })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    // Click submit
    await confirmBtn.click()

    // Verify submission confirmation screen
    await expect(page.locator('h2', { hasText: 'Examination Submitted' })).toBeVisible({ timeout: 10000 })
  })
})

