import { useState, useEffect } from 'react'
import { getSocket } from '@/lib/socketClient'

export function restoreAnswers(serverAnswers, attemptId) {
  const restored = {}, restoredBm = {}
  if (Array.isArray(serverAnswers)) {
    serverAnswers.forEach(a => {
      if (!a.questionId) return
      if (a.selectedOptionIndex !== null && a.selectedOptionIndex !== undefined) restored[a.questionId] = a.selectedOptionIndex
      if (a.isBookmarked) restoredBm[a.questionId] = true
    })
  }
  try {
    const cached = attemptId && localStorage.getItem(`pn_offline_answers_${attemptId}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      Object.keys(parsed).forEach(qId => {
        if (parsed[qId]?.selectedOptionIndex !== undefined) restored[qId] = parsed[qId].selectedOptionIndex
      })
    }
  } catch (_) {}
  return { restored, restoredBm }
}

export function useArenaSocketAndTab({ examId, attemptId, onTerminated, initialSuspended = false }) {
  const [isSuspended, setIsSuspended] = useState(initialSuspended)
  const [isDuplicateTab, setIsDuplicateTab] = useState(false)

  // BroadcastChannel for Multi-Tab / Duplicate Session Protection
  useEffect(() => {
    if (!examId || typeof window === 'undefined' || !window.BroadcastChannel) return
    const channel = new BroadcastChannel('proctornet_active_exam')
    const mySessionId = Math.random().toString(36).substring(2)

    channel.postMessage({ type: 'CHECK_ACTIVE_TAB', examId, sessionId: mySessionId })

    const handleMessage = (event) => {
      const data = event.data
      if (!data || data.examId !== examId) return
      if (data.type === 'CHECK_ACTIVE_TAB' && data.sessionId !== mySessionId) {
        channel.postMessage({ type: 'TAB_ACTIVE', examId, sessionId: mySessionId })
      } else if (data.type === 'TAB_ACTIVE' && data.sessionId !== mySessionId) {
        setIsDuplicateTab(true)
      }
    }

    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [examId])

  // Socket sync for suspended, resumed, and terminated events
  useEffect(() => {
    if (!attemptId) return
    const socket = getSocket()
    socket.emit('attempt:join', { attemptId })
    const onSusp = () => setIsSuspended(true)
    const onRes = () => setIsSuspended(false)
    const onTerm = (data) => {
      if (onTerminated) {
        onTerminated(data?.reason === 'MAX_VIOLATIONS_EXCEEDED'
          ? 'Your examination was terminated because maximum violations (3/3) were exceeded.'
          : 'Your examination was terminated by an invigilator.')
      }
    }
    socket.on('attempt:suspended', onSusp)
      .on('attempt:resumed', onRes)
      .on('attempt:terminated', onTerm)
    return () => {
      socket.off('attempt:suspended', onSusp)
        .off('attempt:resumed', onRes)
        .off('attempt:terminated', onTerm)
    }
  }, [attemptId, onTerminated])

  return { isSuspended, setIsSuspended, isDuplicateTab }
}
