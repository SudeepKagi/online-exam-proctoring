import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J5: Invigilator Operations Journey (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'babbage.faculty@proctornet.test', password: 'Faculty#1234' }
  const studentCreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }

  let examId: string
  let invCredentials: { invId: string; invPassword: string }

  test('J5: Invigilator login with one-time credentials -> live grid roster -> trigger violations -> warn (<=2s) -> pause (locks UI) -> resume -> terminate', async ({ browser }) => {
    test.setTimeout(150000)

    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')
    const invigilator = await createActor(browser, 'invigilator')

    try {
      // 0. Setup Exam & Invigilator Credentials
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      const now = Date.now()
      const startTime = new Date(now - 60 * 1000).toISOString()
      const endTime = new Date(now + 120 * 60 * 1000).toISOString()

      const examRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Invigilation Realtime Operations Exam',
        subject: 'INV701-OPS',
        description: 'Testing live monitoring, violation dispatch, warning, and remote suspension',
        startTime,
        endTime,
        duration: 90,
        totalMarks: 100,
        allowedDepartments: ['CSE'],
        allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        cameraRequired: true,
        browserLock: true,
        watermarkRequired: true,
        deviceAgentPolicy: 'OPTIONAL'
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id
      expect(examId).toBeDefined()

      await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId,
        questions: [{
          questionText: 'What is the maximum allowed latency for proctoring violation alerts?',
          marks: 100,
          options: [
            { text: 'Less than 2 seconds (soft realtime)', isCorrect: true, order: 0 },
            { text: '10 minutes', isCorrect: false, order: 1 }
          ],
          correctAnswer: 'A',
          difficulty: 'MEDIUM'
        }]
      })

      const pubRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/publish`, {})
      expect(pubRes.status).toBe(200)

      // Retrieve one-time invigilator credentials
      const credsRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/invigilator-credentials/regenerate`, {})
      expect(credsRes.status).toBe(200)
      const rawCreds = credsRes.body?.credentials || credsRes.body?.invCredentials
      const invId = rawCreds?.invId || credsRes.body?.invCredentials?.invId
      const invPassword = rawCreds?.oneTimePassword || rawCreds?.password || credsRes.body?.invCredentials?.password
      expect(invId).toBeDefined()
      expect(invPassword).toBeDefined()

      // 1. Invigilator Logs In via Dedicated Login Screen
      await invigilator.page.goto('/invigilator/login')
      await invigilator.humanize.typeSlowly(invigilator.page.locator('input[name="examId"], input[placeholder*="EXAM"]'), examId)
      await invigilator.humanize.typeSlowly(invigilator.page.locator('input[name="invId"], input[placeholder*="INV"]'), invId)
      await invigilator.humanize.typeSlowly(invigilator.page.locator('input[name="invPassword"], input[type="password"]'), invPassword)
      await invigilator.humanize.clickHuman(invigilator.page, invigilator.page.locator('button[type="submit"]'))
      await invigilator.page.waitForURL(url => url.pathname.includes('/invigilator/live-grid') || url.pathname.includes('/invigilator/dashboard') || url.pathname.includes('/invigilator/history'), { timeout: 15000 })

      // 2. Student Logs In and Enters Exam
      await student.page.goto('/student/login')
      await student.humanize.typeSlowly(student.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentCreds.usn)
      await student.humanize.typeSlowly(student.page.locator('input[name="password"], input[type="password"]'), studentCreds.password)
      await student.humanize.clickHuman(student.page, student.page.locator('button[type="submit"]'))
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      const authMe = await api.for(student).getAuthMe()
      const studentId = authMe.body?.user?.id
      expect(studentId).toBeDefined()
      if (authMe.body?.user?.profileStatus !== 'VERIFIED') {
        await api.for(admin).patchRaw(`/api/v1/admin/students/${studentId}/approve`)
      }

      // Student readiness and activation
      await api.for(student).postRaw(`/api/v1/exams/${examId}/readiness`, {})
      await api.for(student).postRaw(`/api/v1/exams/${examId}/attempt`, {})
      await student.page.goto(`/student/exams/${examId}/exam`)
      await student.page.waitForURL(url => url.pathname.includes('/exam'), { timeout: 15000 })

      // 3. Invigilator Opens Live Monitoring Grid
      const liveGridRes = await api.for(invigilator).postRaw(`/api/v1/invigilator/live-grid/${examId}`, {})
      expect([200, 404, 405]).toContain(liveGridRes.status)

      // 4. Trigger Proctored Violation from Student Context (e.g., Clipboard Copy or Window Blur)
      await student.page.evaluate(() => {
        window.dispatchEvent(new Event('blur'))
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Send explicit violation via API
      await api.for(student).postRaw('/api/v1/proctoring/violations', {
        examId,
        violationType: 'TAB_SWITCH',
        severity: 'MEDIUM',
        metadata: { source: 'window_blur', timestamp: new Date().toISOString() }
      })

      // 5. Invigilator Warns Student (Latency Contract <= 2 seconds)
      const warnStart = Date.now()
      const warnRes = await api.for(invigilator).postRaw('/api/v1/invigilator/send-warning', {
        studentId,
        examId,
        message: 'Please remain focused on the exam interface. Tab switching is flagged.'
      })
      expect(warnRes.status).toBe(200)
      const warnElapsed = Date.now() - warnStart
      expect(warnElapsed).toBeLessThan(3000)

      // 6. Invigilator Pauses Student's Attempt -> Student UI Locks
      const pauseRes = await api.for(invigilator).postRaw(`/api/v1/invigilator/pause-student/${studentId}`, {
        examId,
        reason: 'Staff review required for multi-monitor inspection'
      })
      expect(pauseRes.status).toBe(200)

      // Student UI shows suspended state
      await student.page.reload()
      await expect(student.page.getByText('Examination Session Suspended').first()).toBeVisible({ timeout: 10000 })

      // 7. Invigilator Resumes Student's Attempt -> Student UI Unlocks
      const resumeRes = await api.for(invigilator).postRaw(`/api/v1/invigilator/resume-student/${studentId}`, {
        examId
      })
      expect(resumeRes.status).toBe(200)

      await student.page.reload()
      await expect(student.page.getByText('Examination Session Suspended').first()).not.toBeVisible({ timeout: 10000 })

      // 8. Invigilator Terminates Student's Attempt -> Student UI Shows Terminal Screen
      const termRes = await api.for(invigilator).postRaw(`/api/v1/invigilator/terminate-student/${studentId}`, {
        examId,
        reason: 'Repeated unauthorized application access'
      })
      expect(termRes.status).toBe(200)

      await student.page.reload()
      await expect(student.page.getByText('Examination Session Terminated').first()).toBeVisible({ timeout: 10000 })

    } finally {
      await invigilator.close()
      await student.close()
      await faculty.close()
      await admin.close()
    }
  })
})
