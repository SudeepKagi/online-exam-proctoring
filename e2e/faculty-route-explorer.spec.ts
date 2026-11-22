import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY } from './helpers/cleanroom'

test.describe('E2E: Faculty Route Explorer & Async Fault Injection Suite (§Phase 4 Route Group 2)', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let testExamId: string

  const VIEWPORTS = [
    { name: 'Mobile', width: 360, height: 640 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1366, height: 768 },
  ]

  test.beforeAll(async ({ browser }) => {
    await resetCleanRoom()
    facultyActor = await createActor(browser, 'faculty')

    // Faculty login
    await facultyActor.page.goto('/login?role=faculty')
    await facultyActor.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
    await facultyActor.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
    await facultyActor.page.locator('button[type="submit"]').click()
    await facultyActor.page.waitForURL((url: URL) => url.pathname.includes('/faculty'), { timeout: 15000 })

    const now = Date.now()

    // Create a draft exam for manage route exploration
    const exRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Faculty Route Explorer Exam ${now}`,
      subject: 'CS-FACULTY-TEST',
      courseCode: 'CS501',
      description: 'Exam for faculty route exploration and resilience testing',
      startTime: new Date(now + 60 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: false, screenShare: false, sebRequired: false }
    })
    testExamId = exRes.body?.exam?.id || exRes.body?.data?.id || exRes.body?.id

    // Add a sample question
    await api.for(facultyActor).postRaw(`/api/v1/exams/${testExamId}/questions`, {
      questionText: 'What is the enterprise light canvas background color?',
      options: ['#ffffff', '#fbfcfd', '#171721', '#edecfb'],
      correctOptionIndex: 1,
      marks: 5
    })
  })

  test.afterAll(async () => {
    if (facultyActor?.context) await facultyActor.context.close().catch(() => {})
  })

  // 1. Viewport Exploration across 3 viewports
  for (const vp of VIEWPORTS) {
    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Faculty Exams Workspace renders without overflow or dark mode`, async () => {
      const page = facultyActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/faculty/exams')
      await page.waitForLoadState('networkidle')

      // Zero horizontal overflow check
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      // Strict light theme verification
      const darkClasses = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')
      })
      expect(darkClasses).toBe(false)

      // Verify page title and header
      await expect(page.locator('text=Faculty Examination Workspace')).toBeVisible({ timeout: 10000 })
    })

    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Exam Manage view renders cleanly`, async () => {
      const page = facultyActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(`/faculty/exams/${testExamId}`)
      await page.waitForLoadState('networkidle')

      // Zero horizontal overflow check
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      // Tab navigation visible
      await expect(page.getByRole('tab', { name: /Question Bank/i })).toBeVisible({ timeout: 10000 })
    })
  }

  // 2. Fault Injection: Faculty Exams list 500 error & recovery
  test('2. Fault Injection: Faculty Exams workspace recovers gracefully from 500 with AsyncStateView', async () => {
    const page = facultyActor.page
    await page.setViewportSize({ width: 1366, height: 768 })

    let failRequest = true
    await page.route('**/api/v1/faculty/exams', route => {
      if (failRequest) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'DB_ERROR',
            message: 'Database query timeout while retrieving faculty examinations.'
          })
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/faculty/exams')
    await page.waitForLoadState('networkidle')

    // Verify error state appears with reference ID and retry action
    const errorState = page.locator('[data-testid="async-state-error"]')
    await expect(errorState).toBeVisible({ timeout: 10000 })
    await expect(errorState).toContainText('The examination server encountered a temporary error')
    await expect(errorState).toContainText('Reference:')

    // Ensure it did NOT render the empty state
    await expect(page.locator('text=No assessments authored yet')).not.toBeVisible()

    // Test Recovery: disable failure and click retry
    failRequest = false
    const retryBtn = page.locator('[data-testid="async-state-retry-btn"]')
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    // Verify list renders cleanly
    await expect(errorState).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Faculty Route Explorer Exam').first()).toBeVisible({ timeout: 10000 })

    await page.unroute('**/api/v1/faculty/exams')
  })

  // 3. Fault Injection: Exam Manage 404 / 500 with Back to Exams link
  test('3. Fault Injection: Exam Manage displays AsyncStateView with Back to My Exams on non-existent exam ID', async () => {
    const page = facultyActor.page
    await page.goto('/faculty/exams/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')

    // Verify error state with Reference ID and Back button
    await expect(page.locator('text=Reference:')).toBeVisible({ timeout: 10000 })
    const backBtn = page.locator('a', { hasText: 'Back to My Exams' })
    await expect(backBtn).toBeVisible()

    // Clicking Back takes faculty safely back to /faculty/exams
    await backBtn.click()
    await page.waitForURL((url: URL) => url.pathname.includes('/faculty/exams'), { timeout: 10000 })
    expect(page.url()).toContain('/faculty/exams')
  })
})
