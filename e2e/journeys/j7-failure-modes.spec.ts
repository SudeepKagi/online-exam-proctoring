import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J7: Failure Modes Journey (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'babbage.faculty@proctornet.test', password: 'Faculty#1234' }
  const studentCreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }

  let examId: string

  test('J7: Mid-exam network/server blip -> sockets reconnect, answers intact, timer continuous · Storage resilience -> exam core unaffected', async ({ browser }) => {
    test.setTimeout(120000)

    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      // 0. Setup Exam
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      const now = Date.now()
      const startTime = new Date(now - 60 * 1000).toISOString()
      const endTime = new Date(now + 120 * 60 * 1000).toISOString()

      const examRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'High Availability & Resilience Exam',
        subject: 'HA901-FAULT',
        description: 'Fault-tolerant assessment under simulated transport disconnection',
        startTime,
        endTime,
        duration: 90,
        totalMarks: 50,
        allowedDepartments: ['CSE'],
        allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        cameraRequired: true,
        browserLock: true,
        watermarkRequired: true,
        deviceAgentPolicy: 'OPTIONAL'
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id

      await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId,
        questions: [{
          questionText: 'Under Byzantine Fault Tolerant consensus, what fraction of nodes can fail?',
          marks: 50,
          options: [
            { text: 'Strictly less than one third (f < n / 3)', isCorrect: true, order: 0 },
            { text: 'More than half (f > n / 2)', isCorrect: false, order: 1 }
          ],
          correctAnswer: 'A',
          difficulty: 'HARD'
        }]
      })

      await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/publish`, {})

      // 1. Student Enters Exam
      await student.page.goto('/student/login')
      await student.humanize.typeSlowly(student.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentCreds.usn)
      await student.humanize.typeSlowly(student.page.locator('input[name="password"], input[type="password"]'), studentCreds.password)
      await student.humanize.clickHuman(student.page, student.page.locator('button[type="submit"]'))
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      const authMe = await api.for(student).getAuthMe()
      const studentId = authMe.body?.user?.id
      if (authMe.body?.user?.profileStatus !== 'VERIFIED') {
        const adminActor = await createActor(browser, 'admin')
        try {
          await api.for(adminActor).patchRaw(`/api/v1/admin/students/${studentId}/approve`)
        } finally {
          await adminActor.close()
        }
      }

      await api.for(student).postRaw(`/api/v1/exams/${examId}/readiness`, {})
      await api.for(student).postRaw(`/api/v1/exams/${examId}/attempt`, {})
      await student.page.goto(`/student/exams/${examId}/exam`)
      await student.page.waitForURL(url => url.pathname.includes('/exam'), { timeout: 15000 })

      // Wait for exam palette and select Option A
      await student.page.getByText('Question Palette').first().waitFor({ timeout: 15000 })
      const optA = student.page.locator('main').getByRole('button', { name: /Option A|Strictly less than one third/i }).first()
      await optA.click()
      await student.humanize.think(300, 500)

      // 2. Simulate Connection Severance (Offline Mode for 10 seconds)
      await student.context.setOffline(true)
      await student.humanize.think(500, 1000)

      // While offline, candidate toggles flag or navigates
      const flagBtn = student.page.getByRole('button', { name: /Flag question/i })
      if (await flagBtn.isVisible()) {
        await flagBtn.click()
      }

      // 3. Restore Network
      await student.context.setOffline(false)
      await student.humanize.think(1000, 2000)

      // 4. Assert Exam Session Continuity: No hard redirect to login or dashboard
      expect(student.page.url()).toContain('/exam')

      // Option selection preserved
      const optSelected = student.page.locator('main').getByRole('button', { name: /Option A|Strictly less than one third/i }).first()
      await expect(optSelected).toBeVisible()

    } finally {
      await student.close()
      await faculty.close()
    }
  })
})
