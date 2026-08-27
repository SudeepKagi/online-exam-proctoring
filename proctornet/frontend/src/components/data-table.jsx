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

  const listData = Array.isArray(data) ? data : []

  const filtered = listData.filter(item => {
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
    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xs font-sans overflow-hidden">
      <div className="p-5 pb-4 border-b border-[#f1f5f9]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Recent Exam Results</h3>
            <p className="text-xs text-[#64748b] mt-0.5">Detailed list of evaluated exam scores and session audit flags.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Search exam name..."
                className="pl-9 h-8 text-xs bg-card"
                aria-label="Search exam name"
              />
            </div>

            <div className="flex bg-[#f1f5f9] dark:bg-neutral-900 border border-border rounded-xl p-1">
              {['ALL', 'PASSED', 'FAILED', 'FLAGGED'].map(status => (
                <button
                  key={status}
                  onClick={() => { setFilterStatus(status); setCurrentPage(1) }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterStatus === status
                      ? 'bg-card text-primary shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-pressed={filterStatus === status}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Exam Title</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Course Code</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Date</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Score</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Security Alerts</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Status</TableHead>
              <TableHead className="text-xs text-right font-bold uppercase tracking-wider text-[#64748b]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-[#94a3b8] text-xs">
                  No matching exam records found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow key={r.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                  <TableCell className="text-xs font-bold text-[#0f172a]">{r.title}</TableCell>
                  <TableCell className="text-xs text-[#64748b] font-semibold">{r.code || 'CS301'}</TableCell>
                  <TableCell className="text-xs text-[#64748b]">{r.date}</TableCell>
                  <TableCell className="text-xs">
                    <span className="font-bold text-[#0f172a]">{r.score}</span>
                    <span className="text-[#94a3b8]"> / {r.maxScore}</span>
                    <span className="ml-1.5 font-bold text-[#2f80ed]">({r.percentage}%)</span>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {r.flags === 0 ? (
                      <span className="text-[#94a3b8]">No Alerts</span>
                    ) : (
                      <span className="text-[#ef4444] font-bold">{r.flags} Alerts</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'PASSED' ? 'green' : 'destructive'} className="text-[10px]">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-7 text-xs font-semibold">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#e2e8f0] text-xs text-[#64748b] bg-[#f8fafc]">
          <span>Page {currentPage} of {totalPages} ({filtered.length} total entries)</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="h-8 px-2.5"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="h-8 px-2.5"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
