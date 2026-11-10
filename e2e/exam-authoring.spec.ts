import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, SEEDED_FACULTY } from './helpers/cleanroom'

test.describe('E2E: 5-Step Faculty Exam Creation Wizard & Invigilator Provisioning', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Faculty completes 5-step wizard with questions, timezone schedule, cohort assignment & invigilator key generation', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const subjectName = `Distributed Systems Assessment ${Date.now()}`
    const subjectCode = '22CS72'

    try {
      // 1. Faculty Login
      await faculty.page.goto('/login?role=faculty')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      // 2. Open 5-Step AI Exam Creation Wizard
      await faculty.page.goto('/faculty/exams')
      await expect(faculty.page.getByText('Faculty Examination Workspace')).toBeVisible({ timeout: 10000 })
      await faculty.page.getByRole('button', { name: /Exam Wizard/i }).click()
      await expect(faculty.page.getByText('Start Your Examination')).toBeVisible()

      // Step 1: Skip PDF to enter questions manually
      await faculty.page.getByRole('button', { name: /Skip, I'll type/i }).click()

      // Step 2: Add MCQ manually in Question Review
      await expect(faculty.page.getByText('Questions & Marking Scheme')).toBeVisible()
      await faculty.page.getByRole('button', { name: /Add Question/i }).click()
      await faculty.page.locator('input[placeholder*="Question prompt"]').fill('What is Byzantine Fault Tolerance in distributed systems?')
      const optionInputs = faculty.page.locator('input[placeholder*="Option"]')
      await optionInputs.nth(0).fill('Consensus protocol tolerating arbitrary failures')
      await optionInputs.nth(1).fill('A hardware caching algorithm')
      await optionInputs.nth(2).fill('A relational database constraint')
      await optionInputs.nth(3).fill('An optical network transmission protocol')

      await faculty.page.getByRole('button', { name: /Save Question/i }).click()
      await expect(faculty.page.getByText('1 Items')).toBeVisible()

      // Continue to Step 3: Schedule
      await faculty.page.getByRole('button', { name: /Continue/i }).click()

      // Step 3: Subject Details & Timezone-Aware Schedule
      await expect(faculty.page.getByText('Subject Details & Schedule')).toBeVisible()
      await faculty.page.locator('input[placeholder="e.g. Digital Signal Processing"]').fill(subjectName)
      await faculty.page.locator('input[placeholder="e.g. 22EC71"]').fill(subjectCode)
      await expect(faculty.page.getByText('Student Window Preview')).toBeVisible()
      await expect(faculty.page.getByText(/Students can start any time between/i)).toBeVisible()

      // Continue to Step 4: Cohort & Security
      await faculty.page.getByRole('button', { name: /Continue/i }).click()

      // Step 4: Audience & Security Settings
      await expect(faculty.page.getByText('Cohort, Invigilators & Security')).toBeVisible()
      await expect(faculty.page.getByText('Enrolling')).toBeVisible()

      // Continue to Step 5: Review & Publish
      await faculty.page.getByRole('button', { name: /Continue/i }).click()

      // Step 5: Finalize & Publish
      await expect(faculty.page.getByText('Review & Finalize Publication')).toBeVisible()
      await expect(faculty.page.getByText('Student Portal Preview')).toBeVisible()
      await expect(faculty.page.getByText('Invigilator Live Surveillance Access')).toBeVisible()
      await expect(faculty.page.getByRole('button', { name: /Copy/i }).first()).toBeVisible()
      await expect(faculty.page.getByRole('button', { name: /Slip \(\.txt\)/i })).toBeVisible()

      // Publish Exam
      await faculty.page.getByRole('button', { name: /Publish Exam Now/i }).click()

      // Verify exam is published on Faculty Exams table
      await expect(faculty.page.getByText(/published successfully/i)).toBeVisible({ timeout: 15000 })
      const examRow = faculty.page.locator('tr').filter({ hasText: subjectName })
      await expect(examRow).toBeVisible({ timeout: 10000 })

      // Verify Invigilator Credentials Modal opens from table
      await examRow.getByRole('button', { name: /Invigilator Key/i }).click()
      await expect(faculty.page.getByText('Invigilator Surveillance Credentials')).toBeVisible()
      await expect(faculty.page.getByRole('button', { name: /Copy Credentials/i })).toBeVisible()

    } finally {
      await faculty.close()
    }
  })
})
