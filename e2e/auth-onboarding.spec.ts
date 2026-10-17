import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { api } from './helpers/api'
import { resetCleanRoom, ADMIN_CREDENTIALS } from './helpers/cleanroom'

test.describe('E2E: Auth & Onboarding Flow', () => {
  test.describe.configure({ mode: 'serial' })

  const facultyData = {
    name: 'Prof. Charles Babbage',
    email: 'babbage.faculty@proctornet.test',
    employeeId: 'FAC-CSE-001',
    password: 'Faculty#1234',
    department: 'CSE'
  }

  const studentsData = [
    { name: 'Ada Lovelace', usn: '1MS22CS001', email: 'ada.lovelace@proctornet.test', password: 'Student#1234', semester: 6, department: 'CSE' },
    { name: 'Alan Turing', usn: '1MS22CS002', email: 'alan.turing@proctornet.test', password: 'Student#1234', semester: 6, department: 'CSE' },
    { name: 'Grace Hopper', usn: '1MS22CS003', email: 'grace.hopper@proctornet.test', password: 'Student#1234', semester: 6, department: 'CSE' }
  ]

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Admin onboarding -> create dept -> create faculty & students -> verify auth', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')

    try {
      // 1. Admin login
      await admin.page.goto('/admin/login')
      await expect(admin.page).toHaveTitle(/ProctorNet/i)

      await admin.humanize.typeSlowly(admin.page.locator('input[name="email"], input[type="email"]'), ADMIN_CREDENTIALS.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[name="password"], input[type="password"]'), ADMIN_CREDENTIALS.password)
      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))

      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })
      expect(admin.page.url()).toContain('/admin/dashboard')

      // 2. Admin creates department CSE
      const deptRes = await api.for(admin).postRaw('/api/v1/admin/departments', {
        code: 'CSE',
        name: 'Computer Science and Engineering'
      })
      expect(deptRes.status).toBe(201)

      // 3. Admin creates Faculty
      await admin.page.goto('/admin/create-faculty')
      await admin.page.waitForSelector('form')

      await admin.humanize.typeSlowly(admin.page.locator('input[placeholder*="Rajesh Kumar"]'), facultyData.name)
      await admin.humanize.typeSlowly(admin.page.locator('input[placeholder*="FAC2024CS01"]'), facultyData.employeeId)
      await admin.humanize.typeSlowly(admin.page.locator('input[type="email"]'), facultyData.email)
      await admin.humanize.typeSlowly(admin.page.locator('input[type="password"]'), facultyData.password)

      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await expect(admin.page.getByText('Faculty Account Created', { exact: true })).toBeVisible({ timeout: 10000 })

      // 4. Admin creates student
      await admin.page.goto('/admin/create-student')
      await admin.page.waitForSelector('form')

      await admin.humanize.typeSlowly(admin.page.locator('input[placeholder*="Aarav Sharma"]'), studentsData[0].name)
      await admin.humanize.typeSlowly(admin.page.locator('input[placeholder*="1MS21CS045"]'), studentsData[0].usn)
      await admin.humanize.typeSlowly(admin.page.locator('input[placeholder*="student@university.edu"]'), studentsData[0].email)
      await admin.humanize.typeSlowly(admin.page.locator('input[type="password"]'), studentsData[0].password)

      await admin.humanize.clickHuman(admin.page, admin.page.locator('button[type="submit"]'))
      await expect(admin.page.getByText('Account Created Successfully', { exact: true })).toBeVisible({ timeout: 10000 })

      // 5. Bulk create remaining students
      const bulkPayload = {
        type: 'students',
        role: 'student',
        accounts: studentsData.slice(1).map(s => ({
          name: s.name,
          usn: s.usn,
          email: s.email,
          departmentCode: s.department,
          semester: s.semester,
          password: s.password
        }))
      }
      const bulkRes = await api.for(admin).postRaw('/api/v1/admin/bulk-upload/confirm', bulkPayload)
      expect(bulkRes.status).toBe(200)

      // 6. Faculty isolated login
      const facultyActor = await createActor(browser, 'faculty')
      try {
        await facultyActor.page.goto('/faculty/login')
        await facultyActor.humanize.typeSlowly(facultyActor.page.locator('input[name="email"], input[type="email"]'), facultyData.email)
        await facultyActor.humanize.typeSlowly(facultyActor.page.locator('input[name="password"], input[type="password"]'), facultyData.password)
        await facultyActor.humanize.clickHuman(facultyActor.page, facultyActor.page.locator('button[type="submit"]'))

        await facultyActor.page.waitForURL(url => url.pathname.includes('/faculty/dashboard'), { timeout: 15000 })
        expect(facultyActor.page.url()).toContain('/faculty/dashboard')
      } finally {
        await facultyActor.close()
      }

      // 7. Student isolated login
      const studentActor = await createActor(browser, 'student')
      try {
        await studentActor.page.goto('/student/login')
        await studentActor.humanize.typeSlowly(studentActor.page.locator('input[name="usn"]'), studentsData[0].usn)
        await studentActor.humanize.typeSlowly(studentActor.page.locator('input[name="password"], input[type="password"]'), studentsData[0].password)
        await studentActor.humanize.clickHuman(studentActor.page, studentActor.page.locator('button[type="submit"]'))

        await studentActor.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })
        expect(studentActor.page.url()).toMatch(/\/student\/(dashboard|enrollment)/)
      } finally {
        await studentActor.close()
      }

      // 8. Public registration URLs are disallowed
      const anonActor = await createActor(browser, 'student')
      try {
        await anonActor.page.goto('/student/register')
        await anonActor.page.waitForURL(url => !url.pathname.includes('/student/register'), { timeout: 10000 }).catch(() => {})
        expect(anonActor.page.url()).not.toContain('/student/register')

        const regRes = await anonActor.page.request.post('http://localhost:5000/api/v1/auth/register', {
          data: { email: 'unauthorized@test.com' }
        })
        expect(regRes.status()).toBe(404)
      } finally {
        await anonActor.close()
      }

    } finally {
      await admin.close()
    }
  })
})
