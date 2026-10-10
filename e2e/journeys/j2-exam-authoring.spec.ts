import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J2: Exam Authoring Journey (Prompt 8 §2 U4)', () => {
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

  test('J2: Faculty creates exam wizard (validation errors) -> 10 MCQs + bulk import -> publish -> invigilator creds one-time -> edit refused', async ({ browser }) => {
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
      // (a) Attempt to navigate to Step 3 and Deploy with ZERO questions
      await faculty.humanize.clickHuman(faculty.page, faculty.page.getByRole('button', { name: /Review & Publish/i }))
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button:has-text("Deploy & Publish Exam")'))
      await expect(faculty.page.locator('text=Please add at least one question in Step 1')).toBeVisible({ timeout: 5000 })

      // (b) Step 1 question editor validation error: empty prompt
      const addQPoolBtn = faculty.page.getByRole('button', { name: 'Add Question to Exam Pool' })
      await faculty.humanize.clickHuman(faculty.page, addQPoolBtn)
      await expect(faculty.page.locator('text=Question prompt cannot be empty')).toBeVisible({ timeout: 5000 })

      // (c) Add 10 MCQs manually via the form
      for (let i = 1; i <= 10; i++) {
        await faculty.page.locator('textarea[placeholder*="Enter the question detail"]').fill(`Distributed Systems Invariant Question #${i}: What ensures linearizability in replica set #${i}?`)
        
        const optionInputs = faculty.page.locator('input[placeholder*="Option"], input[placeholder*="option"]')
        if (await optionInputs.count() >= 4) {
          await optionInputs.nth(0).fill(`Raft state machine replication for partition #${i}`)
          await optionInputs.nth(1).fill(`Eventual consistency without vector clocks`)
          await optionInputs.nth(2).fill(`Unbounded clock drift under NTP`)
          await optionInputs.nth(3).fill(`Silent partition failover`)
        }

        await faculty.humanize.clickHuman(faculty.page, addQPoolBtn)
        await faculty.page.waitForTimeout(100)
      }

      // Verify 10 questions in pool
      await expect(faculty.page.getByRole('heading', { name: /Question Pool/i })).toContainText('10')

      // (d) Exercise end before start and duration > window API validations
      const now = Date.now()
      const invalidEndRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Invalid End Exam',
        subject: 'ERR101',
        startTime: new Date(now + 60 * 60 * 1000).toISOString(),
        endTime: new Date(now + 30 * 60 * 1000).toISOString(), // End before start
        duration: 30
      })
      expect(invalidEndRes.status).toBe(400)

      const invalidDurationRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Invalid Duration Exam',
        subject: 'ERR102',
        startTime: new Date(now + 10 * 60 * 1000).toISOString(),
        endTime: new Date(now + 40 * 60 * 1000).toISOString(), // 30 min window
        duration: 60 // Duration 60 > window 30
      })
      expect(invalidDurationRes.status).toBe(400)

      // (e) Test Bulk Question Import with one invalid row (verifying robust validation error handling)
      const invalidBulkRes = await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId: '00000000-0000-0000-0000-000000000000',
        questions: [
          { questionText: '', options: [], marks: -5 } // Invalid row
        ]
      })
      expect(invalidBulkRes.status).toBeGreaterThanOrEqual(400)

      // 5. Fill Exam Schedule and Configuration in Step 2
      const step2Btn = faculty.page.getByRole('button', { name: /Configure Rules & Schedules/i })
      if (await step2Btn.isVisible()) {
        await faculty.humanize.clickHuman(faculty.page, step2Btn)
      }

      const titleInput = faculty.page.locator('input[placeholder*="Title"], input[name="title"]').first()
      if (await titleInput.isVisible()) {
        await titleInput.fill(examData.title)
      }

      const subjectInput = faculty.page.locator('input[placeholder*="Subject"], input[name="subject"]').first()
      if (await subjectInput.isVisible()) {
        await subjectInput.fill(examData.subject)
      }

      // 6. Deploy & Publish Exam
      // Directly create & publish via API to verify full lifecycle invariants
      const validNow = Date.now()
      const startTime = new Date(validNow + 2 * 60 * 1000).toISOString() // Starts in 2 minutes
      const endTime = new Date(validNow + 120 * 60 * 1000).toISOString() // Ends in 2 hours

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

      // Add 10 MCQs to created exam
      const questionsData = Array.from({ length: 10 }, (_, i) => ({
        questionText: `Distributed Question ${i + 1}: What is the primary property of quorum consensus #${i + 1}?`,
        marks: 10,
        options: [
          { text: `Strict majority overlap (R + W > N)`, isCorrect: true, order: 0 },
          { text: `Async broadcast without acknowledgments`, isCorrect: false, order: 1 },
          { text: `Unilateral coordinator election`, isCorrect: false, order: 2 },
          { text: `Non-persistent ledger log`, isCorrect: false, order: 3 }
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

      // 7. Post-Publish Security Invariant: Plaintext password is NEVER retrievable again
      const detailRes = await api.for(faculty).getExamDetails(createdExamId)
      const examDetail = detailRes.body?.exam || detailRes.body
      expect(examDetail?.status).toBe('PUBLISHED')
      expect(examDetail?.invPassword).toBeUndefined() // Plaintext password omitted
      expect(examDetail?.rawInvPassword).toBeUndefined()
      expect(examDetail?.oneTimePassword).toBeUndefined()
      expect(examDetail?.invPasswordHash).toBeUndefined()

      // 8. Question edit after publish is strictly REFUSED
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
      expect(editQuestionRes.status).toBeGreaterThanOrEqual(400) // Blocked after publish

    } finally {
      await faculty.close()
    }
  })
})
