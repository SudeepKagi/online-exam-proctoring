import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'

test.describe('E2E: Exam Authoring Flow', () => {
  test.describe.configure({ mode: 'serial' })

  const facultyCreds = {
    email: 'babbage.faculty@proctornet.test',
    password: 'Faculty#1234'
  }

  const examData = {
    title: 'Advanced Distributed Systems Final Examination',
    subject: 'CS801-DIST',
    description: 'Comprehensive evaluation of distributed consensus and Byzantine fault tolerance',
    duration: 60,
    department: 'CSE'
  }

  let createdExamId: string
  let invigilatorCredentials: { invId: string; invPassword?: string }

  test('Faculty creates exam wizard -> adds MCQs -> publish -> invigilator creds -> tamper protection', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')

    try {
      // 1. Faculty Login
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))

      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })
      expect(faculty.page.url()).toContain('/faculty/dashboard')

      // 2. Navigate to Create Exam Wizard
      await faculty.page.goto('/faculty/exams/create')
      await faculty.page.waitForSelector('text=Question Editor')

      // 3. Exercise Wizard Validation Errors
      const addQPoolBtn = faculty.page.getByRole('button', { name: 'Add Question to Exam Pool' })
      await faculty.humanize.clickHuman(faculty.page, addQPoolBtn)
      await expect(faculty.page.locator('text=Question prompt cannot be empty')).toBeVisible({ timeout: 5000 })

      // 4. Fill question prompt and options
      await faculty.page.locator('textarea[placeholder*="Enter the question detail"]').fill('Distributed Invariant: What guarantees linearizability in replica sets?')
      const optionInputs = faculty.page.locator('input[placeholder*="Option"], input[placeholder*="option"]')
      if (await optionInputs.count() >= 4) {
        await optionInputs.nth(0).fill('Raft state machine replication with majority quorum')
        await optionInputs.nth(1).fill('Eventual consistency without vector clocks')
        await optionInputs.nth(2).fill('Unbounded clock drift under NTP')
        await optionInputs.nth(3).fill('Silent partition failover')
      }
      await faculty.humanize.clickHuman(faculty.page, addQPoolBtn)

      // 5. Create Exam via API to verify full lifecycle rules
      const now = Date.now()
      const startTime = new Date(now + 2 * 60 * 1000).toISOString()
      const endTime = new Date(now + 120 * 60 * 1000).toISOString()

      // Invalid schedule: end before start
      const invalidEndRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Invalid Schedule Exam',
        subject: 'ERR101',
        startTime: new Date(now + 60 * 60 * 1000).toISOString(),
        endTime: new Date(now + 30 * 60 * 1000).toISOString(),
        duration: 30
      })
      expect(invalidEndRes.status).toBe(400)

      // Valid Exam creation
      const examPayload = {
        title: examData.title,
        subject: examData.subject,
        description: examData.description,
        startTime,
        endTime,
        duration: examData.duration,
        totalMarks: 100,
        allowedDepartments: ['CSE'],
        allowedSemesters: [6],
        cameraRequired: true,
        browserLock: false
      }

      const createExamRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', examPayload)
      expect(createExamRes.status).toBe(201)
      createdExamId = createExamRes.body?.exam?.id
      expect(createdExamId).toBeDefined()

      // Add 5 MCQ questions
      const questionsData = Array.from({ length: 5 }, (_, i) => ({
        questionText: `Distributed Systems Q${i + 1}: What is the primary property of quorum consensus #${i + 1}?`,
        marks: 20,
        options: [
          { text: 'Strict majority overlap (R + W > N)', isCorrect: true, order: 0 },
          { text: 'Async broadcast without acknowledgments', isCorrect: false, order: 1 },
          { text: 'Unilateral coordinator election', isCorrect: false, order: 2 },
          { text: 'Non-persistent ledger log', isCorrect: false, order: 3 }
        ],
        correctAnswer: 'A',
        difficulty: 'MEDIUM'
      }))

      const bulkAddRes = await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId: createdExamId,
        questions: questionsData
      })
      expect([200, 201]).toContain(bulkAddRes.status)

      // Publish Exam & Capture One-Time Invigilator Credentials
      const publishRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${createdExamId}/publish`, {})
      expect(publishRes.status).toBe(200)
      expect(publishRes.body?.exam?.status).toBe('PUBLISHED')

      invigilatorCredentials = {
        invId: publishRes.body?.exam?.invId || publishRes.body?.invId,
        invPassword: publishRes.body?.exam?.oneTimePassword || publishRes.body?.exam?.invCredentials?.password || publishRes.body?.invPassword
      }
      expect(invigilatorCredentials.invId).toBeDefined()
      expect(invigilatorCredentials.invPassword).toBeDefined()

      // 6. Post-Publish Security Invariant: Plaintext password is omitted on subsequent reads
      const detailRes = await api.for(faculty).getExamDetails(createdExamId)
      const examDetail = detailRes.body?.exam || detailRes.body
      expect(examDetail?.status).toBe('PUBLISHED')
      expect(examDetail?.oneTimePassword).toBeUndefined()
      expect(examDetail?.invPasswordHash).toBeUndefined()

      // 7. Question modification after publish is strictly blocked
      const editQuestionRes = await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId: createdExamId,
        questions: [
          {
            questionText: 'Tampered question after publish',
            marks: 10,
            options: [{ text: 'Opt1', isCorrect: true }, { text: 'Opt2', isCorrect: false }]
          }
        ]
      })
      expect(editQuestionRes.status).toBeGreaterThanOrEqual(400)

    } finally {
      await faculty.close()
    }
  })
})
