import { Locator, Page } from '@playwright/test'
import seedrandom from 'seedrandom'

export interface HumanizeOptions {
  seed?: string
  enabled?: boolean
  errorRate?: number // e.g. 0.05 = 5% chance of typo
}

export class Humanizer {
  private rng: seedrandom.PRNG
  public readonly seed: string
  public readonly enabled: boolean
  private errorRate: number

  constructor(options: HumanizeOptions = {}) {
    this.seed = options.seed || process.env.E2E_SEED || `pn-${Date.now()}`
    this.rng = seedrandom(this.seed)
    this.enabled = options.enabled !== false && process.env.FAST_E2E !== 'true'
    this.errorRate = options.errorRate ?? 0.05
    console.log(`[HUMANIZER] Initialized with seed="${this.seed}", enabled=${this.enabled}`)
  }

  /**
   * Random float between 0 and 1
   */
  private random(): number {
    return this.rng()
  }

  /**
   * Random integer between min and max (inclusive)
   */
  private randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min
  }

  /**
   * Simulates human pause / think time
   */
  async think(minMs = 200, maxMs = 600): Promise<void> {
    if (!this.enabled) return
    const ms = this.randInt(minMs, maxMs)
    await new Promise(r => setTimeout(r, ms))
  }

  /**
   * Types text naturally character-by-character with per-key delays and occasional typo correction
   */
  async typeSlowly(locator: Locator, text: string, options: { withTypo?: boolean } = {}): Promise<void> {
    await locator.focus()
    await this.think(100, 250)

    if (!this.enabled) {
      await locator.fill(text)
      return
    }

    const shouldMakeTypo = options.withTypo || (this.random() < this.errorRate && text.length > 5)
    let typoInjected = false
    const typoIndex = shouldMakeTypo ? this.randInt(2, text.length - 2) : -1

    for (let i = 0; i < text.length; i++) {
      // Inadvertent typo simulation
      if (shouldMakeTypo && i === typoIndex && !typoInjected) {
        const wrongChar = String.fromCharCode(this.randInt(97, 122))
        await locator.pressSequentially(wrongChar, { delay: this.randInt(40, 80) })
        await this.think(120, 250) // realize mistake
        await locator.press('Backspace') // correct
        await this.think(80, 150)
        typoInjected = true
      }

      await locator.pressSequentially(text[i], { delay: this.randInt(20, 60) })
    }

    await this.think(80, 200)
  }

  /**
   * Moves mouse naturally toward target and clicks with slight delay
   */
  async clickHuman(page: Page, locator: Locator, options: { doubleClick?: boolean } = {}): Promise<void> {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (box && this.enabled) {
      // Slight offset within the target button/link (not exact mathematical center)
      const targetX = box.x + box.width / 2 + this.randInt(-4, 4)
      const targetY = box.y + box.height / 2 + this.randInt(-4, 4)

      // Move mouse in steps
      await page.mouse.move(targetX, targetY, { steps: this.randInt(3, 7) })
      await this.think(50, 120)
    }

    if (options.doubleClick) {
      await locator.dblclick()
    } else {
      await locator.click()
    }

    await this.think(100, 300)
  }
}
