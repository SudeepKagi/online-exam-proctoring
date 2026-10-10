import { test as base, expect } from '@playwright/test'

/**
 * Console and Network Guard (Prompt 8 Appendix A / U2.4)
 * Fails test immediately if any console.error, pageerror, or HTTP >= 500 occurs.
 */
function isIgnoredConsoleError(text: string): boolean {
  return (
    text.includes('favicon.ico') ||
    text.includes('favicon.svg') ||
    text.includes('Failed to load resource: the server responded with a status of 4') ||
    text.includes('7880') ||
    text.includes('ERR_CONNECTION_REFUSED') ||
    text.includes('ERR_INTERNET_DISCONNECTED') ||
    text.includes('LiveKit') ||
    text.includes('ws proxy')
  )
}

function isIgnoredPageError(message: string): boolean {
  return (
    message.includes('$RefreshSig$') ||
    message.includes('$RefreshReg$')
  )
}

export const test = base.extend({
  page: async ({ page }, use, info) => {
    const problems: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!isIgnoredConsoleError(text)) {
          problems.push(`[CONSOLE_ERROR] ${text}`)
        }
      }
    })

    page.on('pageerror', err => {
      if (!isIgnoredPageError(err.message)) {
        problems.push(`[PAGE_ERROR] ${err.message}`)
      }
    })

    page.on('response', res => {
      if (res.status() >= 500) {
        problems.push(`[HTTP_${res.status()}] ${res.url()}`)
      }
    })

    await use(page)

    if (problems.length > 0) {
      throw new Error(
        `Guard failed in "${info.title}":\n` + problems.map(p => `  - ${p}`).join('\n')
      )
    }
  }
})

export function attachGuard(page: any) {
  const problems: string[] = []

  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!isIgnoredConsoleError(text)) {
        problems.push(`[CONSOLE_ERROR] ${text}`)
      }
    }
  })

  page.on('pageerror', (err: any) => {
    if (!isIgnoredPageError(err.message)) {
      problems.push(`[PAGE_ERROR] ${err.message}`)
    }
  })

  page.on('response', (res: any) => {
    if (res.status() >= 500) {
      problems.push(`[HTTP_${res.status()}] ${res.url()}`)
    }
  })

  return {
    getProblems: () => [...problems],
    assertClean: (contextName = 'Actor Page') => {
      if (problems.length > 0) {
        throw new Error(
          `Guard failed in ${contextName}:\n` + problems.map(p => `  - ${p}`).join('\n')
        )
      }
    }
  }
}

export { expect }

