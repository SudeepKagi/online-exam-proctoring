/**
 * autosaveManager.js
 * Robust client-side autosave manager (Notion 13.6/13.7 & Task 8).
 * - Dirty map keyed by attemptQuestionId
 * - Automatic background flush every 5s + on visibilitychange/blur
 * - Revision tracking with 409 STALE_REVISION reconciliation
 * - Exponential backoff with jitter on 429/503/network failure
 * - Retains uncommitted dirty state in memory on failure
 * - Flush-before-submit with stable, reusable Idempotency-Key
 */

import axios from 'axios'
import { serverClock } from './serverClock'

export class AutosaveManager {
  constructor(options = {}) {
    this.attemptId = options.attemptId || null
    this.apiBaseUrl = options.apiBaseUrl || (import.meta.env.VITE_API_BASE_URL || '/api/v1')
    this.currentRevision = options.initialRevision || 1
    this.dirtyMap = new Map() // attemptQuestionId -> { attemptQuestionId, selectedOptionId, revision, clientTimestamp }
    this.isFlushing = false
    this.isSubmitting = false
    this.backoffMs = 1000
    this.maxBackoffMs = 16000
    this.stableIdempotencyKey = null
    this.flushTimer = null
    this.onStateChangeCallbacks = new Set()

    this._setupAutoFlush()
  }

  setAttemptId(attemptId, revision = 1) {
    this.attemptId = attemptId
    this.currentRevision = revision
  }

  _setupAutoFlush() {
    // 1. Periodic 5-second background flush (Task 8)
    this.flushTimer = setInterval(() => {
      if (this.dirtyMap.size > 0 && !this.isFlushing && !this.isSubmitting) {
        this.flush().catch(() => {})
      }
    }, 5000)

    // 2. Immediate flush on tab blur or visibility change (Task 8)
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.dirtyMap.size > 0) {
          this.flush().catch(() => {})
        }
      })

      window.addEventListener('blur', () => {
        if (this.dirtyMap.size > 0) {
          this.flush().catch(() => {})
        }
      })
    }
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * Record candidate answer selection
   */
  recordAnswer(attemptQuestionId, selectedOptionId) {
    const entry = {
      attemptQuestionId,
      selectedOptionId,
      revision: this.currentRevision,
      clientTimestamp: new Date(serverClock.now()).toISOString()
    }

    this.dirtyMap.set(attemptQuestionId, entry)
    this._notifyStateChange()
    return entry
  }

  /**
   * Check if there are uncommitted answers in memory
   */
  hasDirtyAnswers() {
    return this.dirtyMap.size > 0
  }

  /**
   * Flush all dirty answers to backend
   */
  async flush() {
    if (!this.attemptId || this.dirtyMap.size === 0 || this.isFlushing) {
      return { saved: 0, status: 'SKIPPED' }
    }

    this.isFlushing = true
    this._notifyStateChange()

    // Take snapshot of dirty items
    const snapshot = Array.from(this.dirtyMap.values())
    const payload = {
      answers: snapshot.map(item => ({
        attemptQuestionId: item.attemptQuestionId,
        selectedOptionId: item.selectedOptionId
      })),
      revision: this.currentRevision
    }

    try {
      const response = await axios.put(
        `${this.apiBaseUrl}/attempts/${this.attemptId}/answers`,
        payload,
        { withCredentials: true, timeout: 5000 }
      )

      // Sync server clock from response
      if (response.data?.serverTime) {
        serverClock.synchronize(response.data.serverTime)
      }

      // On 200 SUCCESS: remove successfully saved entries from dirty map
      for (const item of snapshot) {
        const currentInMap = this.dirtyMap.get(item.attemptQuestionId)
        if (currentInMap && currentInMap.clientTimestamp === item.clientTimestamp) {
          this.dirtyMap.delete(item.attemptQuestionId)
        }
      }

      // Bump revision to server authoritative revision
      if (response.data?.revision) {
        this.currentRevision = response.data.revision
      } else {
        this.currentRevision++
      }

      // Reset exponential backoff on success
      this.backoffMs = 1000
      this.isFlushing = false
      this._notifyStateChange()

      return { saved: snapshot.length, status: 'SUCCESS', revision: this.currentRevision }
    } catch (err) {
      this.isFlushing = false
      const status = err.response?.status
      const errorData = err.response?.data?.error || {}

      if (status === 409 && (errorData.code === 'STALE_REVISION' || errorData.currentRevision)) {
        // Reconcile stale revision: adopt server's current revision and retry immediately
        this.currentRevision = errorData.currentRevision || (this.currentRevision + 1)
        console.warn(`[Autosave] 409 Stale revision encountered; reconciling to revision ${this.currentRevision}`)
        this._notifyStateChange()
        return this.flush()
      }

      // On 429, 503, or network outage: retain dirty map in memory and back off (Task 8)
      const jitter = 0.8 + 0.4 * Math.random()
      const nextDelay = Math.min(this.maxBackoffMs, this.backoffMs * 2) * jitter
      this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2)

      console.warn(`[Autosave] Save failed (${status || err.message}); retained ${this.dirtyMap.size} dirty answers. Retrying in ${Math.round(nextDelay)}ms`)
      setTimeout(() => {
        if (this.dirtyMap.size > 0 && !this.isFlushing) {
          this.flush().catch(() => {})
        }
      }, nextDelay)

      this._notifyStateChange()
      throw err
    }
  }

  /**
   * Flush before submit guarantee
   */
  async flushBeforeSubmit() {
    if (this.dirtyMap.size > 0) {
      await this.flush()
    }
  }

  /**
   * Get or initialize stable Idempotency-Key for the submit session (Task 8)
   */
  getStableIdempotencyKey() {
    if (!this.stableIdempotencyKey) {
      this.stableIdempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
    return this.stableIdempotencyKey
  }

  /**
   * Submit exam attempt with idempotency guarantee
   */
  async submitAttempt() {
    if (this.isSubmitting) {
      throw new Error('Submission already in progress')
    }

    this.isSubmitting = true
    this._notifyStateChange()

    try {
      // 1. Flush any pending dirty answers
      await this.flushBeforeSubmit()

      // 2. Stable Idempotency-Key reused across retries (Task 8)
      const idempotencyKey = this.getStableIdempotencyKey()

      const response = await axios.post(
        `${this.apiBaseUrl}/attempts/${this.attemptId}/submit`,
        {},
        {
          headers: {
            'Idempotency-Key': idempotencyKey
          },
          withCredentials: true,
          timeout: 10000
        }
      )

      this.isSubmitting = false
      this.stableIdempotencyKey = null // Clear on definitive success
      this._notifyStateChange()

      return response.data
    } catch (err) {
      // Do not clear stableIdempotencyKey on failure so retry re-sends the exact same key!
      this.isSubmitting = false
      this._notifyStateChange()
      throw err
    }
  }

  subscribe(callback) {
    this.onStateChangeCallbacks.add(callback)
    return () => this.onStateChangeCallbacks.delete(callback)
  }

  _notifyStateChange() {
    const state = {
      dirtyCount: this.dirtyMap.size,
      isFlushing: this.isFlushing,
      isSubmitting: this.isSubmitting,
      revision: this.currentRevision
    }
    for (const cb of this.onStateChangeCallbacks) {
      try {
        cb(state)
      } catch (e) {
        // ignore
      }
    }
  }
}
