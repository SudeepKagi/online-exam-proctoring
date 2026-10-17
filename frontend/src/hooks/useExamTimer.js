import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useExamTimer Hook
 * Realtime countdown timer immune to background tab throttling via Date.now() delta.
 * Synchronizes against server expiresAt timestamp.
 */
export function useExamTimer({ expiresAt, durationMinutes = 60, onExpire } = {}) {
  const getRemainingSeconds = useCallback(() => {
    if (expiresAt) {
      const expiry = new Date(expiresAt).getTime()
      return Math.max(0, Math.floor((expiry - Date.now()) / 1000))
    }
    return Math.max(0, durationMinutes * 60)
  }, [expiresAt, durationMinutes])

  const [remaining, setRemaining] = useState(getRemainingSeconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    const targetTimestamp = expiresAt
      ? new Date(expiresAt).getTime()
      : Date.now() + durationMinutes * 60 * 1000

    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((targetTimestamp - now) / 1000))
      setRemaining(diff)

      if (diff <= 0 && !firedRef.current) {
        firedRef.current = true
        if (onExpireRef.current) {
          onExpireRef.current()
        }
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, durationMinutes])

  const formatTime = () => {
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const seconds = remaining % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return {
    remaining,
    formatTime,
    isExpired: remaining <= 0,
    isLowTime: remaining > 0 && remaining <= 300,
  }
}

export default useExamTimer
