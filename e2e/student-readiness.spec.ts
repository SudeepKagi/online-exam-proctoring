import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Student Journey, System Readiness & Auto-Exit Suite', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let studentActor: any
  let openExamId: string
  let upcomingExamId: string
  let closedExamId: string
  let sebExamId: string

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

    // 3. Create and publish open exam
    const openRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Student Readiness Open Exam ${now}`,
      subject: 'CS-101',
      courseCode: 'CS101',
      description: 'Exam for student readiness check flow',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: true, screenShare: false, sebRequired: false }
    })
    openExamId = openRes.body?.exam?.id || openRes.body?.data?.id || openRes.body?.id

    await api.for(facultyActor).postRaw(`/api/v1/exams/${openExamId}/questions`, {
      questionText: 'What is the standard light canvas color in ProctorNet?',
      options: ['#000000', '#fbfcfd', '#ff0000', '#121212'],
      correctOptionIndex: 1,
      marks: 10
    })
    const pubOpen = await api.for(facultyActor).postRaw(`/api/v1/exams/${openExamId}/publish`, {})
    expect(pubOpen.status).toBe(200)
    await setExamScheduleDates(openExamId, {
      startTime: new Date(now - 15 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })

    // 4. Create and publish upcoming exam (opens in 1 hour)
    const upRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Student Readiness Upcoming Exam ${now}`,
      subject: 'CS-102',
      courseCode: 'CS102',
      description: 'Upcoming examination window',
      startTime: new Date(now + 60 * 60 * 1000).toISOString(),
      endTime: new Date(now + 180 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: true, screenShare: false, sebRequired: false }
    })
    upcomingExamId = upRes.body?.exam?.id || upRes.body?.data?.id || upRes.body?.id

    await api.for(facultyActor).postRaw(`/api/v1/exams/${upcomingExamId}/questions`, {
      questionText: 'Upcoming question placeholder?',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 0,
      marks: 5
    })
    const pubUp = await api.for(facultyActor).postRaw(`/api/v1/exams/${upcomingExamId}/publish`, {})
    expect(pubUp.status).toBe(200)

    // 5. Create and publish closed exam (ended 15 minutes ago)
    const closedRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Student Readiness Closed Exam ${now}`,
      subject: 'CS-103',
      courseCode: 'CS103',
      description: 'Closed examination window',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: { webcam: true, screenShare: false, sebRequired: false }
    })
    closedExamId = closedRes.body?.exam?.id || closedRes.body?.data?.id || closedRes.body?.id

    await api.for(facultyActor).postRaw(`/api/v1/exams/${closedExamId}/questions`, {
      questionText: 'Closed question placeholder?',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 0,
      marks: 5
    })
    const pubClosed = await api.for(facultyActor).postRaw(`/api/v1/exams/${closedExamId}/publish`, {})
    expect(pubClosed.status).toBe(200)
    await setExamScheduleDates(closedExamId, {
      startTime: new Date(now - 120 * 60 * 1000),
      endTime: new Date(now - 15 * 60 * 1000)
    })

    // 6. Create and publish SEB required exam
    const sebRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `Student Readiness SEB Exam ${now}`,
      subject: 'CS-104',
      courseCode: 'CS104',
      description: 'Exam requiring Safe Exam Browser',
      startTime: new Date(now + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: {
        webcam: true,
        screenShare: false,
        sebRequired: true,
        sebConfigKey: '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'
      }
    })
    sebExamId = sebRes.body?.exam?.id || sebRes.body?.data?.id || sebRes.body?.id

    const qSeb = await api.for(facultyActor).postRaw(`/api/v1/exams/${sebExamId}/questions`, {
      questionText: 'Is the secure browser verified?',
      options: ['Yes', 'No', 'Maybe', 'Never'],
      correctOptionIndex: 0,
      marks: 10
    })
    expect(qSeb.status).toBe(201)
    const pubSeb = await api.for(facultyActor).postRaw(`/api/v1/exams/${sebExamId}/publish`, {})
    expect(pubSeb.status).toBe(200)
    await setExamScheduleDates(sebExamId, {
      startTime: new Date(now - 15 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })

    expect(openExamId).toBeTruthy()
    expect(upcomingExamId).toBeTruthy()
    expect(closedExamId).toBeTruthy()
    expect(sebExamId).toBeTruthy()
  })

  test.afterAll(async () => {
    if (facultyActor) await facultyActor.close()
    if (studentActor) await studentActor.close()
    await resetCleanRoom()
  })

  test('1. Dashboard "Check your computer" card runs live checks and remembers result', async () => {
    const page = studentActor.page
    await page.goto('/student/dashboard')
    await page.waitForLoadState('networkidle')

    // Expect "Check your computer" card to be visible
    await expect(page.getByRole('heading', { name: 'Check your computer' })).toBeVisible({ timeout: 10000 })

    // Find and click the check button
    const checkBtn = page.getByRole('button', { name: /Check your computer|Check now|Check again/i })
    await expect(checkBtn).toBeVisible()
    await checkBtn.click()

    // Wait for the check to complete and show "You're ready ✓"
    await expect(page.getByText("You're ready ✓")).toBeVisible({ timeout: 10000 })

    // Verify result is stored in localStorage
    const savedResult = await page.evaluate(() => localStorage.getItem('proctornet_readiness_check'))
    expect(savedResult).toBeTruthy()
    const parsed = JSON.parse(savedResult!)
    expect(parsed.camera).toBe(true)
    expect(parsed.internet).toBe(true)
  })

  test('2. /student/exams/:id/start: live checklist with camera preview, latency, clock, and ready start', async () => {
    const page = studentActor.page
    await page.goto(`/student/exams/${openExamId}/start`)
    await page.waitForLoadState('networkidle')

    // Verify header and description
    await expect(page.getByText('System Readiness Check')).toBeVisible({ timeout: 10000 })

    // Verify all 4 checklist items render
    await expect(page.getByText('Camera Preview & Permissions')).toBeVisible()
    await expect(page.getByText('Internet Connection')).toBeVisible()
    await expect(page.getByText('System Clock Synchronization')).toBeVisible()
    await expect(page.getByText('Computer & Operating System')).toBeVisible()

    // Verify latency in ms is rendered
    await expect(page.locator('text=/\\d+\\s*ms/')).toBeVisible({ timeout: 10000 })

    // Verify persistent Need help? support link
    const helpLink = page.getByRole('link', { name: /Need help\?/i })
    await expect(helpLink).toBeVisible()
    expect(await helpLink.getAttribute('href')).toBeTruthy()

    // Verify primary action button "Start exam" is enabled
    const startBtn = page.getByRole('button', { name: /Start exam/i })
    await expect(startBtn).toBeEnabled({ timeout: 10000 })

    // Click "Start exam" -> navigates to pre-check
    await startBtn.click()
    await page.waitForURL((url: URL) => url.pathname.includes(`/student/exams/${openExamId}/pre-check`), { timeout: 10000 })
    expect(page.url()).toContain(`/student/exams/${openExamId}/pre-check`)
  })

  test('3. Countdown & window states: friendly messages for upcoming and closed exams', async () => {
    const page = studentActor.page

    // Upcoming exam
    await page.goto(`/student/exams/${upcomingExamId}/start`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Exam opens at/i)).toBeVisible({ timeout: 10000 })
    const startBtn = page.getByRole('button', { name: /Starts in/i })
    await expect(startBtn).toBeDisabled()

    // Closed exam
    await page.goto(`/student/exams/${closedExamId}/start`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/This exam window closed at/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Return to Dashboard/i })).toBeVisible()
  })

  test('4. SEB outside SEB: "Open secure exam browser" button and 4-second fallback', async () => {
    const page = studentActor.page

    // Mock seb-status to enforce mode outside SEB
    await page.route(`**/api/v1/attempts/exams/${sebExamId}/seb-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ required: true, mode: 'enforce', verified: false })
      })
    })

    // Mock launch-link
    await page.route(`**/api/v1/seb/launch-link`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: `seb://localhost:5173/api/v1/seb/config/mock-token.seb` })
      })
    })

    await page.goto(`/student/exams/${sebExamId}/start`)
    await page.waitForLoadState('networkidle')

    // Button should be "Open secure exam browser"
    const openSebBtn = page.getByRole('button', { name: /Open secure exam browser/i })
    await expect(openSebBtn).toBeVisible({ timeout: 10000 })

    // Click the button to trigger launch attempt and 4-second timer
    await openSebBtn.click()

    // Wait 4.5 seconds for fallback panel to reveal
    await page.waitForTimeout(4500)

    // Verify "Nothing opened?" fallback card
    await expect(page.getByText('Nothing opened?')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('link', { name: /Download Safe Exam Browser/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Try again/i })).toBeVisible()
    await expect(page.getByText(/Make sure Safe Exam Browser is installed/i)).toBeVisible()
  })

  test('5. Inside SEB: login badge, target exam redirect, and single-stage pre-check', async () => {
    const page = studentActor.page

    // Mock seb/ping to return verified
    await page.route(`**/api/v1/seb/ping`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: true })
      })
    })

    // Visit login page
    await page.goto('/login?role=student')
    await page.waitForLoadState('networkidle')

    // Verify "Secure browser ✓" badge in navbar
    const badge = page.getByTestId('seb-verified-badge')
    await expect(badge).toBeVisible({ timeout: 10000 })
    await expect(badge).toContainText('Secure browser ✓')

    // Mock seb-status for pre-check inside SEB
    await page.route(`**/api/v1/attempts/exams/${sebExamId}/seb-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ required: true, mode: 'enforce', verified: true })
      })
    })

    // Navigate to pre-check
    await page.goto(`/student/exams/${sebExamId}/pre-check`)
    await page.waitForLoadState('networkidle')

    // Inside SEB, stage indicator is single stage: Identity Verification
    await expect(page.getByText('Identity Verification', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Secure browser verified')).toBeVisible()

    // Verify button text is single-step capture & start
    const captureAndStartBtn = page.getByRole('button', { name: /Capture Face & Start Exam/i })
    await expect(captureAndStartBtn).toBeVisible()
  })

  test('6. Pre-check camera failure shows one-click recovery steps', async () => {
    // Open a separate tab to test camera error in complete isolation without affecting studentActor.page
    const errorPage = await studentActor.page.context().newPage()

    await errorPage.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Camera blocked', 'NotAllowedError'))
      }
    })

    await errorPage.goto(`/student/exams/${openExamId}/pre-check`)
    await errorPage.waitForLoadState('networkidle')

    // Expect recovery UI to appear
    await expect(errorPage.getByText('Camera access needed')).toBeVisible({ timeout: 10000 })
    await expect(errorPage.getByText(/Click the camera or lock icon in your browser/i)).toBeVisible()
    await expect(errorPage.getByRole('button', { name: /Try camera again/i })).toBeVisible()

    await errorPage.close()
  })

  test('7. After submit: confirmation with cancelable 5-second auto-exit', async () => {
    const page = studentActor.page

    // Navigate to open exam pre-check and complete normal pre-check flow
    await page.goto(`/student/exams/${openExamId}/pre-check`)
    await page.waitForLoadState('networkidle')

    // Step 1: Capture Face
    const verifyFaceBtn = page.getByRole('button', { name: /Capture & Verify Face/i })
    await expect(verifyFaceBtn).toBeVisible({ timeout: 10000 })
    await verifyFaceBtn.click()

    // Step 2: Fullscreen & Launch
    const launchBtn = page.getByRole('button', { name: /Enter Fullscreen & Launch Exam/i })
    await expect(launchBtn).toBeVisible({ timeout: 10000 })
    await launchBtn.click()

    // Wait for Arena
    await page.waitForURL((url: URL) => url.pathname.includes('/arena') || url.pathname.includes('/exam'), { timeout: 15000 })

    // Submit Exam
    const submitExamBtn = page.getByRole('button', { name: /Submit Exam/i })
    await expect(submitExamBtn).toBeVisible({ timeout: 10000 })
    await submitExamBtn.click()

    // Confirm dialog
    const confirmBtn = page.getByRole('button', { name: /Confirm Submission/i })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })
    await confirmBtn.click()

    // Verify Submission confirmation screen
    await expect(page.getByText('Examination Submitted')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Your responses have been successfully recorded/i)).toBeVisible()

    // Verify auto-exit banner
    const autoExitBanner = page.getByTestId('auto-exit-banner')
    await expect(autoExitBanner).toBeVisible()
    await expect(autoExitBanner).toContainText(/Returning to dashboard in/i)

    // Verify cancel auto-exit button
    const cancelBtn = page.getByRole('button', { name: /Cancel auto-exit/i })
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()

    // Verify cancelled state
    const cancelledBanner = page.getByTestId('auto-exit-cancelled-banner')
    await expect(cancelledBanner).toBeVisible()
    await expect(cancelledBanner).toContainText(/Auto-exit cancelled/i)

    // Verify "Return to Student Dashboard" button is still available
    const returnBtn = page.getByRole('button', { name: /Return to Student Dashboard/i })
    await expect(returnBtn).toBeVisible()
    await returnBtn.click()

    // Lands cleanly on dashboard
    await page.waitForURL((url: URL) => url.pathname.includes('/student/dashboard'), { timeout: 10000 })
    expect(page.url()).toContain('/student/dashboard')
  })
})
