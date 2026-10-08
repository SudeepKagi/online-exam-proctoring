/**
 * autosaveManager.js
 * Robust client-side autosave manager (Notion 13.6/13.7 & Task 8 / Phase S2).
 * - Dirty map keyed by attemptQuestionId
 * - Automatic background flush every 5s + on visibilitychange/blur
 * - Revision tracking with 409 STALE_REVISION reconciliation
 * - Exponential backoff with jitter on 429/503/network failure
 * - Retains uncommitted dirty state in memory and sessionStorage on failure
 * - Flush-before-submit with stable, reusable Idempotency-Key
 */

import api from '@/utils/api'
import { serverClock } from './serverClock'

export class AutosaveManager {
  constructor(options = {}) {
    this.attemptId = options.attemptId || null
    this.currentRevision = options.initialRevision || 1
    this.dirtyMap = new Map() // attemptQuestionId -> { attemptQuestionId, selectedOptionId, revision, clientTimestamp }
    this.isFlushing = false
    this.isSubmitting = false
    this.backoffMs = 1000
    this.maxBackoffMs = 16000
    this.stableIdempotencyKey = null
    this.flushTimer = null
    this.debounceTimer = null
    this.onStateChangeCallbacks = new Set()

    this._setupAutoFlush()
    if (this.attemptId) {
      this._restoreFromSessionStorage()
    }
  }

  setAttemptId(attemptId, revision = 1) {
    this.attemptId = attemptId
    this.currentRevision = revision
    this._restoreFromSessionStorage()
  }

  _persistToSessionStorage() {
    if (typeof sessionStorage !== 'undefined' && this.attemptId) {
      try {
        const arr = Array.from(this.dirtyMap.entries())
        sessionStorage.setItem(`pn_autosave_${this.attemptId}`, JSON.stringify(arr))
      } catch (_e) {}
    }
  }

  _restoreFromSessionStorage() {
    if (typeof sessionStorage !== 'undefined' && this.attemptId) {
      try {
        const raw = sessionStorage.getItem(`pn_autosave_${this.attemptId}`)
        if (raw) {
          const entries = JSON.parse(raw)
          for (const [k, v] of entries) {
            if (!this.dirtyMap.has(k)) {
              this.dirtyMap.set(k, v)
            }
          }
          this._notifyStateChange()
        }
      } catch (_e) {}
    }
  }

  _setupAutoFlush() {
    // 1. Periodic 5-second background flush (Task 8 / Q3.2)
    this.flushTimer = setInterval(() => {
      if (this.dirtyMap.size > 0 && !this.isFlushing && !this.isSubmitting) {
        this.flush().catch(() => {})
      }
    }, 5000)

    // 2. Immediate flush on tab blur, visibility change, or pagehide (Q3.2)
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

      window.addEventListener('pagehide', () => {
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
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
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
    this._persistToSessionStorage()
    this._notifyStateChange()

    // Trigger debounced flush (300ms) so answers persist promptly
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      if (this.dirtyMap.size > 0 && !this.isFlushing && !this.isSubmitting) {
        this.flush().catch(() => {})
      }
    }, 300)

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

    // Take snapshot of dirty items (batch <= 100 per Q3.2)
    const snapshot = Array.from(this.dirtyMap.values()).slice(0, 100)
    const payload = {
      answers: snapshot.map(item => ({
        attemptQuestionId: item.attemptQuestionId,
        optionId: item.selectedOptionId || null,
        revision: item.revision || this.currentRevision || 1
      }))
    }

    try {
      const response = await api.put(
        `/attempts/${this.attemptId}/answers`,
        payload,
        { timeout: 5000 }
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

      // Update sessionStorage cache
      this._persistToSessionStorage()

      // Bump revision to highest revision in results if present
      if (response.data?.results) {
        const maxRev = response.data.results.reduce((max, r) => Math.max(max, r.revision || 0), this.currentRevision)
        if (maxRev > this.currentRevision) {
          this.currentRevision = maxRev
        }
      } else if (response.data?.revision) {
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
   * Stable Idempotency-Key across retries for submitAttempt (Task 8 / Q3.2)
   */
  getStableIdempotencyKey() {
    if (!this.stableIdempotencyKey) {
      this.stableIdempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sub_${this.attemptId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
    return this.stableIdempotencyKey
  }

  /**
   * Submit attempt with mandatory flush-before-submit and stable idempotency key
   */
  async submitAttempt() {
    if (this.isSubmitting) {
      throw new Error('Submission already in progress')
    }

    this.isSubmitting = true
    this._notifyStateChange()

    try {
      // 1. Mandatory Flush-Before-Submit (Task 8 / Q3.2)
      if (this.dirtyMap.size > 0) {
        try {
          await this.flush()
        } catch (flushErr) {
          console.warn('[Autosave] Non-fatal flush error prior to submission; proceeding with final submission:', flushErr.message)
        }
      }

      // 2. Stable Idempotency-Key reused across retries (Task 8 / Q3.2)
      const idempotencyKey = this.getStableIdempotencyKey()

      const response = await api.post(
        `/attempts/${this.attemptId}/submission`,
        {},
        {
          headers: {
            'Idempotency-Key': idempotencyKey
          },
          timeout: 10000
        }
      )

      this.isSubmitting = false
      this.stableIdempotencyKey = null // Clear on definitive success
      if (typeof sessionStorage !== 'undefined' && this.attemptId) {
        sessionStorage.removeItem(`pn_autosave_${this.attemptId}`)
      }
      this._notifyStateChange()

      return response.data
    } catch (err) {
      // Do not clear stableIdempotencyKey on failure so retry re-sends the exact same key!
      this.isSubmitting = false
      this._notifyStateChange()
      throw err
    }
  }

  /**
   * Poll GET /attempts/:attemptId/result (respecting release policy per Q3.2)
   */
  async pollResult(maxAttempts = 10, intervalMs = 2000) {
    if (!this.attemptId) return null
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await api.get(
          `/attempts/${this.attemptId}/result`,
          { timeout: 5000 }
        )
        if (res.data) {
          return res.data
        }
      } catch (err) {
        const status = err.response?.status
        if (status === 403) {
          // Result held by policy (not released yet)
          return { released: false, status: 'HELD_BY_POLICY' }
        }
        if (status !== 404 && status !== 202) {
          throw err
        }
      }
      await new Promise(r => setTimeout(r, intervalMs))
    }
    return null
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
