import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { createActor } from '../../e2e/helpers/actors'
import { api } from '../../e2e/helpers/api'
import {
  resetCleanRoom,
  ADMIN_CREDENTIALS,
  SEEDED_FACULTY,
  SEEDED_INVIGILATOR,
  SEEDED_STUDENTS
} from '../../e2e/helpers/cleanroom'

test.describe('Responsive Viewport Audit (§Phase 2)', () => {
  test.describe.configure({ mode: 'serial' })

  const RESULTS_DIR = path.resolve(process.cwd(), 'test-results/responsive-audit')
  let sharedExamId = ''

  test.beforeAll(async () => {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true })
    }
    await resetCleanRoom()
  })

  // Helper to evaluate a page against responsive design rules
  async function auditPageResponsiveness(page: any, routePath: string, testInfo: any) {
    const projectName = testInfo.project.name || 'default'
    const viewport = page.viewportSize() || { width: 1440, height: 900 }
    const routeSlug = routePath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'root'

    // Wait for network idle and layout stabilization
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(300)

    // Capture screenshot
    const screenshotPath = path.join(RESULTS_DIR, `${projectName}-${routeSlug}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})

    // Evaluate in browser DOM
    const audit = await page.evaluate(({ vpWidth }) => {
      const offenders: Array<{
        type: string
        selector: string
        width?: number
        height?: number
        fontSize?: string
        detail: string
      }> = []

      // 1. Horizontal Document Overflow Check
      const docScrollWidth = document.documentElement.scrollWidth
      const bodyScrollWidth = document.body ? document.body.scrollWidth : 0
      const clientWidth = document.documentElement.clientWidth || window.innerWidth

      if (docScrollWidth > clientWidth + 1) {
        offenders.push({
          type: 'DOCUMENT_OVERFLOW',
          selector: 'document.documentElement',
          width: docScrollWidth,
          detail: `documentElement scrollWidth (${docScrollWidth}px) exceeds clientWidth (${clientWidth}px)`
        })
      }
      if (bodyScrollWidth > clientWidth + 1) {
        offenders.push({
          type: 'BODY_OVERFLOW',
          selector: 'document.body',
          width: bodyScrollWidth,
          detail: `body scrollWidth (${bodyScrollWidth}px) exceeds clientWidth (${clientWidth}px)`
        })
      }

      // 2. Anti-Cheating: overflow-x hidden / clip on html or body
      const htmlStyle = window.getComputedStyle(document.documentElement)
      const bodyStyle = document.body ? window.getComputedStyle(document.body) : null
      if (htmlStyle.overflowX === 'hidden' || htmlStyle.overflowX === 'clip') {
        offenders.push({
          type: 'CHEAT_OVERFLOW_HIDDEN',
          selector: 'html',
          detail: 'html element has overflow-x: hidden/clip, masking horizontal overflow'
        })
      }
      if (bodyStyle && (bodyStyle.overflowX === 'hidden' || bodyStyle.overflowX === 'clip')) {
        offenders.push({
          type: 'CHEAT_OVERFLOW_HIDDEN',
          selector: 'body',
          detail: 'body element has overflow-x: hidden/clip, masking horizontal overflow'
        })
      }

      // 3. Elements Wider than Viewport
      const allEls = Array.from(document.querySelectorAll('body *'))
      for (const el of allEls) {
        if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)

        // Ignore hidden / non-rendered elements
        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
          continue
        }

        // Element wider than viewport
        if (rect.width > clientWidth + 2) {
          // Identify selector
          const tag = el.tagName.toLowerCase()
          const id = el.id ? `#${el.id}` : ''
          const cls = el.className && typeof el.className === 'string'
            ? `.${el.className.split(/\s+/).slice(0, 3).join('.')}`
            : ''
          offenders.push({
            type: 'ELEMENT_WIDER_THAN_VIEWPORT',
            selector: `${tag}${id}${cls}`,
            width: Math.round(rect.width),
            detail: `Element width (${Math.round(rect.width)}px) exceeds viewport width (${clientWidth}px)`
          })
          if (offenders.length > 10) break
        }

        // 4. Input Font Size Check (inputs, selects, textareas must be >= 16px to prevent mobile zoom)
        const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
        const inputType = el.getAttribute('type')
        if (isInput && inputType !== 'checkbox' && inputType !== 'radio' && inputType !== 'hidden') {
          const fs = parseFloat(style.fontSize)
          if (!isNaN(fs) && fs < 15.5) {
            const tag = el.tagName.toLowerCase()
            const name = el.getAttribute('name') || el.getAttribute('placeholder') || ''
            offenders.push({
              type: 'INPUT_FONT_TOO_SMALL',
              selector: `${tag}[${name}]`,
              fontSize: style.fontSize,
              detail: `Form control font-size (${style.fontSize}) is below 16px (causes mobile viewport zoom)`
            })
          }
        }

        // 5. Touch Target Size Check on Mobile / Touch Viewports (< 900px)
        if (clientWidth < 900) {
          const isInteractive =
            el.tagName === 'BUTTON' ||
            (el.tagName === 'A' && style.display !== 'inline') ||
            (el.getAttribute('role') === 'button')

          if (isInteractive && el.textContent?.trim().length) {
            // Check bounding dimensions or tap target padding
            if (rect.height > 0 && rect.height < 32 && rect.width < 32) {
              const tag = el.tagName.toLowerCase()
              const text = (el.textContent || '').trim().slice(0, 20)
              offenders.push({
                type: 'TOUCH_TARGET_TOO_SMALL',
                selector: `${tag}: "${text}"`,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                detail: `Interactive element (${Math.round(rect.width)}x${Math.round(rect.height)}px) is smaller than accessible touch target`
              })
            }
          }
        }

        // 6. Clipped Primary Action Button (#5266eb)
        const isPrimaryBtn =
          (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') &&
          (style.backgroundColor === 'rgb(82, 102, 235)' || style.backgroundColor === '#5266eb')

        if (isPrimaryBtn && rect.width > 0) {
          if (rect.left < -1 || rect.right > clientWidth + 2) {
            offenders.push({
              type: 'CLIPPED_PRIMARY_ACTION',
              selector: `primary-button "${(el.textContent || '').trim().slice(0, 20)}"`,
              detail: `Primary button is clipped by viewport boundary (left: ${Math.round(rect.left)}, right: ${Math.round(rect.right)})`
            })
          }
        }
      }

      return {
        docScrollWidth,
        clientWidth,
        offenders
      }
    }, { vpWidth: viewport.width })

    return {
      route: routePath,
      projectName,
      viewport,
      ...audit
    }
  }

  // 1. PUBLIC ROUTES AUDIT
  test('Audit Public Routes Across Viewports', async ({ browser }, testInfo) => {
    const actor = await createActor(browser, 'student')
    try {
      const publicRoutes = ['/', '/login', '/forgot-password', '/seb/enter', '/privacy']

      for (const route of publicRoutes) {
        await actor.page.goto(route, { waitUntil: 'domcontentloaded' })
        const res = await auditPageResponsiveness(actor.page, route, testInfo)

        if (res.offenders.length > 0) {
          console.error(`[AUDIT FAILED] ${testInfo.project.name} on ${route}:`, JSON.stringify(res.offenders, null, 2))
        }
        expect(res.offenders, `Responsive violations on ${route} (${testInfo.project.name})`).toEqual([])
      }
    } finally {
      await actor.close()
    }
  })

  // 2. FACULTY & EXAM CREATION
  test('Audit Faculty Routes & Seed Assessment', async ({ browser }, testInfo) => {
    const faculty = await createActor(browser, 'faculty')
    try {
      // Login as Faculty
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })

      // Seed an exam for the student and audit routes
      const now = new Date()
      const examRes = await api.for(faculty).postRaw('/api/v1/exams', {
        title: 'Network Systems & Distributed Architecture',
        subject: 'CS-804',
        courseCode: 'CS-804',
        startTime: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
        durationMinutes: 60
      })
      if (examRes.status === 201) {
        sharedExamId = examRes.body?.exam?.id || ''
        await api.for(faculty).postRaw(`/api/v1/exams/${sharedExamId}/questions`, {
          questionText: 'Which consistency model strictly linearizes state machine transitions?',
          options: ['Raft Consensus', 'Eventual Gossip', 'Async Read Cache', 'Split-Brain Multicast'],
          correctOptionIndex: 0,
          marks: 10,
          order: 1
        })
        await api.for(faculty).postRaw(`/api/v1/exams/${sharedExamId}/publish`)
      }

      // Audit Faculty Routes
      const facultyRoutes = ['/faculty/exams', '/settings']
      if (sharedExamId) {
        facultyRoutes.push(`/faculty/exams/${sharedExamId}`)
      }

      for (const route of facultyRoutes) {
        await faculty.page.goto(route, { waitUntil: 'domcontentloaded' })
        const res = await auditPageResponsiveness(faculty.page, route, testInfo)

        if (res.offenders.length > 0) {
          console.error(`[AUDIT FAILED] ${testInfo.project.name} on ${route}:`, JSON.stringify(res.offenders, null, 2))
        }
        expect(res.offenders, `Responsive violations on ${route} (${testInfo.project.name})`).toEqual([])
      }
    } finally {
      await faculty.close()
    }
  })

  // 3. STUDENT ROUTES AUDIT
  test('Audit Student Routes Across Viewports', async ({ browser }, testInfo) => {
    const student = await createActor(browser, 'student')
    try {
      // Login as Student
      await student.page.goto('/login')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })

      const studentRoutes = [
        '/student/dashboard',
        '/student/secure-browser',
        '/student/settings'
      ]
      if (sharedExamId) {
        studentRoutes.push(`/student/exams/${sharedExamId}/seb-required`)
        studentRoutes.push(`/student/exams/${sharedExamId}/pre-check`)
      }

      for (const route of studentRoutes) {
        await student.page.goto(route, { waitUntil: 'domcontentloaded' })
        const res = await auditPageResponsiveness(student.page, route, testInfo)

        if (res.offenders.length > 0) {
          console.error(`[AUDIT FAILED] ${testInfo.project.name} on ${route}:`, JSON.stringify(res.offenders, null, 2))
        }
        expect(res.offenders, `Responsive violations on ${route} (${testInfo.project.name})`).toEqual([])
      }
    } finally {
      await student.close()
    }
  })

  // 4. ADMIN ROUTES AUDIT
  test('Audit Admin Routes Across Viewports', async ({ browser }, testInfo) => {
    const admin = await createActor(browser, 'admin')
    try {
      // Login as Admin
      await admin.page.goto('/login')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      const adminRoutes = [
        '/admin/dashboard',
        '/admin/users',
        '/admin/exams',
        '/admin/seb'
      ]

      for (const route of adminRoutes) {
        await admin.page.goto(route, { waitUntil: 'domcontentloaded' })
        const res = await auditPageResponsiveness(admin.page, route, testInfo)

        if (res.offenders.length > 0) {
          console.error(`[AUDIT FAILED] ${testInfo.project.name} on ${route}:`, JSON.stringify(res.offenders, null, 2))
        }
        expect(res.offenders, `Responsive violations on ${route} (${testInfo.project.name})`).toEqual([])
      }
    } finally {
      await admin.close()
    }
  })

  // 5. INVIGILATOR ROUTE AUDIT
  test('Audit Invigilator Console Across Viewports', async ({ browser }, testInfo) => {
    const inv = await createActor(browser, 'invigilator')
    try {
      // Login as Invigilator
      await inv.page.goto('/login')
      await inv.page.locator('input[type="text"]').fill(SEEDED_INVIGILATOR.email)
      await inv.page.locator('input[type="password"]').fill(SEEDED_INVIGILATOR.password)
      await inv.page.locator('button[type="submit"]').click()
      await inv.page.waitForURL(url => url.pathname.includes('/invigilator'), { timeout: 15000 })

      const invRoutes = ['/invigilator/console']

      for (const route of invRoutes) {
        await inv.page.goto(route, { waitUntil: 'domcontentloaded' })
        const res = await auditPageResponsiveness(inv.page, route, testInfo)

        if (res.offenders.length > 0) {
          console.error(`[AUDIT FAILED] ${testInfo.project.name} on ${route}:`, JSON.stringify(res.offenders, null, 2))
        }
        expect(res.offenders, `Responsive violations on ${route} (${testInfo.project.name})`).toEqual([])
      }
    } finally {
      await inv.close()
    }
  })
})
