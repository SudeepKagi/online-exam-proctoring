import { test, expect } from '@playwright/test'
import { createActor } from './helpers/actors'
import { resetCleanRoom, ADMIN_CREDENTIALS, SEEDED_FACULTY, SEEDED_INVIGILATOR, SEEDED_STUDENTS } from './helpers/cleanroom'

test.describe('E2E: Auth, Onboarding & Admin Approval Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await resetCleanRoom()
  })

  test('1. Public Landing Page renders and navigates to Login', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      await actor.page.goto('/')
      await expect(actor.page.locator('text=Online Examination & Proctoring Platform for Institutions')).toBeVisible({ timeout: 10000 })
      await expect(actor.page.locator('text=Institutional Examination Platform')).toBeVisible()

      // Click Sign In
      await actor.page.locator('header').getByRole('button', { name: /^Sign In$/i }).click()
      await actor.page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10000 })
      expect(actor.page.url()).toContain('/login')
    } finally {
      await actor.close()
    }
  })

  test('2. Invalid credentials triggers error alert', async ({ browser }) => {
    const actor = await createActor(browser, 'student')
    try {
      await actor.page.goto('/login?role=student')
      await actor.page.locator('input[type="text"]').fill('nonexistent@user.com')
      await actor.page.locator('input[type="password"]').fill('WrongPassword@123')
      await actor.page.locator('button[type="submit"]').click()

      await expect(actor.page.locator('text=Authentication failed').or(actor.page.locator('text=Invalid credentials'))).toBeVisible({ timeout: 10000 })
    } finally {
      await actor.close()
    }
  })

  test('3. Login succeeds and redirects for all 4 roles', async ({ browser }) => {
    // 1. Admin login
    const admin = await createActor(browser, 'admin')
    try {
      await admin.page.goto('/login?role=admin')
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
      await faculty.page.goto('/login?role=faculty')
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
      await invigilator.page.goto('/login?role=invigilator')
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
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(SEEDED_STUDENTS[0].email)
      await student.page.locator('input[type="password"]').fill(SEEDED_STUDENTS[0].password)
      await student.page.locator('button[type="submit"]').click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })
      expect(student.page.url()).toContain('/student')
    } finally {
      await student.close()
    }
  })

  test('4. Full Lifecycle: Admin provisions Student -> Student Onboarding -> Admin Approval -> Dashboard Access', async ({ browser }) => {
    const admin = await createActor(browser, 'admin')
    const student = await createActor(browser, 'student')
    const testStudentEmail = `eva.${Date.now()}@proctornet.test`
    const tempPassword = 'TempPassword@123'
    const permanentPassword = 'PermanentPass@456'

    try {
      // 1. Admin logs in and provisions a student account
      await admin.page.goto('/login?role=admin')
      await admin.page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.email)
      await admin.page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password)
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin'), { timeout: 15000 })

      await admin.page.goto('/admin/users')
      await expect(admin.page.getByText('User Management & Approvals')).toBeVisible({ timeout: 10000 })

      await admin.page.getByRole('button', { name: /Provision Account/i }).click()
      await expect(admin.page.getByText('Provision New User Account')).toBeVisible()

      await admin.page.locator('input[placeholder="Alex Rivera"]').fill('Eva Lovelace')
      await admin.page.locator('input[placeholder="alex@univ.edu"]').fill(testStudentEmail)
      await admin.page.locator('input[placeholder="1RV21CS042"]').fill('1RV21CS099')
      await admin.page.locator('input[placeholder="Temp@123"]').fill(tempPassword)
      await admin.page.getByRole('button', { name: 'Create Provisioned Account' }).click()

      await expect(admin.page.getByText(/User account created with PENDING_SETUP/i)).toBeVisible({ timeout: 10000 })

      // 2. Student logs in with temporary password -> Redirects to /onboarding
      await student.page.goto('/login?role=student')
      await student.page.locator('input[type="text"]').fill(testStudentEmail)
      await student.page.locator('input[type="password"]').fill(tempPassword)
      await student.page.locator('button[type="submit"]').click()

      await student.page.waitForURL(url => url.pathname.includes('/onboarding'), { timeout: 15000 })
      await expect(student.page.getByText('Student Identity Verification')).toBeVisible()

      // 3. Step 1: Set permanent password & academic details
      await student.page.locator('input[placeholder="Min 6 characters"]').fill(permanentPassword)
      await student.page.locator('input[placeholder="Repeat password"]').fill(permanentPassword)
      await student.page.locator('input[placeholder="+91 98765 43210"]').fill('+91 9876543210')
      await student.page.getByRole('button', { name: /Proceed to Face Verification/i }).click()

      // 4. Step 2: Snap Webcam live photo
      await expect(student.page.getByText('Webcam Face Reference')).toBeVisible({ timeout: 10000 })
      await student.page.getByRole('button', { name: /Snap Live Photo/i }).click()
      await student.page.getByRole('button', { name: /Proceed to College ID/i }).click()

      // 5. Step 3: Upload College ID Card photo
      await expect(student.page.getByText('Click to upload College ID Card Photo')).toBeVisible({ timeout: 10000 })
      const samplePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
      await student.page.locator('input[type="file"]').setInputFiles({
        name: 'college_id.png',
        mimeType: 'image/png',
        buffer: samplePng
      })

      await student.page.getByRole('button', { name: /Submit Profile for Approval/i }).click()
      await student.page.waitForURL(url => url.pathname.includes('/pending-approval'), { timeout: 15000 })
      await expect(student.page.getByText('Identity Profile Under Review')).toBeVisible()

      // 6. Admin reviews and approves the student
      await admin.page.goto('/admin/users')
      await admin.page.getByRole('tab', { name: /Pending Approvals/i }).click()
      const studentRow = admin.page.locator('tr').filter({ hasText: testStudentEmail })
      await expect(studentRow).toBeVisible({ timeout: 10000 })

      await studentRow.getByRole('button', { name: /Review & Verify/i }).click()
      await expect(admin.page.getByText('Review & Verify Identity Profile')).toBeVisible()

      // Real Image Pixel Check in Playwright: assert complete === true AND naturalWidth > 0
      const faceImg = admin.page.locator('img[alt="Face Reference"]')
      const idImg = admin.page.locator('img[alt="College ID"]')
      await expect(faceImg).toBeVisible({ timeout: 10000 })
      await expect(idImg).toBeVisible({ timeout: 10000 })

      await expect.poll(async () => {
        return faceImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
      }, { timeout: 10000 }).toBe(true)

      await expect.poll(async () => {
        return idImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
      }, { timeout: 10000 }).toBe(true)

      await admin.page.getByRole('button', { name: /Approve Account/i }).click()

      await expect(admin.page.getByText(/Account approved for Eva Lovelace/i)).toBeVisible({ timeout: 10000 })

      // 7. Student checks review status -> Unlocked to Student Dashboard!
      await student.page.getByRole('button', { name: /Check Approval Status/i }).click()
      await student.page.waitForURL(url => url.pathname.includes('/student'), { timeout: 15000 })
      await expect(student.page.getByText('Student Examination Portal')).toBeVisible()
      await expect(student.page.getByText('Identity Verified')).toBeVisible()
    } finally {
      await student.close()
      await admin.close()
    }
  })
})
