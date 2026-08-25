import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Search, RefreshCw, Eye, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function SeverityBadge({ severity }) {
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    return <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono text-[10px]">{severity}</Badge>
  }
  if (severity === 'MEDIUM') {
    return <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]">{severity}</Badge>
  }
  return <Badge variant="outline" className="text-slate-400 border-[#27272A] bg-[#09090B] font-mono text-[10px]">{severity || 'LOW'}</Badge>
}

const EVENT_LABELS = {
  tab_switch: 'Tab Switch',
  window_blur: 'Window Blur',
  fullscreen_exit: 'Fullscreen Exit',
  multiple_faces: 'Multiple Faces',
  no_face: 'No Face Detected',
  face_mismatch: 'Face Mismatch',
  keyboard_shortcut: 'Keyboard Shortcut',
  copy_attempt: 'Copy Attempt',
}

export default function AdminViolations() {
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(null)

  const fetchViolations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/violations')
      setViolations(res.data.violations || res.data || [])
    } catch (err) {
      console.error('Failed to load violations', err)
      toast.error(err.response?.data?.error || 'Failed to load violations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchViolations()
  }, [])

  const filtered = violations.filter((v) => {
    const matchSearch =
      (v.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.examTitle || '').toLowerCase().includes(search.toLowerCase())
    const matchSeverity = !filterSeverity || v.severity === filterSeverity
    const matchType = !filterType || v.eventType === filterType
    return matchSearch && matchSeverity && matchType
  })

  const stats = {
    total: violations.length,
    high: violations.filter((v) => ['HIGH', 'CRITICAL'].includes(v.severity)).length,
    medium: violations.filter((v) => v.severity === 'MEDIUM').length,
    low: violations.filter((v) => v.severity === 'LOW').length,
  }

  return (
    <DashboardLayout title="Violations">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Violations & Security Flags</h1>
            <p className="text-xs text-slate-400 mt-0.5">Real-time proctoring security events and candidate violation audits</p>
          </div>
          <button
            onClick={fetchViolations}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono border border-[#27272A] bg-[#141416] hover:bg-[#18181B] text-slate-300 rounded-xl transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-[#141416] border-[#27272A] p-4 shadow-xl">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Total Flags</p>
            <p className="text-2xl font-bold font-mono text-slate-100 mt-1">{stats.total}</p>
          </Card>
          <Card className="bg-[#141416] border-[#27272A] p-4 shadow-xl">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Critical / High</p>
            <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{stats.high}</p>
          </Card>
          <Card className="bg-[#141416] border-[#27272A] p-4 shadow-xl">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Medium Flags</p>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{stats.medium}</p>
          </Card>
          <Card className="bg-[#141416] border-[#27272A] p-4 shadow-xl">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Low Flags</p>
            <p className="text-2xl font-bold font-mono text-slate-400 mt-1">{stats.low}</p>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate or exam..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#27272A] bg-[#141416] text-xs text-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-1.5 border border-[#27272A] bg-[#141416] text-xs text-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Severities</option>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-[#27272A] bg-[#141416] text-xs text-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Flag Types</option>
              {Object.entries(EVENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 font-sans" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
                <h3 className="text-base font-bold text-slate-100">Violation Event Snapshot</h3>
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-[#27272A] rounded-lg">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {selected.cameraFrameUrl && (
                  <img src={selected.cameraFrameUrl} alt="Camera frame" className="w-full rounded-xl object-cover max-h-48 border border-[#27272A]" />
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ['Student Name', selected.studentName || 'N/A'],
                    ['Candidate USN', selected.studentUsn || 'N/A'],
                    ['Exam Session', selected.examTitle || 'N/A'],
                    ['Flag Type', EVENT_LABELS[selected.eventType] || selected.eventType],
                    ['Severity', selected.severity],
                    ['Time Flagged', selected.timestamp ? new Date(selected.timestamp).toLocaleString() : 'N/A'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-[#09090B] border border-[#27272A] rounded-xl p-2.5">
                      <p className="text-[10px] font-mono text-slate-500 uppercase">{label}</p>
                      <p className="font-semibold text-slate-200 mt-0.5 font-mono">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => setSelected(null)}
                className="mt-5 w-full text-xs font-mono bg-[#09090B] border border-[#27272A] hover:bg-[#18181B] text-slate-300"
              >
                Close Snapshot
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Card className="bg-[#141416] border-[#27272A] shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-[#09090B] border border-[#27272A] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle size={36} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold text-sm">No violations recorded</p>
              <p className="text-xs text-slate-500 mt-1">No candidate proctoring flags match your filter query.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#27272A] bg-[#09090B]">
                  <TableHead className="text-xs text-slate-400 font-mono">Candidate</TableHead>
                  <TableHead className="text-xs text-slate-400 font-mono">Exam Session</TableHead>
                  <TableHead className="text-xs text-slate-400">Event Type</TableHead>
                  <TableHead className="text-xs text-slate-400">Severity</TableHead>
                  <TableHead className="text-xs text-slate-400 font-mono">Time</TableHead>
                  <TableHead className="text-xs text-right text-slate-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v, i) => (
                  <TableRow key={v.id || i} className="border-b border-[#27272A]/60 hover:bg-[#18181A]">
                    <TableCell className="font-semibold text-xs text-slate-100">{v.studentName || 'Candidate'}</TableCell>
                    <TableCell className="font-mono text-xs text-indigo-400 truncate max-w-xs">{v.examTitle || 'Exam'}</TableCell>
                    <TableCell className="text-xs text-slate-300">{EVENT_LABELS[v.eventType] || v.eventType}</TableCell>
                    <TableCell><SeverityBadge severity={v.severity} /></TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(v)}
                        className="h-7 text-xs text-slate-300 hover:bg-[#27272A]"
                      >
                        <Eye size={13} className="mr-1" /> View Snapshot
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
