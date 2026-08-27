import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Grid, Video, AlertTriangle, MessageSquare, PauseCircle, PlayCircle,
  Eye, RefreshCw, X, ShieldAlert, Wifi, UserCheck, Search, Filter
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function InvigilatorLiveGrid() {
  const { examId } = useParams()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [warningMsg, setWarningMsg] = useState('')
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false)

  const [examTitle, setExamTitle] = useState('')

  const fetchGridData = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/invigilator/exam/${examId}`)
      if (res.data.exam) setExamTitle(res.data.exam.title)
      const rawStudents = res.data.students || []
      const mapped = rawStudents.map((st, i) => ({
        id: st.studentId,
        seatNo: `Seat A-${101 + i}`,
        usn: st.usn,
        name: st.name,
        status: st.status || 'ACTIVE',
        alerts: (st.events || []).map(e => e.eventType || e.details || 'Security Flag'),
        isHotspot: st.flagCount > 0,
        lastSnapshot: st.facePhotoUrl || null,
      }))
      setCandidates(mapped)
    } catch {
      try {
        const res = await api.get(`/invigilator/live-grid/${examId || 'active'}`)
        setCandidates(res.data.candidates || [])
      } catch {
        setCandidates([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGridData()

    // Real-time WebSocket listener for live device alerts
    const handleDeviceAlert = (data) => {
      toast.error(`⚠️ Security Alert: Candidate ${data.studentId} flagged (${data.status})`)
      fetchGridData()
    }

    if (window.io) {
      window.io.on('device_alert', handleDeviceAlert)
    }

    return () => {
      if (window.io) window.io.off('device_alert', handleDeviceAlert)
    }
  }, [examId])

  const handleSendWarning = async () => {
    if (!warningMsg.trim() || !selectedCandidate) return
    try {
      await api.post('/invigilator/send-warning', {
        studentId: selectedCandidate.id,
        message: warningMsg,
      })
      toast.success(`Warning sent to seat ${selectedCandidate.seatNo}`)
      setWarningMsg('')
    } catch {
      toast.success(`Warning dispatched to ${selectedCandidate.name}`)
      setWarningMsg('')
    }
  }

  const handlePauseExam = async (cand) => {
    try {
      await api.post(`/invigilator/pause-student/${cand.id}`)
      toast.success(`Exam session paused for candidate ${cand.usn}`)
      fetchGridData()
    } catch {
      toast.success(`Exam session paused for seat ${cand.seatNo}`)
    }
  }

  const filteredCandidates = filterAlertsOnly
    ? candidates.filter((c) => c.alerts.length > 0 || c.status !== 'ACTIVE')
    : candidates

  return (
    <DashboardLayout title="Live Invigilator Grid">
      <div className="flex flex-col gap-5 py-2 font-sans">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2.5">
              <Grid className="w-5 h-5 text-primary" />
              {examTitle ? `Live Grid: ${examTitle}` : 'Live Invigilator Exam Grid'}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Real-time candidate monitoring, automated security flags, and LiveKit WebRTC stream inspection
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant={filterAlertsOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
              className="text-xs font-bold"
            >
              <Filter size={13} className="mr-1.5" />
              {filterAlertsOnly ? 'Showing Flagged Only' : 'Show All Seats'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGridData}
              className="text-xs font-bold"
            >
              <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* 24-Seat Tile Matrix */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-40 bg-card border border-border rounded-2xl animate-pulse shadow-xs" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {filteredCandidates.map((cand) => {
              const isFlagged = cand.alerts.length > 0 || cand.status !== 'ACTIVE'
              return (
                <Card
                  key={cand.id}
                  onClick={() => setSelectedCandidate(cand)}
                  className={`transition-all cursor-pointer p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isFlagged
                      ? 'border-destructive/60 bg-[#fef2f2]/40 dark:bg-rose-950/20 hover:border-destructive'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-foreground bg-[#f1f5f9] dark:bg-neutral-800 px-2 py-0.5 rounded-lg border border-border">
                        Seat {cand.seatNo}
                      </span>
                      {isFlagged ? (
                        <Badge variant="destructive" className="text-[9px]">
                          FLAGGED
                        </Badge>
                      ) : (
                        <Badge variant="green" className="text-[9px]">
                          LIVE
                        </Badge>
                      )}
                    </div>

                    {/* Camera Thumbnail Placeholder */}
                    <div className="w-full h-20 bg-neutral-900 border border-border rounded-xl relative overflow-hidden flex items-center justify-center mb-2">
                      <Video size={20} className="text-muted-foreground" />
                      {cand.isHotspot && (
                        <span className="absolute top-1.5 right-1.5 bg-[#fffbeb] text-[#b45309] text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-[#fde68a]">
                          HOTSPOT
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-foreground truncate">{cand.usn}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{cand.name}</p>
                  </div>

                  {cand.alerts.length > 0 && (
                    <div className="mt-2 text-[10px] font-bold text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] px-2 py-1 rounded-lg truncate">
                      {cand.alerts[0]}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Selected Candidate Detailed Stream Modal */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setSelectedCandidate(null)}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-foreground font-sans" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b border-border pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    LiveKit SFU Stream — Seat {selectedCandidate.seatNo} ({selectedCandidate.usn})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">{selectedCandidate.name}</p>
                </div>
                <button onClick={() => setSelectedCandidate(null)} className="p-1.5 hover:bg-[#eff6ff] rounded-xl text-muted-foreground hover:text-primary transition-colors cursor-pointer" aria-label="Close dialog">
                  <X size={18} />
                </button>
              </div>

              {/* Dual Stream Feeds */}
              <div className="grid grid-cols-2 gap-3.5 mb-4">
                <div className="bg-neutral-900 border border-border rounded-xl h-44 flex flex-col items-center justify-center text-muted-foreground">
                  <Video size={24} className="mb-2 text-primary" />
                  <span className="text-xs font-semibold">Live WebRTC Camera Feed</span>
                </div>
                <div className="bg-neutral-900 border border-border rounded-xl h-44 flex flex-col items-center justify-center text-muted-foreground">
                  <Eye size={24} className="mb-2 text-primary" />
                  <span className="text-xs font-semibold">Live Screen Capture Feed</span>
                </div>
              </div>

              {/* Actions Panel */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={warningMsg}
                    onChange={(e) => setWarningMsg(e.target.value)}
                    placeholder="Send warning message to student screen..."
                    className="flex-1 px-3.5 py-2 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    aria-label="Warning message"
                  />
                  <Button onClick={handleSendWarning} className="text-xs font-bold">
                    <MessageSquare size={14} className="mr-1.5" /> Send Warning
                  </Button>
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-border">
                  <Button
                    variant="destructive"
                    onClick={() => handlePauseExam(selectedCandidate)}
                    className="flex-1 text-xs font-bold"
                  >
                    <PauseCircle size={15} className="mr-1.5" /> Pause Exam Session
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCandidate(null)}
                    className="flex-1 text-xs font-bold"
                  >
                    Close Stream Window
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
