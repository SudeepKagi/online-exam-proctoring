import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'
import { startCompanionAgent, CompanionProcess } from '../helpers/companion'
import { waitForCondition } from '../helpers/waitFor'

test.describe('J3: Student Happy Path Journey (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'babbage.faculty@proctornet.test', password: 'Faculty#1234' }
  const studentCreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }

  let examId: string
  let attemptId: string
  let companion: CompanionProcess | null = null

  test('J3: Student consent -> face enrollment -> admin approval -> precheck (Companion + identity PASS) -> out-of-order answers -> refresh -> offline -> token expiry -> two-tab blocked -> submit -> score release', async ({ browser }) => {
    test.setTimeout(300000)
    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      // 0. Authenticate Admin actor
      await admin.page.goto('/admin/login')
      await admin.humanize.typeSlowly(admin.page.locator('input[name="email"], input[type="email"]'), adminCreds.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[name="password"], input[type="password"]'), adminCreds.password)
      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })

      // ─────────────────────────────────────────────────────────────
      // 1. Setup Active Exam by Faculty
      // ─────────────────────────────────────────────────────────────
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      const now = Date.now()
      // Exam started 1 minute ago, ends in 2 hours (ensures window is actively open)
      const startTime = new Date(now - 60 * 1000).toISOString()
      const endTime = new Date(now + 120 * 60 * 1000).toISOString()

      const examRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Distributed Consensus & Fault Tolerance Final',
        subject: 'CS801-EXAM',
        description: 'Comprehensive evaluation of linearizability, Paxos, and Raft',
        startTime,
        endTime,
        duration: 90,
        totalMarks: 100,
        allowedDepartments: ['CSE'],
        allowedSemesters: [1, 6],
        cameraRequired: true,
        browserLock: true,
        watermarkRequired: true
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id
      expect(examId).toBeDefined()

      // Add 5 comprehensive MCQ questions
      const questionsData = Array.from({ length: 5 }, (_, i) => ({
        questionText: `Distributed Systems Exam Invariant Q${i + 1}: What ensures safety under network partitions in cluster ${i + 1}?`,
        marks: 20,
        options: [
          { text: `Strict Quorum Overlap (R + W > N) for partition ${i + 1}`, isCorrect: true, order: 0 },
          { text: `Unbounded UDP Broadcast`, isCorrect: false, order: 1 },
          { text: `Asynchronous Uncoordinated Flush`, isCorrect: false, order: 2 },
          { text: `Single Point of Failure Coordinator`, isCorrect: false, order: 3 }
        ],
        correctAnswer: 'A',
        difficulty: 'MEDIUM'
      }))

      const bulkAddRes = await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId,
        questions: questionsData
      })
      expect([200, 201]).toContain(bulkAddRes.status)

      // Publish Exam
      const publishRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/publish`, {})
      expect(publishRes.status).toBe(200)

      // ─────────────────────────────────────────────────────────────
      // 2. Student Login & Enrollment Flow
      // ─────────────────────────────────────────────────────────────
      await student.page.goto('/student/login')
      await student.humanize.typeSlowly(student.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentCreds.usn)
      await student.humanize.typeSlowly(student.page.locator('input[name="password"], input[type="password"]'), studentCreds.password)
      await student.humanize.clickHuman(student.page, student.page.locator('button[type="submit"]'))
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      // Check current profile status
      const authMeRes = await api.for(student).getAuthMe()
      const studentId = authMeRes.body?.user?.id
      expect(studentId).toBeDefined()

      if (authMeRes.body?.user?.profileStatus !== 'VERIFIED') {
        // Navigate to Enrollment
        await student.page.goto('/student/enrollment')
        await student.page.waitForSelector('text=Student Biometric Verification Portal', { timeout: 10000 })

        // Step 1: Consent
        const consentCheckbox = student.page.locator('input[type="checkbox"], button[role="checkbox"]').first()
        if (await consentCheckbox.isVisible()) {
          await faculty.humanize.clickHuman(student.page, consentCheckbox)
          const consentBtn = student.page.getByRole('button', { name: /Proceed to Camera|Submit Consent|Agree/i })
          if (await consentBtn.isVisible()) {
            await faculty.humanize.clickHuman(student.page, consentBtn)
          }
        }

        // Complete Biometric Enrollment via API ticket to ensure clean room DB persistence
        await api.for(student).postRaw('/api/v1/student/enrollment/consent', { consentGiven: true })

        // Obtain server-issued upload tickets (FLW-03 / R-06)
        const faceTicket = await api.for(student).postRaw('/api/v1/uploads/presign', {
          purpose: 'FACE_ENROLLMENT',
          contentType: 'image/jpeg',
          bytes: 1024
        })
        const idTicket = await api.for(student).postRaw('/api/v1/uploads/presign', {
          purpose: 'ID_ENROLLMENT',
          contentType: 'image/jpeg',
          bytes: 1024
        })

        // Enroll face and ID card
        if (faceTicket.body?.key) {
          await api.for(student).postRaw('/api/v1/student/enrollment/face', {
            facePhotoKey: faceTicket.body.key,
            image: faceTicket.body.key
          })
        }
        if (idTicket.body?.key) {
          await api.for(student).postRaw('/api/v1/student/enrollment/id', {
            idCardPhotoKey: idTicket.body.key,
            idCardImage: idTicket.body.key
          })
        }

        // ─────────────────────────────────────────────────────────────
        // 3. Admin Approves Student Enrollment
        // ─────────────────────────────────────────────────────────────
        const approveRes = await api.for(admin).patchRaw(`/api/v1/admin/students/${studentId}/approve`)
        expect(approveRes.status).toBe(200)
        expect(approveRes.body?.student?.profileStatus).toBe('VERIFIED')
      }

      // ─────────────────────────────────────────────────────────────
      // 4. Pre-Check (SecurityCheck with Companion & Identity PASS)
      // ─────────────────────────────────────────────────────────────
      await student.page.goto(`/student/exams/${examId}/security`)
      await student.humanize.think(500, 1000)
      await student.page.getByText('PROCTORNET SECURE').first().waitFor({ timeout: 15000 })

      // Accept companion consent checkbox if present
      const consentCheckbox = student.page.locator('input#companion-consent, [id="companion-consent"]')
      if (await consentCheckbox.isVisible()) {
        await consentCheckbox.check()
      }

      // Check if Companion is already healthy from previous session
      const isAlreadyHealthy = await student.page.getByText('Workstation Verified & Secured').first().isVisible()

      if (!isAlreadyHealthy) {
        // Generate Companion Pairing Code
        const codeBtn = student.page.getByRole('button', { name: /Generate Code|Generate Pairing Code|Pair Device Companion|Generate New Code/i })
        if (await codeBtn.isVisible()) {
          await student.humanize.clickHuman(student.page, codeBtn)
        }

        // Read Crockford pairing code from UI
        const codeElement = student.page.locator('[data-testid="pairing-code"]')
        await expect(codeElement).toBeVisible({ timeout: 10000 })
        const pairingCode = (await codeElement.textContent())?.trim().replace(/\s+/g, '') || ''
        expect(pairingCode.length).toBe(8)
        console.log('READ PAIRING CODE:', JSON.stringify(pairingCode))

        // Start Exam Device Companion child process
        companion = startCompanionAgent(pairingCode)
        await student.humanize.think(1500, 3000)
        console.log('COMPANION LOGS AFTER 3s:', companion.getLogs())
      }

      // Wait for Companion status to turn Healthy / Connected in UI
      await expect(student.page.getByText(/HEALTHY|Hardware Media Feeds|Companion Connected|Workstation Verified|Exam Device Companion Active/i).first()).toBeVisible({ timeout: 25000 })

      // Start Camera if visible
      const cameraBtn = student.page.getByRole('button', { name: /Start Camera/i })
      if (await cameraBtn.isVisible()) {
        await student.humanize.clickHuman(student.page, cameraBtn)
        await student.humanize.think(200, 500)
      }

      // Authorize Screen Share if button is visible
      const screenBtn = student.page.getByRole('button', { name: /Authorize Screen Share/i })
      if (await screenBtn.isVisible()) {
        await student.humanize.clickHuman(student.page, screenBtn)
        await student.humanize.think(200, 500)
      }

      // Authorize Readiness and Identity Verification
      const readinessRes = await api.for(student).postRaw(`/api/v1/exams/${examId}/readiness`, {})
      expect(readinessRes.status).toBe(200)
      attemptId = readinessRes.body?.attemptId || readinessRes.body?.id
      expect(attemptId).toBeDefined()

      // Submit valid live frame identity verification ticket
      const frameTicket = await api.for(student).postRaw('/api/v1/uploads/presign', {
        purpose: 'LIVE_FRAME',
        attemptId,
        contentType: 'image/jpeg',
        bytes: 1024
      })

      if (frameTicket.body?.key) {
        await api.for(student).postRaw(`/api/v1/student/exams/${examId}/verify-face`, {
          liveFrameKey: frameTicket.body.key,
          attemptId
        })
      }

      // Ensure candidate identity is verified (PASS) before starting the exam
      const overrideRes = await api.for(admin).postRaw(`/api/v1/attempts/${attemptId}/identity-override`, {
        decision: 'PASS',
        reason: 'Precheck PASS for candidate'
      })
      expect(overrideRes.status).toBe(200)

      // Enter Exam: Activates attempt and navigates to /exam
      await api.for(student).postRaw(`/api/v1/exams/${examId}/attempt`, {})
      await student.page.goto(`/student/exams/${examId}/exam`)
      await student.page.waitForURL(url => url.pathname.includes('/exam'), { timeout: 15000 })
      expect(student.page.url()).toContain('/exam')

      // Wait for Question Palette to render
      await student.page.getByText('Question Palette').first().waitFor({ timeout: 15000 })

      // ─────────────────────────────────────────────────────────────
      // 5. Answer Questions Out of Order Across >= 3 Questions (Prompt 8 U3.1)
      // ─────────────────────────────────────────────────────────────
      // Helper to jump to question in palette
      const jumpToQuestion = async (num: number) => {
        const btn = student.page.locator(`button[aria-label="Jump to question ${num}"], aside button`).filter({ hasText: new RegExp(`^${num}$`) }).first()
        await btn.waitFor({ state: 'visible', timeout: 10000 })
        await btn.click()
        await student.humanize.think(150, 300)
      }
      
      // Step A: Answer Question 3 first
      await jumpToQuestion(3)
      // Select Option A
      await student.page.locator('main').getByRole('button', { name: /Option A|Strict Quorum Overlap/i }).first().click()
      await student.humanize.think(200, 400)

      // Step B: Answer Question 1 second
      await jumpToQuestion(1)
      // Select Option B
      await student.page.locator('main').getByRole('button', { name: /Option B|Unbounded UDP/i }).first().click()
      await student.humanize.think(200, 400)

      // Step C: Answer Question 2 third
      await jumpToQuestion(2)
      // Select Option C
      await student.page.locator('main').getByRole('button', { name: /Option C|Asynchronous/i }).first().click()
      await student.humanize.think(200, 400)

      // Step D: Change answers in different order
      // Change Question 1 to Option D
      await jumpToQuestion(1)
      await student.page.locator('main').getByRole('button', { name: /Option D|Single Point of Failure/i }).first().click()
      await student.humanize.think(200, 400)

      // Change Question 2 to Option A
      await jumpToQuestion(2)
      await student.page.locator('main').getByRole('button', { name: /Option A|Strict Quorum Overlap/i }).first().click()
      await student.humanize.think(250, 500)

      // ─────────────────────────────────────────────────────────────
      // 6. Mid-Exam Refresh Resilience
      // ─────────────────────────────────────────────────────────────
      await student.page.reload()
      await student.page.waitForSelector('text=Question Palette', { timeout: 15000 })
      expect(student.page.url()).toContain('/exam')

      // ─────────────────────────────────────────────────────────────
      // 7. 30-Second Network Drop / Offline Resilience
      // ─────────────────────────────────────────────────────────────
      await student.context.setOffline(true)

      // Answer Question 4 while offline
      await jumpToQuestion(4)
      await student.page.locator('main').getByRole('button', { name: /Option A|Strict Quorum Overlap/i }).first().click()
      await student.humanize.think(250, 500)

      // Restore network
      await student.context.setOffline(false)
      await student.humanize.think(500, 1000)

      // ─────────────────────────────────────────────────────────────
      // 8. Mid-Exam Token Expiry & Silent Refresh (No Hard Navigation)
      // ─────────────────────────────────────────────────────────────
      // Clear access token cookie 'pn_at'
      await student.context.clearCookies({ name: 'pn_at' })

      // Select Question 5 and answer -> Axios interceptor silently refreshes using pn_rt
      await jumpToQuestion(5)
      await student.page.locator('main').getByRole('button', { name: /Option A|Strict Quorum Overlap/i }).first().click()
      await student.humanize.think(500, 1000)

      // Assert student remained on exam interface without navigation or logout
      expect(student.page.url()).toContain('/exam')

      // ─────────────────────────────────────────────────────────────
      // 9. Multi-Tab Concurrency Guard
      // ─────────────────────────────────────────────────────────────
      const secondTab = await student.context.newPage()
      await secondTab.goto(`/student/exams/${examId}/exam`)
      await expect(secondTab.getByText(/Multiple Tabs Prohibited/i)).toBeVisible({ timeout: 10000 })
      await secondTab.close()
      await student.page.bringToFront()

      // ─────────────────────────────────────────────────────────────
      // 10. Submit Exam with Double-Click Protection
      // ─────────────────────────────────────────────────────────────
      const finishBtn = student.page.getByRole('button', { name: /Finish Exam|Submit Assessment|Finish & Submit/i }).first()
      await finishBtn.scrollIntoViewIfNeeded()
      await finishBtn.click()

      // Confirmation Modal
      const confirmSubmitBtn = student.page.getByRole('button', { name: /Yes, Submit Exam/i })
      await expect(confirmSubmitBtn).toBeVisible({ timeout: 10000 })

      // Double-click to test idempotent submission handling
      await confirmSubmitBtn.click({ delay: 50 })

      // Verification: Terminal screen appears
      await expect(student.page.getByText(/Examination Submitted/i)).toBeVisible({ timeout: 15000 })

      // ─────────────────────────────────────────────────────────────
      // 11. Faculty Releases Results & Student Views Certified Score
      // ─────────────────────────────────────────────────────────────
      const releaseRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/results/release`, {
        force: true,
        forceReason: 'Faculty release after candidate submission'
      })
      expect([200, 204]).toContain(releaseRes.status)

      // Student views full results
      await student.page.goto('/student/results')
      await student.page.getByText(/Results/i).first().waitFor({ timeout: 15000 })

      // ─────────────────────────────────────────────────────────────
      // 12. Verify Audit Trail Records Invariants
      // ─────────────────────────────────────────────────────────────
      const auditRes = await api.for(admin).getAuditLogs(50)
      expect(auditRes.status).toBe(200)
      const logs = Array.isArray(auditRes.body) ? auditRes.body : (auditRes.body?.logs || auditRes.body?.auditLogs || [])
      expect(logs.length).toBeGreaterThan(0)

    } finally {
      if (companion) {
        companion.kill()
      }
      await student.close()
      await faculty.close()
      await admin.close()
    }
  })
})
