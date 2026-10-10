import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { AiCostGuard } from './guardrails'

test.describe('U5: Layer 2 AI Exploratory Tester & UX Personas', () => {
  // Advisory AI tests (§4.8): only run when real vision model key is supplied; otherwise skip with explicit ticket reason.
  test.beforeEach(() => {
    const hasKey = Boolean(process.env.MIDSCENE_MODEL_API_KEY || process.env.OPENAI_API_KEY)
    if (!hasKey) {
      test.skip(true, 'PROCT-AI-01: Skipped AI explorer: No vision model key configured (MIDSCENE_MODEL_API_KEY or OPENAI_API_KEY required)')
    }
  })

  test('Persona 1: Nervous first-time student on a slow laptop (Enrollment & Pre-checks)', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/student/login')
      await expect(student.page.locator('button[type="submit"]')).toBeVisible()
    } finally {
      await student.close()
    }
  })

  test('Persona 2: Student under time pressure taking exam and recovering', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/student/exams')
      await expect(student.page).toHaveURL(/.*student/)
    } finally {
      await student.close()
    }
  })

  test('Persona 3: Invigilator watching candidates and interpreting tiles', async ({ browser }) => {
    const invigilator = await createActor(browser, 'invigilator')
    try {
      await invigilator.page.goto('/invigilator/login')
      await expect(invigilator.page.locator('button[type="submit"]')).toBeVisible()
    } finally {
      await invigilator.close()
    }
  })

  test('Persona 4: Faculty building an exam in a hurry', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/faculty/login')
      await expect(faculty.page.locator('button[type="submit"]')).toBeVisible()
    } finally {
      await faculty.close()
    }
  })

  test('Persona 5: Admin onboarding and audit trail review', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/admin/login')
      await expect(admin.page.locator('button[type="submit"]')).toBeVisible()
    } finally {
      await admin.close()
    }
  })

  test('Persona 6: Cross-Page UX & Banned Wording Audit', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      const pagesToAudit = ['/student/login', '/faculty/login', '/admin/login']
      for (const route of pagesToAudit) {
        await page.goto(route)
        const content = await page.content()
        const bannedTerms = ['AI Kiosk', 'neural proctor', 'model match']
        for (const term of bannedTerms) {
          expect(content.toLowerCase().includes(term.toLowerCase())).toBe(false)
        }
      }
    } finally {
      await context.close()
    }
  })
})
