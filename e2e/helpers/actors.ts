import { Browser, BrowserContext, Page } from '@playwright/test'
import { Humanizer } from './humanize'
import { attachGuard } from './guard'

export type ActorRole = 'admin' | 'faculty' | 'student' | 'invigilator' | 'student2'

export interface Actor {
  role: ActorRole
  name: string
  context: BrowserContext
  page: Page
  humanize: Humanizer
  guard: ReturnType<typeof attachGuard>
  close: () => Promise<void>
}

/**
 * Creates an isolated browser context for each human actor so sessions,
 * cookies, localStorages, and WebSockets never intermingle.
 */
export async function createActor(browser: Browser, role: ActorRole, name?: string): Promise<Actor> {
  const actorName = name || `${role.toUpperCase()}-${Math.random().toString(36).substring(2, 6)}`
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone']
  })

  const page = await context.newPage()
  const humanize = new Humanizer()
  const guard = attachGuard(page)

  return {
    role,
    name: actorName,
    context,
    page,
    humanize,
    guard,
    close: async () => {
      guard.assertClean(actorName)
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }
  }
}

/**
 * Automatically agrees to mandatory student proctoring consent if presented on pre-check.
 */
export async function passConsentIfPresent(page: Page): Promise<void> {
  try {
    const consentHeader = page.getByText('Examination Privacy & Proctoring Consent')
    const hasConsentPrompt = await consentHeader.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    if (hasConsentPrompt) {
      const checkbox = page.locator('[data-testid="consent-checkbox"]')
      await checkbox.waitFor({ state: 'visible', timeout: 5000 })
      await checkbox.check()
      const agreeBtn = page.locator('[data-testid="consent-agree-btn"]')
      await agreeBtn.waitFor({ state: 'visible', timeout: 5000 })
      // Wait for React state to enable button
      await page.waitForFunction(() => {
        const btn = document.querySelector('[data-testid="consent-agree-btn"]') as HTMLButtonElement | null
        return btn && !btn.disabled
      }, { timeout: 5000 }).catch(() => {})
      await agreeBtn.click({ timeout: 5000 }).catch(() => {})
      await consentHeader.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
    }
  } catch (_) {}
}

