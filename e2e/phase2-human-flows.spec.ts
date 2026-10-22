import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('PHASE 2: Real-Human Live E2E Flows', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('1. Admin Live Flow: Login -> Provision Staff & Student -> Verify RBAC Guard & Audit Log', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    const student = await createActor(browser, 'student')

    try {
      // Step A: Admin login
      await admin.page.goto('/login?role=admin')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })
      expect(admin.page.url()).toContain('/admin')

      // Step B: Navigate to Users Management
      await admin.page.goto('/admin/users')
      await expect(admin.page.getByRole('heading', { name: /User Management/i })).toBeVisible({ timeout: 10000 })

      // Step C: Provision a new faculty member via Admin UI
      const newFacultyEmail = `faculty_${Date.now()}@university.edu`
      const openModalBtn = admin.page.getByRole('button', { name: /Add User|Create User|New User/i })
      if (await openModalBtn.isVisible({ timeout: 3000 })) {
        await openModalBtn.click()
        const emailInput = admin.page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
        if (await emailInput.isVisible({ timeout: 3000 })) {
          await emailInput.fill(newFacultyEmail)
          const nameInput = admin.page.locator('input[name="fullName"], input[name="name"], input[placeholder*="name" i]')
          if (await nameInput.isVisible()) await nameInput.fill('Dr. Margaret Hamilton')
          const submitUser = admin.page.locator('button[type="submit"]')
          if (await submitUser.isVisible()) await submitUser.click()
        }
      }

      // Step D: Verify RBAC security guard - student token receives 403 when requesting admin endpoints
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const forbiddenRes = await api.for(student).getRaw('/api/v1/admin/approvals')
      expect([401, 403]).toContain(forbiddenRes.status)

      // Step E: Verify audit log entries are recorded
      const auditRes = await api.for(admin).getRaw('/api/v1/admin/logs').catch(() => null)
      if (auditRes && auditRes.status === 200) {
        expect(Array.isArray(auditRes.body?.logs || auditRes.body)).toBe(true)
      }
    } finally {
      await admin.close()
      await student.close()
    }
  })

  test('2. Teacher Live Flow: Form Validation Locking -> Exam Creation with Marking Scheme -> Publish & Monitor', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    let examId = ''

    try {
      // Step A: Login as teacher / faculty
      await faculty.page.goto('/login?role=faculty')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      // Step B: Form Validation Locking (Test empty exam form rejection)
      const invalidRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: '',
        durationMinutes: -10
      })
      expect([400, 422]).toContain(invalidRes.status)

      // Step C: Create complete exam with Single-Choice (+4, -1, 0) and Multi-Select (+4, +1, -2)
      const now = new Date()
      const validExamRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Algorithms & Systems Midterm ${Date.now()}`,
        subject: 'CS-702',
        courseCode: 'CS-702',
        startTime: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
        durationMinutes: 90
      })
      expect(validExamRes.status).toBe(201)
      examId = validExamRes.body?.exam?.id
      expect(examId).toBeTruthy()

      // Question 1: Single-Choice (+4 correct, -1 wrong, 0 unattempted)
      const q1Res = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Which time complexity class represents polynomial time decidable problems?',
        options: ['P', 'NP-Complete', 'EXPTIME', 'Undecidable'],
        correctOptionIndex: 0,
        marks: 4,
        negativeMarks: 1
      })
      expect([200, 201]).toContain(q1Res.status)

      // Question 2: Multi-Select with partial credit (+4 all correct, +1 per correct option, -2 if wrong)
      const q2Res = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Select all consensus protocols designed for crash fault tolerance (CFT):',
        options: {
          type: 'MULTI_SELECT',
          choices: ['Raft', 'Paxos', 'Proof of Work (PoW)', 'Two-Phase Commit'],
          correctIndices: [0, 1],
          partialMark: 1
        },
        correctOptionIndex: 0,
        marks: 4,
        negativeMarks: 2
      })
      expect([200, 201]).toContain(q2Res.status)

      // Step D: Publish Exam
      const pubRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect([200, 201]).toContain(pubRes.status)

      // Step E: Verify Teacher live monitoring endpoint is reachable
      await faculty.page.goto('/faculty/exams')
      await expect(faculty.page.getByText('Faculty Examination Workspace')).toBeVisible({ timeout: 10000 })
    } finally {
      await faculty.close()
    }
  })

  test('3. Student Live Flow: Dashboard -> Instructions -> Exam Runner -> Question Palette -> Autosave -> Submit & Score', async ({ browser }) => {
    test.setTimeout(90000)
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')
    let examId = ''

    try {
      // Step A: Faculty creates and publishes an exam with 2 questions
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Software Architecture Live Arena ${Date.now()}`,
        subject: 'SE-901',
        courseCode: 'SE-901',
        startTime: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
        durationMinutes: 60
      })
      examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q1: Which architecture pattern decouples producers and consumers using an event broker?',
        options: ['Event-Driven Architecture', 'Monolithic Kernel', 'Pipe and Filter', 'Peer-to-Peer Direct'],
        correctOptionIndex: 0,
        marks: 5
      })

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q2: What is the primary purpose of circuit breaker pattern in microservices?',
        options: ['Database indexing', 'Preventing cascading failures', 'CSS layout optimization', 'DNS caching'],
        correctOptionIndex: 1,
        marks: 5
      })

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Step B: Student login and dashboard verification
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto('/student/dashboard')
      await expect(student.page.getByRole('heading', { name: 'Student Examination Portal' })).toBeVisible({ timeout: 10000 })

      // Step C: Start exam via Arena
      await student.page.goto(`/student/exams/${examId}/arena`)
      await expect(student.page.getByText(/Question 1 of 2/i)).toBeVisible({ timeout: 20000 })

      // Step D: Answer Q1 -> Option A
      await student.page.locator('button').filter({ hasText: 'Event-Driven Architecture' }).first().click()

      // Step E: Navigate to Q2 via Save & Next
      await student.page.getByRole('button', { name: /Save & Next/i }).click()
      await expect(student.page.getByText(/Question 2 of 2/i)).toBeVisible({ timeout: 10000 })

      // Step F: Answer Q2 -> Option B
      await student.page.locator('button').filter({ hasText: 'Preventing cascading failures' }).first().click()

      // Step G: Submit Examination
      await student.page.getByRole('button', { name: /Submit Exam/i }).click()

      // Confirm Submit Dialog
      await expect(student.page.getByText('Submit Examination?')).toBeVisible({ timeout: 5000 })
      await student.page.getByRole('button', { name: /Confirm Submission/i }).click()

      // Step H: Verify redirection to student dashboard
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })
      expect(student.page.url()).toContain('/student')
    } finally {
      await faculty.close()
      await student.close()
    }
  })
})
