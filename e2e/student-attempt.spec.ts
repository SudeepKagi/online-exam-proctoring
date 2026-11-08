import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, setExamScheduleDates, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Student Attempt Flow', () => {
  test.describe.configure({ mode: 'serial' })

  let examId = ''

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Complete pre-check -> answer MCQs, bookmark, clear, palette -> submit & verify score', async ({ browser }) => {
    test.setTimeout(120000)

    // 1. Faculty Setup Exam with 3 MCQs (20 points each)
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Distributed Systems Certification',
        subject: 'CS-801',
        courseCode: 'CS-801',
        startTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 190 * 60 * 1000).toISOString(),
        durationMinutes: 90
      })
      expect(examRes.status).toBe(201)
      examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      // Add 3 Questions: Q1 -> Opt A (0), Q2 -> Opt B (1), Q3 -> Opt C (2)
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q1: What ensures safety under network partitions in distributed quorum?',
        options: ['Strict Majority Overlap (R + W > N)', 'Async Unbounded Flush', 'Broadcast UDP', 'No replication'],
        correctOptionIndex: 0,
        marks: 20
      })

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q2: Which consensus algorithm uses term numbers and leader leases?',
        options: ['Two-Phase Commit', 'Raft Consensus Protocol', 'Gossip Membership', 'MapReduce Shuffling'],
        correctOptionIndex: 1,
        marks: 20
      })

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Q3: What property guarantees that every read observes the latest write?',
        options: ['Eventual Consistency', 'Read Uncommitted', 'Linearizability (Atomic Consistency)', 'Causal Order'],
        correctOptionIndex: 2,
        marks: 20
      })

      // Publish Exam
      const pubRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect(pubRes.status).toBe(200)
      await setExamScheduleDates(examId, { startTime: new Date(now.getTime() - 5 * 60 * 1000) })
    } finally {
      await faculty.close()
    }

    // 2. Student Logs in and Completes 3-Stage PreExamCheck
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Navigate to Pre-Check
      await student.page.goto(`/student/exams/${examId}/pre-check`)
      await expect(student.page.getByText('Pre-Examination Verification')).toBeVisible({ timeout: 10000 })

      // Step 1: Verify Face
      const verifyFaceBtn = student.page.getByRole('button', { name: /Capture & Verify Face/i })
      await expect(verifyFaceBtn).toBeVisible()
      await verifyFaceBtn.click()

      // Step 2: Share Entire Screen
      const shareScreenBtn = student.page.getByRole('button', { name: /Grant Entire Screen Access/i })
      await expect(shareScreenBtn).toBeVisible({ timeout: 10000 })
      await shareScreenBtn.click()

      // Step 3: Fullscreen & Launch Exam
      const launchBtn = student.page.getByRole('button', { name: /Enter Fullscreen & Launch Exam/i })
      await expect(launchBtn).toBeVisible({ timeout: 10000 })
      await launchBtn.click()

      // 3. Exam Arena Verifications
      await student.page.waitForURL(url => url.pathname.includes('/arena') || url.pathname.includes('/exam'), { timeout: 15000 })
      await expect(student.page.getByText('Question 1 of 3')).toBeVisible({ timeout: 10000 })

      // Answer Q1 with Option A
      await student.page.locator('button').filter({ hasText: 'Strict Majority Overlap' }).click()

      // Test Bookmark Question
      const bookmarkBtn = student.page.getByRole('button', { name: /Bookmark/i })
      await bookmarkBtn.click()

      // Navigate to Q2 via Save & Next
      await student.page.getByRole('button', { name: /Save & Next/i }).click()
      await expect(student.page.getByText('Question 2 of 3')).toBeVisible({ timeout: 5000 })

      // Answer Q2 with Option A, then clear answer
      await student.page.locator('button').filter({ hasText: 'Two-Phase Commit' }).click()
      await student.page.getByRole('button', { name: /Clear/i }).click()

      // Now select correct Option B (Raft Consensus)
      await student.page.locator('button').filter({ hasText: 'Raft Consensus Protocol' }).click()

      // Navigate to Q3 via Question Palette
      await student.page.getByRole('button', { name: '3', exact: true }).click()
      await expect(student.page.getByText('Question 3 of 3')).toBeVisible({ timeout: 5000 })

      // Answer Q3 with Option C (Linearizability)
      await student.page.locator('button').filter({ hasText: 'Linearizability' }).click()

      // Test Previous button
      await student.page.getByRole('button', { name: /Previous/i }).click()
      await expect(student.page.getByText('Question 2 of 3')).toBeVisible({ timeout: 5000 })

      // Return to Q3
      await student.page.getByRole('button', { name: /Save & Next/i }).click()

      // 4. Submit Exam via Dialog
      await student.page.getByRole('button', { name: /Submit Exam/i }).click()
      await expect(student.page.getByText('Submit Examination?')).toBeVisible()

      await student.page.getByRole('button', { name: /Confirm Submission/i }).click()
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard'), { timeout: 15000 })

      // 5. Verify Exact Calculated Score (3/3 correct = 60 pts)
      const recordRow = student.page.locator('tr').filter({ hasText: 'Distributed Systems Certification' })
      await expect(recordRow).toBeVisible({ timeout: 10000 })
      await expect(recordRow.locator('text=SUBMITTED')).toBeVisible()
      await expect(recordRow.locator('text=60 pts')).toBeVisible()

    } finally {
      await student.close()
    }
  })

  test('Camera teardown verification: getUserMedia tracks end after submit, navigating away, and logout', async ({ browser }) => {
    test.setTimeout(90000)

    const student = await createActor(browser, 'student')
    try {
      // 1. Install getUserMedia track recorder before any navigation
      await student.page.addInitScript(() => {
        ;(window as any).__mediaTracks = []
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
          navigator.mediaDevices.getUserMedia = async (constraints) => {
            const stream = await origGetUserMedia(constraints)
            stream.getTracks().forEach((track) => {
              ;(window as any).__mediaTracks.push(track)
            })
            return stream
          }
        }
      })

      // 2. Student 2 logs in
      await student.page.goto('/login')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[1].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[1].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // 3. Pre-check: capture face, share screen, launch
      await student.page.goto(`/student/exams/${examId}/pre-check`)
      await expect(student.page.getByText('Pre-Examination Verification')).toBeVisible({ timeout: 10000 })

      const verifyFaceBtn = student.page.getByRole('button', { name: /Capture & Verify Face/i })
      await expect(verifyFaceBtn).toBeVisible()
      await verifyFaceBtn.click()

      const shareScreenBtn = student.page.getByRole('button', { name: /Grant Entire Screen Access/i })
      await expect(shareScreenBtn).toBeVisible({ timeout: 10000 })
      await shareScreenBtn.click()

      const launchBtn = student.page.getByRole('button', { name: /Enter Fullscreen & Launch Exam/i })
      await expect(launchBtn).toBeVisible({ timeout: 10000 })
      await launchBtn.click()

      // 4. In Arena: verify camera track is still 'live' inside arena before submit
      await student.page.waitForURL(url => url.pathname.includes('/arena') || url.pathname.includes('/exam'), { timeout: 15000 })
      await expect(student.page.getByText('Question 1 of 3')).toBeVisible({ timeout: 10000 })

      const liveTracksInArena = await student.page.evaluate(() => {
        const tracks: MediaStreamTrack[] = (window as any).__mediaTracks || []
        const globalCam = (window as any).__proctorCameraStream
        const activeTracks = tracks.filter(t => t.readyState === 'live')
        return {
          count: tracks.length,
          activeCount: activeTracks.length,
          hasGlobalCamera: !!(globalCam && globalCam.active),
          globalCameraLive: !!(globalCam?.getVideoTracks?.()[0]?.readyState === 'live')
        }
      })
      expect(liveTracksInArena.count).toBeGreaterThan(0)
      expect(liveTracksInArena.activeCount).toBeGreaterThan(0)
      expect(liveTracksInArena.hasGlobalCamera).toBe(true)
      expect(liveTracksInArena.globalCameraLive).toBe(true)

      await student.page.getByRole('button', { name: /Submit Exam/i }).click()
      await expect(student.page.getByText('Submit Examination?')).toBeVisible()
      await student.page.getByRole('button', { name: /Confirm Submission/i }).click()

      // 5. Navigate away to dashboard
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard'), { timeout: 15000 })

      // 6. Sign out
      const signOutBtn = student.page.getByRole('button', { name: /Sign Out/i })
      await expect(signOutBtn).toBeVisible({ timeout: 5000 })
      await signOutBtn.click()
      await student.page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10000 })

      // 7. Assert track teardown & no active streams
      const teardownAudit = await student.page.evaluate(() => {
        const tracks: MediaStreamTrack[] = (window as any).__mediaTracks || []
        const mediaElements = Array.from(document.querySelectorAll('video, audio')) as (HTMLVideoElement | HTMLAudioElement)[]
        const activeMediaElements = mediaElements.filter(el => (el.srcObject as MediaStream)?.active)

        return {
          totalTracksRecorded: tracks.length,
          allTracksEnded: tracks.length > 0 && tracks.every(t => t.readyState === 'ended'),
          unendedTracks: tracks.filter(t => t.readyState !== 'ended').map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState })),
          activeMediaElementCount: activeMediaElements.length,
          hasGlobalScreenStream: !!((window as any).__proctorScreenStream?.active),
          hasGlobalCameraStream: !!((window as any).__proctorCameraStream?.active)
        }
      })

      expect(teardownAudit.totalTracksRecorded).toBeGreaterThan(0)
      expect(teardownAudit.allTracksEnded).toBe(true)
      expect(teardownAudit.unendedTracks).toHaveLength(0)
      expect(teardownAudit.activeMediaElementCount).toBe(0)
      expect(teardownAudit.hasGlobalScreenStream).toBe(false)
      expect(teardownAudit.hasGlobalCameraStream).toBe(false)
    } finally {
      await student.close()
    }
  })
})
