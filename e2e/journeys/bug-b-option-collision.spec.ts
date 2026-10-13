import { test, expect } from '@playwright/test'

test.describe('BUG B: Option selection collision reproduction', () => {
  test('question with option texts C, A, D, B records exactly the 3rd option id when clicking 3rd option', async ({ page }) => {
    // Mock getDisplayMedia so screen share overlay can be cleared
    await page.addInitScript(() => {
      localStorage.setItem('proctornet_logged_in', 'true')
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, 640, 480)
      }
      const stream = canvas.captureStream(30)
      if (!navigator.mediaDevices) {
        // @ts-ignore
        navigator.mediaDevices = {}
      }
      navigator.mediaDevices.getDisplayMedia = async () => stream
      navigator.mediaDevices.getUserMedia = async () => stream
    })

    // 1. Mock auth/me and refresh BEFORE navigation
    await page.route(/\/api\/v1\/auth\/me/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          authenticated: true,
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            role: 'student',
            name: 'Student One',
            usn: '1MS22CS001',
            profileStatus: 'VERIFIED',
            mustChangePassword: false
          }
        })
      })
    })

    await page.route(/\/api\/v1\/auth\/refresh/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'dummy-token'
        })
      })
    })

    // 2. Mock system config
    await page.route(/\/api\/v1\/config/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vpnEnforcement: false })
      })
    })

    // 3. Mock start attempt with colliding option texts
    const questionWithCollidingOptions = {
      attemptQuestionId: 'aq-collide-1',
      questionId: 'q-collide-1',
      questionText: 'What is the correct letter?',
      marks: 10,
      negativeMarks: 0,
      options: [
        { id: 'opt-c-1111', text: 'C', order: 0 },
        { id: 'opt-a-2222', text: 'A', order: 1 },
        { id: 'opt-d-3333', text: 'D', order: 2 },
        { id: 'opt-b-4444', text: 'B', order: 3 }
      ]
    }

    await page.route(/\/api\/v1\/exams\/.*\/attempt/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'att-collide-123',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          serverTime: new Date().toISOString(),
          exam: {
            id: 'exam-collide-123',
            title: 'Collision Test Exam',
            startTime: new Date(Date.now() - 60000).toISOString(),
            totalMarks: 10,
            fullScreenMode: false,
            watermarkRequired: false
          },
          questions: [questionWithCollidingOptions]
        })
      })
    })

    // Mock agent status to avoid suspended modal
    await page.route(/\/api\/v1\/attempts\/.*\/agent\/status/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: 'HEALTHY',
          findings: []
        })
      })
    })

    // 4. Intercept autosave answers put request
    let savedOptionId: string | null = null
    await page.route(/\/api\/v1\/attempts\/.*\/answers/, async (route) => {
      const postData = route.request().postDataJSON()
      if (postData?.answers?.length > 0) {
        savedOptionId = postData.answers[0].optionId
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'OK',
          results: [
            { attemptQuestionId: 'aq-collide-1', status: 'SAVED', revision: 1 }
          ]
        })
      })
    })

    // 5. Navigate to the exam interface
    await page.goto('/student/exams/exam-collide-123/exam')

    // Handle screen share prompt if shown
    const shareScreenBtn = page.getByRole('button', { name: /Share Entire Screen/i })
    if (await shareScreenBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareScreenBtn.click()
    }

    // 6. Wait for QuestionPanel to render
    await expect(page.locator('text=What is the correct letter?')).toBeVisible({ timeout: 15000 })

    // Locate the 4 options:
    // Option 1 has letter "A", text "C" (id: opt-c-1111)
    // Option 2 has letter "B", text "A" (id: opt-a-2222)
    // Option 3 has letter "C", text "D" (id: opt-d-3333)
    // Option 4 has letter "D", text "B" (id: opt-b-4444)
    const optionButtons = page.locator('main .space-y-3 button')
    await expect(optionButtons).toHaveCount(4)

    // Click the 3rd option (Letter "C", text "D")
    const thirdOption = optionButtons.nth(2)
    await expect(thirdOption).toContainText('D')
    await thirdOption.click()

    // Assert that the 1st option is NOT selected and 3rd option IS selected
    await expect(optionButtons.nth(0)).toHaveAttribute('aria-pressed', 'false')
    await expect(optionButtons.nth(2)).toHaveAttribute('aria-pressed', 'true')

    // Assert that the saved option ID must be exactly opt-d-3333, NOT opt-c-1111
    await expect.poll(() => savedOptionId, { timeout: 10000 }).toBe('opt-d-3333')
  })
})
