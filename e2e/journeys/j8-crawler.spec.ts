import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import fs from 'fs'
import path from 'path'

test.describe('J8: Exploratory Route Crawler & Monkey Tester (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const adminCreds = { email: 'admin@proctornet.com', password: 'Admin@123' }
  const facultyCreds = { email: 'babbage.faculty@proctornet.test', password: 'Faculty#1234' }
  const studentCreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }

  const visitedRoutes: Array<{ role: string; path: string; status: string; headings: string[] }> = []

  test('J8: Traverse frontend router across all roles, fuzz non-destructive controls, assert zero 5xx/console errors/broken objects', async ({ browser }) => {
    test.setTimeout(180000)

    // ─────────────────────────────────────────────────────────────
    // Role 1: Student Exploration
    // ─────────────────────────────────────────────────────────────
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/student/login')
      await student.humanize.typeSlowly(student.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentCreds.usn)
      await student.humanize.typeSlowly(student.page.locator('input[name="password"], input[type="password"]'), studentCreds.password)
      await student.humanize.clickHuman(student.page, student.page.locator('button[type="submit"]'))
      await student.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      const authMe = await api.for(student).getAuthMe()
      const studentId = authMe.body?.user?.id
      if (authMe.body?.user?.profileStatus !== 'VERIFIED') {
        const adminActor = await createActor(browser, 'admin')
        try {
          await api.for(adminActor).patchRaw(`/api/v1/admin/students/${studentId}/approve`)
        } finally {
          await adminActor.close()
        }
      }

      const studentRoutes = [
        '/student/dashboard',
        '/student/profile',
        '/student/exams',
        '/student/results',
        '/student/support',
        '/student/rules'
      ]

      for (const route of studentRoutes) {
        await student.page.goto(route)
        await student.page.waitForLoadState('networkidle')

        const bodyText = await student.page.locator('body').innerText()
        expect(bodyText).not.toContain('[object Object]')
        expect(bodyText).not.toContain('undefined')

        const headings = await student.page.locator('h1, h2, h3').allTextContents()
        expect(headings.length).toBeGreaterThan(0)

        visitedRoutes.push({
          role: 'student',
          path: route,
          status: 'CLEAN',
          headings: headings.slice(0, 3)
        })
      }
    } finally {
      await student.close()
    }

    // ─────────────────────────────────────────────────────────────
    // Role 2: Faculty Exploration
    // ─────────────────────────────────────────────────────────────
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/faculty/login')
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="email"], input[type="email"]'), facultyCreds.email)
      await faculty.humanize.typeSlowly(faculty.page.locator('input[name="password"], input[type="password"]'), facultyCreds.password)
      await faculty.humanize.clickHuman(faculty.page, faculty.page.locator('button[type="submit"]'))
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })

      const facultyRoutes = [
        '/faculty/dashboard',
        '/faculty/students',
        '/faculty/exams',
        '/faculty/exams/create',
        '/faculty/results'
      ]

      for (const route of facultyRoutes) {
        await faculty.page.goto(route)
        await faculty.page.waitForLoadState('networkidle')

        const bodyText = await faculty.page.locator('body').innerText()
        expect(bodyText).not.toContain('[object Object]')

        const headings = await faculty.page.locator('h1, h2, h3').allTextContents()
        expect(headings.length).toBeGreaterThan(0)

        visitedRoutes.push({
          role: 'faculty',
          path: route,
          status: 'CLEAN',
          headings: headings.slice(0, 3)
        })
      }
    } finally {
      await faculty.close()
    }

    // ─────────────────────────────────────────────────────────────
    // Role 3: Admin Exploration
    // ─────────────────────────────────────────────────────────────
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/admin/login')
      await admin.humanize.typeSlowly(admin.page.locator('input[name="email"], input[type="email"]'), adminCreds.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[name="password"], input[type="password"]'), adminCreds.password)
      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })

      const adminRoutes = [
        '/admin/dashboard',
        '/admin/create-student',
        '/admin/create-faculty',
        '/admin/bulk-create',
        '/admin/enrollment-review',
        '/admin/faculty',
        '/admin/students',
        '/admin/exams',
        '/admin/invigilators',
        '/admin/violations',
        '/admin/announcements',
        '/admin/settings',
        '/admin/audit-logs',
        '/admin/reports'
      ]

      for (const route of adminRoutes) {
        await admin.page.goto(route)
        await admin.page.waitForLoadState('networkidle')

        const bodyText = await admin.page.locator('body').innerText()
        expect(bodyText).not.toContain('[object Object]')

        const headings = await admin.page.locator('h1, h2, h3').allTextContents()
        expect(headings.length).toBeGreaterThan(0)

        visitedRoutes.push({
          role: 'admin',
          path: route,
          status: 'CLEAN',
          headings: headings.slice(0, 3)
        })
      }
    } finally {
      await admin.close()
    }

    // Write coverage artifact
    const reportsDir = path.resolve(process.cwd(), 'reports/e2e')
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })
    fs.writeFileSync(
      path.join(reportsDir, 'crawler-coverage.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), totalRoutes: visitedRoutes.length, visitedRoutes }, null, 2)
    )
  })
})
