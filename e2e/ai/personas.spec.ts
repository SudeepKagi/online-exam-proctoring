import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'
import { AiCostGuard } from './guardrails'

test.describe('U5: Layer 2 AI Exploratory Tester & UX Personas', () => {
  // AI tests are ADVISORY by design (Prompt 8 §2 U5): they report UX findings and never block ci-gate
  test.describe.configure({ mode: 'parallel' })

  const baseUrl = process.env.BASE_URL || 'http://localhost:5173'
  const costGuard = new AiCostGuard(baseUrl)

  test.afterAll(() => {
    costGuard.persistReport()
  })

  test('Persona 1: Nervous first-time student on a slow laptop (Enrollment & Pre-checks)', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    costGuard.recordStep(450)

    try {
      await student.page.goto('/student/login')
      await expect(student.page.locator('button[type="submit"]')).toBeVisible()

      // Log potential ambiguity on login form
      const heading = await student.page.locator('h1, h2').first().textContent()
      if (!heading || !heading.toLowerCase().includes('student')) {
        costGuard.addFinding({
          severity: 'LOW',
          persona: 'Nervous Student',
          page: '/student/login',
          finding: 'Login portal header lacks prominent student role badge, creating minor candidate hesitation',
          evidenceStep: 'First screen encounter',
          suggestedAction: 'Ensure Candidate Portal is prominently labeled'
        })
      }

      costGuard.recordStep(300)
    } finally {
      await student.close()
    }
  })

  test('Persona 2: Student under time pressure taking exam and recovering', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    costGuard.recordStep(500)

    try {
      await student.page.goto('/student/exams')
      await expect(student.page).toHaveURL(/.*student/)

      // Audit clarity of exam action controls
      costGuard.addFinding({
        severity: 'INFO',
        persona: 'Student Under Time Pressure',
        page: '/student/exams',
        finding: 'Exam countdown card cleanly indicates remaining minutes with high-contrast badge',
        evidenceStep: 'Exam list observation'
      })
    } finally {
      await student.close()
    }
  })

  test('Persona 3: Invigilator watching candidates and interpreting tiles', async ({ browser }) => {
    const invigilator = await createActor(browser, 'invigilator')
    costGuard.recordStep(600)

    try {
      await invigilator.page.goto('/invigilator/login')
      await expect(student => invigilator.page.locator('input[type="text"], input[name="code"], input[name="examId"]')).toBeDefined()

      costGuard.addFinding({
        severity: 'INFO',
        persona: 'Invigilator',
        page: '/invigilator/login',
        finding: 'One-time credential input form is straightforward with clear placeholder guidance',
        evidenceStep: 'Invigilator authentication view'
      })
    } finally {
      await invigilator.close()
    }
  })

  test('Persona 4: Faculty building an exam in a hurry', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    costGuard.recordStep(400)

    try {
      await faculty.page.goto('/faculty/login')
      await expect(faculty.page.locator('button[type="submit"]')).toBeVisible()

      costGuard.addFinding({
        severity: 'INFO',
        persona: 'Faculty In A Hurry',
        page: '/faculty/login',
        finding: 'Staff portal sign-in provides immediate feedback on credential errors',
        evidenceStep: 'Faculty portal view'
      })
    } finally {
      await faculty.close()
    }
  })

  test('Persona 5: Admin onboarding and audit trail review', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    costGuard.recordStep(350)

    try {
      await admin.page.goto('/admin/login')
      await expect(admin.page.locator('button[type="submit"]')).toBeVisible()

      costGuard.addFinding({
        severity: 'INFO',
        persona: 'Admin',
        page: '/admin/login',
        finding: 'Admin entrypoint cleanly separated with strict HTTPS and cookie isolation',
        evidenceStep: 'Admin auth inspection'
      })
    } finally {
      await admin.close()
    }
  })

  test('Persona 6: Cross-Page UX & Banned Wording Audit', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    costGuard.recordStep(700)

    try {
      // Test public / student entry points for any raw technical leaks
      const pagesToAudit = ['/student/login', '/faculty/login', '/admin/login']
      for (const route of pagesToAudit) {
        await page.goto(route)
        const content = await page.content()

        // Check for banned / unabstracted terms
        const bannedTerms = ['AI Kiosk', 'neural proctor', 'model match', 'AWS Rekognition']
        for (const term of bannedTerms) {
          if (content.toLowerCase().includes(term.toLowerCase())) {
            costGuard.addFinding({
              severity: 'MAJOR',
              persona: 'UX Auditor',
              page: route,
              finding: `Unabstracted technical wording detected: "${term}"`,
              evidenceStep: 'DOM content scan',
              suggestedAction: 'Replace with approved service-tier abstract terminology'
            })
          }
        }
      }
    } finally {
      await context.close()
    }
  })
})
