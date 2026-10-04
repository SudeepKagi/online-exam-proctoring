const { test, expect } = require('@playwright/test')
const { setupE2EFixture, prisma } = require('./helpers/db')

test.describe('Golden Path E2E — Real-User Candidate Examination Lifecycle', () => {
  let fixture

  test.beforeAll(async () => {
    fixture = await setupE2EFixture()
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('Complete Candidate Journey: Login -> Discover Exam -> Start Attempt -> Autosave Answer -> Detect Violation -> Submit Exam', async ({ page }) => {
    // 1. Candidate Login
    await page.goto('/student/login')
    await expect(page).toHaveTitle(/ProctorNet/i)

    await page.fill('input[name="usn"]', fixture.student.usn)
    await page.fill('input[name="password"]', fixture.commonPassword)
    await page.click('button[type="submit"]')

    // 2. Navigation to Student Portal
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })
    expect(page.url()).not.toContain('/login')

    // 3. Enter Examination
    await page.goto(`/student/exams/${fixture.examId}/exam`)

    // 4. Assert Question UI Loads (Verifies Start/Resume Attempt API)
    const questionHeading = page.locator('main h2')
    await expect(questionHeading).toBeVisible({ timeout: 15000 })

    // 5. Select Answer (Option A on current question)
    const optionA = page.locator('main button:has-text("A ")').first()
    await expect(optionA).toBeVisible()
    await optionA.click()

    // 6. Assert Autosave Status
    // On current main, this FAILS because ExamInterface posts to legacy /student/exams/:id/autosave (Bug A-01)
    // and answers are not written with revision CAS to the modern answers table.
    const savedIndicator = page.locator('text=Answers Saved, text=Saved, text=All changes saved')
    await expect(savedIndicator.first()).toBeVisible({ timeout: 10000 })

    // 7. Verify Attempt Created in Database
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        examId: fixture.examId,
        studentId: fixture.student.id
      }
    })
    expect(attempt).not.toBeNull()
    expect(attempt.status).toBe('ACTIVE')

    // 8. Trigger Tab Switch / Window Blur Violation
    // Simulates student switching window/tab
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'))
    })

    // 9. Submit Examination
    const finishBtn = page.locator('button:has-text("Finish Exam"), button:has-text("Submit Exam")')
    await expect(finishBtn).toBeVisible()
    await finishBtn.click()

    // Confirm submission modal if present
    const confirmBtn = page.locator('button:has-text("Confirm Submit"), button:has-text("Yes, Submit"), button:has-text("Submit")').last()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // 10. Assert Successful Submission and Terminal State
    // On current main, this FAILS because submit posts to legacy /student/exams/:id/submit (Bug A-01)
    await page.waitForURL(url => url.pathname.includes('/results') || url.pathname.includes('/dashboard'), { timeout: 15000 })

    // Verify Attempt is SUBMITTED in Database
    const finalAttempt = await prisma.examAttempt.findUnique({
      where: { id: attempt.id }
    })
    expect(finalAttempt.status).toBe('SUBMITTED')
  })
})
