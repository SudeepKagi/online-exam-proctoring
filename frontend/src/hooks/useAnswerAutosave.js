import { useRef, useEffect, useCallback, useState } from 'react'
import { apiClient } from '@/lib/apiClient'

/**
 * useAnswerAutosave Hook
 * High-concurrency autosave engine using a dirtyAnswers ref map and persistent offline queue.
 * Supports:
 * - Visible syncStatus: 'SAVED' | 'SAVING' | 'OFFLINE'
 * - Exponential backoff on 500/network errors (1s -> 2s -> 4s -> 8s -> 16s)
 * - Automatic flush on network online event and visibilitychange
 * - Local persistence in localStorage with key pn_offline_answers_{attemptId}
 */
export function useAnswerAutosave({ attemptId, onFlushSuccess, onFlushError, onSyncSuccess } = {}) {
  const dirtyAnswers = useRef({})
  const [syncStatus, setSyncStatus] = useState('SAVED') // 'SAVED' | 'SAVING' | 'OFFLINE'
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const isFlushingRef = useRef(false)
  const backoffMsRef = useRef(1000)
  const retryTimerRef = useRef(null)
  const debounceFlushRef = useRef(null)
  const hadOfflineFailuresRef = useRef(false)

  // Restore offline queued answers on mount
  useEffect(() => {
    if (!attemptId) return
    try {
      const cached = localStorage.getItem(`pn_offline_answers_${attemptId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          dirtyAnswers.current = { ...parsed, ...dirtyAnswers.current }
          setSyncStatus('OFFLINE')
          hadOfflineFailuresRef.current = true
        }
      }
    } catch (_) {}

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setSyncStatus('OFFLINE')
      hadOfflineFailuresRef.current = true
    }
  }, [attemptId])

  const flushDirtyAnswers = useCallback(async () => {
    if (!attemptId || isFlushingRef.current) return
    const pendingKeys = Object.keys(dirtyAnswers.current)
    if (pendingKeys.length === 0) {
      if (syncStatus === 'SAVING') setSyncStatus('SAVED')
      return
    }

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setSyncStatus('OFFLINE')
      hadOfflineFailuresRef.current = true
      return
    }

    const snapshot = { ...dirtyAnswers.current }
    isFlushingRef.current = true
    setSyncStatus('SAVING')

    try {
      await apiClient.put(`/attempts/${attemptId}/answers`, snapshot)

      // Evict successfully synced keys
      for (const qId of Object.keys(snapshot)) {
        if (dirtyAnswers.current[qId] === snapshot[qId]) {
          delete dirtyAnswers.current[qId]
        }
      }

      try {
        if (Object.keys(dirtyAnswers.current).length === 0) {
          localStorage.removeItem(`pn_offline_answers_${attemptId}`)
        } else {
          localStorage.setItem(`pn_offline_answers_${attemptId}`, JSON.stringify(dirtyAnswers.current))
        }
      } catch (_) {}

      const now = new Date()
      setLastSavedAt(now)
      setSyncStatus('SAVED')
      backoffMsRef.current = 1000
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }

      if (hadOfflineFailuresRef.current) {
        hadOfflineFailuresRef.current = false
        if (onSyncSuccess) onSyncSuccess(now)
      }

      if (onFlushSuccess) onFlushSuccess(now)
    } catch (err) {
      // Retain dirtyAnswers in memory & localStorage!
      const status = err.response?.status
      const isRecoverableError = !status || status >= 500 || status === 408 || status === 429
      
      if (isRecoverableError || (typeof window !== 'undefined' && !window.navigator.onLine)) {
        setSyncStatus('OFFLINE')
        hadOfflineFailuresRef.current = true
        // Exponential backoff
        backoffMsRef.current = Math.min(16000, backoffMsRef.current * 2)
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        retryTimerRef.current = setTimeout(() => {
          flushDirtyAnswers()
        }, backoffMsRef.current)
      }

      if (onFlushError) onFlushError(err)
    } finally {
      isFlushingRef.current = false
    }
  }, [attemptId, syncStatus, onFlushSuccess, onFlushError, onSyncSuccess])

  const recordAnswer = useCallback((questionId, selectedOptionIndex, isBookmarked = false) => {
    if (!questionId) return
    dirtyAnswers.current[questionId] = { selectedOptionIndex, isBookmarked }
    if (attemptId) {
      try {
        localStorage.setItem(`pn_offline_answers_${attemptId}`, JSON.stringify(dirtyAnswers.current))
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setSyncStatus('OFFLINE')
      hadOfflineFailuresRef.current = true
    } else {
      setSyncStatus('SAVING')
      if (debounceFlushRef.current) clearTimeout(debounceFlushRef.current)
      debounceFlushRef.current = setTimeout(() => {
        flushDirtyAnswers()
      }, 400)
    }
  }, [attemptId, flushDirtyAnswers])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceFlushRef.current) clearTimeout(debounceFlushRef.current)
    }
  }, [])

  // Periodic batch flush every 5 seconds if dirty
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.keys(dirtyAnswers.current).length > 0) {
        flushDirtyAnswers()
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [flushDirtyAnswers])

  // Sync queued answers when network resumes (online event)
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('SAVING')
      backoffMsRef.current = 1000
      flushDirtyAnswers()
    }
    const handleOffline = () => {
      setSyncStatus('OFFLINE')
      hadOfflineFailuresRef.current = true
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [flushDirtyAnswers])

  // Flush on visibilitychange (e.g. background tab or app switch)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && Object.keys(dirtyAnswers.current).length > 0) {
        flushDirtyAnswers()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [flushDirtyAnswers])

  return {
    recordAnswer,
    flushDirtyAnswers,
    syncStatus,
    isSaving: syncStatus === 'SAVING',
    isOffline: syncStatus === 'OFFLINE',
    lastSavedAt,
    hasDirtyAnswers: () => Object.keys(dirtyAnswers.current).length > 0,
  }
}

export default useAnswerAutosave
