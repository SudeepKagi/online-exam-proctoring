/**
 * serverClock.js
 * High-precision synchronized clock compensating for client-server clock drift.
 * Computes offset = serverEpochMs - Date.now() from every authoritative HTTP response.
 */

class ServerClock {
  constructor() {
    this.offsetMs = 0
    this.hasSynced = false
  }

  /**
   * Synchronize using server timestamp
   * @param {string|number|Date} serverTime ISO string or epoch ms
   */
  synchronize(serverTime) {
    if (!serverTime) return
    const serverEpoch = typeof serverTime === 'number'
      ? serverTime
      : new Date(serverTime).getTime()

    if (isNaN(serverEpoch)) return

    // offset = serverTime - localClientTime
    this.offsetMs = serverEpoch - Date.now()
    this.hasSynced = true
  }

  /**
   * Get current synchronized epoch timestamp (ms)
   */
  now() {
    return Date.now() + this.offsetMs
  }

  /**
   * Get synchronized Date object
   */
  getSynchronizedDate() {
    return new Date(this.now())
  }

  /**
   * Calculate milliseconds remaining until target deadline
   * @param {string|number|Date} expiresAt 
   * @returns {number} Remaining milliseconds (clamped to 0)
   */
  getRemainingMs(expiresAt) {
    if (!expiresAt) return 0
    const deadlineMs = typeof expiresAt === 'number'
      ? expiresAt
      : new Date(expiresAt).getTime()

    if (isNaN(deadlineMs)) return 0
    return Math.max(0, deadlineMs - this.now())
  }

  /**
   * Format remaining time into HH:MM:SS string
   */
  formatRemaining(expiresAt) {
    const totalSeconds = Math.floor(this.getRemainingMs(expiresAt) / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
}

export const serverClock = new ServerClock()
