import { test, expect } from '@playwright/test'
import { resetCleanRoom } from './helpers/cleanroom'

test.describe('E2E: Auth & Public Route Explorer & Resilience Suite (§Phase 4 Route Group 4)', () => {
  const VIEWPORTS = [
    { name: 'Mobile', width: 360, height: 640 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1366, height: 768 },
  ]

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  // 1. Viewport Exploration across 3 viewports
  for (const vp of VIEWPORTS) {
    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Login Page renders without horizontal overflow or dark mode`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/login')
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

      // Brand and role tabs visible
      await expect(page.locator('text=ProctorNet').first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('tab', { name: /Student/i })).toBeVisible({ timeout: 10000 })
    })

    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Forgot Password renders without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/forgot-password')
      await page.waitForLoadState('networkidle')

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      await expect(page.locator('text=Reset Password')).toBeVisible({ timeout: 10000 })
    })

    test(`1. Viewport Explorer (${vp.name} ${vp.width}x${vp.height}): Safe Exam Browser Diagnostics renders cleanly`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/seb/diagnostics')
      await page.waitForLoadState('networkidle')

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1
      })
      expect(overflow).toBe(false)

      await expect(page.locator('text=Safe Exam Browser Diagnostics')).toBeVisible({ timeout: 10000 })
    })
  }

  // 2. Fault Injection: Login 429 Rate Limiting
  test('2. Fault Injection: Login handles 429 Rate Limiting gracefully', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })

    await page.route('**/api/v1/auth/login', route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please wait 30 seconds before trying again.'
        })
      })
    })

    await page.goto('/login')
    await page.locator('input[type="text"]').fill('student@univ.edu')
    await page.locator('input[type="password"]').fill('WrongPassword123')
    await page.locator('button[type="submit"]').click()

    // Verify sanitized error message
    const alert = page.locator('text=Too many login attempts')
    await expect(alert).toBeVisible({ timeout: 10000 })

    await page.unroute('**/api/v1/auth/login')
  })

  // 3. Fault Injection: Login 401 Invalid Credentials & Double Submit Locking
  test('3. Fault Injection: Login handles 401 Invalid Credentials and locks submit button during flight', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })

    let delayed = false
    await page.route('**/api/v1/auth/login', async route => {
      delayed = true
      await new Promise(r => setTimeout(r, 600))
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid USN/email or password.'
        })
      })
    })

    await page.goto('/login')
    await page.locator('input[type="text"]').fill('student@univ.edu')
    await page.locator('input[type="password"]').fill('InvalidPass')

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // Assert button disabled during flight
    await expect(submitBtn).toBeDisabled()

    // Assert failure message appears once completed
    await expect(page.locator('text=Invalid USN/email or password')).toBeVisible({ timeout: 10000 })
    await expect(submitBtn).toBeEnabled()

    await page.unroute('**/api/v1/auth/login')
  })
})
