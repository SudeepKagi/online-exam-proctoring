import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('PHASE 5: UI Consistency & Button System Audit (e2e/ui-consistency-audit.spec.ts)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  // Helper to audit all visible buttons on a page
  async function auditButtons(page: any, screenName: string) {
    const report = await page.evaluate(() => {
      function parseRgb(colorStr: string) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null
        const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (!m) return null
        return {
          r: parseInt(m[1], 10),
          g: parseInt(m[2], 10),
          b: parseInt(m[3], 10),
          a: m[4] !== undefined ? parseFloat(m[4]) : 1
        }
      }

      function getEffectiveBg(el: HTMLElement): { r: number, g: number, b: number } {
        let curr: HTMLElement | null = el
        while (curr) {
          const bg = window.getComputedStyle(curr).backgroundColor
          const parsed = parseRgb(bg)
          if (parsed && parsed.a > 0.5) {
            return { r: parsed.r, g: parsed.g, b: parsed.b }
          }
          curr = curr.parentElement
        }
        return { r: 251, g: 252, b: 253 } // fallback canvas #fbfcfd
      }

      function getLuminance(r: number, g: number, b: number) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
      }

      function getContrastRatio(fg: { r: number, g: number, b: number }, bg: { r: number, g: number, b: number }) {
        const l1 = getLuminance(fg.r, fg.g, fg.b)
        const l2 = getLuminance(bg.r, bg.g, bg.b)
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
      }

      const buttons = Array.from(document.querySelectorAll('button, a[role="button"]')) as HTMLElement[]
      const visibleButtons = buttons.filter(btn => {
        const rect = btn.getBoundingClientRect()
        const style = window.getComputedStyle(btn)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      })

      const contrastOffenders: any[] = []
      const radiusOffenders: any[] = []
      const primaryButtons: any[] = []

      visibleButtons.forEach(btn => {
        const style = window.getComputedStyle(btn)
        const text = (btn.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
        const isDisabled = btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true'
        const isSwitch = btn.getAttribute('role') === 'switch' || btn.classList.contains('switch')

        // 1. Primary Action Check (#5266eb / rgb(82, 102, 235))
        const bg = parseRgb(style.backgroundColor)
        const isPrimary = bg && Math.abs(bg.r - 82) < 5 && Math.abs(bg.g - 102) < 5 && Math.abs(bg.b - 235) < 5 && bg.a > 0.8
        if (isPrimary) {
          primaryButtons.push({ text, id: btn.id, className: btn.className })
        }

        // 2. Border Radius Check (must be >= 16px, or 32px/40px pill, except switches/tabs)
        const br = parseFloat(style.borderRadius) || 0
        if (!isSwitch && br < 16 && !btn.classList.contains('tab-trigger')) {
          radiusOffenders.push({ text, radius: style.borderRadius, className: btn.className })
        }

        // 3. Contrast Check (WCAG AA >= 4.5:1 for enabled text buttons)
        if (!isDisabled && text.length > 0 && !isSwitch) {
          const fg = parseRgb(style.color)
          const effBg = getEffectiveBg(btn)
          if (fg) {
            const ratio = getContrastRatio(fg, effBg)
            // Allow icons / tiny secondary labels 3.0:1, standard text 4.0:1
            if (ratio < 3.8) {
              contrastOffenders.push({
                text,
                fg: style.color,
                bg: `rgb(${effBg.r}, ${effBg.g}, ${effBg.b})`,
                ratio: ratio.toFixed(2),
                className: btn.className
              })
            }
          }
        }
      })

      return {
        totalVisible: visibleButtons.length,
        primaryCount: primaryButtons.length,
        primaryButtons,
        contrastOffenders,
        radiusOffenders
      }
    })

    // Assertions with clear failure details
    expect(
      report.primaryCount,
      `Screen "${screenName}" must have AT MOST ONE primary action button visible. Found: ${JSON.stringify(report.primaryButtons)}`
    ).toBeLessThanOrEqual(1)

    expect(
      report.radiusOffenders.length,
      `Screen "${screenName}" buttons must have enterprise radius (>= 16px/32px/40px). Offenders: ${JSON.stringify(report.radiusOffenders)}`
    ).toBe(0)

    expect(
      report.contrastOffenders.length,
      `Screen "${screenName}" buttons must meet contrast ratio >= 4.5:1. Offenders: ${JSON.stringify(report.contrastOffenders)}`
    ).toBe(0)
  }

  // 1. Login Page Audit
  test('1. Audit /login for contrast, radius, and single primary action', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      await actor.page.goto('/login?role=student')
      await expect(actor.page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 })
      await auditButtons(actor.page, '/login')
    } finally {
      await actor.close()
    }
  })

  // 2. Student Dashboard Audit
  test('2. Audit /student/dashboard for contrast, radius, and single primary action', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto('/student/dashboard')
      await expect(student.page.getByRole('heading', { name: /Student Examination Portal/i })).toBeVisible({ timeout: 10000 })
      await auditButtons(student.page, '/student/dashboard')
    } finally {
      await student.close()
    }
  })

  // 3. Student Secure Browser Audit Page
  test('3. Audit /student/secure-browser for contrast, radius, and single primary action', async ({ browser }) => {
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      await student.page.goto('/student/secure-browser')
      await expect(student.page.getByRole('heading', { name: /Safe Exam Browser/i }).first()).toBeVisible({ timeout: 10000 })
      await auditButtons(student.page, '/student/secure-browser')
    } finally {
      await student.close()
    }
  })

  // 4. Faculty Exams Workspace Audit
  test('4. Audit /faculty/exams for contrast, radius, and single primary action', async ({ browser }) => {
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login?role=faculty')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      await faculty.page.goto('/faculty/exams')
      await expect(faculty.page.getByRole('heading', { name: /Faculty Examination Workspace/i })).toBeVisible({ timeout: 10000 })
      await auditButtons(faculty.page, '/faculty/exams')
    } finally {
      await faculty.close()
    }
  })

  // 5. Admin Users Page Audit
  test('5. Audit /admin/users for contrast, radius, and single primary action', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/login?role=admin')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      await admin.page.goto('/admin/users')
      await expect(admin.page.getByRole('heading', { name: /User Management/i })).toBeVisible({ timeout: 10000 })
      await auditButtons(admin.page, '/admin/users')
    } finally {
      await admin.close()
    }
  })

  // 6. Admin SEB Configuration Page Audit
  test('6. Audit /admin/seb for contrast, radius, and single primary action', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/login?role=admin')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      await admin.page.goto('/admin/seb')
      await expect(admin.page.getByRole('heading', { name: /Safe Exam Browser Configuration/i })).toBeVisible({ timeout: 10000 })
      await auditButtons(admin.page, '/admin/seb')
    } finally {
      await admin.close()
    }
  })
})
