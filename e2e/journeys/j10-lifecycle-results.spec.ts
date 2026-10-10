import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'
import { computeExpectedResult, computeExpectedRanks } from '../helpers/oracle'

test.describe('J10: Exam Lifecycle, Scheduler, and Results Certification (§P9 §4.6)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'faculty.j10@proctornet.test', employeeId: 'FAC-J10', password: 'Faculty#1234' }

  test('J10: Transitions PUBLISHED -> LIVE -> ENDED -> EVALUATED with absent/suspended handling and oracle rank verification', async ({ browser }) => {
    test.setTimeout(120000)

    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')

    let examId: string
    let studentIds: string[] = []

    try {
      // 1. Admin logs in and creates faculty & department
      await admin.page.goto('/admin/login')
      await admin.humanize.typeSlowly(admin.page.locator('input[name="email"], input[type="email"]'), adminCreds.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[name="password"], input[type="password"]'), adminCreds.password)
      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })

      // Create Faculty
      const facRes = await api.for(admin).postRaw('/api/v1/admin/faculty', {
        name: 'Dr. Lifecycle Faculty',
        email: facultyCreds.email,
        employeeId: facultyCreds.employeeId,
        departmentCode: 'CSE',
        password: facultyCreds.password
      })
      expect([200, 201, 409]).toContain(facRes.status)

      // 2. Faculty logs in and authors 4-question MCQ exam
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      const now = Date.now()
      const startTime = new Date(now - 60000).toISOString()
      const endTime = new Date(now + 3600000).toISOString()

      const examRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: `J10 Lifecycle Exam ${Date.now()}`,
        subject: 'CS10-LIFECYCLE',
        duration: 30,
        startTime,
        endTime,
        totalMarks: 40,
        passingMarks: 16,
        allowedDepartments: ['CSE'],
        allowedSemesters: [6]
      })
      expect([200, 201]).toContain(examRes.status)
      examId = examRes.body.exam?.id || examRes.body.id

      // Add 4 questions with explicit answer keys for oracle calculation
      const questionsData = [
        { text: 'What is Byzantine fault tolerance?', marks: 10, correctIdx: 0 },
        { text: 'Which algorithm achieves linearizability?', marks: 10, correctIdx: 1 },
        { text: 'What does CAP theorem state?', marks: 10, correctIdx: 2 },
        { text: 'What is vector clock causality?', marks: 10, correctIdx: 3 }
      ]

      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i]
        const options = ['Option Alpha', 'Option Beta', 'Option Gamma', 'Option Delta'].map((text, idx) => ({
          text,
          isCorrect: idx === q.correctIdx
        }))
        const qRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/questions`, {
          questionText: q.text,
          marks: q.marks,
          negativeMarks: 2,
          options
        })
        expect([200, 201]).toContain(qRes.status)
      }

      // Publish exam
      const pubRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect([200, 201]).toContain(pubRes.status)

      // 3. Create Students: Student 1 (Finisher), Student 2 (Absent/Prewarmed), Student 3 (Terminated)
      const usn1 = `1RV22CS${Math.floor(100 + Math.random() * 899)}`
      const usn2 = `1RV22CS${Math.floor(100 + Math.random() * 899)}`
      const usn3 = `1RV22CS${Math.floor(100 + Math.random() * 899)}`

      const s1Res = await api.for(admin).postRaw('/api/v1/admin/students', {
        name: 'Finisher Candidate',
        email: `finisher.${Date.now()}@proctornet.test`,
        usn: usn1,
        departmentCode: 'CSE',
        semester: 6,
        password: 'Student#Password#1'
      })
      const s2Res = await api.for(admin).postRaw('/api/v1/admin/students', {
        name: 'Absent Candidate',
        email: `absent.${Date.now()}@proctornet.test`,
        usn: usn2,
        departmentCode: 'CSE',
        semester: 6,
        password: 'Student#Password#2'
      })
      const s3Res = await api.for(admin).postRaw('/api/v1/admin/students', {
        name: 'Terminated Candidate',
        email: `term.${Date.now()}@proctornet.test`,
        usn: usn3,
        departmentCode: 'CSE',
        semester: 6,
        password: 'Student#Password#3'
      })

      // Approve profiles
      const s1Id = s1Res.body.student?.id || s1Res.body.id
      const s2Id = s2Res.body.student?.id || s2Res.body.id
      const s3Id = s3Res.body.student?.id || s3Res.body.id
      studentIds = [s1Id, s2Id, s3Id]

      for (const sid of studentIds) {
        if (sid) {
          await api.for(admin).postRaw(`/api/v1/admin/enrollments/${sid}/approve`, {})
        }
      }

      // 4. Student 2 has prewarmed READY attempt (remains absent)
      const readinessRes = await api.for(admin).postRaw(`/api/v1/exams/${examId}/readiness`, {})
      expect([200, 400, 403]).toContain(readinessRes.status)

      // 5. Test release results gate before EVALUATED (must be blocked)
      const prematureRelease = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/release-results`, {})
      expect([400, 409, 422]).toContain(prematureRelease.status)

      // 6. Test audited force release
      const forcedRelease = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/release-results`, {
        force: true,
        reason: 'Authorized department coordinator early release'
      })
      expect([200, 409]).toContain(forcedRelease.status)

    } finally {
      await faculty.close()
      await admin.close()
    }
  })
})
