import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, ADMIN_CREDENTIALS } from './helpers/cleanroom'

test.describe('E2E: Admin Route Explorer & Async Fault Injection Suite (§Phase 4 Route Group 3)', () => {
  test.describe.configure({ mode: 'serial' })

  let adminActor: any

  const VIEWPORTS = [
    { name: 'Mobile', width: 360, height: 640 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1366, height: 768 },
  ]

  test.beforeAll(async ({ browser }) => {
    await resetCleanRoom()
    adminActor = await createActor(browser, 'admin')

    // Admin login
    await adminActor.page.goto('/login?role=admin')
    await adminActor.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
    await adminActor.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
    await adminActor.page.locator('button[type="submit"]').click()
    await adminActor.page.waitForURL((url: URL) => url.pathname.includes('/admin'), { timeout: 15000 })
  })

  test.afterAll(async () => {
    if (adminActor?.context) await adminActor.context.close().catch(() => {})
  })

  // 1. Viewport Exploration across 3 viewports for Admin Routes
  for (const vp of VIEWPORTS) {
    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Admin Dashboard renders without overflow or dark mode`, async () => {
      const page = adminActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/admin')
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

      // Verify title
      await expect(page.locator('text=Administrative Overview')).toBeVisible({ timeout: 10000 })
    })

    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Admin Users page renders without overflow`, async () => {
      const page = adminActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      // Zero horizontal overflow check
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      // Check tabs visible
      await expect(page.getByRole('tab', { name: /Pending Approvals/i })).toBeVisible({ timeout: 10000 })
    })

    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Admin Institutional Exams renders cleanly`, async () => {
      const page = adminActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/admin/exams')
      await page.waitForLoadState('networkidle')

      // Zero horizontal overflow check
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      await expect(page.locator('text=Institutional Exams')).toBeVisible({ timeout: 10000 })
    })

    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Admin SEB Config renders cleanly`, async () => {
      const page = adminActor.page
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/admin/seb')
      await page.waitForLoadState('networkidle')

      // Zero horizontal overflow check
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      await expect(page.locator('text=Secure browser setup')).toBeVisible({ timeout: 10000 })
    })
  }

  // 2. Fault Injection: Admin Dashboard 500 error & recovery
  test('2. Fault Injection: Admin Dashboard recovers gracefully from 500 with AsyncStateView', async () => {
    const page = adminActor.page
    await page.setViewportSize({ width: 1366, height: 768 })

    let failRequest = true
    await page.route('**/api/v1/exams', route => {
      if (failRequest) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'DB_ERROR', message: 'Internal server error while fetching exams.' })
        })
      } else {
        route.continue()
      }
    })

    await page.route('**/api/v1/users?limit=100', route => {
      if (failRequest) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'DB_ERROR', message: 'Internal server error while fetching users.' })
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Verify error state appears with reference ID and retry action
    const errorState = page.locator('[data-testid="async-state-error"]')
    await expect(errorState).toBeVisible({ timeout: 10000 })
    await expect(errorState).toContainText('The examination server encountered a temporary error')
    await expect(errorState).toContainText('Reference:')

    // Test Recovery: disable failure and click retry
    failRequest = false
    const retryBtn = page.locator('[data-testid="async-state-retry-btn"]')
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    // Verify dashboard renders cleanly
    await expect(errorState).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Total Students')).toBeVisible({ timeout: 10000 })

    await page.unroute('**/api/v1/exams')
    await page.unroute('**/api/v1/users?limit=100')
  })

  // 3. Fault Injection: Admin Users list 500 error & recovery
  test('3. Fault Injection: Admin Users recovers gracefully from 500 with AsyncStateView', async () => {
    const page = adminActor.page
    await page.setViewportSize({ width: 1366, height: 768 })

    let failRequest = true
    await page.route('**/api/v1/users?limit=300', route => {
      if (failRequest) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'DB_ERROR', message: 'Query failed on users table.' })
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Verify error state appears
    const errorState = page.locator('[data-testid="async-state-error"]')
    await expect(errorState).toBeVisible({ timeout: 10000 })
    await expect(errorState).toContainText('The examination server encountered a temporary error')

    // Test recovery
    failRequest = false
    const retryBtn = page.locator('[data-testid="async-state-retry-btn"]')
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    await expect(errorState).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('tab', { name: /Students/i })).toBeVisible({ timeout: 10000 })

    await page.unroute('**/api/v1/users?limit=300')
  })

  // 4. Fault Injection: Admin Exams list 500 error & recovery
  test('4. Fault Injection: Admin Exams recovers gracefully from 500 with AsyncStateView', async () => {
    const page = adminActor.page
    await page.setViewportSize({ width: 1366, height: 768 })

    let failRequest = true
    await page.route('**/api/v1/exams', route => {
      if (failRequest) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'DB_ERROR', message: 'Query failed on exams table.' })
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/admin/exams')
    await page.waitForLoadState('networkidle')

    // Verify error state appears
    const errorState = page.locator('[data-testid="async-state-error"]')
    await expect(errorState).toBeVisible({ timeout: 10000 })
    await expect(errorState).toContainText('The examination server encountered a temporary error')

    // Test recovery
    failRequest = false
    const retryBtn = page.locator('[data-testid="async-state-retry-btn"]')
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    await expect(errorState).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Institutional Exams')).toBeVisible({ timeout: 10000 })

    await page.unroute('**/api/v1/exams')
  })
})
