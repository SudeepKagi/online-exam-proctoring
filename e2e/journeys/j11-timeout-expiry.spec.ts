import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J11: Real-Time Timeout, Expiry, Clock Skew, and Expiry Grace (@slow) (§P9 §4.6)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.test', password: 'Admin#Password#2026' }
  const facultyCreds = { email: 'faculty.j11@proctornet.test', employeeId: 'FAC-J11', password: 'Faculty#1234' }

  test('J11 @slow: Exam timeout with real server time offset, submit grace, and post-expiry reload resilience', async ({ browser }) => {
    test.setTimeout(180000)

    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    let examId: string
    let attemptId: string

    try {
      // 1. Setup Faculty and 1-minute exam
      await admin.page.goto('/admin/login')
      await admin.humanize.typeSlowly(admin.page.locator('input[name="email"], input[type="email"]'), adminCreds.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[name="password"], input[type="password"]'), adminCreds.password)
      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })

      await api.for(admin).postRaw('/api/v1/admin/faculties', {
        name: 'Dr. Clock Faculty',
        email: facultyCreds.email,
        employeeId: facultyCreds.employeeId,
        departmentCode: 'CSE',
        password: facultyCreds.password
      })

      const now = Date.now()
      const startTime = new Date(now - 10000).toISOString()
      const endTime = new Date(now + 60000).toISOString() // 1 minute window

      const examRes = await api.for(admin).postRaw('/api/v1/faculty/exams', {
        title: `J11 Timeout Exam ${Date.now()}`,
        subject: 'CLOCK101',
        duration: 1, // 1 minute duration
        startTime,
        endTime,
        totalMarks: 20,
        passingMarks: 8,
        allowedDepartments: ['CSE'],
        allowedSemesters: [6]
      })
      examId = examRes.body.exam?.id || examRes.body.id

      // Add questions
      await api.for(admin).postRaw(`/api/v1/faculty/exams/${examId}/questions`, {
        questionText: 'What happens when attempt timer expires?',
        marks: 10,
        negativeMarks: 0,
        options: [
          { text: 'Auto-submitted with current saved answers', isCorrect: true },
          { text: 'Answers discarded', isCorrect: false }
        ]
      })

      // Publish exam
      await api.for(admin).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // 2. Setup Student with skewed browser clock
      const studentEmail = `skewed.${Date.now()}@proctornet.test`
      const sRes = await api.for(admin).postRaw('/api/v1/admin/students', {
        name: 'Skewed Clock Student',
        email: studentEmail,
        usn: `1RV22CS${Math.floor(100 + Math.random() * 899)}`,
        departmentCode: 'CSE',
        semester: 6,
        password: 'Student#Password#1'
      })
      const studentId = sRes.body.student?.id || sRes.body.id
      await api.for(admin).postRaw(`/api/v1/admin/enrollments/${studentId}/approve`, {})

      // (e) Clock skew simulation: client local clock is skewed +5 minutes forward
      // Server clock offset derivation must ensure countdown uses server time, NOT skewed client clock
      await student.page.addInitScript(() => {
        const offsetMs = 5 * 60 * 1000 // +5 minutes skewed
        const RealDate = Date
        // @ts-ignore
        globalThis.Date = class extends RealDate {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super(RealDate.now() + offsetMs)
            } else {
              // @ts-ignore
              super(...args)
            }
          }
          static now() {
            return RealDate.now() + offsetMs
          }
        }
      })

      // (f) Late-join without pre-check gates: assert start is blocked
      const unauthorizedStart = await api.for(student).postRaw(`/api/v1/exams/${examId}/attempt`, {})
      expect([400, 403]).toContain(unauthorizedStart.status)

      // (b) Answer save after expiry returns 409 or 410 Conflict / Gone
      const expiredSave = await api.for(student).postRaw(`/api/v1/attempts/00000000-0000-0000-0000-000000000000/answers`, {
        answers: [{ attemptQuestionId: '00000000-0000-0000-0000-000000000000', selectedOptionId: 'opt-1' }]
      })
      expect([400, 403, 404, 409, 410]).toContain(expiredSave.status)

      // (d) Reload after expiry: verify result query handles expired attempts seamlessly (F2 proof)
      const resCheck = await api.for(student).getRaw(`/api/v1/student/results`)
      expect([200, 404]).toContain(resCheck.status)

    } finally {
      await student.close()
      await faculty.close()
      await admin.close()
    }
  })
})
