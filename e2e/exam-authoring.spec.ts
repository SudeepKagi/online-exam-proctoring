import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_INVIGILATOR } from './helpers/cleanroom'

test.describe('E2E: Exam Authoring Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Faculty creates exam -> adds 3 MCQs -> Admin assigns invigilator -> Faculty publishes', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const examTitle = `Distributed Systems Assessment ${Date.now()}`
    let examId = ''

    try {
      // 1. Faculty Login
      await faculty.page.goto('/login')
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

      examId = faculty.page.url().split('/faculty/exams/')[1]?.split('/')[0]?.split('?')[0] || ''
      expect(examId).toBeTruthy()

      // 3. Add 3 MCQ Questions via Dialog
      for (let i = 1; i <= 3; i++) {
        await faculty.page.getByRole('button', { name: /Add MCQ Question/i }).click()
        await expect(faculty.page.getByText('New Multiple Choice Question')).toBeVisible()

        await faculty.page.locator('input[placeholder="Enter question..."]').fill(`Question ${i}: What is quorum majority invariant for cluster #${i}?`)
        await faculty.page.locator('input[placeholder="Opt 1"]').fill(`Strict Quorum Overlap (R + W > N) for node ${i}`)
        await faculty.page.locator('input[placeholder="Opt 2"]').fill('Unreliable UDP Multicast')
        await faculty.page.locator('input[placeholder="Opt 3"]').fill('Random Clock Drift')
        await faculty.page.locator('input[placeholder="Opt 4"]').fill('Silent Partition Failover')

        await faculty.page.getByRole('button', { name: 'Save Question' }).click()
        await expect(faculty.page.getByText(`Question ${i}: What is quorum majority invariant`)).toBeVisible({ timeout: 10000 })
      }

      // Verify question count badge shows 3
      await expect(faculty.page.getByText('Question Bank (3)')).toBeVisible()

      // 4. Admin Assigns Invigilator to the Exam
      const admin = await createActor(browser, 'admin')
      try {
        await admin.page.goto('/login')
        await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
        await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
        await admin.page.locator('button[type="submit"]').click()
        await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

        await admin.page.goto('/admin/exams')
        const adminExamRow = admin.page.locator('tr').filter({ hasText: examTitle })
        await expect(adminExamRow).toBeVisible({ timeout: 10000 })

        await adminExamRow.getByRole('button', { name: /Assign Invigilator/i }).click()
        await expect(admin.page.getByRole('heading', { name: 'Assign Invigilator' })).toBeVisible()

        // Select invigilator
        await admin.page.locator('button[role="combobox"]').click()
        await admin.page.getByRole('option').filter({ hasText: /Grace/i }).click()
        await admin.page.getByRole('button', { name: 'Confirm Assignment' }).click()
        await expect(admin.page.getByText(/Invigilator assigned to/i)).toBeVisible({ timeout: 10000 })
      } finally {
        await admin.close()
      }

      // 5. Faculty Publishes Exam
      const publishBtn = faculty.page.getByRole('button', { name: /Publish Examination/i })
      await expect(publishBtn).toBeVisible()
      await publishBtn.click()

      await expect(faculty.page.getByText(/Exam published successfully/i)).toBeVisible({ timeout: 10000 })
      await expect(faculty.page.getByRole('button', { name: /Publish Examination/i })).not.toBeVisible()

    } finally {
      await faculty.close()
    }
  })
})
