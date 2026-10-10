import { expect } from '@playwright/test'

/**
 * Polling helper against server state (Prompt 8 §2 U4.2)
 * Eliminates arbitrary waitForTimeout, asserting deterministic state transitions.
 */
export async function pollServerState<T>(
  fetchFn: () => Promise<T>,
  expected: (val: T) => boolean | void,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const timeout = options.timeout ?? 10000
  const intervals = [100, 250, 500, 1000]

  await expect.poll(async () => {
    const val = await fetchFn()
    const result = expected(val)
    if (typeof result === 'boolean') {
      return result
    }
    return true
  }, {
    message: options.message || 'Server state poll timed out',
    timeout,
    intervals
  }).toBeTruthy()
}
