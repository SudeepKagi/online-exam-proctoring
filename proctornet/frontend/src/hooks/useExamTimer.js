import { useState, useEffect, useRef } from 'react'

/**
 * useExamTimer Hook
 * Manages exam countdown timer, interval updates, and auto-submit callback on expiration.
 */
export function useExamTimer({ durationMinutes, endTime, onTimeUp, autoStart = true }) {
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp

  useEffect(() => {
    if (!autoStart) return

    let totalSeconds = 0
    if (endTime) {
      const remainingMs = new Date(endTime).getTime() - Date.now()
      totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
    } else if (durationMinutes) {
      totalSeconds = Math.floor(durationMinutes * 60)
    }

    if (totalSeconds <= 0) return

    setTimeLeft(totalSeconds)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(timerRef.current)
          onTimeUpRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [durationMinutes, endTime, autoStart])

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
