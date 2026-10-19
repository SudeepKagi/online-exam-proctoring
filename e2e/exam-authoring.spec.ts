import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, SEEDED_FACULTY } from './helpers/cleanroom'

test.describe('E2E: 4-Step Faculty Exam Creation Wizard & Invigilator Provisioning', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Faculty completes 4-step wizard with questions, schedule, cohort assignment & invigilator key generation', async ({ browser }) => {
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

      // 2. Open 4-Step AI Exam Creation Wizard
      await faculty.page.goto('/faculty/exams')
      await expect(faculty.page.getByText('Faculty Examination Workspace')).toBeVisible({ timeout: 10000 })
      await faculty.page.getByRole('button', { name: /4-Step AI Exam Wizard/i }).click()
      await expect(faculty.page.getByText('4-Step AI Exam Creation Wizard')).toBeVisible()

      // Step 1: Add MCQ manually
      await faculty.page.getByRole('button', { name: /Add MCQ Manually/i }).click()
      await faculty.page.locator('input[placeholder*="Which algorithm is used"]').fill('What is Byzantine Fault Tolerance in distributed systems?')
      const optionInputs = faculty.page.locator('input[placeholder*="Option"]')
      await optionInputs.nth(0).fill('Consensus protocol tolerating arbitrary failures')
      await optionInputs.nth(1).fill('A hardware caching algorithm')
      await optionInputs.nth(2).fill('A relational database constraint')
      await optionInputs.nth(3).fill('An optical network transmission protocol')

      await faculty.page.getByRole('button', { name: /Save Question to Bank/i }).click()
      await expect(faculty.page.getByText('1 Question in Bank')).toBeVisible()

      // Continue to Step 2
      await faculty.page.getByRole('button', { name: /Continue/i }).click()

      // Step 2: Subject Details & Auto-Calculated Schedule
      await expect(faculty.page.getByText('Subject Details & Schedule')).toBeVisible()
      await faculty.page.locator('input[placeholder="e.g. Digital Signal Processing"]').fill(subjectName)
      await faculty.page.locator('input[placeholder="e.g. 22EC71"]').fill(subjectCode)
      await expect(faculty.page.getByText('Calculated End Time')).toBeVisible()

      // Continue to Step 3
      await faculty.page.getByRole('button', { name: /Continue/i }).click()

      // Step 3: Audience & Cohort Assignment
      await expect(faculty.page.getByText('Target Semester & Department')).toBeVisible()
      await expect(faculty.page.getByText('Target Cohort')).toBeVisible()

      // Continue to Step 4
      await faculty.page.getByRole('button', { name: /Continue/i }).click()

      // Step 4: Auto-Generate Invigilator Credentials & Publish
      await expect(faculty.page.getByText('Auto-Generated Invigilator Credentials')).toBeVisible()
      await expect(faculty.page.getByText('Invigilator Surveillance Access')).toBeVisible()
      await expect(faculty.page.getByRole('button', { name: /Copy Credentials/i })).toBeVisible()
      await expect(faculty.page.getByRole('button', { name: /Download Slip/i })).toBeVisible()

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
