import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS, ADMIN_CREDENTIALS } from './helpers/cleanroom'

test.describe('E2E: Safe Exam Browser (SEB) UI, Status & Interceptor Suite', () => {
  test.describe.configure({ mode: 'serial' })

  let facultyActor: any
  let studentActor: any
  let adminActor: any
  let testExamId: string
  const VALID_CONFIG_KEY = '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'

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

    // 3. Create a draft exam via API for UI tests
    const now = new Date()
    const examRes = await api.for(facultyActor).postRaw('/api/v1/exams', {
      title: `SEB UI Integration Exam ${Date.now()}`,
      subject: 'SEB-301',
      courseCode: 'SEB301',
      description: 'Testing SEB modal settings and student UI flows',
      startTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      proctoringConfig: {
        webcam: true,
        screenShare: false,
        sebRequired: false
      }
    })
    expect(examRes.status).toBe(201)
    testExamId = examRes.body?.exam?.id || examRes.body?.data?.id || examRes.body?.id
    expect(testExamId).toBeTruthy()

    // Add a question
    await api.for(facultyActor).postRaw(`/api/v1/exams/${testExamId}/questions`, {
      questionText: 'Is Safe Exam Browser required for this exam?',
      options: ['Yes', 'No', 'Maybe', 'Optional'],
      correctOptionIndex: 0,
      marks: 4
    })
  })

  test.afterAll(async () => {
    if (facultyActor) await facultyActor.close()
    if (studentActor) await studentActor.close()
    if (adminActor) await adminActor.close()
  })

  test('1. seb-status endpoint returns status without blocking student or non-SEB clients', async () => {
    const res = await api.for(studentActor).getRaw(`/api/v1/attempts/exams/${testExamId}/seb-status`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'success')
    expect(res.body).toHaveProperty('required', false)
    expect(res.body).toHaveProperty('mode')
    expect(res.body).toHaveProperty('verified')
  })

  test('2. Faculty ExamSettingsModal: masked key round-trip and key removal in UI', async () => {
    const page = facultyActor.page

    // Navigate to exam manage page
    await page.goto(`/faculty/exams/${testExamId}`)
    const settingsBtn = page.getByRole('button', { name: /Exam Settings/i })
    await expect(settingsBtn).toBeVisible({ timeout: 10000 })

    // Open settings modal
    await settingsBtn.click()

    // Verify modal and SEB section
    await expect(page.getByText('Edit Examination Settings')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Safe Exam Browser', { exact: true })).toBeVisible()

    // Toggle SEB Required ON
    const sebToggle = page.locator('label[data-testid="label-seb-required"]')
    await sebToggle.click()

    // Helper text and checklist are now visible
    await expect(page.getByText('Copy the CONFIG KEY, not the Browser Exam Key')).toBeVisible()

    // Enter 64-hex configuration key
    const keyInput = page.locator('input[data-testid="input-seb-config-key"]')
    await expect(keyInput).toBeVisible()
    await keyInput.fill(VALID_CONFIG_KEY)

    // Save Changes
    const saveBtn = page.getByRole('button', { name: /Save Changes/i })
    await saveBtn.click()
    await expect(page.getByText('Edit Examination Settings')).toBeHidden({ timeout: 5000 })

    // Verify "Secure browser" badge is now visible on faculty page
    await expect(page.getByText('Secure browser')).toBeVisible({ timeout: 5000 })

    // Re-open settings modal: verify key field displays masked string ending in '1f8c'
    await settingsBtn.click()
    await expect(page.getByText('Edit Examination Settings')).toBeVisible({ timeout: 5000 })
    const reloadedKeyInput = page.locator('input[data-testid="input-seb-config-key"]')
    await expect(reloadedKeyInput).toHaveValue(/••••••••.*1f8c/, { timeout: 10000 })

    // Click "Remove key"
    const removeKeyBtn = page.locator('button[data-testid="btn-remove-seb-key"]')
    await removeKeyBtn.click()
    await expect(reloadedKeyInput).toHaveValue('', { timeout: 5000 })

    // Save cleared settings
    await saveBtn.click()
    await expect(page.getByText('Edit Examination Settings')).toBeHidden({ timeout: 5000 })

    // Re-enable SEB with key for student tests and publish exam
    await settingsBtn.click()
    await expect(page.getByText('Edit Examination Settings')).toBeVisible({ timeout: 5000 })
    if (!await page.locator('input[data-testid="input-seb-config-key"]').isVisible()) {
      await page.locator('label[data-testid="label-seb-required"]').click()
    }
    await page.locator('input[data-testid="input-seb-config-key"]').fill(VALID_CONFIG_KEY)
    await saveBtn.click()
    await expect(page.getByText('Edit Examination Settings')).toBeHidden({ timeout: 5000 })

    // Ensure startTime is in future for publish validation
    await setExamScheduleDates(testExamId, {
      startTime: new Date(Date.now() + 10 * 60 * 1000),
      endTime: new Date(Date.now() + 120 * 60 * 1000)
    })

    // Publish exam so students can view/attempt it
    const publishRes = await api.for(facultyActor).postRaw(`/api/v1/exams/${testExamId}/publish`, {})
    expect(publishRes.status).toBe(200)

    // Set schedule dates so the window is currently open for students
    const now = Date.now()
    await setExamScheduleDates(testExamId, {
      startTime: new Date(now - 5 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })
  })

  test('3. Student Dashboard displays "Secure browser" badge for SEB-required exams', async () => {
    const page = studentActor.page
    await page.goto('/student/dashboard')
    await expect(page.getByText(/SEB UI Integration Exam/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Secure browser')).toBeVisible()
  })

  test('4. PreExamCheckPage redirects unverified student browser to /seb-required page in enforce mode', async () => {
    const page = studentActor.page

    // Simulate backend in enforce mode for this exam
    await page.route(`**/api/v1/attempts/exams/${testExamId}/seb-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          required: true,
          mode: 'enforce',
          verified: false
        })
      })
    })

    // Navigate directly to pre-exam check for the SEB-required exam
    await page.goto(`/student/exams/${testExamId}/pre-check`)

    // Pre-check should detect mode: 'enforce', required: true, verified: false and redirect to /student/exams/:id/seb-required
    await page.waitForURL((url: URL) => url.pathname.includes('/seb-required'), { timeout: 10000 })
    expect(page.url()).toContain(`/student/exams/${testExamId}/seb-required`)

    // Verify SEB Required page contents
    await expect(page.getByText('Safe Exam Browser Required')).toBeVisible()
    await expect(page.getByText('Download Safe Exam Browser')).toBeVisible()
    await expect(page.getByText('Troubleshooting & Setup Instructions')).toBeVisible()
    await expect(page.getByText('Already running SEB?')).toBeVisible()
  })

  test('5. Axios Interceptor: 403 SEB_REQUIRED triggers automatic redirect to /seb-required', async () => {
    const page = studentActor.page

    // Navigate to student dashboard
    await page.goto('/student/dashboard')
    await page.waitForLoadState('networkidle')

    // Mock API call to return 403 SEB_REQUIRED
    await page.route(`**/api/v1/attempts/exams/${testExamId}/start`, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SEB_REQUIRED', message: 'Safe Exam Browser is required.' })
      })
    })

    // Trigger API call using apiClient
    await page.evaluate(async (examId) => {
      // @ts-ignore
      const { apiClient } = await import('/src/lib/apiClient.js')
      await apiClient.post(`/attempts/exams/${examId}/start`, {}).catch(() => {})
    }, testExamId)

    // Verify interceptor routes to seb-required page
    await page.waitForURL((url: URL) => url.pathname.includes('/seb-required'), { timeout: 10000 })
    expect(page.url()).toContain(`/student/exams/${testExamId}/seb-required`)

    // Verify UI on SebRequiredPage
    await expect(page.getByText('Safe Exam Browser Required')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Re-check Browser Status/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Return to Student Dashboard/i })).toBeVisible()

    // Test the re-check button
    const recheckBtn = page.getByRole('button', { name: /Re-check Browser Status/i })
    await recheckBtn.click()
    await expect(page.getByText('Safe Exam Browser Required')).toBeVisible()
  })

  test('6. Admin Secure Browser Setup: displays 3 numbered steps, downloads checklist, and uploads configuration', async ({ browser }) => {
    adminActor = await createActor(browser, 'admin')
    const page = adminActor.page

    // Admin login
    await page.goto('/login?role=admin')
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((url: URL) => url.pathname.includes('/admin'), { timeout: 15000 })

    // Navigate to /admin/seb
    await page.goto('/admin/seb')
    await page.waitForLoadState('networkidle')

    // Verify 3 numbered steps
    await expect(page.getByText('Install Config Tool & settings checklist')).toBeVisible()
    await expect(page.getByText('Upload configuration file & paste Config Key')).toBeVisible()
    await expect(page.locator('div[data-slot="card-title"]', { hasText: 'Test my setup' })).toBeVisible()

    // Verify checklist items & helper text
    await expect(page.getByText(/Copy the CONFIG KEY, not the Browser Exam Key/i)).toBeVisible()
    await expect(page.getByText(/Use Browser Exam Key and Configuration Key/i)).toBeVisible()
    await expect(page.getByText(/Allow video capture/i)).toBeVisible()

    // Test file selection and input
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.locator('label[for="seb-file-upload"]').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'institution.seb',
      mimeType: 'application/seb',
      buffer: Buffer.from('seb\0mock-encrypted-seb-binary-content')
    })

    await expect(page.getByText('institution.seb')).toBeVisible()

    // Fill valid 64-hex config key
    const configInput = page.locator('input[placeholder*="43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c"]')
    await configInput.fill(VALID_CONFIG_KEY)

    // Submit form
    await page.getByRole('button', { name: /Save institution configuration/i }).click()

    // Verify success notification & status update
    await expect(page.getByText(/configuration saved successfully/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Configured \(Key: ••••••••1f8c\)/i)).toBeVisible()
  })

  test('7. Admin Secure Browser Setup: "Test my setup" triggers launch link and displays live Verified indicator', async () => {
    const page = adminActor.page
    await page.goto('/admin/seb')
    await page.waitForLoadState('networkidle')

    // Mock /api/v1/seb/launch-link so browser navigation is intercepted cleanly
    await page.route('**/api/v1/seb/launch-link', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'seb://localhost:5000/api/v1/seb/config/mock-token.seb' })
      })
    })

    // Mock status polling to return fresh lastVerifiedAt
    const recentVerifiedTime = new Date().toISOString()
    await page.route('**/api/v1/admin/seb/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          uploadedAt: new Date().toISOString(),
          keyLast4: '1f8c',
          lastVerifiedAt: recentVerifiedTime
        })
      })
    })

    // Click "Test my setup"
    const testBtn = page.getByRole('button', { name: /Test my setup/i })
    await testBtn.click()

    // Live green badge should appear
    await expect(page.getByText('Verified ✓ just now').first()).toBeVisible({ timeout: 10000 })
  })
})
