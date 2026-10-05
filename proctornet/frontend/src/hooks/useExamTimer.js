import { useState, useEffect, useRef } from 'react'
import { serverClock } from '@/lib/serverClock'

/**
 * useExamTimer Hook (Q3.3)
 * - Timer computed from expiresAt using serverClock offset
 * - Recomputes from deadline every tick (no background tab drift)
 * - Auto-submits at 0
 * - Handles "already past" upon initialization
 */
export function useExamTimer({ expiresAt, endTime, durationMinutes, onTimeUp, autoStart = true }) {
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp

  useEffect(() => {
    if (!autoStart) return

    const targetDeadline = expiresAt || endTime

    // Function to calculate authoritative remaining seconds using serverClock offset
    const computeRemainingSeconds = () => {
      if (targetDeadline) {
        const remMs = serverClock.getRemainingMs(targetDeadline)
        return Math.max(0, Math.floor(remMs / 1000))
      }
      return null
    }

    if (targetDeadline) {
      const initialSeconds = computeRemainingSeconds()

      if (initialSeconds <= 0) {
        // Deadline is already in the past (Q3.3)
        setTimeLeft(0)
        onTimeUpRef.current?.()
        return
      }

      setTimeLeft(initialSeconds)

      timerRef.current = setInterval(() => {
        // Recompute from deadline every tick to eliminate background tab drift (Q3.3)
        const rem = computeRemainingSeconds()
        setTimeLeft(rem)

        if (rem <= 0) {
          if (timerRef.current) clearInterval(timerRef.current)
          onTimeUpRef.current?.()
        }
      }, 1000)
    } else if (durationMinutes) {
      // Fallback if no target deadline
      let seconds = Math.floor(durationMinutes * 60)
      setTimeLeft(seconds)

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            onTimeUpRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [expiresAt, endTime, durationMinutes, autoStart])

  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return '--:--'
    const pad = (n) => String(n).padStart(2, '0')
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  }

  return {
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isUrgent: timeLeft !== null && timeLeft <= 300, // <= 5 minutes
    isCritical: timeLeft !== null && timeLeft <= 60  // <= 1 minute
  }
}
