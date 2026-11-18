import React, { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { getSocket } from '@/lib/socketClient'
import { useAuth } from '@/context/AuthContext'
import CandidateCard from '@/components/invigilator/CandidateCard'
import ViolationStream from '@/components/invigilator/ViolationStream'
import SnapshotZoomModal from '@/components/invigilator/SnapshotZoomModal'
import CandidateAuditSheet from '@/components/invigilator/CandidateAuditSheet'
import ConsoleKpiBar from '@/components/invigilator/ConsoleKpiBar'
import ConsoleToolbar from '@/components/invigilator/ConsoleToolbar'
import { Loader2 } from 'lucide-react'

export default function LiveConsolePage() {
  const { user } = useAuth()
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [candidates, setCandidates] = useState([])
  const [violations, setViolations] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [auditHistory, setAuditHistory] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [zoomSnapshot, setZoomSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    api.get('/exams').then(res => {
      const list = ensureArray(res.data?.exams || res.data)
      setExams(list)
      const assignedExamId = user?.profileMetadata?.examId
      if (assignedExamId && list.some(e => e.id === assignedExamId)) {
        setSelectedExamId(assignedExamId)
      } else if (list.length > 0) {
        setSelectedExamId(list[0].id)
      }
    }).catch(() => {})
  }, [user])

  const loadLiveFeed = async (examId) => {
    if (!examId) return
    setLoading(true)
    try {
      const res = await api.get(`/proctoring/exams/${examId}/live`)
      setCandidates(ensureArray(res.data?.candidates))
      setViolations(ensureArray(res.data?.violations))
    } catch (_) {
      try {
        const attRes = await api.get(`/exams/${examId}/attempts`)
        const attList = ensureArray(attRes.data?.attempts || attRes.data)
        setCandidates(attList.map(a => ({
          studentId: a.studentId || a.id,
          attemptId: a.id,
          studentName: a.studentName || a.student?.fullName || 'Candidate',
          institutionId: a.student?.institutionId || '—',
          attemptStatus: a.status || 'IN_PROGRESS',
          violationCount: 0,
          latestSnapshotUrl: null,
          lastActiveAt: a.startedAt
        })))
      } catch (_) {}
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedExamId) loadLiveFeed(selectedExamId)
  }, [selectedExamId])

  useEffect(() => {
    if (!selectedExamId) return
    const socket = getSocket()
    socket.emit('inv:join', { examId: selectedExamId })

    const handleViolation = (data) => {
      if (!data) return
      setViolations(prev => {
        if (data.id && prev.some(v => v.id === data.id)) return prev
        return [data, ...prev.slice(0, 49)]
      })
      setCandidates(prev => prev.map(c => {
        if (c.attemptId === data.attemptId || c.studentId === data.studentId) {
          return {
            ...c,
            violationCount: (c.violationCount || 0) + 1,
            latestSnapshotUrl: data.snapshotDataUrl || c.latestSnapshotUrl,
            lastActiveAt: data.createdAt || new Date().toISOString()
          }
        }
        return c
      }))
    }

    const handleAttemptUpdated = (data) => {
      if (!data) return
      setCandidates(prev => prev.map(c => {
        if (c.attemptId === data.attemptId || c.studentId === data.studentId) {
          return {
            ...c,
            attemptStatus: data.attemptStatus || c.attemptStatus,
            violationCount: data.violationCount ?? c.violationCount,
            latestSnapshotUrl: data.latestSnapshotUrl || c.latestSnapshotUrl,
            lastActiveAt: data.lastActiveAt || c.lastActiveAt,
            faceStatus: data.faceStatus || c.faceStatus,
            faceVerified: data.faceVerified ?? c.faceVerified,
            invigilatorApproved: data.invigilatorApproved ?? c.invigilatorApproved
          }
        }
        return c
      }))
    }

    const handleIdentityUpdated = (data) => {
      if (!data) return
      setCandidates(prev => prev.map(c => {
        if (c.attemptId === data.attemptId || c.studentId === data.studentId) {
          return {
            ...c,
            faceStatus: data.faceStatus || (data.status === 'APPROVED' ? 'APPROVED' : 'REJECTED'),
            faceVerified: data.status === 'APPROVED' || Boolean(data.faceVerified),
            invigilatorApproved: data.status === 'APPROVED' || Boolean(data.invigilatorApproved)
          }
        }
        return c
      }))
    }

    socket.on('proctoring:violation', handleViolation)
    socket.on('student:violation', handleViolation)
    socket.on('attempt:updated', handleAttemptUpdated)
    socket.on('student:identity_pending', handleAttemptUpdated)
    socket.on('identity:approved', handleIdentityUpdated)
    socket.on('identity:rejected', handleIdentityUpdated)

    return () => {
      socket.off('proctoring:violation', handleViolation)
      socket.off('student:violation', handleViolation)
      socket.off('attempt:updated', handleAttemptUpdated)
      socket.off('student:identity_pending', handleAttemptUpdated)
      socket.off('identity:approved', handleIdentityUpdated)
      socket.off('identity:rejected', handleIdentityUpdated)
    }
  }, [selectedExamId])

  const handleInspectHistory = async (candidate) => {
    setSelectedCandidate(candidate)
    setSheetOpen(true)
    if (candidate.attemptId) {
      try {
        const res = await api.get(`/proctoring/attempts/${candidate.attemptId}/logs`)
        setAuditHistory(ensureArray(res.data?.logs || res.data))
      } catch (_) {
        setAuditHistory([])
      }
    }
  }

  const handleToggleSuspend = async (candidate) => {
    if (!candidate.attemptId) return
    setActionLoading(true)
    const isSusp = candidate.attemptStatus === 'SUSPENDED'
    const endpoint = isSusp ? `/attempts/${candidate.attemptId}/resume` : `/attempts/${candidate.attemptId}/suspend`
    try {
      await api.post(endpoint)
      const nextStatus = isSusp ? 'IN_PROGRESS' : 'SUSPENDED'
      setCandidates(prev => prev.map(c => c.attemptId === candidate.attemptId ? { ...c, attemptStatus: nextStatus } : c))
      if (selectedCandidate?.attemptId === candidate.attemptId) {
        setSelectedCandidate(prev => ({ ...prev, attemptStatus: nextStatus }))
      }
    } catch (err) {
      alert(errorMessage(err, 'Failed to update candidate state'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleTerminateCandidate = async (candidate) => {
    if (!candidate.attemptId) return
    const confirmed = window.confirm(`Are you sure you want to terminate the exam attempt for ${candidate.studentName || 'this student'}? This action is irreversible.`)
    if (!confirmed) return
    setActionLoading(true)
    try {
      await api.post(`/attempts/${candidate.attemptId}/terminate`, { reason: 'Invigilator manual termination' })
      setCandidates(prev => prev.map(c => c.attemptId === candidate.attemptId ? { ...c, attemptStatus: 'SUBMITTED' } : c))
      if (selectedCandidate?.attemptId === candidate.attemptId) {
        setSelectedCandidate(prev => ({ ...prev, attemptStatus: 'SUBMITTED' }))
      }
    } catch (err) {
      alert(errorMessage(err, 'Failed to terminate candidate attempt'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveIdentity = async (candidate) => {
    if (!candidate.attemptId) return
    setActionLoading(true)
    try {
      await api.post(`/attempts/${candidate.attemptId}/approve-identity`)
      setCandidates(prev => prev.map(c => c.attemptId === candidate.attemptId ? {
        ...c,
        faceVerified: true,
        faceStatus: 'APPROVED',
        invigilatorApproved: true
      } : c))
      if (selectedCandidate?.attemptId === candidate.attemptId) {
        setSelectedCandidate(prev => ({
          ...prev,
          faceVerified: true,
          faceStatus: 'APPROVED',
          invigilatorApproved: true
        }))
      }
    } catch (err) {
      alert(errorMessage(err, 'Failed to approve candidate identity'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectIdentity = async (candidate) => {
    if (!candidate.attemptId) return
    setActionLoading(true)
    try {
      await api.post(`/attempts/${candidate.attemptId}/reject-identity`)
      setCandidates(prev => prev.map(c => c.attemptId === candidate.attemptId ? {
        ...c,
        faceVerified: false,
        faceStatus: 'REJECTED'
      } : c))
      if (selectedCandidate?.attemptId === candidate.attemptId) {
        setSelectedCandidate(prev => ({
          ...prev,
          faceVerified: false,
          faceStatus: 'REJECTED'
        }))
      }
    } catch (err) {
      alert(errorMessage(err, 'Failed to reject candidate identity'))
    } finally {
      setActionLoading(false)
    }
  }

  const pendingIdentityCount = candidates.filter(c =>
    c.faceStatus === 'PENDING_APPROVAL' || c.faceStatus === 'NO_REFERENCE' || (!c.faceVerified && c.faceStatus && c.faceStatus !== 'MATCH' && c.faceStatus !== 'APPROVED')
  ).length

  const filtered = candidates
    .filter(c => {
      if (filter === 'IDENTITY_QUEUE') {
        return c.faceStatus === 'PENDING_APPROVAL' || c.faceStatus === 'NO_REFERENCE' || (!c.faceVerified && c.faceStatus && c.faceStatus !== 'MATCH' && c.faceStatus !== 'APPROVED')
      }
      if (filter === 'NEEDS_ATTENTION') return (c.violationCount > 0) || c.faceStatus === 'PENDING_APPROVAL' || c.attemptStatus === 'SUSPENDED'
      if (filter === 'FLAGGED') return c.violationCount > 0
      if (filter === 'SUSPENDED') return c.attemptStatus === 'SUSPENDED'
      if (filter === 'IN_PROGRESS') return c.attemptStatus === 'IN_PROGRESS'
      return true
    })
    .sort((a, b) => (b.violationCount || 0) - (a.violationCount || 0))

  return (
    <DashboardShell title="Live Proctoring Console">
      <ConsoleKpiBar candidates={candidates} />

      <ConsoleToolbar
        exams={exams}
        selectedExamId={selectedExamId}
        onSelectExamId={setSelectedExamId}
        filter={filter}
        onSelectFilter={setFilter}
        pendingIdentityCount={pendingIdentityCount}
      />

      {/* Split View: Left (Feeds Grid) & Right (Violation Stream) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4 font-sans items-start">
        <div className="lg:col-span-8 xl:col-span-9">
          {loading ? (
            <div className="py-20 text-center text-xs text-[#554e7b] bg-white rounded-[16px] border-0 shadow-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#5266eb]" /> Loading live candidate telemetry...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#554e7b] bg-white rounded-[16px] border-0 shadow-xs">
              No active candidates match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filtered.map(c => (
                <CandidateCard
                  key={c.studentId || c.attemptId}
                  candidate={c}
                  onInspectHistory={handleInspectHistory}
                  onToggleSuspend={handleToggleSuspend}
                  onZoomSnapshot={setZoomSnapshot}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 xl:col-span-3 h-[78vh] sticky top-4">
          <ViolationStream violations={violations} onZoomSnapshot={setZoomSnapshot} />
        </div>
      </div>

      <SnapshotZoomModal
        isOpen={!!zoomSnapshot}
        onClose={() => setZoomSnapshot(null)}
        snapshot={zoomSnapshot}
      />

      <CandidateAuditSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        candidate={selectedCandidate}
        auditHistory={auditHistory}
        onToggleSuspend={handleToggleSuspend}
        onTerminate={handleTerminateCandidate}
        onApproveIdentity={handleApproveIdentity}
        onRejectIdentity={handleRejectIdentity}
        actionLoading={actionLoading}
      />
    </DashboardShell>
  )
}
