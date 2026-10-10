const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const { setupE2EFixture, prisma } = require('./helpers/db')

const BASELINE_DIR = path.resolve(__dirname, 'visual-baseline')

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 }
]

// Structural DOM serializer: captures hierarchical element tree, tags, classes, and roles
// while abstracting inner dynamic text, guaranteeing zero design/layout regressions during copy abstraction (§4.6)
async function captureDOMStructure(page) {
  return await page.evaluate(() => {
    function serializeNode(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return null
      const tag = node.tagName.toLowerCase()
      if (['script', 'style', 'noscript', 'iframe'].includes(tag)) return null

      const attributes = {}
      for (const attr of node.attributes) {
        if (['id', 'class', 'role', 'type', 'name', 'aria-label', 'placeholder', 'data-testid'].includes(attr.name)) {
          attributes[attr.name] = attr.value
        }
      }

      const children = []
      for (const child of node.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const s = serializeNode(child)
          if (s) children.push(s)
        }
      }

      return {
        tag,
        ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
        childCount: children.length,
        ...(children.length > 0 ? { children } : {})
      }
    }

    const root = document.querySelector('#root') || document.body
    return serializeNode(root)
  })
}

async function captureRoute(page, routeSlug, urlPath, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(urlPath, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.locator('#root, main, body').first().waitFor({ state: 'visible' })

  const filenamePrefix = `${routeSlug}-${viewport.width}x${viewport.height}`
  const screenshotPath = path.join(BASELINE_DIR, `${filenamePrefix}.png`)
  const domPath = path.join(BASELINE_DIR, `${filenamePrefix}.dom.json`)

  // 1. Full-page screenshot
  await page.screenshot({ path: screenshotPath, fullPage: true })

  // 2. DOM-structure snapshot
  const domStructure = await captureDOMStructure(page)
  fs.writeFileSync(domPath, JSON.stringify(domStructure, null, 2), 'utf8')
}

test.describe('Visual & Structural Baselines Capture (§3 Q0.5)', () => {
  let fixture

  test.beforeAll(async () => {
    if (!fs.existsSync(BASELINE_DIR)) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true })
    }
    fixture = await setupE2EFixture()
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('Public Routes Baseline (Landing & Login Pages)', async ({ page }) => {
    const publicRoutes = [
      { slug: 'public-landing', path: '/' },
      { slug: 'public-login-admin', path: '/admin/login' },
      { slug: 'public-login-faculty', path: '/faculty/login' },
      { slug: 'public-login-student', path: '/student/login' },
      { slug: 'public-login-invigilator', path: '/invigilator/login' }
    ]

    for (const route of publicRoutes) {
      for (const vp of VIEWPORTS) {
        await captureRoute(page, route.slug, route.path, vp)
      }
    }
  })

  test('Student Portal Baseline', async ({ page }) => {
    // Login as student
    await page.goto('/student/login')
    await expect(page).toHaveTitle(/ProctorNet/i)
    await page.fill('input[name="usn"]', fixture.student.usn)
    await page.fill('input[name="password"]', fixture.commonPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })

    const studentRoutes = [
      { slug: 'student-dashboard', path: '/student/dashboard' },
      { slug: 'student-profile', path: '/student/profile' },
      { slug: 'student-enrollment', path: '/student/enrollment' },
      { slug: 'student-device-check', path: '/student/device-check' },
      { slug: 'student-exams', path: '/student/exams' },
      { slug: 'student-exam-lobby', path: `/student/exams/${fixture.examId}/lobby` },
      { slug: 'student-exam-interface', path: `/student/exams/${fixture.examId}/exam` },
      { slug: 'student-results', path: '/student/results' },
      { slug: 'student-support', path: '/student/support' },
      { slug: 'student-rules', path: '/student/rules' }
    ]

    for (const route of studentRoutes) {
      for (const vp of VIEWPORTS) {
        await captureRoute(page, route.slug, route.path, vp)
      }
    }
  })

  test('Faculty Portal Baseline', async ({ page }) => {
    // Login as faculty
    await page.goto('/faculty/login')
    await expect(page).toHaveTitle(/ProctorNet/i)
    await page.fill('input[name="email"]', fixture.faculty.email)
    await page.fill('input[name="password"]', fixture.commonPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })

    const facultyRoutes = [
      { slug: 'faculty-dashboard', path: '/faculty/dashboard' },
      { slug: 'faculty-students', path: '/faculty/students' },
      { slug: 'faculty-exams', path: '/faculty/exams' },
      { slug: 'faculty-exams-create', path: '/faculty/exams/create' },
      { slug: 'faculty-results', path: '/faculty/results' }
    ]

    for (const route of facultyRoutes) {
      for (const vp of VIEWPORTS) {
        await captureRoute(page, route.slug, route.path, vp)
      }
    }
  })

  test('Admin Portal Baseline', async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login')
    await expect(page).toHaveTitle(/ProctorNet/i)
    await page.fill('input[name="email"]', fixture.adminEmail)
    await page.fill('input[name="password"]', fixture.adminPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })

    const adminRoutes = [
      { slug: 'admin-dashboard', path: '/admin/dashboard' },
      { slug: 'admin-students', path: '/admin/students' },
      { slug: 'admin-faculty', path: '/admin/faculty' },
      { slug: 'admin-exams', path: '/admin/exams' },
      { slug: 'admin-invigilators', path: '/admin/invigilators' },
      { slug: 'admin-audit-logs', path: '/admin/audit-logs' },
      { slug: 'admin-settings', path: '/admin/settings' },
      { slug: 'admin-reports', path: '/admin/reports' }
    ]

    for (const route of adminRoutes) {
      for (const vp of VIEWPORTS) {
        await captureRoute(page, route.slug, route.path, vp)
      }
    }
  })

  test('Invigilator Portal Baseline', async ({ page }) => {
    // Login as invigilator
    await page.goto('/invigilator/login')
    await expect(page).toHaveTitle(/ProctorNet/i)
    await page.fill('input[name="examId"], input[placeholder*="Exam ID" i]', fixture.examId)
    await page.fill('input[name="invId"], input[placeholder*="Invigilator ID" i]', 'INV-E2E-001')
    await page.fill('input[name="invPassword"], input[type="password"]', fixture.commonPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })

    const invigilatorRoutes = [
      { slug: 'invigilator-dashboard', path: '/invigilator/dashboard' },
      { slug: 'invigilator-violations', path: '/invigilator/violations' },
      { slug: 'invigilator-live-grid', path: `/invigilator/live-grid/${fixture.examId}` }
    ]

    for (const route of invigilatorRoutes) {
      for (const vp of VIEWPORTS) {
        await captureRoute(page, route.slug, route.path, vp)
      }
    }
  })
})
