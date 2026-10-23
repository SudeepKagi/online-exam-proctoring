import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('Production Bugs Regression Suite (Bugs 1-4 Verification)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  // BUG 1 REGRESSION TEST: Early Exam Route Guard & Unhandled 403
  test('BUG 1: Direct navigation to future exam arena does not render zombie state, does not throw uncaught pageerror, and redirects cleanly', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    const pageErrors: string[] = []
    student.page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    try {
      // 1. Faculty logs in and creates a future scheduled exam
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const futureStart = new Date(Date.now() + 2 * 3600 * 1000) // 2 hours from now
      const futureEnd = new Date(Date.now() + 4 * 3600 * 1000)

      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Future Scheduled Exam ${Date.now()}`,
        subject: 'FUT-101',
        courseCode: 'FUT-101',
        startTime: futureStart.toISOString(),
        endTime: futureEnd.toISOString(),
        durationMinutes: 45
      })
      const futureExamId = examRes.body?.exam?.id
      expect(futureExamId).toBeDefined()

      await api.for(faculty).postRaw(`/api/v1/exams/${futureExamId}/questions`, {
        questionText: 'Is this future question accessible early?',
        options: ['No', 'Yes', 'Maybe', 'Never'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${futureExamId}/publish`, {})

      // 2. Student logs in
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // 3. Student tries to bypass dashboard and navigate directly to arena
      await student.page.goto(`/student/exams/${futureExamId}/arena`)
      await student.page.waitForTimeout(3000)

      // 4. Assert NO zombie arena state rendered
      const zombieQuestionCount = await student.page.locator('text=/QUESTION 1 OF 0/i').count()
      expect(zombieQuestionCount, 'Must never render QUESTION 1 OF 0 zombie state').toBe(0)

      const loadingQuestionCount = await student.page.locator('text=/Loading question.../i').count()
      expect(loadingQuestionCount, 'Must never render infinite Loading question... state').toBe(0)

      // 5. Assert clean redirect to dashboard with error feedback
      expect(student.page.url()).toContain('/student/dashboard')
      const alertMsg = await student.page.locator('text=/Exam is not open yet|Exam is not currently available/i').count()
      expect(alertMsg, 'Student must receive clear message on dashboard').toBeGreaterThan(0)

      // 6. Assert zero uncaught pageerror exceptions
      expect(pageErrors, 'Must have 0 uncaught pageerror exceptions').toHaveLength(0)
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // BUG 2 REGRESSION TEST: Screen Sharing & Main-Thread Stability
  test('BUG 2: Screen share proctoring remains responsive (rAF delta < 200ms) with zero main-thread lockup', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      // 1. Faculty creates active exam with 3 questions
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Screen Share Perf Exam ${Date.now()}`,
        subject: 'PERF-101',
        courseCode: 'PERF-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      for (let i = 1; i <= 3; i++) {
        await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
          questionText: `Performance Question ${i}?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctOptionIndex: 0,
          marks: 2
        })
      }
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // 2. Student logs in and navigates to arena
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Mock mediaDevices in page before navigation to simulate screen capture
      await student.page.addInitScript(() => {
        const dummyCanvas = document.createElement('canvas')
        dummyCanvas.width = 1280
        dummyCanvas.height = 720
        const ctx = dummyCanvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#5266eb'
          ctx.fillRect(0, 0, 1280, 720)
        }
        const stream = (dummyCanvas as any).captureStream ? (dummyCanvas as any).captureStream(5) : new MediaStream()
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getDisplayMedia = async () => stream
        }
      })

      await student.page.goto(`/student/exams/${examId}/arena`)
      await expect(student.page.getByText(/Question 1 of 3/i)).toBeVisible({ timeout: 20000 })

      // 3. Measure event loop latency via requestAnimationFrame while answering 3 questions
      const maxDelta = await student.page.evaluate(async () => {
        let maxLatency = 0
        let lastTime = performance.now()
        let active = true

        function checkFrame(currentTime: number) {
          const delta = currentTime - lastTime
          if (delta > maxLatency) maxLatency = delta
          lastTime = currentTime
          if (active) requestAnimationFrame(checkFrame)
        }
        requestAnimationFrame(checkFrame)

        // Simulate fast student answering 3 questions over 5 seconds
        for (let q = 0; q < 3; q++) {
          const optBtn = document.querySelector('button[type="button"]') as HTMLButtonElement
          if (optBtn) optBtn.click()
          await new Promise(r => setTimeout(r, 1200))
        }

        active = false
        return maxLatency
      })

      // Main thread must remain fluid (no synchronous lockup > 200ms)
      expect(maxDelta, 'Main-thread rAF latency delta must stay below 200ms').toBeLessThan(200)
    } finally {
      await faculty.close()
      await student.close()
    }
  })
})
