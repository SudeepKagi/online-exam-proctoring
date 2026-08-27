import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Video, Search, RefreshCw, Eye, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function AdminInvigilators() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/invigilator-sessions')
      setSessions(res.data.sessions || res.data || [])
    } catch {
      console.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const filtered = sessions.filter(
    (s) =>
      !search ||
      (s.invId || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.exam?.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout title="Invigilators">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Invigilator Sessions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track live and past invigilator authentication sessions</p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono border border-border bg-card hover:bg-[#f8fafc] dark:bg-neutral-900 text-foreground/90 rounded-xl transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or exam title..."
            className="w-full pl-9 pr-3 py-1.5 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
          />
        </div>

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 text-foreground font-sans" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Invigilator Session Details</h3>
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {selected.idCardPhotoUrl && selected.idCardPhotoUrl !== 'placeholder_id' && (
                  <img src={selected.idCardPhotoUrl} alt="ID" className="w-full rounded-xl max-h-48 object-cover border border-border" />
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ['Invigilator ID', selected.invId],
                    ['Exam Session', selected.exam?.title || selected.examId],
                    ['Login Time', (selected.loginTime || selected.createdAt) ? new Date(selected.loginTime || selected.createdAt).toLocaleString() : '—'],
                    ['Session Expiry', selected.sessionExpiry ? new Date(selected.sessionExpiry).toLocaleString() : '—'],
                    ['Status', selected.isActive ? 'Active' : 'Expired'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-background border border-border rounded-xl p-2.5">
                      <p className="text-[10px] font-mono text-slate-500 uppercase">{label}</p>
                      <p className={`font-semibold mt-0.5 font-mono ${label === 'Status' ? (selected.isActive ? 'text-emerald-400' : 'text-slate-500') : 'text-foreground'}`}>
                        {val}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => setSelected(null)}
                className="mt-5 w-full text-xs font-mono bg-background border border-border hover:bg-[#f8fafc] dark:bg-neutral-900 text-foreground/90"
              >
                Close Window
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Card className="bg-card border-border shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-background border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Video size={36} className="text-slate-600 mx-auto mb-2" />
              <p className="text-foreground/90 font-semibold text-sm">No invigilator sessions found</p>
              <p className="text-xs text-slate-500 mt-1">No active or archived invigilator login sessions.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-background">
                  <TableHead className="text-xs text-muted-foreground font-mono">Invigilator ID</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-mono">Exam Session</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Login Time</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-right text-muted-foreground font-mono">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                    <TableCell className="font-mono text-xs font-bold text-foreground">{s.invId}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">{s.exam?.title || 'Exam Session'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{(s.loginTime || s.createdAt) ? new Date(s.loginTime || s.createdAt).toLocaleString() : '—'}</TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px]">
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border bg-background font-mono text-[10px]">
                          EXPIRED
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(s)}
                        className="h-7 text-xs text-foreground/90 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <Eye size={13} className="mr-1" /> View Details
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
