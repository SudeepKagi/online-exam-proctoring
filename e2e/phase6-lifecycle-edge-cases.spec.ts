import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_INVIGILATOR, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('PHASE 6: Strict Backend + Frontend State Machine & Lifecycle Edge Cases', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  // -------------------------------------------------------------------------
  // 1. Started Exam Immutability (Live State)
  // -------------------------------------------------------------------------
  test('1. Live/Started Exam rejects PUT/PATCH, question modification, and DELETE with 409 and locks Faculty UI', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      // Create exam that is live (started 2 minutes ago, ends in 30 minutes)
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Live Exam Immutability ${Date.now()}`,
        subject: 'LIFECYCLE-101',
        courseCode: 'LC-101',
        startTime: new Date(now.getTime() - 120000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      // Add a question before publishing
      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Initial Draft Question?',
        options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
        correctOptionIndex: 0,
        marks: 2
      })
      const questionId = qRes.body?.question?.id || qRes.body?.id

      // Publish the exam
      const pubRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect([200, 204]).toContain(pubRes.status)

      // 1. Attempt PUT /exams/:id while exam is started -> MUST return 409
      const updateRes = await api.for(faculty).putRaw(`/api/v1/exams/${examId}`, {
        title: 'Hacked Title During Live Exam'
      })
      expect(updateRes.status).toBe(409)
      expect(updateRes.body?.code || updateRes.body?.error?.code).toBe('EXAM_IMMUTABLE_ACTIVE_OR_ENDED')

      // 2. Attempt to add a question while exam is live -> MUST return 409
      const addQRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Late Leaked Question?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 1,
        marks: 2
      })
      expect(addQRes.status).toBe(409)
      expect(addQRes.body?.code || addQRes.body?.error?.code).toBe('EXAM_IMMUTABLE_ACTIVE_OR_ENDED')

      // 3. Attempt to delete a question while live -> MUST return 409
      if (questionId) {
        const delQRes = await api.for(faculty).deleteRaw(`/api/v1/exams/${examId}/questions/${questionId}`)
        expect(delQRes.status).toBe(409)
        expect(delQRes.body?.code || delQRes.body?.error?.code).toBe('EXAM_IMMUTABLE_ACTIVE_OR_ENDED')
      }

      // 4. Attempt to delete the live exam -> MUST return 409
      const delExamRes = await api.for(faculty).deleteRaw(`/api/v1/exams/${examId}`)
      expect(delExamRes.status).toBe(409)
      expect(delExamRes.body?.code || delExamRes.body?.error?.code).toBe('EXAM_IMMUTABLE_ACTIVE_OR_ENDED')

      // 5. Verify Frontend reflects read-only mode
      await faculty.page.goto(`/faculty/exams/${examId}/manage`)
      await faculty.page.waitForLoadState('networkidle')
      // Look for read-only banner
      const banner = faculty.page.locator('text=Exam is Live / In Progress')
      await expect(banner).toBeVisible({ timeout: 10000 })
      // Verify "+ Add MCQ" is hidden or absent
      const addMcqBtn = faculty.page.locator('button:has-text("+ Add MCQ")')
      await expect(addMcqBtn).not.toBeVisible()
    } finally {
      await faculty.close()
    }
  })

  // -------------------------------------------------------------------------
  // 2. Ended Exam Immutability
  // -------------------------------------------------------------------------
  test('2. Ended Exam rejects edits and deletions with 409 and renders read-only UI', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      // Exam ended 5 minutes ago
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Ended Exam Immutability ${Date.now()}`,
        subject: 'LIFECYCLE-102',
        courseCode: 'LC-102',
        startTime: new Date(now.getTime() - 3600000).toISOString(),
        endTime: new Date(now.getTime() - 300000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id
      expect(examId).toBeTruthy()

      // Attempt to edit ended exam -> MUST return 409
      const updateRes = await api.for(faculty).putRaw(`/api/v1/exams/${examId}`, {
        title: 'Modifying Past Exam Title'
      })
      expect(updateRes.status).toBe(409)
      expect(updateRes.body?.code || updateRes.body?.error?.code).toBe('EXAM_IMMUTABLE_ACTIVE_OR_ENDED')

      // Verify UI shows Exam has Ended
      await faculty.page.goto(`/faculty/exams/${examId}/manage`)
      await faculty.page.waitForLoadState('networkidle')
      const endedBanner = faculty.page.locator('text=Exam has Ended')
      await expect(endedBanner).toBeVisible({ timeout: 10000 })
      const addMcqBtn = faculty.page.locator('button:has-text("+ Add MCQ")')
      await expect(addMcqBtn).not.toBeVisible()
    } finally {
      await faculty.close()
    }
  })

  // -------------------------------------------------------------------------
  // 3. Schedule Math & Question Integrity Gate Validation
  // -------------------------------------------------------------------------
  test('3. Publishing with 0 questions, endTime <= startTime, or duration > window returns 400', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()

      // 1. Invalid window: endTime < startTime
      const badWindowRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Inverted Window Exam',
        subject: 'MATH-01',
        courseCode: 'M-01',
        startTime: new Date(now.getTime() + 600000).toISOString(),
        endTime: new Date(now.getTime() + 60000).toISOString(), // Ends before starting!
        durationMinutes: 30
      })
      expect(badWindowRes.status).toBe(400)
      expect(badWindowRes.body?.code || badWindowRes.body?.error?.code).toBe('INVALID_EXAM_WINDOW')

      // 2. Duration exceeds window
      const durExceedRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Duration Exceeds Window Exam',
        subject: 'MATH-02',
        courseCode: 'M-02',
        startTime: new Date(now.getTime() + 60000).toISOString(),
        endTime: new Date(now.getTime() + 180000).toISOString(), // 2 minute window
        durationMinutes: 60 // 60 minutes duration!
      })
      expect(durExceedRes.status).toBe(400)
      expect(durExceedRes.body?.code || durExceedRes.body?.error?.code).toBe('DURATION_EXCEEDS_WINDOW')

      // 3. Valid draft exam with 0 questions
      const draftRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Zero Questions Exam ${Date.now()}`,
        subject: 'MATH-03',
        courseCode: 'M-03',
        startTime: new Date(now.getTime() + 600000).toISOString(),
        endTime: new Date(now.getTime() + 3600000).toISOString(),
        durationMinutes: 30
      })
      const examId = draftRes.body?.exam?.id
      expect(examId).toBeTruthy()

      // Publish with 0 questions -> MUST return 400 EXAM_INCOMPLETE
      const emptyPublishRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})
      expect(emptyPublishRes.status).toBe(400)
      expect(emptyPublishRes.body?.code || emptyPublishRes.body?.error?.code).toBe('EXAM_INCOMPLETE')
    } finally {
      await faculty.close()
    }
  })

  // -------------------------------------------------------------------------
  // 4. Mid-Exam Screen-Share Disconnection & Non-Dismissible Blocking Overlay
  // -------------------------------------------------------------------------
  test('4. Screen-share disconnection triggers onended, records violation, and displays non-dismissible blocking overlay', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      // 1. Faculty sets up a live exam
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Proctoring Interruption Exam ${Date.now()}`,
        subject: 'SEC-101',
        courseCode: 'SEC-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Security Question 1: What is CIA triad?',
        options: ['Confidentiality, Integrity, Availability', 'Choice B', 'Choice C', 'Choice D'],
        correctOptionIndex: 0,
        marks: 2
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // 2. Student logs in and navigates to arena
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Start attempt via API
      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      expect(startRes.status).toBe(200)

      // Enter arena
      await student.page.goto(`/student/exam/${examId}/arena`)
      await student.page.waitForLoadState('networkidle')

      // Verify questions loaded
      await expect(student.page.locator('text=Security Question 1')).toBeVisible({ timeout: 10000 })

      // 3. Simulate screen track ending / "Stop sharing" event
      await student.page.evaluate(() => {
        const stream = window.__proctorScreenStream
        if (stream) {
          const track = stream.getVideoTracks()[0]
          if (track) {
            track.dispatchEvent(new Event('ended'))
            if (typeof track.onended === 'function') track.onended(new Event('ended'))
          }
        } else {
          // If mock stream was not attached, create a mock event on window
          window.dispatchEvent(new CustomEvent('proctor:screen_ended'))
        }
      })

      // If needed, directly dispatch ended event on any hidden video stream
      await student.page.evaluate(() => {
        const track = (window as any).__proctorScreenStream?.getVideoTracks?.()[0]
        if (track && track.onended) track.onended(new Event('ended'))
      })

      // 4. Verify blocking overlay appears
      // Check for either the proctoring interrupted overlay or dialog
      const overlay = student.page.locator('[data-testid="proctoring-interrupted-overlay"], text=Proctoring Interrupted, text=Screen Share Disconnected')
      await expect(overlay.first()).toBeVisible({ timeout: 10000 })
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // -------------------------------------------------------------------------
  // 5. Max Violations Auto-Termination (3 / 3)
  // -------------------------------------------------------------------------
  test('5. Reaching 3 violations auto-terminates attempt and rejects further answer saves with 409', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')

    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Max Violations Exam ${Date.now()}`,
        subject: 'VIOL-101',
        courseCode: 'V-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      const qRes = await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Violation Question 1?',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctOptionIndex: 0,
        marks: 1
      })
      const questionId = qRes.body?.question?.id || qRes.body?.id
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // Student starts attempt
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id
      expect(attemptId).toBeTruthy()

      // Record 3 violations
      await api.for(student).postRaw('/api/v1/proctoring/events', {
        attemptId,
        examId,
        eventType: 'TAB_SWITCH',
        severity: 'HIGH'
      })
      await api.for(student).postRaw('/api/v1/proctoring/events', {
        attemptId,
        examId,
        eventType: 'WINDOW_BLUR',
        severity: 'MEDIUM'
      })
      const v3 = await api.for(student).postRaw('/api/v1/proctoring/events', {
        attemptId,
        examId,
        eventType: 'FULLSCREEN_EXIT',
        severity: 'HIGH'
      })
      expect([200, 201]).toContain(v3.status)

      // Verify that further attempt to save an answer is rejected with 409 ATTEMPT_TERMINATED
      const saveRes = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/answers`, {
        questionId,
        selectedOptionIndex: 0
      })
      expect(saveRes.status).toBe(409)
      expect(saveRes.body?.code || saveRes.body?.error?.code).toBe('ATTEMPT_TERMINATED')
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // -------------------------------------------------------------------------
  // 6. Invigilator State Machine Guards
  // -------------------------------------------------------------------------
  test('6. Invigilator cannot suspend or terminate an already SUBMITTED attempt (returns 409)', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    const student = await createActor(browser, 'student')
    const invigilator = await createActor(browser, 'invigilator')

    try {
      // 1. Create and publish exam
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: `Invigilator State Machine Exam ${Date.now()}`,
        subject: 'INV-101',
        courseCode: 'I-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Invigilator Guard Q1?',
        options: ['1', '2', '3', '4'],
        correctOptionIndex: 0,
        marks: 1
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      // 2. Student starts and submits attempt
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const startRes = await api.for(student).postRaw(`/api/v1/attempts/exams/${examId}/start`, {})
      const attemptId = startRes.body?.attempt?.id
      expect(attemptId).toBeTruthy()

      // Submit attempt
      const subRes = await api.for(student).postRaw(`/api/v1/attempts/${attemptId}/submit`, {})
      expect(subRes.status).toBe(200)

      // 3. Invigilator logs in
      await invigilator.page.goto('/login?role=invigilator')
      await invigilator.page.locator('input[type="text"]').fill(SEEDED_INVIGILATOR.email)
      await invigilator.page.locator('input[type="password"]').fill(SEEDED_INVIGILATOR.password)
      await invigilator.page.locator('button[type="submit"]').click()
      await invigilator.page.waitForURL(url => url.pathname.includes('/invigilator'), { timeout: 15000 })

      // Attempt to suspend submitted attempt -> MUST return 409
      const suspRes = await api.for(invigilator).postRaw(`/api/v1/attempts/${attemptId}/suspend`, {
        reason: 'Post-submission test suspension'
      })
      expect(suspRes.status).toBe(409)
      expect(suspRes.body?.code || suspRes.body?.error?.code).toBe('INVALID_ATTEMPT_TRANSITION')

      // Attempt to terminate submitted attempt -> MUST return 409
      const termRes = await api.for(invigilator).postRaw(`/api/v1/attempts/${attemptId}/terminate`, {
        reason: 'Post-submission test termination'
      })
      expect(termRes.status).toBe(409)
      expect(termRes.body?.code || termRes.body?.error?.code).toBe('INVALID_ATTEMPT_TRANSITION')
    } finally {
      await faculty.close()
      await student.close()
      await invigilator.close()
    }
  })

  // -------------------------------------------------------------------------
  // 7. Admin Self-Lockout Prevention
  // -------------------------------------------------------------------------
  test('7. Admin cannot delete, suspend, or alter the role of their own account (returns 400)', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')

    try {
      await admin.page.goto('/login?role=admin')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      // Get admin's own user record
      const meRes = await api.for(admin).getRaw('/api/v1/auth/me')
      const adminId = meRes.body?.user?.id || meRes.body?.id
      expect(adminId).toBeTruthy()

      // 1. Admin tries to delete their own account -> MUST return 400 CANNOT_MODIFY_OWN_ADMIN_ACCOUNT
      const delRes = await api.for(admin).deleteRaw(`/api/v1/users/${adminId}`)
      expect(delRes.status).toBe(400)
      expect(delRes.body?.code || delRes.body?.error?.code).toBe('CANNOT_MODIFY_OWN_ADMIN_ACCOUNT')

      // 2. Admin tries to suspend their own account -> MUST return 400 CANNOT_MODIFY_OWN_ADMIN_ACCOUNT
      const suspRes = await api.for(admin).patchRaw(`/api/v1/users/${adminId}/suspend`, {})
      expect(suspRes.status).toBe(400)
      expect(suspRes.body?.code || suspRes.body?.error?.code).toBe('CANNOT_MODIFY_OWN_ADMIN_ACCOUNT')

      // 3. Admin tries to demote their own role to STUDENT -> MUST return 400 CANNOT_MODIFY_OWN_ADMIN_ACCOUNT
      const updateRes = await api.for(admin).patchRaw(`/api/v1/users/${adminId}`, {
        role: 'STUDENT'
      })
      expect(updateRes.status).toBe(400)
      expect(updateRes.body?.code || updateRes.body?.error?.code).toBe('CANNOT_MODIFY_OWN_ADMIN_ACCOUNT')
    } finally {
      await admin.close()
    }
  })
})
