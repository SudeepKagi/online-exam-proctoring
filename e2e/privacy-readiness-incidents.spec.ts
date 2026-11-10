import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Privacy Consent, Student Readiness & Incident Review Suite (§Tasks 8 & 9)', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let studentActor: any
  let examId: string
  let attemptId: string

  test.beforeAll(async ({ browser }) => {
    await resetCleanRoom()
    facultyActor = await createActor(browser, 'faculty')
    studentActor = await createActor(browser, 'student')

    // 1. Faculty login
    await facultyActor.page.goto('/login?role=faculty')
    await facultyActor.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
    await facultyActor.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
    await facultyActor.page.locator('button[type="submit"]').click()
    await facultyActor.page.waitForURL((url: URL) => url.pathname.includes('/faculty'), { timeout: 15000 })

    // 2. Student login
    await studentActor.page.goto('/login?role=student')
    await studentActor.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
    await studentActor.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
    await studentActor.page.locator('button[type="submit"]').click()
    await studentActor.page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })

    const now = Date.now()

    // 3. Create and publish an exam
    const examRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Privacy & Incident Review E2E Exam ${now}`,
      subject: 'CS-401',
      courseCode: 'CS401',
      description: 'Exam for verification of consent, readiness telemetry, and incident review',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: true, screenShare: false, sebRequired: false }
    })
    examId = examRes.body?.exam?.id || examRes.body?.data?.id || examRes.body?.id

    await api.for(facultyActor).postRaw(`/api/v1/exams/${examId}/questions`, {
      questionText: 'What is the standard data retention period in ProctorNet?',
      options: ['30 days', '60 days', '90 days', 'Indefinite'],
      correctOptionIndex: 2,
      marks: 10
    })

    const pubRes = await api.for(facultyActor).postRaw(`/api/v1/exams/${examId}/publish`, {})
    expect(pubRes.status).toBe(200)

    await setExamScheduleDates(examId, {
      startTime: new Date(now - 10 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })
  })

  test.afterAll(async () => {
    if (facultyActor?.page) await facultyActor.page.close().catch(() => {})
    if (studentActor?.page) await studentActor.page.close().catch(() => {})
  })

  test('1. Student sees mandatory privacy consent screen before pre-check and agrees', async () => {
    await studentActor.page.goto(`/student/exams/${examId}/pre-check`)

    // Verify Privacy & Consent screen appears before any camera starts
    await expect(studentActor.page.getByText('Examination Privacy & Proctoring Consent')).toBeVisible({ timeout: 10000 })
    await expect(studentActor.page.getByText('What is captured')).toBeVisible()
    await expect(studentActor.page.getByText('Who can access this data')).toBeVisible()
    await expect(studentActor.page.getByText('Retention period')).toBeVisible()

    const checkbox = studentActor.page.locator('[data-testid="consent-checkbox"]')
    const agreeBtn = studentActor.page.locator('[data-testid="consent-agree-btn"]')

    // Initially disabled until checkbox is ticked
    await expect(agreeBtn).toBeDisabled()

    // Tick the checkbox
    await checkbox.check()
    await expect(agreeBtn).toBeEnabled()

    // Click agree
    await agreeBtn.click()

    // Transition to Stage 1 of verification pipeline (Pre-Examination Verification)
    await expect(studentActor.page.getByText('Pre-Examination Verification')).toBeVisible({ timeout: 10000 })
  })

  test('2. Student telemetry is reported and visible in Faculty Readiness tab', async () => {
    // Navigate faculty to the exam management page
    await facultyActor.page.goto(`/faculty/exams/${examId}`)

    // Click the Student Readiness tab
    const readinessTab = facultyActor.page.locator('[data-testid="tab-readiness"]')
    await expect(readinessTab).toBeVisible({ timeout: 10000 })
    await readinessTab.click()

    // Verify readiness metrics container and table
    const container = facultyActor.page.locator('[data-testid="readiness-tab-container"]')
    await expect(container).toBeVisible()

    await expect(facultyActor.page.getByText('Ready to Test')).toBeVisible()
    await expect(facultyActor.page.getByText('Telemetry & Pre-flight Diagnostics')).toBeVisible()

    // Verify student's email appears in the readiness table
    await expect(facultyActor.page.getByText(SEEDED_STUDENTS[0].email)).toBeVisible({ timeout: 10000 })
  })

  test('3. Incident Review workflow: flagged status and invigilator adjudication', async () => {
    // 1. Simulate an attempt with a violation log via API
    const startRes = await api.for(studentActor).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
    attemptId = startRes.body?.attempt?.id || startRes.body?.id

    // Log a proctoring incident for this attempt
    await api.for(facultyActor).postRaw(`/api/v1/proctoring/events`, {
      attemptId,
      eventType: 'SCREEN_SHARE_ENDED',
      severity: 'MEDIUM',
      metadata: { source: 'e2e_test' }
    }).catch(() => {})

    // Reload faculty page and click Assessment Results tab
    await facultyActor.page.goto(`/faculty/exams/${examId}`)
    await facultyActor.page.getByRole('tab', { name: /Assessment Results/i }).click()

    // Attempt row should be visible
    const attemptRow = facultyActor.page.locator(`[data-testid="attempt-row-${attemptId}"]`)
    await expect(attemptRow).toBeVisible({ timeout: 10000 })

    // Click "Review Incidents"
    const reviewBtn = facultyActor.page.locator(`[data-testid="review-btn-${attemptId}"]`)
    await expect(reviewBtn).toBeVisible()
    await reviewBtn.click()

    // Modal opens with student details and violation timeline
    await expect(facultyActor.page.getByText(/Proctoring Incident Review/i)).toBeVisible({ timeout: 10000 })
    await expect(facultyActor.page.getByText(/Screen share ended \(legacy\)/i)).toBeVisible()

    // Update Adjudication Status to "Confirmed Violation" and add notes
    const statusSelect = facultyActor.page.locator('select').first()
    await statusSelect.selectOption('CONFIRMED')

    const notesTextarea = facultyActor.page.locator('textarea')
    await notesTextarea.fill('Confirmed test incident for privacy & incident review verification.')

    // Click Save Adjudication
    await facultyActor.page.getByRole('button', { name: /Save Adjudication/i }).click()
    await expect(facultyActor.page.getByText('Review status and invigilator notes updated successfully.')).toBeVisible({ timeout: 10000 })

    // Close the review modal
    await facultyActor.page.locator('[data-testid="close-review-modal"]').click()

    // Verify that CONFIRMED appears in the table row
    await expect(attemptRow.getByText('CONFIRMED')).toBeVisible({ timeout: 10000 })
  })
})
