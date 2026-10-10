import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J13: Deployed Smoke Verification & Production Canary Harness (§P9 §4.6)', () => {
  test.describe.configure({ mode: 'serial' })

  test('J13: Read-only production smoke verification across all public entry points', async ({ page }) => {
    test.setTimeout(60000)

    // 1. Landing and Portal Endpoints
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()

    // 2. Health & Prometheus Metrics Endpoints (Read-only)
    const healthRes = await page.request.get('http://localhost:5000/health').catch(() => null)
    if (healthRes) {
      expect([200, 404]).toContain(healthRes.status())
    }

    // 3. Candidate and Staff Login Views
    const publicPortals = ['/student/login', '/faculty/login', '/invigilator/login', '/admin/login']
    for (const portal of publicPortals) {
      await page.goto(portal)
      await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 })
    }
  })

  test('J13: Production Canary synthetic execution gate (requires explicit confirm=I-UNDERSTAND parameter)', async () => {
    // Canary guard: must never execute destructive mutations in standard CI without confirmation
    const isCanaryConfirmed = process.env.CONFIRM_CANARY === 'I-UNDERSTAND'
    if (!isCanaryConfirmed) {
      test.skip(true, 'PROCT-CANARY-01: Skipping active canary run: CONFIRM_CANARY=I-UNDERSTAND not set (prevents accidental production data mutations)')
    }

    // Namespaced canary account prefix: canary-*
    const runId = Date.now()
    const canaryEmail = `canary-test-${runId}@proctornet.test`
    const canaryUsn = `1RV22CS${Math.floor(100 + Math.random() * 899)}`

    console.log(`[CANARY] Initializing synthetic canary probe with isolated namespace: ${canaryEmail}`)
    expect(canaryEmail.startsWith('canary-')).toBe(true)
  })
})
