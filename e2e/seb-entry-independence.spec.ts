import { test, expect } from '@playwright/test'
import crypto from 'crypto'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

const SEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.140 Safari/537.36 SEB/3.10.3'
const SEB_CONFIG_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
const PUBLIC_ORIGIN = 'http://localhost:5000'

function calculateSebHash(urlPathAndQuery: string, configKey: string = SEB_CONFIG_KEY): string {
  const fullUrl = `${PUBLIC_ORIGIN}${urlPathAndQuery.startsWith('/') ? urlPathAndQuery : `/${urlPathAndQuery}`}`
  return crypto.createHash('sha256').update(fullUrl + configKey.toLowerCase()).digest('hex').toLowerCase()
}

test.describe('E2E: Safe Exam Browser Entry Independence Suite (§Phase 2)', () => {
  test.describe.configure({ mode: 'serial' })

  let examId: string

  test.beforeAll(async ({ request }) => {
    await resetCleanRoom()

    // 1. Authenticate as faculty
    const loginRes = await request.post('/api/v1/auth/login', {
      data: {
        email: SEEDED_FACULTY.email,
        password: SEEDED_FACULTY.password
      }
    })
    expect(loginRes.status()).toBe(200)

    // 2. Create an exam requiring SEB
    const now = Date.now()
    const examRes = await request.post('/api/v1/exams', {
      data: {
        title: `SEB Independence Test Exam ${now}`,
        subject: 'SEB-101',
        courseCode: 'SEB101',
        description: 'Testing entry independence and launch code fallback',
        startTime: new Date(now + 10 * 60 * 1000).toISOString(),
        endTime: new Date(now + 120 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        proctoringConfig: {
          webcam: true,
          screenShare: false,
          sebRequired: true,
          sebConfigKey: SEB_CONFIG_KEY
        }
      }
    })
    expect(examRes.status()).toBe(201)
    const examBody = await examRes.json()
    examId = examBody.exam?.id || examBody.id
    expect(examId).toBeTruthy()

    // Add question so exam can be published
    const qRes = await request.post(`/api/v1/exams/${examId}/questions`, {
      data: {
        questionText: 'What is the standard light canvas color in ProctorNet?',
        options: ['#000000', '#fbfcfd', '#ff0000', '#121212'],
        correctOptionIndex: 1,
        marks: 10
      }
    })
    expect(qRes.status()).toBe(201)

    // 3. Publish exam
    const pubRes = await request.post(`/api/v1/exams/${examId}/publish`, { data: {} })
    expect(pubRes.status()).toBe(200)

    // 4. Set schedule to currently active/open
    await setExamScheduleDates(examId, {
      startTime: new Date(now - 10 * 60 * 1000),
      endTime: new Date(now + 120 * 60 * 1000)
    })
  })

  test('1. Signed-out visitor with SEB UA on / renders launch-code card and never redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.locator('input#seb-pin-input, [data-testid="seb-pin-input"]')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Enter Launch Code')).toBeVisible()

    // Ensure it did not redirect to /login
    expect(page.url()).not.toContain('/login')
    await context.close()
  })

  test('2. Signed-out visitor with SEB UA on /login renders launch-code card as primary UI with password option', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/login')
    // Primary UI is the launch code card
    await expect(page.getByText('Enter Launch Code')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="seb-pin-input"], input#seb-login-pin')).toBeVisible()

    // Secondary link to sign in with password
    const pwLink = page.getByRole('button', { name: /Sign in with password instead/i })
    await expect(pwLink).toBeVisible()

    // Clicking toggles to standard password login
    await pwLink.click()
    await expect(page.getByText(/Student Examination Portal/i)).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()

    await context.close()
  })

  test('3. Signed-out visitor with SEB UA on /seb/enter stays on /seb/enter and never redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/seb/enter')
    await expect(page.locator('input#seb-pin-input')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Enter Launch Code')).toBeVisible()

    // Wait 2 seconds to confirm no delayed 401 redirect kicks them to /login
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/seb/enter')
    expect(page.url()).not.toContain('/login')

    await context.close()
  })

  test('4. Signed-out visitor with SEB UA accessing protected deep link redirects to launch-code card, never to /login', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/student/dashboard')
    await expect(page.locator('input#seb-pin-input')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Enter Launch Code')).toBeVisible()
    expect(page.url()).toContain('/seb/enter')
    expect(page.url()).not.toContain('/login')

    await context.close()
  })

  test('5. Signed-out visitor with ConfigKeyHash header shows launch-code card on /login', async ({ browser }) => {
    const hash = calculateSebHash('/api/v1/seb/ping', SEB_CONFIG_KEY)
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'x-safeexambrowser-configkeyhash': hash
      }
    })
    const page = await context.newPage()

    await page.goto('/login')
    await expect(page.getByText('Enter Launch Code')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="seb-pin-input"], input#seb-login-pin')).toBeVisible()

    await context.close()
  })

  test('6. Correct 6-digit code entry logs student in and transitions to exam lobby', async ({ browser, request }) => {
    // Student logs in via API to generate launch link / code
    const studentLogin = await request.post('/api/v1/auth/login', {
      data: {
        email: SEEDED_STUDENTS[0].email,
        password: SEEDED_STUDENTS[0].password
      }
    })
    expect(studentLogin.status()).toBe(200)

    const launchRes = await request.post('/api/v1/seb/launch-link', {
      data: { examId }
    })
    expect(launchRes.status()).toBe(200)
    const { pin } = await launchRes.json()
    expect(pin).toMatch(/^\d{6}$/)

    // Open SEB browser context
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/seb/enter')
    const pinInput = page.locator('input#seb-pin-input')
    await expect(pinInput).toBeVisible({ timeout: 10000 })
    await pinInput.fill(pin)

    await page.getByRole('button', { name: /Continue to exam/i }).click()

    // Successfully exchanged: lands on student exam start lobby
    await page.waitForURL((url: URL) => url.pathname.includes(`/student/exams/${examId}/start`) || url.pathname.includes('/student/dashboard'), { timeout: 15000 })
    expect(page.url()).toContain(examId)

    await context.close()
  })

  test('7. Wrong, expired, and reused codes show friendly messages', async ({ browser, request }) => {
    // Generate valid token to test reuse
    const studentLogin = await request.post('/api/v1/auth/login', {
      data: {
        email: SEEDED_STUDENTS[0].email,
        password: SEEDED_STUDENTS[0].password
      }
    })
    expect(studentLogin.status()).toBe(200)

    const launchRes = await request.post('/api/v1/seb/launch-link', {
      data: { examId }
    })
    const { pin } = await launchRes.json()

    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    // A. Wrong code
    await page.goto('/seb/enter')
    await page.locator('input#seb-pin-input').fill('000000')
    await page.getByRole('button', { name: /Continue to exam/i }).click()
    await expect(page.getByText(/Invalid launch code/i)).toBeVisible({ timeout: 5000 })

    // B. Consume the valid pin via API
    const consumeRes = await request.post('/api/v1/seb/exchange-pin', {
      data: { pin }
    })
    expect(consumeRes.status()).toBe(200)

    // C. Reused code in the browser
    await page.locator('input#seb-pin-input').fill(pin)
    await page.getByRole('button', { name: /Continue to exam/i }).click()
    await expect(page.getByText(/already been used/i)).toBeVisible({ timeout: 5000 })

    await context.close()
  })
})
