import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function ResultDetailModal({ result, onClose }) {
  if (!result) return null
  const isPassed = (result.percentage || 0) >= 40

  return (
    <Dialog open={!!result} onOpenChange={open => !open && onClose()}>
      <DialogContent onClose={onClose} className="max-w-lg bg-card border-border rounded-2xl text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-foreground">{result.exam?.title || result.examTitle}</DialogTitle>
            <Badge variant={isPassed ? 'default' : 'secondary'} className="font-mono text-[10px]">
              {isPassed ? 'PASSED' : 'FAILED'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
          <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 border border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Score</p>
            <p className="font-mono font-bold text-xs text-white mt-0.5">{result.totalScore} / {result.exam?.totalMarks || result.totalMarks}</p>
          </div>
          <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 border border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Percentage</p>
            <p className="font-mono font-bold text-xs text-white mt-0.5">{result.percentage || 0}%</p>
          </div>
          <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 border border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Integrity Flags</p>
            <p className="font-mono font-bold text-xs text-white mt-0.5">{result.flagCount || 0} flags</p>
          </div>
          <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 border border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Evaluation Date</p>
            <p className="font-mono text-xs text-foreground mt-0.5">{result.gradedAt ? new Date(result.gradedAt).toLocaleDateString() : '—'}</p>
          </div>
          <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 border border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Duration</p>
            <p className="font-mono text-xs text-foreground mt-0.5">{result.timeTaken ? `${Math.round(result.timeTaken / 60)} min` : '60 min'}</p>
          </div>
          <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 border border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Biometrics</p>
            <p className="font-mono text-xs text-white mt-0.5">VERIFIED</p>
          </div>
        </div>

        {result.answers && result.answers.length > 0 && (
          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-semibold text-foreground/90">Itemized Question Breakdown</h4>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {result.answers.map((a, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-border bg-[#f8fafc] dark:bg-neutral-900 text-xs space-y-1">
                  <p className="font-medium text-foreground text-xs">Q{i + 1}. {a.question?.text?.slice(0, 75)}…</p>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white font-semibold">
                      {a.isCorrect ? `Correct (+${a.marksAwarded})` : `Incorrect (${a.marksAwarded})`}
                    </span>
                    <span className="text-muted-foreground">Selected: {a.selectedOption || a.writtenText || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function StudentResults() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  
  // Filter & Pagination States
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL') // ALL, PASSED, FAILED, FLAGGED
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    api.get('/student/results')
      .then(r => setResults(r.data.results || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length)
    : 0

  const bestScore = results.length > 0 ? Math.max(...results.map(r => r.percentage || 0)) : 0
  const passedCount = results.filter(r => (r.percentage || 0) >= 40).length
  const flaggedCount = results.filter(r => (r.flagCount || 0) > 0 || r.collusionFlagged).length

  // Filtered dataset
  const filtered = results.filter(r => {
    const title = (r.exam?.title || r.examTitle || '').toLowerCase()
    const matchSearch = !search || title.includes(search.toLowerCase())
    const isPassed = (r.percentage || 0) >= 40
    const isFlagged = (r.flagCount || 0) > 0 || r.collusionFlagged

    if (filterStatus === 'PASSED') return matchSearch && isPassed
    if (filterStatus === 'FAILED') return matchSearch && !isPassed
    if (filterStatus === 'FLAGGED') return matchSearch && isFlagged
    return matchSearch
  })

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <DashboardLayout title="Performance & Integrity Audit">
      <ResultDetailModal result={selected} onClose={() => setSelected(null)} />

      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Exam Results & Integrity Docket</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Automated scoring breakdown and proctoring audit log.</p>
        </div>

        {/* ── Bento Stat Section: Hero Card + Slim Secondary Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Primary Hero Stat Card */}
          <Card className="lg:col-span-1 border-border bg-card relative overflow-hidden">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Cumulative Performance</span>
                <Badge variant="secondary" className="font-mono text-[9px]">
                  {results.length} EXAMS
                </Badge>
              </div>
              
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-white">{avgScore}%</span>
                  <span className="text-xs font-mono text-muted-foreground">average score</span>
                </div>
                {/* Progress bar visual */}
                <div className="w-full h-2 bg-border rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${avgScore}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-border text-muted-foreground">
                <span>Pass Rate: <strong className="text-white">{results.length > 0 ? Math.round((passedCount / results.length) * 100) : 0}%</strong></span>
                <span>Highest: <strong className="text-white">{bestScore}%</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* Slim Secondary Metrics Row */}
          <div className="lg:col-span-2 grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-mono font-semibold">Evaluated Tests</span>
              <p className="text-2xl font-bold font-mono text-white mt-2">{results.length}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1">Submitted sessions</span>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-mono font-semibold">Passed Assessments</span>
              <p className="text-2xl font-bold font-mono text-white mt-2">{passedCount}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1">&ge; 40% pass criteria</span>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-mono font-semibold">Integrity Flags</span>
              <p className="text-2xl font-bold font-mono text-white mt-2">{flaggedCount}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1">Camera / tab alerts</span>
            </div>
          </div>
        </div>

        {/* ── Table & Filter Header ── */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Evaluated Candidate Dossier</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Filtering and proctoring audit log.</CardDescription>
              </div>

              {/* Functional Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                    placeholder="Search title..."
                    className="pl-8 h-7 text-xs bg-background"
                  />
                </div>

                <div className="flex bg-background border border-border rounded-xl p-0.5">
                  {['ALL', 'PASSED', 'FAILED', 'FLAGGED'].map(status => (
                    <button
                      key={status}
                      onClick={() => { setFilterStatus(status); setCurrentPage(1) }}
                      className={`px-3 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                        filterStatus === status
                          ? 'bg-border text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">Loading candidate evaluation records...</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 font-mono">No examination records found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-background">
                    <TableHead className="text-xs text-muted-foreground">Exam Assessment</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Evaluation Date</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Score & Percentage</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Proctoring Integrity</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs text-right text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r) => {
                    const isPassed = (r.percentage || 0) >= 40
                    const flags = r.flagCount || 0

                    return (
                      <TableRow key={r.id || r._id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                        <TableCell className="text-xs font-semibold text-foreground">
                          {r.exam?.title || r.examTitle}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {new Date(r.gradedAt || r.submittedAt || Date.now()).toLocaleDateString()}
                        </TableCell>

                        <TableCell className="text-xs font-mono">
                          <span className="font-bold text-white">{r.totalScore}</span>
                          <span className="text-slate-500"> / {r.exam?.totalMarks || r.totalMarks}</span>
                          <span className="ml-2 font-bold text-white">
                            ({r.percentage || 0}%)
                          </span>
                        </TableCell>

                        <TableCell className="text-xs font-mono text-foreground/90">
                          {flags === 0 ? '0 Flags (Verified)' : `${flags} Flags Recorded`}
                        </TableCell>

                        <TableCell>
                          <Badge variant={isPassed ? 'default' : 'secondary'} className="font-mono text-[10px]">
                            {isPassed ? 'PASSED' : 'FAILED'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setSelected(r)}>
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs font-mono text-muted-foreground bg-background">
                <span>Page {currentPage} of {totalPages} ({filtered.length} total entries)</span>
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
    </DashboardLayout>
  )
}
