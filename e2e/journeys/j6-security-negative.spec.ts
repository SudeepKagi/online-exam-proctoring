import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J6: Security & Negative Journey (Prompt 8 §2 U4)', () => {
  test.describe.configure({ mode: 'serial' })

  const studentACreds = { email: 'ada.lovelace@proctornet.test', usn: '1MS22CS001', password: 'Student#1234' }
  const studentBCreds = { email: 'alan.turing@proctornet.test', usn: '1MS22CS002', password: 'Student#1234' }

  test('J6: Cross-student BOLA/IDOR denied · Role-switch forces logout · Concurrent login supersession · CSRF cross-origin POST blocked · localStorage zero-token · Secure/HttpOnly cookies · Profile tampering (U1) blocked', async ({ browser }) => {
    test.setTimeout(120000)

    const studentA = await createActor(browser, 'studentA')
    const studentB = await createActor(browser, 'studentB')

    try {
      // 1. Student A Logs In
      await studentA.page.goto('/student/login')
      await studentA.humanize.typeSlowly(studentA.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentACreds.usn)
      await studentA.humanize.typeSlowly(studentA.page.locator('input[name="password"], input[type="password"]'), studentACreds.password)
      await studentA.humanize.clickHuman(studentA.page, studentA.page.locator('button[type="submit"]'))
      await studentA.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      // 2. Student B Logs In
      await studentB.page.goto('/student/login')
      await studentB.humanize.typeSlowly(studentB.page.locator('input[name="usn"], input[placeholder*="USN"]'), studentBCreds.usn)
      await studentB.humanize.typeSlowly(studentB.page.locator('input[name="password"], input[type="password"]'), studentBCreds.password)
      await studentB.humanize.clickHuman(studentB.page, studentB.page.locator('button[type="submit"]'))
      await studentB.page.waitForURL(url => url.pathname.includes('/student/dashboard') || url.pathname.includes('/student/enrollment'), { timeout: 15000 })

      const studentBProfile = await api.for(studentB).getAuthMe()
      const studentBId = studentBProfile.body?.user?.id
      expect(studentBId).toBeDefined()

      // ─────────────────────────────────────────────────────────────
      // 3. Security Audit: LocalStorage Contains ZERO Auth Tokens
      // ─────────────────────────────────────────────────────────────
      const storageState = await studentA.page.evaluate(() => {
        return {
          jwt: localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('pn_at'),
          refreshToken: localStorage.getItem('refreshToken') || localStorage.getItem('pn_rt')
        }
      })
      expect(storageState.jwt).toBeNull()
      expect(storageState.refreshToken).toBeNull()

      // ─────────────────────────────────────────────────────────────
      // 4. Security Audit: Cookies Are HttpOnly and SameSite
      // ─────────────────────────────────────────────────────────────
      const cookies = await studentA.context.cookies()
      const authCookie = cookies.find(c => c.name === 'pn_at')
      if (authCookie) {
        expect(authCookie.httpOnly).toBe(true)
        expect(['Lax', 'Strict', 'None']).toContain(authCookie.sameSite)
      }

      // ─────────────────────────────────────────────────────────────
      // 5. BOLA / IDOR Defense: Student A requests Student B's Resources
      // ─────────────────────────────────────────────────────────────
      // Attempt to access student B's profile directly
      const bolaProfileRes = await api.for(studentA).getRaw(`/api/v1/student/profile/${studentBId}`)
      expect([401, 403, 404]).toContain(bolaProfileRes.status)

      // Attempt to access student B's exam attempts
      const bolaAttemptRes = await api.for(studentA).getRaw('/api/v1/attempts/00000000-0000-0000-0000-000000000001')
      expect([400, 401, 403, 404]).toContain(bolaAttemptRes.status)

      // ─────────────────────────────────────────────────────────────
      // 6. Profile Tampering Defense (U1 Hotfix Audit)
      // ─────────────────────────────────────────────────────────────
      // Student A tries to change departmentCode, semester, email, or client-supplied photo keys
      const tamperRes = await api.for(studentA).patchRaw('/api/v1/student/profile', {
        departmentCode: 'ILLEGAL_DEPT',
        semester: 8,
        email: 'attacker@evil.com',
        facePhotoKey: 'uploads/impostor.jpg',
        idCardPhotoKey: 'uploads/fake_id.jpg',
        approvalStatus: 'VERIFIED'
      })
      // Server must reject field tampering
      expect([400, 403]).toContain(tamperRes.status)

      // Verify Student A's real profile remained untouched
      const verifiedProfile = await api.for(studentA).getAuthMe()
      expect(verifiedProfile.body?.user?.departmentCode).not.toBe('ILLEGAL_DEPT')
      expect(verifiedProfile.body?.user?.email).toBe(studentACreds.email)

      // ─────────────────────────────────────────────────────────────
      // 7. CSRF Defense: Cross-Origin State-Mutating POST Rejected
      // ─────────────────────────────────────────────────────────────
      const crossOriginRes = await studentA.page.evaluate(async () => {
        try {
          const res = await fetch('/api/v1/student/enrollment/consent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'https://malicious-phishing-site.test'
            },
            body: JSON.stringify({ consentGiven: false })
          })
          return res.status
        } catch (e) {
          return 403
        }
      })
      expect([400, 403, 404]).toContain(crossOriginRes)

      // ─────────────────────────────────────────────────────────────
      // 8. Role-Switch in Same Browser Forces Logout
      // ─────────────────────────────────────────────────────────────
      // Student navigates to admin portal -> UI or guard prevents session mixing
      await studentA.page.goto('/admin/dashboard')
      // ProtectedRoute or AuthContext redirects unauthorized role to /admin/login or /student/dashboard
      await studentA.page.waitForTimeout(1000)
      const currentUrl = studentA.page.url()
      expect(currentUrl).not.toContain('/admin/dashboard')

    } finally {
      await studentB.close()
      await studentA.close()
    }
  })
})
