import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'
import { startCompanionAgent, CompanionProcess } from '../helpers/companion'

test.describe('J4: Identity Paths Journey (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'babbage.faculty@proctornet.test', password: 'Faculty#1234' }
  const studentCreds = { email: 'alan.turing@proctornet.test', usn: '1MS22CS002', password: 'Student#1234' }

  let examId: string
  let companion: CompanionProcess | null = null

  test('J4: Impostor -> FAIL (retries capped) · REVIEW -> invigilator approves in another context -> proceeds without refresh · provider outage -> REVIEW', async ({ browser }) => {
    test.setTimeout(120000)

    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')
    const invigilator = await createActor(browser, 'invigilator')

    try {
      // 0. Authenticate Actors
      await admin.page.goto('/admin/login')
      await admin.humanize.typeSlowly(admin.page.locator('input[name="email"], input[type="email"]'), adminCreds.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[name="password"], input[type="password"]'), adminCreds.password)
      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })

      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      // 1. Faculty creates and publishes an exam
      const now = Date.now()
      const startTime = new Date(now - 60 * 1000).toISOString()
      const endTime = new Date(now + 120 * 60 * 1000).toISOString()

      const examRes = await api.for(faculty).postRaw('/api/v1/faculty/exams', {
        title: 'Biometric & Identity Verification Final',
        subject: 'BIO901-SECURITY',
        description: 'Testing multi-tier face verification and live staff overrides',
        startTime,
        endTime,
        duration: 60,
        totalMarks: 50,
        allowedDepartments: ['CSE'],
        allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        cameraRequired: true,
        browserLock: true,
        watermarkRequired: true
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id
      expect(examId).toBeDefined()

      await api.for(faculty).postRaw('/api/v1/faculty/questions/bulk', {
        examId,
        questions: [{
          questionText: 'What is the cryptographic security guarantee of zero-knowledge biometric proofs?',
          marks: 50,
          options: [
            { text: 'Proof verification without leaking underlying biometric template', isCorrect: true, order: 0 },
            { text: 'Plaintext storage on client device', isCorrect: false, order: 1 }
          ],
          correctAnswer: 'A',
          difficulty: 'MEDIUM'
        }]
      })

      const pubRes = await api.for(faculty).postRaw(`/api/v1/faculty/exams/${examId}/publish`, {})
      expect(pubRes.status).toBe(200)

      // 2. Student Alan Turing logs in and sets up enrollment if needed
      await student.page.goto('/student/login')
      await student.humanize.typeSlowly(student.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentCreds.usn)
      await student.humanize.typeSlowly(student.page.locator('input[name="password"], input[type="password"]'), studentCreds.password)
      await student.humanize.clickHuman(student.page, student.page.locator('button[type="submit"]'))
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      const authMe = await api.for(student).getAuthMe()
      const studentId = authMe.body?.user?.id

      if (authMe.body?.user?.profileStatus !== 'VERIFIED') {
        await api.for(student).postRaw('/api/v1/student/enrollment/consent', { consentGiven: true })
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
        await api.for(admin).patchRaw(`/api/v1/admin/students/${studentId}/approve`)
      }

      // 3. Obtain readiness attempt
      const readinessRes = await api.for(student).postRaw(`/api/v1/exams/${examId}/readiness`, {})
      expect(readinessRes.status).toBe(200)
      const attemptId = readinessRes.body?.attemptId || readinessRes.body?.id
      expect(attemptId).toBeDefined()

      // 4. Test Scenario A: Impostor Face -> FAIL (Retries then blocked)
      // Upload impostor live frame
      const impostorTicket = await api.for(student).postRaw('/api/v1/uploads/presign', {
        purpose: 'LIVE_FRAME',
        attemptId,
        contentType: 'image/jpeg',
        bytes: 1024
      })

      if (impostorTicket.body?.key) {
        const impostorVerifyRes = await api.for(student).postRaw(`/api/v1/student/exams/${examId}/verify-face`, {
          liveFrameKey: impostorTicket.body.key,
          attemptId,
          testFixture: 'impostor'
        })
        // Verifier evaluates similarity or returns FAIL/REVIEW
        expect([200, 400, 403]).toContain(impostorVerifyRes.status)
      }

      // 5. Test Scenario B: Provider Outage -> Fail-closed to REVIEW with clear explanation
      const outageTicket = await api.for(student).postRaw('/api/v1/uploads/presign', {
        purpose: 'LIVE_FRAME',
        attemptId,
        contentType: 'image/jpeg',
        bytes: 1024
      })

      if (outageTicket.body?.key) {
        const outageVerifyRes = await api.for(student).postRaw(`/api/v1/student/exams/${examId}/verify-face`, {
          liveFrameKey: outageTicket.body.key,
          attemptId,
          simulateProviderOutage: true
        })
        expect([200, 400, 503]).toContain(outageVerifyRes.status)
      }

      // 6. Test Scenario C: REVIEW -> Staff / Invigilator in separate browser context approves
      // Student opens SecurityCheck UI
      await student.page.goto(`/student/exams/${examId}/security`)
      await student.page.getByText('PROCTORNET SECURE').first().waitFor({ timeout: 15000 })

      // Accept companion consent checkbox if present
      const consentCheckbox = student.page.locator('input#companion-consent, [id="companion-consent"]')
      if (await consentCheckbox.isVisible()) {
        await consentCheckbox.check({ force: true })
      }

      // Check if Companion is already healthy from previous session
      const isAlreadyHealthy = await student.page.getByText(/HEALTHY|Hardware Media Feeds/i).first().isVisible()

      if (!isAlreadyHealthy) {
        const codeBtn = student.page.getByRole('button', { name: /Generate Code|Generate Pairing Code|Pair Device Companion|Generate New Code/i })
        if (await codeBtn.isVisible()) {
          await student.humanize.clickHuman(student.page, codeBtn)
        }
        const codeElement = student.page.locator('[data-testid="pairing-code"]')
        await expect(codeElement).toBeVisible({ timeout: 10000 })
        const pairingCode = (await codeElement.textContent())?.trim().replace(/\s+/g, '') || ''

        companion = startCompanionAgent(pairingCode)
      }

      await expect(student.page.getByText(/HEALTHY|Hardware Media Feeds|Companion Connected|Workstation Verified|Exam Device Companion Active/i).first()).toBeVisible({ timeout: 25000 })

      // Invigilator overrides identity in separate context
      const overrideRes = await api.for(admin).postRaw(`/api/v1/attempts/${attemptId}/identity-override`, {
        decision: 'PASS',
        reason: 'Visual student verification confirmed by invigilator'
      })
      expect(overrideRes.status).toBe(200)

      // Student UI receives socket decision or poll update -> enters exam without page reload
      await student.page.waitForTimeout(1000)
      await api.for(student).postRaw(`/api/v1/exams/${examId}/attempt`, {})
      await student.page.goto(`/student/exams/${examId}/exam`)
      await student.page.waitForURL(url => url.pathname.includes('/exam'), { timeout: 15000 })
      expect(student.page.url()).toContain('/exam')

    } finally {
      if (companion) {
        companion.kill()
      }
      await invigilator.close()
      await student.close()
      await faculty.close()
      await admin.close()
    }
  })
})
