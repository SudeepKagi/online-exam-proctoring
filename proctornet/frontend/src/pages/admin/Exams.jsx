import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BookOpen, Search, RefreshCw, Activity, Calendar, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function ExamStatusBadge({ status }) {
  if (status === 'ACTIVE' || status === 'IN_PROGRESS') {
    return (
      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] flex items-center gap-1.5 w-fit">
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        ACTIVE NOW
      </Badge>
    )
  }
  if (status === 'SCHEDULED' || status === 'PUBLISHED') {
    return <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 font-mono text-[10px]">SCHEDULED</Badge>
  }
  if (status === 'ENDED' || status === 'COMPLETED') {
    return <Badge variant="outline" className="text-muted-foreground border-border bg-background font-mono text-[10px]">ENDED</Badge>
  }
  return <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]">{status}</Badge>
}

export default function AdminExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/exams')
      setExams(res.data.exams || res.data || [])
    } catch {
      console.error('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const filtered = exams.filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.faculty?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.subject || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || e.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    active: exams.filter((e) => e.status === 'ACTIVE' || e.status === 'IN_PROGRESS').length,
    scheduled: exams.filter((e) => e.status === 'SCHEDULED' || e.status === 'PUBLISHED').length,
    ended: exams.filter((e) => e.status === 'ENDED' || e.status === 'COMPLETED').length,
  }

  return (
    <DashboardLayout title="Exams Overview">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">All Platform Exams</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Platform-wide exam scheduling and proctoring status monitoring</p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono border border-border bg-card hover:bg-[#f8fafc] dark:bg-neutral-900 text-foreground/90 rounded-xl transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Active Now</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-2">{stats.active}</p>
          </Card>

          <Card className="bg-card border-border p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Scheduled / Published</span>
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold font-mono text-primary mt-2">{stats.scheduled}</p>
          </Card>

          <Card className="bg-card border-border p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Completed Sessions</span>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground/90 mt-2">{stats.ended}</p>
          </Card>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam title, subject, faculty..."
              className="w-full pl-9 pr-3 py-1.5 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex bg-card border border-border rounded-full p-1 w-full sm:w-auto overflow-x-auto">
            {['', 'ACTIVE', 'SCHEDULED', 'PUBLISHED', 'ENDED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-full transition-colors whitespace-nowrap ${
                  filterStatus === s ? 'bg-white text-black' : 'text-muted-foreground hover:text-white'
                }`}
              >
                {s || 'All Exams'}
              </button>
            ))}
          </div>
        </div>

        {/* Exams Table */}
        <Card className="bg-card border-border shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-background border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen size={36} className="text-slate-600 mx-auto mb-2" />
              <p className="text-foreground/90 font-semibold text-sm">No exams found</p>
              <p className="text-xs text-slate-500 mt-1">No exam sessions match your filter criteria.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-background">
                  <TableHead className="text-xs text-muted-foreground font-mono">Exam Title</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Subject</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-mono">Faculty</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Duration</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-mono">Time Window</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                    <TableCell className="font-semibold text-xs text-foreground">{e.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10">{e.subject}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-foreground/90">{e.faculty?.name || 'Faculty'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.duration} mins</TableCell>
                    <TableCell><ExamStatusBadge status={e.status} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{new Date(e.startTime).toLocaleDateString()}</TableCell>
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
