import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useExamTimer Hook
 * Realtime countdown timer synchronized with server clock via serverOffsetMs.
 * Fires callbacks for:
 * - 5 minutes remaining (300s)
 * - 1 minute remaining (60s)
 * - Expiration (0s)
 */
export function useExamTimer({
  expiresAt,
  serverOffsetMs = 0,
  durationMinutes = 60,
  onExpire,
  on5MinWarning,
  on1MinWarning,
  enabled = true
} = {}) {
  const getRemainingSeconds = useCallback(() => {
    if (!enabled || !expiresAt) return 0
    const expiry = new Date(expiresAt).getTime()
    const now = Date.now() + (serverOffsetMs || 0)
    return Math.max(0, Math.floor((expiry - now) / 1000))
  }, [expiresAt, serverOffsetMs, enabled])

  const [remaining, setRemaining] = useState(getRemainingSeconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const on5MinRef = useRef(on5MinWarning)
  on5MinRef.current = on5MinWarning
  const on1MinRef = useRef(on1MinWarning)
  on1MinRef.current = on1MinWarning

  const firedExpireRef = useRef(false)
  const warned5MinRef = useRef(false)
  const warned1MinRef = useRef(false)

  useEffect(() => {
    if (!enabled || !expiresAt) {
      setRemaining(0)
      return
    }
    firedExpireRef.current = false
    warned5MinRef.current = false
    warned1MinRef.current = false

    const targetTimestamp = new Date(expiresAt).getTime()

    const updateTimer = () => {
      const now = Date.now() + (serverOffsetMs || 0)
      const diff = Math.max(0, Math.floor((targetTimestamp - now) / 1000))
      setRemaining(diff)

      if (diff <= 300 && diff > 60 && !warned5MinRef.current) {
        warned5MinRef.current = true
        if (on5MinRef.current) on5MinRef.current()
      }

      if (diff <= 60 && diff > 0 && !warned1MinRef.current) {
        warned1MinRef.current = true
        if (on1MinRef.current) on1MinRef.current()
      }

      if (diff <= 0 && !firedExpireRef.current) {
        firedExpireRef.current = true
        if (onExpireRef.current) {
          onExpireRef.current()
        }
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, serverOffsetMs, durationMinutes, enabled])

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
