/**
 * rosterStore.js
 * External store for invigilator live roster utilizing useSyncExternalStore.
 * - Subscribes to Socket.IO 'roster:delta' batches
 * - Merges updates inside React.startTransition
 * - Eliminates window globals and CustomEvent buses (Task 8)
 */

import { useSyncExternalStore, startTransition } from 'react'
import { getSocket, initSocketClient } from './socketClient'

class RosterStoreManager {
  constructor() {
    this.examId = null
    this.rosterMap = new Map() // attemptId -> studentRecord
    this.summary = { total: 0, active: 0, submitted: 0, terminated: 0, ready: 0, flagged: 0, online: 0 }
    this.listeners = new Set()
    this.statusFilter = 'ALL'
    this.searchQuery = ''
    this.isListening = false
    this.snapshot = { items: [], summary: this.summary, filter: 'ALL', query: '' }
  }

  initExam(examId, initialRoster = [], initialSummary = null) {
    this.examId = examId
    this.rosterMap.clear()

    for (const item of initialRoster) {
      const key = item.attemptId || item.id
      if (key) {
        this.rosterMap.set(key, { ...item, attemptId: key })
      }
    }

    if (initialSummary) {
      this.summary = { ...initialSummary }
    }

    this._bindSocket(examId)
    this._recomputeSnapshot()
  }

  updateCandidate(attemptId, updates = {}) {
    startTransition(() => {
      const existing = this.rosterMap.get(attemptId)
      if (existing) {
        this.rosterMap.set(attemptId, {
          ...existing,
          ...updates
        })
        this._recomputeSnapshot()
      }
    })
  }

  _bindSocket(examId) {
    if (this.isListening) return
    const socket = getSocket() || initSocketClient()
    if (!socket) return

    socket.emit('inv:join', { examId })

    // Listen to coalesced 500ms roster deltas (Task 3 / 8)
    socket.on('roster:delta', (payload) => {
      if (payload.examId !== this.examId || !Array.isArray(payload.deltas)) return

      startTransition(() => {
        let changed = false
        for (const delta of payload.deltas) {
          if (!delta.attemptId) continue

          const existing = this.rosterMap.get(delta.attemptId)
          if (existing) {
            this.rosterMap.set(delta.attemptId, {
              ...existing,
              ...delta,
              flagCount: delta.flagCount !== undefined ? delta.flagCount : existing.flagCount,
              online: delta.online !== undefined ? delta.online : existing.online,
              status: delta.status || existing.status,
              answered: delta.answered !== undefined ? delta.answered : existing.answered
            })
            changed = true
          }
        }

        if (changed) {
          this._recomputeSnapshot()
        }
      })
    })

    this.isListening = true
  }

  setFilter(status) {
    this.statusFilter = status
    this._recomputeSnapshot()
  }

  setSearchQuery(q) {
    this.searchQuery = q.toLowerCase().trim()
    this._recomputeSnapshot()
  }

  updateSummary(summary) {
    this.summary = { ...this.summary, ...summary }
    this._recomputeSnapshot()
  }

  _recomputeSnapshot() {
    const all = Array.from(this.rosterMap.values())
    const query = this.searchQuery

    const filtered = all.filter((item) => {
      // 1. Status filter
      if (this.statusFilter !== 'ALL' && item.status !== this.statusFilter) {
        return false
      }

      // 2. Search query filter
      if (query) {
        const nameMatch = (item.name || '').toLowerCase().includes(query)
        const usnMatch = (item.usn || '').toLowerCase().includes(query)
        return nameMatch || usnMatch
      }

      return true
    })

    this.snapshot = {
      items: filtered,
      summary: this.summary,
      statusFilter: this.statusFilter,
      searchQuery: this.searchQuery,
      totalCount: all.length,
      filteredCount: filtered.length
    }

    this._notify()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => {
    return this.snapshot
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (e) {
        // ignore
      }
    }
  }

  cleanup() {
    this.rosterMap.clear()
    this.listeners.clear()
    this.isListening = false
  }
}

export const rosterStore = new RosterStoreManager()

export function useRosterStore() {
  return useSyncExternalStore(
    (callback) => rosterStore.subscribe(callback),
    rosterStore.getSnapshot,
    rosterStore.getSnapshot
  )
}
