const { test, expect } = require('@playwright/test')

test.describe('BUG-H03 — Landing Page Tab Filter & Mobile Navigation', () => {
  test('Landing page role portal tabs filter role cards accurately', async ({ page }) => {
    // 1. Navigate to landing page
    await page.goto('/')
    await expect(page).toHaveTitle(/ProctorNet/i)

    // Scroll to Portals section
    const portalsSection = page.locator('#portals')
    await expect(portalsSection).toBeVisible()

    // Initially "All Portals" is active; all 4 role cards are rendered
    await expect(page.locator('text=Student Exam Portal')).toBeVisible()
    await expect(page.locator('text=Faculty Exam Suite')).toBeVisible()
    await expect(page.locator('text=Live Invigilator Grid')).toBeVisible()
    await expect(page.locator('text=Administrator Console')).toBeVisible()

    // 2. Click "Candidate Console" tab filter pill
    const candidateTab = page.locator('button:has-text("Candidate Console")')
    await candidateTab.click()

    await expect(page.locator('text=Student Exam Portal')).toBeVisible()
    await expect(page.locator('text=Faculty Exam Suite')).not.toBeVisible()
    await expect(page.locator('text=Live Invigilator Grid')).not.toBeVisible()
    await expect(page.locator('text=Administrator Console')).not.toBeVisible()

    // 3. Click "Faculty Workspace" tab filter pill
    const facultyTab = page.locator('button:has-text("Faculty Workspace")')
    await facultyTab.click()

    await expect(page.locator('text=Student Exam Portal')).not.toBeVisible()
    await expect(page.locator('text=Faculty Exam Suite')).toBeVisible()
    await expect(page.locator('text=Live Invigilator Grid')).not.toBeVisible()
    await expect(page.locator('text=Administrator Console')).not.toBeVisible()

    // 4. Click "Supervision & Admin" tab filter pill
    const supervisorTab = page.locator('button:has-text("Supervision & Admin")')
    await supervisorTab.click()

    await expect(page.locator('text=Student Exam Portal')).not.toBeVisible()
    await expect(page.locator('text=Faculty Exam Suite')).not.toBeVisible()
    await expect(page.locator('text=Live Invigilator Grid')).toBeVisible()
    await expect(page.locator('text=Administrator Console')).toBeVisible()

    // 5. Click "All Portals" tab filter pill to reset
    const allTab = page.locator('button:has-text("All Portals")')
    await allTab.click()

    await expect(page.locator('text=Student Exam Portal')).toBeVisible()
    await expect(page.locator('text=Faculty Exam Suite')).toBeVisible()
    await expect(page.locator('text=Live Invigilator Grid')).toBeVisible()
    await expect(page.locator('text=Administrator Console')).toBeVisible()
  })

  test('Mobile viewport navigation menu toggles correctly and renders login links', async ({ page }) => {
    // 1. Set mobile viewport (iPhone 12 / Modern mobile size: 390x844)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    // 2. Desktop nav is hidden on mobile
    const desktopNav = page.locator('nav.hidden.lg\\:flex')
    await expect(desktopNav).toBeHidden()

    // 3. Mobile menu button is visible
    const menuButton = page.locator('button[aria-label="Toggle navigation menu"]')
    await expect(menuButton).toBeVisible()

    const mobileMenu = page.locator('header div.lg\\:hidden.shadow-lg')
    await expect(mobileMenu).not.toBeVisible()

    // 4. Click to open mobile navigation menu
    await menuButton.click()

    // 5. Assert mobile navigation menu and links are visible
    await expect(mobileMenu).toBeVisible()
    await expect(mobileMenu.locator('a[href="/student/login"]')).toBeVisible()
    await expect(mobileMenu.locator('a[href="/faculty/login"]')).toBeVisible()
    await expect(mobileMenu.locator('a[href="#faqs"]')).toBeVisible()

    // 6. Click to close mobile menu
    await menuButton.click()
    await expect(mobileMenu).not.toBeVisible()
  })
})

