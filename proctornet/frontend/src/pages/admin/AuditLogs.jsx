import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { ClipboardList, Search, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/audit-logs', { params: { page, limit: PER_PAGE, search, role: filterRole } })
      setLogs(res.data.logs || res.data || [])
    } catch {
      console.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, filterRole])

  const filtered = logs.filter(
    (l) =>
      !search ||
      (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.userRole || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.details || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout title="Audit Logs">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">System Audit Trail</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track all administrative, student, and security actions platform-wide</p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono border border-border bg-card hover:bg-[#f8fafc] dark:bg-neutral-900 text-foreground/90 rounded-xl transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, details, user role..."
              className="w-full pl-9 pr-3 py-1.5 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
          >
            <option value="">All User Roles</option>
            {['admin', 'faculty', 'student', 'invigilator'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Audit Log Table */}
        <Card className="bg-card border-border shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-background border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList size={36} className="text-slate-600 mx-auto mb-2" />
              <p className="text-foreground/90 font-semibold text-sm">No audit logs found</p>
              <p className="text-xs text-slate-500 mt-1">No system logs match your filter criteria.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-background">
                  <TableHead className="text-xs text-muted-foreground font-mono">Timestamp</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-mono">Role</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Action</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log, i) => (
                  <TableRow key={log.id || i} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : new Date().toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30 bg-primary/10 uppercase">
                        {log.userRole || 'system'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-xs text-foreground">{log.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">{log.details || '—'}</TableCell>
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
