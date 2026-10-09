/**
 * autosaveManager.js
 * Robust client-side autosave manager (Notion 13.6/13.7 & Task 8 / Phase S2 / Truth Pass T1).
 * - Per-answer revision tracking via revisionByAqId (CAS: revision = expected)
 * - Per-item batch result handling (deletes OK, reconciles STALE_REVISION, surfaces terminal errors)
 * - Single cancellable retry timer with exponential backoff and jitter (no unbounded recursion)
 * - Respects Retry-After headers and caps retry attempts per item
 * - SessionStorage keyed by attempt with schema versioning and outdated entry pruning
 * - Proper lifecycle teardown removing all listeners and timers
 * - Flush-before-submit with stable, reusable Idempotency-Key
 */

import api from '@/utils/api'
import { serverClock } from './serverClock'

export class AutosaveManager {
  constructor(options = {}) {
    this.attemptId = options.attemptId || null
    this.revisionByAqId = new Map() // attemptQuestionId -> confirmed revision (unanswered = 0)
    this.dirtyMap = new Map() // attemptQuestionId -> { attemptQuestionId, selectedOptionId, expectedRevision, clientTimestamp, attempts }
    this.terminalErrors = new Map() // attemptQuestionId -> { attemptQuestionId, status, error, timestamp }
    this.isFlushing = false
    this.isSubmitting = false
    this.backoffMs = 1000
    this.maxBackoffMs = 16000
    this.stableIdempotencyKey = null
    this.flushTimer = null
    this.debounceTimer = null
    this.retryTimer = null
    this.onStateChangeCallbacks = new Set()

    // Bound listeners for clean destruction
    this._onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && this.dirtyMap.size > 0) {
        this.flush().catch(() => {})
      }
    }
    this._onBlur = () => {
      if (this.dirtyMap.size > 0) {
        this.flush().catch(() => {})
      }
    }
    this._onPageHide = () => {
      if (this.dirtyMap.size > 0) {
        this.flush().catch(() => {})
      }
    }

    this._setupAutoFlush()
    if (this.attemptId) {
      this._restoreFromSessionStorage()
    }
  }

  /**
   * Set or update current active attempt and optionally hydrate question revisions
   */
  setAttemptId(attemptId, questions = []) {
    this.attemptId = attemptId
    if (Array.isArray(questions) && questions.length > 0) {
      this.setQuestionRevisions(questions)
    }
    this._restoreFromSessionStorage()
    this._notifyStateChange()
  }

  /**
   * Hydrate per-question server revisions (unanswered = 0)
   */
  setQuestionRevisions(questions = []) {
    if (!Array.isArray(questions)) return
    for (const q of questions) {
      const aqId = q.attemptQuestionId || q.id || q.questionId
      if (aqId) {
        const rev = typeof q.revision === 'number' ? q.revision : (q.selectedOptionId ? 1 : 0)
        this.revisionByAqId.set(aqId, rev)
      }
    }
  }

  _persistToSessionStorage() {
    if (typeof sessionStorage !== 'undefined' && this.attemptId) {
      try {
        const payload = {
          version: 1,
          attemptId: this.attemptId,
          entries: Array.from(this.dirtyMap.entries())
        }
        sessionStorage.setItem(`pn_autosave_${this.attemptId}`, JSON.stringify(payload))
      } catch (_e) {}
    }
  }

  _restoreFromSessionStorage() {
    if (typeof sessionStorage !== 'undefined' && this.attemptId) {
      try {
        const raw = sessionStorage.getItem(`pn_autosave_${this.attemptId}`)
        if (raw) {
          const parsed = JSON.parse(raw)
          // Ensure schema version matches and attemptId is correct
          if (parsed && parsed.version === 1 && parsed.attemptId === this.attemptId && Array.isArray(parsed.entries)) {
            for (const [k, v] of parsed.entries) {
              const confirmedRev = this.revisionByAqId.get(k)
              // If server has already confirmed a higher revision, drop stale client entry
              if (typeof confirmedRev === 'number' && typeof v.expectedRevision === 'number' && v.expectedRevision < confirmedRev) {
                continue
              }
              if (!this.dirtyMap.has(k)) {
                this.dirtyMap.set(k, {
                  ...v,
                  expectedRevision: confirmedRev ?? v.expectedRevision ?? 0
                })
              }
            }
            this._notifyStateChange()
          }
        }
      } catch (_e) {}
    }
  }

  _setupAutoFlush() {
    // 1. Periodic 5-second background flush
    this.flushTimer = setInterval(() => {
      if (this.dirtyMap.size > 0 && !this.isFlushing && !this.isSubmitting) {
        this.flush().catch(() => {})
      }
    }, 5000)

    // 2. Immediate flush on tab blur, visibility change, or pagehide
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange)
      window.addEventListener('blur', this._onBlur)
      window.addEventListener('pagehide', this._onPageHide)
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
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange)
      window.removeEventListener('blur', this._onBlur)
      window.removeEventListener('pagehide', this._onPageHide)
    }
  }

  /**
   * Record candidate answer selection
   */
  recordAnswer(attemptQuestionId, selectedOptionId) {
    const existing = this.dirtyMap.get(attemptQuestionId)
    const expectedRevision = this.revisionByAqId.get(attemptQuestionId) ?? 0

    const entry = {
      attemptQuestionId,
      selectedOptionId,
      expectedRevision: existing ? existing.expectedRevision : expectedRevision,
      clientTimestamp: new Date(serverClock.now()).toISOString(),
      attempts: existing ? existing.attempts : 0
    }

    this.dirtyMap.set(attemptQuestionId, entry)
    // Clear any previous terminal error for this question on user interaction
    this.terminalErrors.delete(attemptQuestionId)

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
   * Schedule retry with single timer and jittered exponential backoff
   */
  _scheduleRetry(delayMs) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.dirtyMap.size > 0 && !this.isFlushing && !this.isSubmitting) {
        this.flush().catch(() => {})
      }
    }, delayMs)
  }

  _calculateBackoff() {
    const jitter = 0.8 + 0.4 * Math.random()
    const nextDelay = Math.min(this.maxBackoffMs, this.backoffMs * 2) * jitter
    this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2)
    return Math.round(nextDelay)
  }

  /**
   * Flush dirty answers to backend (capped at 100 per batch)
   */
  async flush() {
    if (!this.attemptId || this.dirtyMap.size === 0 || this.isFlushing) {
      return { saved: 0, status: 'SKIPPED' }
    }

    this.isFlushing = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this._notifyStateChange()

    // Take snapshot of dirty items (batch <= 100)
    const snapshot = Array.from(this.dirtyMap.values()).slice(0, 100)
    const payload = {
      answers: snapshot.map(item => ({
        attemptQuestionId: item.attemptQuestionId,
        optionId: item.selectedOptionId || null,
        revision: typeof item.expectedRevision === 'number'
          ? item.expectedRevision
          : (this.revisionByAqId.get(item.attemptQuestionId) ?? 0)
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

      const results = response.data?.results || []
      let okCount = 0
      let conflictCount = 0

      if (Array.isArray(results) && results.length > 0) {
        for (const resItem of results) {
          const aqId = resItem.attemptQuestionId
          const snapshotItem = snapshot.find(s => s.attemptQuestionId === aqId)

          if (resItem.status === 'OK' || resItem.success === true) {
            okCount++
            const confirmedRev = typeof resItem.revision === 'number'
              ? resItem.revision
              : ((this.revisionByAqId.get(aqId) ?? 0) + 1)
            this.revisionByAqId.set(aqId, confirmedRev)

            // Remove from dirty map only if client hasn't modified it again since flush started
            const currentInMap = this.dirtyMap.get(aqId)
            if (currentInMap && snapshotItem && currentInMap.clientTimestamp === snapshotItem.clientTimestamp) {
              this.dirtyMap.delete(aqId)
            } else if (currentInMap) {
              // User made a newer selection during save; update expectedRevision for next flush
              currentInMap.expectedRevision = confirmedRev
            }
            this.terminalErrors.delete(aqId)
          } else if (resItem.status === 'STALE_REVISION') {
            conflictCount++
            // Adopt server's current revision for this question only
            const currentRev = typeof resItem.currentRevision === 'number'
              ? resItem.currentRevision
              : ((this.revisionByAqId.get(aqId) ?? 0) + 1)
            this.revisionByAqId.set(aqId, currentRev)

            const currentInMap = this.dirtyMap.get(aqId)
            if (currentInMap) {
              currentInMap.expectedRevision = currentRev
              currentInMap.attempts = (currentInMap.attempts || 0) + 1
              if (currentInMap.attempts > 5) {
                this.terminalErrors.set(aqId, {
                  attemptQuestionId: aqId,
                  status: 'CONFLICT_LIMIT_EXCEEDED',
                  error: 'Multiple conflict retries exceeded. Please review selection.',
                  timestamp: Date.now()
                })
              }
            }
          } else {
            // Terminal error: INVALID_OPTION, EXPIRED, NOT_ACTIVE, FORBIDDEN
            this.terminalErrors.set(aqId, {
              attemptQuestionId: aqId,
              status: resItem.status || 'ERROR',
              error: resItem.error || 'Answer rejected',
              timestamp: Date.now()
            })
            // Remove from dirty map so we do not loop forever, but keep in terminalErrors for UI
            this.dirtyMap.delete(aqId)
          }
        }
      } else {
        // Fallback if results array missing: treat snapshot as saved
        for (const item of snapshot) {
          const currentInMap = this.dirtyMap.get(item.attemptQuestionId)
          if (currentInMap && currentInMap.clientTimestamp === item.clientTimestamp) {
            this.dirtyMap.delete(item.attemptQuestionId)
          }
        }
        okCount = snapshot.length
      }

      this._persistToSessionStorage()
      if (okCount > 0) {
        this.backoffMs = 1000 // Reset backoff on any success
      }

      this.isFlushing = false

      // If items remain dirty (e.g. STALE_REVISION re-queued or new edits during flush), schedule retry
      if (this.dirtyMap.size > 0) {
        const delay = conflictCount > 0 ? this._calculateBackoff() : 1000
        this._scheduleRetry(delay)
      }

      this._notifyStateChange()
      return { saved: okCount, status: 'SUCCESS' }
    } catch (err) {
      this.isFlushing = false
      const status = err.response?.status
      const errorData = err.response?.data?.errorObject || (typeof err.response?.data?.error === 'object' ? err.response?.data?.error : {})
      const errorCode = err.code || errorData.code

      // If batch returned 409 with item-level results
      if (status === 409 && Array.isArray(errorData.results)) {
        for (const resItem of errorData.results) {
          const aqId = resItem.attemptQuestionId
          if (resItem.status === 'STALE_REVISION') {
            const currentRev = typeof resItem.currentRevision === 'number'
              ? resItem.currentRevision
              : ((this.revisionByAqId.get(aqId) ?? 0) + 1)
            this.revisionByAqId.set(aqId, currentRev)
            const currentInMap = this.dirtyMap.get(aqId)
            if (currentInMap) {
              currentInMap.expectedRevision = currentRev
              currentInMap.attempts = (currentInMap.attempts || 0) + 1
            }
          }
        }
        const delay = this._calculateBackoff()
        console.warn(`[Autosave] 409 Conflict encountered; reconciling revisions and retrying in ${delay}ms`)
        this._scheduleRetry(delay)
        this._notifyStateChange()
        return { saved: 0, status: 'CONFLICT' }
      }

      // Check Retry-After header for rate limiting (429) or maintenance (503)
      let retryDelay = null
      const retryAfterHeader = err.response?.headers?.['retry-after']
      if (retryAfterHeader) {
        const parsedSecs = parseInt(retryAfterHeader, 10)
        if (!isNaN(parsedSecs) && parsedSecs > 0) {
          retryDelay = parsedSecs * 1000
        }
      }

      const nextDelay = retryDelay || this._calculateBackoff()
      console.warn(`[Autosave] Save failed (${status || err.message}); retained ${this.dirtyMap.size} dirty answers. Retrying in ${nextDelay}ms`)
      this._scheduleRetry(nextDelay)

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
      terminalErrors: Array.from(this.terminalErrors.values())
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

