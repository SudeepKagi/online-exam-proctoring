import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_INVIGILATOR, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Auth & Onboarding Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('Invalid credentials triggers error alert', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      await actor.page.goto('/login')
      await expect(actor.page).toHaveTitle(/ProctorNet/i)

      await actor.page.locator('input[type="text"]').fill('nonexistent@user.com')
      await actor.page.locator('input[type="password"]').fill('WrongPassword@123')
      await actor.page.locator('button[type="submit"]').click()

      await expect(actor.page.locator('text=Authentication failed').or(actor.page.locator('text=Invalid credentials'))).toBeVisible({ timeout: 10000 })
    } finally {
      await actor.close()
    }
  })

  test('Login succeeds and redirects for all 4 roles', async ({ browser }) => {
    // 1. Admin login
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/login')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })
      expect(admin.page.url()).toContain('/admin')
    } finally {
      await admin.close()
    }

    // 2. Faculty login
    const faculty = await createActor(browser, 'faculty')
    try {
      await faculty.page.goto('/login')
      await faculty.page.locator('input[type="text"]').fill(SEEDED_FACULTY.email)
      await faculty.page.locator('input[type="password"]').fill(SEEDED_FACULTY.password)
      await faculty.page.locator('button[type="submit"]').click()
      await faculty.page.waitForURL(url => url.pathname.includes('/faculty'), { timeout: 15000 })
      expect(faculty.page.url()).toContain('/faculty')
    } finally {
      await faculty.close()
    }

    // 3. Invigilator login
    const invigilator = await createActor(browser, 'invigilator')
    try {
      await invigilator.page.goto('/login')
      await invigilator.page.locator('input[type="text"]').fill(SEEDED_INVIGILATOR.email)
      await invigilator.page.locator('input[type="password"]').fill(SEEDED_INVIGILATOR.password)
      await invigilator.page.locator('button[type="submit"]').click()
      await invigilator.page.waitForURL(url => url.pathname.includes('/invigilator'), { timeout: 15000 })
      expect(invigilator.page.url()).toContain('/invigilator')
    } finally {
      await invigilator.close()
    }

    // 4. Student login
    const student = await createActor(browser, 'student')
    try {
      await student.page.goto('/login')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })
      expect(student.page.url()).toContain('/student')
    } finally {
      await student.close()
    }
  })

  test('Admin creates a student account and toggles suspension', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    const newStudentEmail = `charlie.${Date.now()}@proctornet.test`

    try {
      await admin.page.goto('/login')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      // Navigate to Admin Users page
      await admin.page.goto('/admin/users')
      await expect(admin.page.getByText('User Management')).toBeVisible({ timeout: 10000 })

      // Click Add Account dialog
      await admin.page.getByRole('button', { name: /Add Account/i }).click()
      await expect(admin.page.getByText('Create New User Account')).toBeVisible()

      // Fill in user details
      await admin.page.locator('input[placeholder="John Doe"]').fill('Charlie Babbage')
      await admin.page.locator('input[placeholder="john@univ.edu"]').fill(newStudentEmail)
      await admin.page.locator('input[placeholder="1RV21CS001"]').fill('USN-999')
      await admin.page.locator('input[placeholder="••••••••"]').fill('Password@12345')

      // Submit form
      await admin.page.getByRole('button', { name: 'Create User' }).click()
      await expect(admin.page.getByText(/User account created successfully/i)).toBeVisible({ timeout: 10000 })

      // Verify new user exists in table
      const userRow = admin.page.locator('tr').filter({ hasText: newStudentEmail })
      await expect(userRow).toBeVisible({ timeout: 10000 })
      await expect(userRow.locator('text=ACTIVE')).toBeVisible()

      // Suspend user
      const toggleBtn = userRow.getByTestId('toggle-status-btn')
      await toggleBtn.click()
      await expect(userRow.locator('text=SUSPENDED')).toBeVisible({ timeout: 10000 })

      // Activate user
      await toggleBtn.click()
      await expect(userRow.locator('text=ACTIVE')).toBeVisible({ timeout: 10000 })
    } finally {
      await admin.close()
    }
  })
})
