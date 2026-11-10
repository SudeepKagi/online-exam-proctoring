import { test, expect } from '@playwright/test'
import { createActor, passConsentIfPresent } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

async function assertVideoHasRealFrames(page: any, selector: string = '[data-testid="camera-preview-video"]') {
  const videoEl = page.locator(selector).first()
  await expect(videoEl).toBeVisible({ timeout: 15000 })

  // Wait until video has non-zero dimensions, is actively playing, and canvas sampling yields non-black pixels
  const frameInfo = await page.waitForFunction(
    (sel: string) => {
      const v = document.querySelector(sel) as HTMLVideoElement | null
      if (!v) return false
      const width = v.videoWidth
      const height = v.videoHeight
      const readyState = v.readyState
      const currentTime = v.currentTime
      const paused = v.paused

      let hasColors = false
      if (width > 0 && height > 0) {
        const c = document.createElement('canvas')
        c.width = 160
        c.height = 120
        const ctx = c.getContext('2d')
        if (ctx) {
          ctx.drawImage(v, 0, 0, 160, 120)
          const data = ctx.getImageData(0, 0, 160, 120).data
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
              hasColors = true
              break
            }
          }
        }
      }

      if (width > 0 && height > 0 && readyState >= 2 && !paused && hasColors) {
        return {
          width,
          height,
          readyState,
          currentTime,
          paused,
          hasColors
        }
      }
      return false
    },
    selector,
    { timeout: 15000 }
  )

  const val = await frameInfo.jsonValue()
  expect(val.width).toBeGreaterThan(0)
  expect(val.height).toBeGreaterThan(0)
  expect(val.readyState).toBeGreaterThanOrEqual(2)
  expect(val.paused).toBe(false)
  expect(val.hasColors).toBe(true)
}

test.describe('E2E: Camera Feed & Real-Frame Verification Suite', () => {
  let examId: string

  test.beforeAll(async ({ browser }) => {
    await resetCleanRoom()
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login?role=faculty')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL((url: URL) => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = Date.now()
      const res = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Camera Feed Test Exam ${now}`,
        subject: 'CAM-101',
        courseCode: 'CAM101',
        description: 'Exam for verifying real video frames and zero blank feed',
        startTime: new Date(now + 15 * 60 * 1000).toISOString(),
        endTime: new Date(now + 120 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        proctoringConfig: { webcam: true, screenShare: false, sebRequired: false }
      })
      examId = res.body?.exam?.id || res.body?.data?.id || res.body?.id

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Is camera feed actively providing frames?',
        options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
        correctOptionIndex: 0,
        marks: 10
      })

      const pubRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect([200, 204]).toContain(pubRes.status)
      await setExamScheduleDates(examId, {
        startTime: new Date(now - 10 * 60 * 1000),
        endTime: new Date(now + 120 * 60 * 1000)
      })
    } finally {
      await faculty.close()
    }
  })

  test('PreExamCheckPage renders active camera preview with non-black real frames after consent', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto(`/student/exams/${examId}/pre-check`)
      await passConsentIfPresent(student.page)

      // Assert real video frames in PreExamCheckPage
      await assertVideoHasRealFrames(student.page, '[data-testid="camera-preview-video"]')
    } finally {
      await student.close()
    }
  })

  test('Route handoff: StudentExamStartPage -> PreExamCheckPage -> ExamArena preserves the stream without freezing or black frame', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })

      // 1. Visit Start Page
      await student.page.goto(`/student/exams/${examId}/start`)
      await assertVideoHasRealFrames(student.page, '[data-testid="camera-preview-video"]')

      // 2. Navigate to Pre-Check via in-app navigation
      const proceedBtn = student.page.getByRole('button', { name: /Start exam|Proceed to Verification/i })
      await expect(proceedBtn).toBeVisible({ timeout: 10000 })
      await expect(proceedBtn).toBeEnabled({ timeout: 10000 })
      await proceedBtn.click()
      await student.page.waitForURL((url: URL) => url.pathname.includes('/pre-check'), { timeout: 15000 })
      await passConsentIfPresent(student.page)
      await assertVideoHasRealFrames(student.page, '[data-testid="camera-preview-video"]')

      // 3. Complete face verify and proceed to arena
      const verifyFaceBtn = student.page.getByRole('button', { name: /Capture & Verify Face|Capture Face & Start Exam/i })
      await expect(verifyFaceBtn).toBeVisible()
      await verifyFaceBtn.click()

      const enterArenaBtn = student.page.getByRole('button', { name: /Lock Screen & Launch Examination|Launch Exam|Enter Fullscreen & Launch Exam/i })
      await expect(enterArenaBtn).toBeVisible({ timeout: 15000 })
      await enterArenaBtn.click()

      await student.page.waitForURL((url: URL) => url.pathname.includes('/arena'), { timeout: 15000 })

      // In Arena, verify camera stream is still active
      const streamActive = await student.page.evaluate(() => {
        const stream = (window as any).__proctorCameraStream
        return Boolean(stream && stream.active && stream.getVideoTracks()[0]?.readyState === 'live')
      })
      expect(streamActive).toBe(true)
    } finally {
      await student.close()
    }
  })

  test('Denied camera permission displays friendly troubleshooting UI and retry mechanism', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      // Mock navigator.mediaDevices.getUserMedia rejection
      await student.page.addInitScript(() => {
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = () => {
            const err = new DOMException('Permission denied by user', 'NotAllowedError')
            return Promise.reject(err)
          }
        }
      })

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[1].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[1].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL((url: URL) => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto(`/student/exams/${examId}/pre-check`)
      await passConsentIfPresent(student.page)

      // Should show Camera access needed card with retry
      await expect(student.page.getByText('Camera access needed')).toBeVisible({ timeout: 10000 })
      await expect(student.page.getByRole('button', { name: /Try camera again/i })).toBeVisible()
    } finally {
      await student.close()
    }
  })
})
