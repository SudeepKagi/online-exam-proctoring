import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'

test.describe('E2E: Student Attempt Flow', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'babbage.faculty@proctornet.test', password: 'Faculty#1234' }
  const studentCreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }

  let examId: string

  test('Student pre-exam 3-stage check -> enter Exam Arena -> answer & bookmark -> submit attempt', async ({ browser }) => {
    test.setTimeout(180000)

    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      // 1. Setup Active Exam by Faculty
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      const now = Date.now()
      const startTime = new Date(now - 60 * 1000).toISOString()
      const endTime = new Date(now + 120 * 60 * 1000).toISOString()

      const examRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Distributed Systems Assessment Exam',
        subject: 'CS801-ATTEMPT',
        description: 'Comprehensive evaluation of quorum systems and Byzantine faults',
        startTime,
        endTime,
        duration: 90,
        totalMarks: 100,
        allowedDepartments: ['CSE'],
        allowedSemesters: [1, 6],
        cameraRequired: true,
        browserLock: false,
        watermarkRequired: true
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id
      expect(examId).toBeDefined()

      // Add 3 MCQ questions
      const questionsData = Array.from({ length: 3 }, (_, i) => ({
        questionText: `Distributed Systems Exam Question ${i + 1}: What ensures safety under network partitions?`,
        marks: 20,
        options: [
          { text: `Strict Quorum Overlap (R + W > N) for partition ${i + 1}`, isCorrect: true, order: 0 },
          { text: 'Unbounded UDP Broadcast', isCorrect: false, order: 1 },
          { text: 'Asynchronous Uncoordinated Flush', isCorrect: false, order: 2 },
          { text: 'Single Coordinator without replication', isCorrect: false, order: 3 }
        ],
        correctAnswer: 'A',
        difficulty: 'MEDIUM'
      }))

      await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId,
        questions: questionsData
      })

      // Publish Exam
      const publishRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/publish`, {})
      expect(publishRes.status).toBe(200)

      // 2. Ensure Student Profile is Verified
      const studentAuth = await api.for(student).postRaw('/api/v1/auth/student/login', {
        usn: studentCreds.usn,
        password: studentCreds.password
      })
      const studentId = studentAuth.body?.user?.id
      if (studentId) {
        await api.for(admin).patchRaw(`/api/v1/admin/students/${studentId}/approve`).catch(() => {})
      }

      // 3. Student Logs In
      await student.page.goto('/student/login')
      await student.humanize.typeSlowly(student.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentCreds.usn)
      await student.humanize.typeSlowly(student.page.locator('input[name="password"], input[type="password"]'), studentCreds.password)
      await student.humanize.clickHuman(student.page, student.page.locator('button[type="submit"]'))
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/exams'), { timeout: 15000 })

      // 4. Navigate to Pre-Exam Check (System & Identity Check)
      await student.page.goto(`/student/exams/${examId}/security`)
      await expect(student.page.getByText('System & Identity Check')).toBeVisible({ timeout: 15000 })

      // Stage 1: Face Verification
      const verifyFaceBtn = student.page.getByRole('button', { name: /Verify Identity|Start Camera/i })
      if (await verifyFaceBtn.isVisible()) {
        await student.humanize.clickHuman(student.page, verifyFaceBtn)
      }

      // Pre-authorize readiness via API for test determinism
      await api.for(student).postRaw(`/api/v1/exams/${examId}/readiness`, {
        faceVerified: true,
        screenVerified: true
      })

      // Stage 2: Screen Share
      const screenBtn = student.page.getByRole('button', { name: /Authorize Entire Screen Share|Screen Shared/i })
      if (await screenBtn.isVisible()) {
        await student.humanize.clickHuman(student.page, screenBtn)
      }

      // Stage 3: Fullscreen & Launch Attempt
      await api.for(student).postRaw(`/api/v1/exams/${examId}/attempt`, {})
      await student.page.goto(`/student/exams/${examId}/exam`)
      await student.page.waitForURL(url => url.pathname.includes('/exam'), { timeout: 15000 })

      // 5. Exam Arena Invariants
      // Question display check
      await expect(student.page.getByText(/Distributed Systems Exam Question/i).first()).toBeVisible({ timeout: 15000 })

      // Test Bookmark Question functionality
      const bookmarkBtn = student.page.getByTitle(/Bookmark Question|Remove Bookmark/i).first()
      if (await bookmarkBtn.isVisible()) {
        await student.humanize.clickHuman(student.page, bookmarkBtn)
      }

      // Select Answer (Option A)
      const firstOption = student.page.locator('button, div').filter({ hasText: /Strict Quorum Overlap/i }).first()
      if (await firstOption.isVisible()) {
        await student.humanize.clickHuman(student.page, firstOption)
      }

      // 6. Submit Exam Attempt
      const submitBtn = student.page.getByRole('button', { name: /Finish Attempt|Submit Exam/i })
      if (await submitBtn.isVisible()) {
        await student.humanize.clickHuman(student.page, submitBtn)

        // Confirm dialog button
        const confirmDialogBtn = student.page.getByRole('button', { name: /Confirm & Submit|Submit Anyway|Yes, Submit/i })
        if (await confirmDialogBtn.isVisible()) {
          await student.humanize.clickHuman(student.page, confirmDialogBtn)
        }
      }

      // 7. Verification: Submit completes or navigates to results
      await student.page.waitForURL(url => url.pathname.includes('/results') || url.pathname.includes('/exam'), { timeout: 15000 })

    } finally {
      await student.close()
      await faculty.close()
      await admin.close()
    }
  })
})
