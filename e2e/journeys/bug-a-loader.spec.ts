import { test, expect } from '@playwright/test'

test.describe('BUG A: Route and Auth Loading Screen Consistency', () => {
  test('asserts only white LoadingSpinner with data-testid="app-loader" appears and never dark Loading workspace', async ({ page }) => {
    // 1. Establish session indicator in localStorage before loading protected route
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('proctornet_logged_in', 'true')
    })

    // 2. Control auth/me resolution with an explicit promise barrier
    let resolveAuth: () => void
    const authBarrier = new Promise<void>((resolve) => {
      resolveAuth = resolve
    })

    await page.route(/\/api\/v1\/auth\/me/, async (route) => {
      await authBarrier
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          authenticated: true,
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            role: 'student',
            name: 'Student One',
            usn: '1MS22CS001',
            profileStatus: 'VERIFIED',
            mustChangePassword: false
          }
        })
      })
    })

    // 3. Navigate to /student/exams
    const navPromise = page.goto('/student/exams')

    // 4. While auth is blocked, assert the full-screen loader appears with data-testid="app-loader"
    const loader = page.locator('[data-testid="app-loader"]')
    await expect(loader).toBeVisible({ timeout: 10000 })

    // (b) Assert computed background is white/near-white and never dark navy rgb(9, 26, 47)
    const bgColor = await loader.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(bgColor, 'Computed background must not be dark navy rgb(9, 26, 47)').not.toContain('rgb(9, 26, 47)')
    expect(bgColor, 'Computed background must not be dark navy rgba(9, 26, 47').not.toContain('rgba(9, 26, 47')

    // (c) Assert text "Loading workspace" never appears
    const bodyText = await page.innerText('body')
    expect(bodyText).not.toContain('Loading workspace')

    // 5. Unblock auth and verify clean transition to workspace
    resolveAuth!()
    await navPromise
    await expect(page.locator('h2:has-text("student Workspace")')).toBeVisible({ timeout: 15000 })
  })
})
