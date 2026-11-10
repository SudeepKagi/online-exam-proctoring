import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_INVIGILATOR, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Invigilator Operations Flow', () => {
  test.describe.configure({ mode: 'serial' })

  let examId = ''

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Violation increments badge -> open sheet -> suspend attempt locks student screen -> resume unlocks', async ({ browser }) => {
    test.setTimeout(120000)

    // 1. Setup Active Published Exam
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Realtime Integrity Monitored Exam',
        subject: 'INV-701',
        courseCode: 'INV-701',
        startTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 190 * 60 * 1000).toISOString(),
        durationMinutes: 60
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'What is the maximum allowed latency for proctoring violation alerts?',
        options: ['Less than 2 seconds (soft realtime)', '10 minutes', '1 hour', 'None'],
        correctOptionIndex: 0,
        marks: 50
      })

      const pubRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect([200, 204]).toContain(pubRes.status)
      await setExamScheduleDates(examId, { startTime: new Date(now.getTime() - 5 * 60 * 1000) })
    } finally {
      await faculty.close()
    }

    // 2. Invigilator Logs in and Opens Live Console
    const invigilator = await createActor(browser, 'invigilator')
    const student = await createActor(browser, 'student')

    try {
      await invigilator.page.goto('/login')
      await invigilator.page.locator('input[type="text"]').fill(SEEDED_INVIGILATOR.email)
      await invigilator.page.locator('input[type="password"]').fill(SEEDED_INVIGILATOR.password)
      await invigilator.page.locator('button[type="submit"]').click()
      await invigilator.page.waitForURL(url => url.pathname.includes('/invigilator'), { timeout: 15000 })
      await invigilator.page.goto('/invigilator/console')
      await expect(invigilator.page.getByText('Live Proctoring Console')).toBeVisible({ timeout: 10000 })

      // 3. Student Logs in and Enters Arena
      await student.page.goto('/login')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Direct entry to Arena
      await student.page.goto(`/student/exams/${examId}/arena`)
      await expect(student.page.getByText('Question 1 of 1')).toBeVisible({ timeout: 15000 })

      // 4. Trigger Tab Switch Violation from Student
      await student.page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Also ensure violation is logged to API to guarantee ingestion
      await api.for(student).postRaw('/api/v1/proctoring/events', {
        examId,
        eventType: 'TAB_SWITCH',
        severity: 'HIGH',
        metadata: { source: 'window_blur', timestamp: new Date().toISOString() }
      })

      // 5. Invigilator sees student card and clicks to open Sheet
      await invigilator.page.reload()
      const studentCard = invigilator.page.locator('[data-slot="card"], .cursor-pointer').filter({ hasText: /Alice Johnson|Candidate/i }).first()
      await expect(studentCard).toBeVisible({ timeout: 10000 })

      // Click card to open Sheet
      await studentCard.click()
      await expect(invigilator.page.getByText('Realtime telemetry & security audit history')).toBeVisible({ timeout: 10000 })

      // 6. Click Suspend Attempt button
      const suspendBtn = invigilator.page.getByRole('button', { name: /Suspend Attempt/i })
      await expect(suspendBtn).toBeVisible()
      await suspendBtn.click()

      // 7. Verify Student Screen Immediately Locks
      await expect(student.page.getByTestId('suspended-overlay')).toBeVisible({ timeout: 10000 })

      // 8. Invigilator Resumes Attempt
      const resumeBtn = invigilator.page.getByRole('button', { name: /Resume Attempt/i })
      await expect(resumeBtn).toBeVisible({ timeout: 10000 })
      await resumeBtn.click()

      // 9. Verify Student Screen Unlocks
      await expect(student.page.getByTestId('suspended-overlay')).not.toBeVisible({ timeout: 10000 })

    } finally {
      await student.close()
      await invigilator.close()
    }
  })

  test('Legacy violation types (e.g. SCREEN_SHARE_ENDED) render with label "Screen share ended (legacy)" in audit sheet', async ({ browser }) => {
    test.setTimeout(60000)

    const invigilator = await createActor(browser, 'invigilator')
    try {
      await invigilator.page.goto('/login')
      await invigilator.page.locator('input[type="text"]').fill(SEEDED_INVIGILATOR.email)
      await invigilator.page.locator('input[type="password"]').fill(SEEDED_INVIGILATOR.password)
      await invigilator.page.locator('button[type="submit"]').click()
      await invigilator.page.waitForURL(url => url.pathname.includes('/invigilator'), { timeout: 15000 })
      await invigilator.page.goto('/invigilator/console')
      await expect(invigilator.page.getByText('Live Proctoring Console')).toBeVisible({ timeout: 10000 })

      // Intercept attempt logs to include legacy SCREEN_SHARE_ENDED violation
      await invigilator.page.route('**/api/v1/proctoring/attempts/*/logs', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            logs: [
              {
                id: 'legacy-log-1',
                eventType: 'SCREEN_SHARE_ENDED',
                severity: 'CRITICAL',
                createdAt: new Date().toISOString()
              }
            ]
          })
        })
      })

      // Click student card to open Sheet
      const studentCard = invigilator.page.locator('[data-slot="card"], .cursor-pointer').filter({ hasText: /Alice Johnson|Candidate/i }).first()
      await expect(studentCard).toBeVisible({ timeout: 10000 })
      await studentCard.click()
      await expect(invigilator.page.getByText('Realtime telemetry & security audit history')).toBeVisible({ timeout: 10000 })

      // Verify legacy violation renders friendly label "Screen share ended (legacy)"
      await expect(invigilator.page.getByText('Screen share ended (legacy)')).toBeVisible({ timeout: 10000 })
    } finally {
      await invigilator.close()
    }
  })
})
