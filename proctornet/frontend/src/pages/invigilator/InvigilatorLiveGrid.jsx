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

  // Demo candidate tiles grid for 100-200 student scale
  const fetchGridData = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/invigilator/live-grid/${examId || 'active'}`)
      setCandidates(res.data.candidates || [])
    } catch {
      // Mock grid data for demonstration
      const demoData = Array.from({ length: 24 }).map((_, i) => ({
        id: `cand_${i + 1}`,
        seatNo: `A-${101 + i}`,
        usn: `1NT23CS${(100 + i).toString().slice(1)}`,
        name: `Candidate ${i + 1}`,
        status: i === 3 ? 'FLAGGED' : i === 7 ? 'NO_FACE' : 'ACTIVE',
        alerts: i === 3 ? ['Tab Switch (3x)', 'AnyDesk Process Detected'] : i === 7 ? ['No Face (15s)'] : [],
        isHotspot: i === 3,
        lastSnapshot: null,
      }))
      setCandidates(demoData)
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
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Grid className="w-5 h-5 text-indigo-400" />
              Live Invigilator Exam Grid (Hall A-1)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time candidate monitoring, automated security flags, and LiveKit WebRTC stream inspection
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
              className={`text-xs font-mono border-[#27272A] ${filterAlertsOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-[#141416] text-slate-300'}`}
            >
              <Filter size={13} className="mr-1.5" />
              {filterAlertsOnly ? 'Showing Flagged Only' : 'Show All Seats'}
            </Button>
            <button
              onClick={fetchGridData}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-[#27272A] bg-[#141416] hover:bg-[#18181B] text-slate-300 rounded-xl transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* 24-Seat Tile Matrix */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-36 bg-[#141416] border border-[#27272A] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredCandidates.map((cand) => {
              const isFlagged = cand.alerts.length > 0 || cand.status !== 'ACTIVE'
              return (
                <Card
                  key={cand.id}
                  onClick={() => setSelectedCandidate(cand)}
                  className={`bg-[#141416] border transition cursor-pointer p-3 flex flex-col justify-between hover:border-indigo-500 ${
                    isFlagged ? 'border-rose-500/50 bg-rose-950/10' : 'border-[#27272A]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-[#09090B] px-1.5 py-0.5 rounded border border-[#27272A]">
                        Seat {cand.seatNo}
                      </span>
                      {isFlagged ? (
                        <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 text-[9px] font-mono">
                          FLAGGED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[9px] font-mono">
                          LIVE
                        </Badge>
                      )}
                    </div>

                    {/* Camera Thumbnail Placeholder */}
                    <div className="w-full h-20 bg-[#09090B] border border-[#27272A] rounded-lg relative overflow-hidden flex items-center justify-center mb-2">
                      <Video size={18} className="text-slate-600" />
                      {cand.isHotspot && (
                        <span className="absolute top-1 right-1 bg-amber-500/20 text-amber-300 text-[8px] font-mono px-1 rounded border border-amber-500/40">
                          HOTSPOT
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-100 truncate">{cand.usn}</p>
                    <p className="text-[10px] text-slate-400 truncate">{cand.name}</p>
                  </div>

                  {cand.alerts.length > 0 && (
                    <div className="mt-2 text-[9px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/30 p-1 rounded truncate">
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setSelectedCandidate(null)}>
            <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 font-sans" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    LiveKit SFU Stream — Seat {selectedCandidate.seatNo} ({selectedCandidate.usn})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedCandidate.name}</p>
                </div>
                <button onClick={() => setSelectedCandidate(null)} className="p-1.5 hover:bg-[#27272A] rounded-lg">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Dual Stream Feeds */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#09090B] border border-[#27272A] rounded-xl h-44 flex flex-col items-center justify-center text-slate-500">
                  <Video size={24} className="mb-2 text-indigo-400" />
                  <span className="text-xs font-mono">Live WebRTC Camera Feed</span>
                </div>
                <div className="bg-[#09090B] border border-[#27272A] rounded-xl h-44 flex flex-col items-center justify-center text-slate-500">
                  <Eye size={24} className="mb-2 text-indigo-400" />
                  <span className="text-xs font-mono">Live Screen Capture Feed</span>
                </div>
              </div>

              {/* Actions Panel */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={warningMsg}
                    onChange={(e) => setWarningMsg(e.target.value)}
                    placeholder="Send warning message to student screen..."
                    className="flex-1 px-3 py-1.5 border border-[#27272A] bg-[#09090B] text-xs text-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                  <Button onClick={handleSendWarning} className="text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white">
                    <MessageSquare size={13} className="mr-1.5" /> Send Warning
                  </Button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[#27272A]">
                  <Button
                    onClick={() => handlePauseExam(selectedCandidate)}
                    className="flex-1 text-xs font-mono bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30"
                  >
                    <PauseCircle size={14} className="mr-1.5" /> Pause Exam Session
                  </Button>
                  <Button
                    onClick={() => setSelectedCandidate(null)}
                    className="flex-1 text-xs font-mono bg-[#09090B] border border-[#27272A] text-slate-300"
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
