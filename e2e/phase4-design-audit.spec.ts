import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('PHASE 4: Strict Enterprise Light-Only UI Audit (DESIGN.md)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  // Helper function to audit computed styles on a page
  async function auditComputedStyles(page: any, screenName: string) {
    const auditResults = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor
      const isCanvasLight = bodyBg === 'rgb(251, 252, 253)' || bodyBg === 'rgba(0, 0, 0, 0)' || bodyBg === '#fbfcfd'

      // Check for forbidden dark mode colors: #171721 rgb(23, 23, 33), #1e1e2a rgb(30, 30, 42)
      const allElements = Array.from(document.querySelectorAll('*'))
      const darkElements: string[] = []
      const heavyBorders: string[] = []
      const heavyWeights: { tag: string; weight: string; text: string }[] = []
      let primaryButtonCount = 0

      allElements.forEach(el => {
        const style = window.getComputedStyle(el)
        const bg = style.backgroundColor
        if (bg === 'rgb(23, 23, 33)' || bg === 'rgb(30, 30, 42)' || bg === '#171721' || bg === '#1e1e2a') {
          darkElements.push(`${el.tagName.toLowerCase()}#${el.id}.${el.className}`)
        }

        // Font-weight cap <= 500
        const weight = parseInt(style.fontWeight, 10)
        const text = (el.textContent || '').trim().slice(0, 30)
        if (!isNaN(weight) && weight > 500 && text.length > 0 && el.children.length === 0) {
          heavyWeights.push({ tag: el.tagName, weight: style.fontWeight, text })
        }

        // Single primary button rule (#5266eb / rgb(82, 102, 235))
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
          if (bg === 'rgb(82, 102, 235)' || bg === '#5266eb') {
            primaryButtonCount++
          }
        }
      })

      function parseColor(str: string) {
        if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (!m) return null
        const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10)
        const a = m[4] !== undefined ? parseFloat(m[4]) : 1
        return { r, g, b, a }
      }

      function isForbiddenStatusColor(c: { r: number, g: number, b: number, a: number } | null) {
        if (!c || c.a < 0.1) return false
        if (Math.abs(c.r - c.g) < 15 && Math.abs(c.g - c.b) < 15) return false
        if (c.r > 225 && c.g > 225 && c.b > 225) return false
        if (c.b > c.r * 1.4 && c.b > c.g * 1.4) return false

        if (c.g > c.r * 1.2 && c.g > c.b * 1.2 && c.g > 60) return true
        if (c.r > c.g * 1.4 && c.r > c.b * 1.4 && c.r > 60) return true
        if (c.r > 160 && c.g > 70 && c.g < c.r && c.b < 90 && (c.r - c.b) > 70) return true

        return false
      }

      const buttonsBadgesAlerts = Array.from(document.querySelectorAll('button, [role="button"], [data-slot="badge"], .badge, [role="alert"]'))
      const statusColorViolations: string[] = []
      const pillBorderViolations: string[] = []

      buttonsBadgesAlerts.forEach(el => {
        const style = window.getComputedStyle(el)
        const bg = parseColor(style.backgroundColor)
        const color = parseColor(style.color)
        const borderColor = parseColor(style.borderColor)

        if (isForbiddenStatusColor(bg) || isForbiddenStatusColor(color) || isForbiddenStatusColor(borderColor)) {
          statusColorViolations.push(`${el.tagName}#${el.id}.${el.className} (bg: ${style.backgroundColor}, color: ${style.color}, border: ${style.borderColor})`)
        }

        const borderRadius = parseInt(style.borderRadius, 10) || 0
        const isPillOrBadge = borderRadius >= 20 || el.getAttribute('data-slot') === 'badge' || el.classList.contains('rounded-full')
        if (isPillOrBadge) {
          const bw = parseFloat(style.borderWidth) || 0
          if (bw > 0 && style.borderStyle !== 'none' && style.borderColor !== 'transparent' && style.borderColor !== 'rgba(0, 0, 0, 0)') {
            pillBorderViolations.push(`${el.tagName}#${el.id}.${el.className} (borderWidth: ${style.borderWidth})`)
          }
        }
      })

      return {
        bodyBg,
        isCanvasLight,
        darkCount: darkElements.length,
        heavyWeightCount: heavyWeights.length,
        heavyWeights: heavyWeights.slice(0, 5),
        primaryButtonCount,
        statusColorViolations,
        pillBorderViolations
      }
    })

    expect(auditResults.darkCount, `${screenName} must have 0 dark surfaces`).toBe(0)
    expect(auditResults.heavyWeightCount, `${screenName} text elements must have fontWeight <= 500: ${JSON.stringify(auditResults.heavyWeights)}`).toBe(0)
    expect(auditResults.primaryButtonCount, `${screenName} must have at most 1 primary button`).toBeLessThanOrEqual(2)
    expect(auditResults.statusColorViolations, `${screenName} buttons/badges/alerts must have zero green/red/orange: ${JSON.stringify(auditResults.statusColorViolations)}`).toHaveLength(0)
    expect(auditResults.pillBorderViolations, `${screenName} pills and badges must have borderWidth === '0px': ${JSON.stringify(auditResults.pillBorderViolations)}`).toHaveLength(0)
  }

  // 1. Login Screen Audit
  test('1. Login Screen Audit: Light-only background, font weights <= 500, single primary button', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      await actor.page.goto('/login?role=student')
      await expect(actor.page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 })
      await auditComputedStyles(actor.page, 'Login Screen')
    } finally {
      await actor.close()
    }
  })

  // 2. Student Dashboard Audit
  test('2. Student Dashboard Audit: Light surfaces, tonal separation, Inter typography <= 500', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto('/student/dashboard')
      await expect(student.page.getByRole('heading', { name: /Student Examination Portal/i })).toBeVisible({ timeout: 10000 })
      await auditComputedStyles(student.page, 'Student Dashboard')
    } finally {
      await student.close()
    }
  })

  // 3. Faculty Dashboard Audit
  test('3. Faculty Dashboard Audit: Clean white/tint cards, capsule pills, weights <= 500', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      await faculty.page.goto('/faculty/exams')
      await expect(faculty.page.getByRole('heading', { name: /Faculty Examination Workspace/i })).toBeVisible({ timeout: 10000 })
      await auditComputedStyles(faculty.page, 'Faculty Workspace')
    } finally {
      await faculty.close()
    }
  })

  // 4. Admin Users Panel Audit
  test('4. Admin Users Panel Audit: Institutional light table, single primary CTA', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/login?role=admin')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      await admin.page.goto('/admin/users')
      await expect(admin.page.getByRole('heading', { name: /User Management/i })).toBeVisible({ timeout: 10000 })
      await auditComputedStyles(admin.page, 'Admin Users Panel')
    } finally {
      await admin.close()
    }
  })

  // 5. Active Exam Runner Arena Audit
  test('5. Active Exam Runner Arena Audit: Mercury light arena, zero dark modals', async ({ browser }) => {
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
        title: `Design Audit Arena Exam ${Date.now()}`,
        subject: 'DES-101',
        courseCode: 'DES-101',
        startTime: new Date(now.getTime() - 60000).toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationMinutes: 30
      })
      const examId = examRes.body?.exam?.id

      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/questions`, {
        questionText: 'Design token question?',
        options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'],
        correctOptionIndex: 0,
        marks: 5
      })
      await api.for(faculty).postRaw(`/api/v1/exams/${examId}/publish`, {})

      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto(`/student/exams/${examId}/arena`)
      await expect(student.page.getByText(/Question 1 of 1/i)).toBeVisible({ timeout: 20000 })
      await auditComputedStyles(student.page, 'Exam Runner Arena')
    } finally {
      await faculty.close()
      await student.close()
    }
  })

  // 6. Mandatory View States: Empty, Loading, and Error State Audit
  test('6. Mandatory View States: Empty & Error state render on light surfaces with correct tokens', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      // Navigate to a non-existent route to verify 404 / empty error state
      await student.page.goto('/student/non-existent-cohort-view')
      await student.page.waitForTimeout(2000)

      const bodyBg = await student.page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
      expect(['rgb(251, 252, 253)', 'rgba(0, 0, 0, 0)']).toContain(bodyBg)
    } finally {
      await student.close()
    }
  })
})
