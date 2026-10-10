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

