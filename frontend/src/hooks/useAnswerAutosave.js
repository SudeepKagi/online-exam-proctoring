import { useRef, useEffect, useCallback, useState } from 'react'
import { apiClient } from '@/lib/apiClient'

/**
 * useAnswerAutosave Hook
 * High-concurrency autosave engine using a dirtyAnswers ref map.
 * Flushes dirty answers via batch PUT /attempts/:id/answers every 5s, on visibilitychange, and before submit.
 */
export function useAnswerAutosave({ attemptId, onFlushSuccess, onFlushError } = {}) {
  const dirtyAnswers = useRef({})
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const isFlushingRef = useRef(false)

  // Restore offline queued answers on mount
  useEffect(() => {
    if (!attemptId) return
    try {
      const cached = localStorage.getItem(`pn_offline_answers_${attemptId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        dirtyAnswers.current = { ...parsed, ...dirtyAnswers.current }
      }
    } catch (_) {}
  }, [attemptId])

  const recordAnswer = useCallback((questionId, selectedOptionIndex, isBookmarked = false) => {
    if (!questionId) return
    dirtyAnswers.current[questionId] = { selectedOptionIndex, isBookmarked }
    if (attemptId) {
      try {
        localStorage.setItem(`pn_offline_answers_${attemptId}`, JSON.stringify(dirtyAnswers.current))
      } catch (_) {}
    }
  }, [attemptId])

  const flushDirtyAnswers = useCallback(async () => {
    if (!attemptId || isFlushingRef.current) return
    const pendingKeys = Object.keys(dirtyAnswers.current)
    if (pendingKeys.length === 0) return

    const snapshot = { ...dirtyAnswers.current }
    isFlushingRef.current = true
    setIsSaving(true)

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
      if (onFlushSuccess) onFlushSuccess(now)
    } catch (err) {
      if (onFlushError) onFlushError(err)
    } finally {
      isFlushingRef.current = false
      setIsSaving(false)
    }
  }, [attemptId, onFlushSuccess, onFlushError])

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
      if (Object.keys(dirtyAnswers.current).length > 0) {
        flushDirtyAnswers()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
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
    isSaving,
    lastSavedAt,
    hasDirtyAnswers: () => Object.keys(dirtyAnswers.current).length > 0,
  }
}

export default useAnswerAutosave
