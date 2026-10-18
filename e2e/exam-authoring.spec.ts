import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, SEEDED_FACULTY } from './helpers/cleanroom'

test.describe('E2E: Exam Authoring, AI Question Generation & Invigilator Provisioning', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Faculty creates exam -> AI generates MCQs -> generates Invigilator -> publishes exam', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const examTitle = `Distributed Systems Assessment ${Date.now()}`

    try {
      // 1. Faculty Login
      await faculty.page.goto('/login?role=faculty')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      // 2. Open Create Exam Dialog
      await faculty.page.goto('/faculty/exams')
      await expect(faculty.page.getByText('Faculty Examination Workspace')).toBeVisible({ timeout: 10000 })
      await faculty.page.getByRole('button', { name: /Create Exam/i }).click()
      await expect(faculty.page.getByText('Create New Examination')).toBeVisible()

      // Fill in exam creation form
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const formatDT = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

      const startIso = formatDT(new Date(now.getTime() - 5 * 60 * 1000))
      const endIso = formatDT(new Date(now.getTime() + 120 * 60 * 1000))

      await faculty.page.locator('input[placeholder="e.g. Midterm Operating Systems"]').fill(examTitle)
      await faculty.page.locator('input[placeholder="e.g. CS-401"]').fill('CS-801')
      const dateInputs = faculty.page.locator('input[type="datetime-local"]')
      await dateInputs.nth(0).fill(startIso)
      await dateInputs.nth(1).fill(endIso)
      await faculty.page.locator('input[type="number"]').fill('60')

      // Save Exam
      await faculty.page.getByRole('button', { name: 'Save & Configure Questions' }).click()
      await expect(faculty.page.getByText(/Exam created successfully/i)).toBeVisible({ timeout: 10000 })

      // Locate row and navigate to manage page
      const examRow = faculty.page.locator('tr').filter({ hasText: examTitle })
      await expect(examRow).toBeVisible({ timeout: 10000 })
      await examRow.getByRole('link', { name: /Manage Exam/i }).click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/exams/'), { timeout: 15000 })

      // 3. AI Generate Questions
      await faculty.page.getByRole('button', { name: /AI Generate Questions/i }).click()
      await expect(faculty.page.getByText('AI MCQ Generator & Question Assistant')).toBeVisible()

      await faculty.page.locator('input[placeholder*="Process Scheduling"]').fill('Distributed Consensus & Raft')
      await faculty.page.getByRole('button', { name: /Generate Questions Preview/i }).click()

      await expect(faculty.page.getByRole('button', { name: /Insert All .* Questions into Exam/i })).toBeVisible({ timeout: 20000 })
      await faculty.page.getByRole('button', { name: /Insert All .* Questions into Exam/i }).click()

      await expect(faculty.page.getByText(/Successfully added .* AI-generated questions/i)).toBeVisible({ timeout: 10000 })

      // 4. Generate Invigilator Account
      await faculty.page.getByRole('tab', { name: /Invigilators & Credentials/i }).click()
      await faculty.page.getByRole('button', { name: /Generate Invigilator Account/i }).click()
      await expect(faculty.page.getByRole('heading', { name: 'Generate Invigilator Account' })).toBeVisible()

      await faculty.page.locator('input[placeholder="e.g. Dr. Ramesh Kumar"]').fill('Prof. Margaret Hamilton')
      await faculty.page.locator('input[placeholder="e.g. Lab 302 or Hall B"]').fill('Room 404')
      await faculty.page.getByRole('button', { name: 'Generate & Assign Invigilator' }).click()

      await expect(faculty.page.getByText(/Invigilator account generated successfully/i)).toBeVisible({ timeout: 10000 })
      await expect(faculty.page.locator('tr').filter({ hasText: 'Prof. Margaret Hamilton' })).toBeVisible()
      await expect(faculty.page.locator('tr').filter({ hasText: 'Room 404' })).toBeVisible()

      // 5. Publish Exam
      await faculty.page.getByRole('button', { name: /Publish Exam/i }).click()
      await expect(faculty.page.getByText(/Exam published successfully/i)).toBeVisible({ timeout: 10000 })
      await expect(faculty.page.getByRole('button', { name: /Publish Exam/i })).not.toBeVisible()

    } finally {
      await faculty.close()
    }
  })
})
