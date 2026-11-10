import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, SEEDED_FACULTY } from './helpers/cleanroom'

test.describe('E2E: Exam Scheduling Timezone Precision Suite', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('1. Faculty in Asia/Kolkata timezone schedules exam and verifies timezone badge and live preview', async ({ browser }) => {
    const context = await browser.newContext({
      timezoneId: 'Asia/Kolkata',
      locale: 'en-IN'
    })
    const page = await context.newPage()
    const subjectName = `IST Physics Exam ${Date.now()}`

    try {
      await page.goto('/login?role=faculty')
      await page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await page.locator('button[type="submit"]').click()
      await page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      await page.goto('/faculty/exams')
      await page.getByRole('button', { name: /Exam Wizard/i }).click()

      // Skip upload
      await page.getByRole('button', { name: /Skip, I'll type/i }).click()

      // Add 1 question
      await page.getByRole('button', { name: /Add Question/i }).click()
      await page.locator('input[placeholder*="Question prompt"]').fill('What is Ohm\'s Law?')
      const optionInputs = page.locator('input[placeholder*="Option"]')
      await optionInputs.nth(0).fill('V = I * R')
      await optionInputs.nth(1).fill('P = V * I')
      await optionInputs.nth(2).fill('F = m * a')
      await optionInputs.nth(3).fill('E = m * c^2')
      await page.getByRole('button', { name: /Save Question/i }).click()
      await page.getByRole('button', { name: /Continue/i }).click()

      // In Schedule Step:
      await expect(page.getByText('Subject Details & Schedule')).toBeVisible()
      await page.locator('input[placeholder="e.g. Digital Signal Processing"]').fill(subjectName)
      await page.locator('input[placeholder="e.g. 22EC71"]').fill('PHY101')

      // Verify detected timezone contains Asia/Kolkata or IST
      const tzBadge = page.locator('[data-testid="timezone-label"]')
      await expect(tzBadge).toBeVisible()
      await expect(tzBadge).toContainText(/Asia\/Kolkata|IST/i)

      // Click "In 10 min" preset
      await page.getByRole('button', { name: /In 10 min/i }).click()

      // Verify student window preview is updated with valid window
      await expect(page.getByText('Student Window Preview')).toBeVisible()
      await expect(page.getByText(/Students can start any time between/i)).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('2. Faculty in America/New_York timezone schedules exam and verifies EST/EDT offset', async ({ browser }) => {
    const context = await browser.newContext({
      timezoneId: 'America/New_York',
      locale: 'en-US'
    })
    const page = await context.newPage()
    const subjectName = `NY Chemistry Exam ${Date.now()}`

    try {
      await page.goto('/login?role=faculty')
      await page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await page.locator('button[type="submit"]').click()
      await page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      await page.goto('/faculty/exams')
      await page.getByRole('button', { name: /Exam Wizard/i }).click()

      // Skip upload
      await page.getByRole('button', { name: /Skip, I'll type/i }).click()

      // Add question
      await page.getByRole('button', { name: /Add Question/i }).click()
      await page.locator('input[placeholder*="Question prompt"]').fill('What is the chemical formula for water?')
      const optionInputs = page.locator('input[placeholder*="Option"]')
      await optionInputs.nth(0).fill('H2O')
      await optionInputs.nth(1).fill('CO2')
      await optionInputs.nth(2).fill('NaCl')
      await optionInputs.nth(3).fill('CH4')
      await page.getByRole('button', { name: /Save Question/i }).click()
      await page.getByRole('button', { name: /Continue/i }).click()

      // In Schedule Step:
      await expect(page.getByText('Subject Details & Schedule')).toBeVisible()
      await page.locator('input[placeholder="e.g. Digital Signal Processing"]').fill(subjectName)
      await page.locator('input[placeholder="e.g. 22EC71"]').fill('CHM101')

      // Verify detected timezone contains America/New_York
      const tzBadge2 = page.locator('[data-testid="timezone-label"]')
      await expect(tzBadge2).toBeVisible()
      await expect(tzBadge2).toContainText(/America\/New_York|EST|EDT/i)

      // Click "Tomorrow 10 AM" preset
      await page.getByRole('button', { name: /Tomorrow 10 AM/i }).click()

      // Verify preview
      await expect(page.getByText(/Students can start any time between/i)).toBeVisible()
    } finally {
      await context.close()
    }
  })
})

