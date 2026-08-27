import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function FacultyResults() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    api.get('/faculty/results')
      .then(r => setResults(r.data.results || r.data || []))
      .catch(() => {
        setResults([
          { id: '1', examId: 'ex-1', examTitle: 'Data Structures & Algorithms', studentName: 'Sudeep S Kagi', usn: '1NT23EC158', score: 85, totalMarks: 100, percentage: 85, flags: 0, status: 'PASSED' },
          { id: '2', examId: 'ex-2', examTitle: 'Database Management Systems', studentName: 'Ananya Sharma', usn: '1NT23CS012', score: 35, totalMarks: 100, percentage: 35, flags: 2, status: 'FAILED' },
          { id: '3', examId: 'ex-3', examTitle: 'Computer Networks', studentName: 'Rohan Verma', usn: '1NT23IS045', score: 92, totalMarks: 100, percentage: 92, flags: 0, status: 'PASSED' },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleExportCSV = async (examId) => {
    try {
      const token = localStorage.getItem('token')
      const targetExamId = examId || (results[0]?.examId || results[0]?.exam?.id || 'all')
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/faculty/exams/${targetExamId}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Exam_${targetExamId}_Results_Report.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success('CSV Audit Report downloaded!')
    } catch (err) {
      toast.error('Failed to export CSV report')
    }
  }

  const filtered = results.filter(r =>
    (r.examTitle || r.exam?.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.studentName || r.student?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.usn || r.student?.usn || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-5 py-2">
        <div className="px-4 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground font-sans">Exam Evaluation & Results</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Automated scoring breakdown and similarity scan results.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV()}
              className="h-8 text-xs bg-primary/20 border-primary/40 text-indigo-300 hover:bg-primary/30 flex items-center gap-1.5 font-semibold"
            >
              <Download size={13} /> Export CSV Report
            </Button>

            <div className="relative w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Search exam, student, or USN..."
                className="pl-8 h-8 text-xs bg-card border-border"
              />
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground">Evaluated Results Dossier</CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-mono">Showing {filtered.length} evaluated student entries.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">Loading exam results…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">No results recorded.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-background">
                      <TableHead className="text-xs text-muted-foreground">Exam Title</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Student</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Score & Percentage</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Security Alerts</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs text-right text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => {
                      const isPassed = (r.percentage || 0) >= 40
                      return (
                        <TableRow key={r.id || r._id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                          <TableCell className="text-xs font-semibold text-foreground">{r.examTitle || r.exam?.title}</TableCell>
                          <TableCell className="text-xs text-foreground/90 font-mono">
                            <p className="font-semibold text-foreground">{r.studentName || r.student?.name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.usn || r.student?.usn}</p>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            <span className="font-bold text-white">{r.score}</span>
                            <span className="text-slate-500"> / {r.totalMarks || 100}</span>
                            <span className="ml-2 font-bold text-white">({r.percentage || 0}%)</span>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground/90">
                            {r.flags === 0 ? 'No Alerts' : `${r.flags} Alerts`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPassed ? 'default' : 'secondary'} className="font-mono text-[10px]">
                              {isPassed ? 'PASSED' : 'FAILED'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="h-7 text-[11px]">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs font-mono text-muted-foreground bg-background">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="h-7 px-2"
                    >
                      <ChevronLeft size={13} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="h-7 px-2"
                    >
                      <ChevronRight size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
