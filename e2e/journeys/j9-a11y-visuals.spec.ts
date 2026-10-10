import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createActor } from '../helpers/actors'

test.describe('J9: Accessibility & Visual Baseline Audit (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const studentCreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }

  test('J9: Axe accessibility audit across core role views & keyboard-only navigation flow', async ({ page }) => {
    test.setTimeout(90000)

    // 1. Accessibility on Landing & Public Login Pages
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const landingAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const criticalLanding = landingAxe.violations.filter(v => v.impact === 'critical')
    expect(criticalLanding).toHaveLength(0)

    await page.goto('/student/login')
    await page.waitForLoadState('domcontentloaded')
    const loginAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const criticalLogin = loginAxe.violations.filter(v => v.impact === 'critical')
    expect(criticalLogin).toHaveLength(0)

    // 2. Keyboard-Only Navigation Flow on Login Screen
    await page.goto('/student/login')
    await page.waitForSelector('form')

    // Ensure USN input is focused
    const usnInput = page.locator('input[name="usn"], input[placeholder*="USN"]')
    await usnInput.focus()
    await page.keyboard.type(studentCreds.usn)

    // Tab into Password input
    await page.keyboard.press('Tab')
    await page.keyboard.type(studentCreds.password)

    // Tab into Submit button and press Enter
    const submitBtn = page.locator('button[type="submit"]')
    while (!await submitBtn.evaluate(el => el === document.activeElement)) {
      await page.keyboard.press('Tab')
    }
    await page.keyboard.press('Enter')

    await page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })
    expect(page.url()).toMatch(/\/student\/(dashboard|enrollment)/)

    // 3. Accessibility on Student Dashboard
    const dashboardAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const criticalDashboard = dashboardAxe.violations.filter(v => v.impact === 'critical')
    expect(criticalDashboard).toHaveLength(0)

    // 4. Accessibility on Rules & Support Page
    await page.goto('/student/rules')
    await page.waitForLoadState('domcontentloaded')
    const rulesAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const criticalRules = rulesAxe.violations.filter(v => v.impact === 'critical')
    expect(criticalRules).toHaveLength(0)
  })
})
