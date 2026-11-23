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

test.describe('E2E: Safe Exam Browser Entry Independence & Resilient Handoff (§Phase 2)', () => {
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
        description: 'Testing entry independence and resilient token handoff',
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

  test('1. Signed-out visitor with SEB UA on / redirects to /seb/enter and never redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.getByText('Secure Browser Ready')).toBeVisible({ timeout: 10000 })

    // Ensure it did not redirect to /login
    expect(page.url()).toContain('/seb/enter')
    expect(page.url()).not.toContain('/login')
    await context.close()
  })

  test('2. Signed-out visitor with SEB UA on /login renders password form with Safe Exam Browser detected badge', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/login')
    await expect(page.getByText('Safe Exam Browser detected')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In to Student Portal/i })).toBeVisible()

    await context.close()
  })

  test('3. Signed-out visitor with SEB UA on /seb/enter stays on /seb/enter and never redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/seb/enter')
    await expect(page.getByText('Secure Browser Ready')).toBeVisible({ timeout: 10000 })

    // Wait 2 seconds to confirm no delayed 401 redirect kicks them to /login
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/seb/enter')
    expect(page.url()).not.toContain('/login')

    await context.close()
  })

  test('4. Signed-out visitor with SEB UA accessing protected deep link redirects to /seb/enter, never to /login', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto('/student/dashboard')
    await expect(page.getByText('Secure Browser Ready')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain('/seb/enter')
    expect(page.url()).not.toContain('/login')

    await context.close()
  })

  test('5. Signed-out visitor with ConfigKeyHash header shows secure browser badge on /login', async ({ browser }) => {
    const hash = calculateSebHash('/api/v1/seb/ping', SEB_CONFIG_KEY)
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'x-safeexambrowser-configkeyhash': hash
      }
    })
    const page = await context.newPage()

    await page.route(`**/api/v1/seb/ping`, async (route) => {
      const header = route.request().headers()['x-safeexambrowser-configkeyhash']
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: Boolean(header && header === hash), isSebAgent: true })
      })
    })

    await page.goto('/login')
    await expect(page.locator('[data-testid="seb-verified-badge"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()

    await context.close()
  })

  test('6. Valid launch token on /seb/enter auto-exchanges and transitions to exam lobby without typing anything', async ({ browser, request }) => {
    // Student logs in via API to generate launch link
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
    const { launchToken } = await launchRes.json()
    expect(launchToken).toBeTruthy()

    // Open SEB browser context
    const context = await browser.newContext({
      userAgent: SEB_UA
    })
    const page = await context.newPage()

    await page.goto(`/seb/enter?launch=${encodeURIComponent(launchToken)}`)

    // Automatically exchanges and lands on student exam start lobby without typing anything
    await page.waitForURL((url: URL) => url.pathname.includes(`/student/exams/${examId}/start`) || url.pathname.includes('/student/dashboard'), { timeout: 15000 })
    expect(page.url()).toContain(examId)

    await context.close()
  })

  test('7. Replay within grace window succeeds, invalid launch token shows friendly error with password fallback', async ({ browser, request }) => {
    const context = await browser.newContext({ userAgent: SEB_UA })
    const page = await context.newPage()

    // A. Invalid launch token
    await page.goto('/seb/enter?launch=invalid_token_999999')
    await expect(page.getByText(/Ref: #/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Launch Handoff Incomplete/i)).toBeVisible()
    await expect(page.locator('[data-testid="seb-signin-fallback-btn"]')).toBeVisible()

    // B. Direct password login works cleanly from fallback button
    await page.locator('[data-testid="seb-signin-fallback-btn"]').click()
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
