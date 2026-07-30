import React, { useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function DataTable({ data = [] }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  const sampleData = data.length > 0 ? data : [
    { id: '1', title: 'Data Structures & Algorithms', code: 'CS301', date: '2026-05-10', score: 85, maxScore: 100, percentage: 85, status: 'PASSED', flags: 0 },
    { id: '2', title: 'Database Management Systems', code: 'CS402', date: '2026-05-12', score: 35, maxScore: 100, percentage: 35, status: 'FAILED', flags: 2 },
    { id: '3', title: 'Computer Networks', code: 'CS405', date: '2026-05-14', score: 92, maxScore: 100, percentage: 92, status: 'PASSED', flags: 0 },
    { id: '4', title: 'Operating Systems', code: 'CS304', date: '2026-05-18', score: 78, maxScore: 100, percentage: 78, status: 'PASSED', flags: 1 },
    { id: '5', title: 'Software Engineering', code: 'CS501', date: '2026-05-20', score: 28, maxScore: 100, percentage: 28, status: 'FAILED', flags: 3 },
  ]

  const filtered = sampleData.filter(item => {
    const title = (item.title || item.name || '').toLowerCase()
    const matchSearch = !search || title.includes(search.toLowerCase())
    if (filterStatus === 'PASSED') return matchSearch && item.status === 'PASSED'
    if (filterStatus === 'FAILED') return matchSearch && item.status === 'FAILED'
    if (filterStatus === 'FLAGGED') return matchSearch && item.flags > 0
    return matchSearch
  })

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <Card className="border-[#27272A] bg-[#141416] font-sans">
      <CardHeader className="pb-3 border-b border-[#27272A]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-100">Recent Exam Results</CardTitle>
            <CardDescription className="text-xs text-slate-400">Detailed list of evaluated exam scores.</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Search exam name..."
                className="pl-8 h-7 text-xs bg-[#09090B]"
              />
            </div>

            <div className="flex bg-[#09090B] border border-[#27272A] rounded-xl p-0.5">
              {['ALL', 'PASSED', 'FAILED', 'FLAGGED'].map(status => (
                <button
                  key={status}
                  onClick={() => { setFilterStatus(status); setCurrentPage(1) }}
                  className={`px-3 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                    filterStatus === status ? 'bg-[#27272A] text-white' : 'text-slate-400 hover:text-slate-200'
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
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#27272A] bg-[#09090B]">
              <TableHead className="text-xs text-slate-400">Exam Title</TableHead>
              <TableHead className="text-xs text-slate-400">Course Code</TableHead>
              <TableHead className="text-xs text-slate-400">Date</TableHead>
              <TableHead className="text-xs text-slate-400">Score</TableHead>
              <TableHead className="text-xs text-slate-400">Security Alerts</TableHead>
              <TableHead className="text-xs text-slate-400">Status</TableHead>
              <TableHead className="text-xs text-right text-slate-400">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((r) => (
              <TableRow key={r.id} className="border-b border-[#27272A]/60 hover:bg-[#18181A]">
                <TableCell className="text-xs font-semibold text-slate-100">{r.title}</TableCell>
                <TableCell className="text-xs text-slate-400 font-mono">{r.code || 'CS301'}</TableCell>
                <TableCell className="text-xs text-slate-400 font-mono">{r.date}</TableCell>
                <TableCell className="text-xs font-mono">
                  <span className="font-bold text-white">{r.score}</span>
                  <span className="text-slate-500"> / {r.maxScore}</span>
                  <span className="ml-2 font-bold text-white">({r.percentage}%)</span>
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-300">
                  {r.flags === 0 ? 'No Alerts' : `${r.flags} Alerts`}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === 'PASSED' ? 'default' : 'secondary'} className="font-mono text-[10px]">
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" className="h-7 text-[11px]">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#27272A] text-xs font-mono text-slate-400 bg-[#09090B]">
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
      </CardContent>
    </Card>
  )
}
