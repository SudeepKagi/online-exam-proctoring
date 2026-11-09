import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/apiClient'
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  Search,
  Laptop,
  Wifi,
  Camera
} from 'lucide-react'

export default function ExamReadinessTab({ examId, exam }) {
  const [readinessList, setReadinessList] = useState([])
  const [summary, setSummary] = useState({ total: 0, ready: 0, notReady: 0, notReported: 0 })
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReadiness = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/exams/${examId}/readiness`, {
        params: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchQuery.trim() || undefined
        }
      })
      const data = res.data || {}
      setReadinessList(data.readiness || [])
      if (data.summary) {
        setSummary(data.summary)
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch student readiness telemetry'))
    } finally {
      setLoading(false)
    }
  }, [examId, statusFilter, searchQuery])

  useEffect(() => {
    fetchReadiness()
  }, [fetchReadiness])

  return (
    <div className="space-y-4 font-sans" data-testid="readiness-tab-container">
      {/* Metric Cards - Light Surface World */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-[14px] border border-[#e9eaf2]/70 shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
          <span className="text-[11px] font-[420] text-[#70707d] uppercase tracking-wider">Total Enrolled</span>
          <div className="text-xl font-[480] text-[#28253b] mt-1">{summary.total}</div>
        </div>

        <div className="p-3.5 bg-white rounded-[14px] border border-[#e9eaf2]/70 shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-[420] text-[#70707d] uppercase tracking-wider">Ready to Test</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" />
          </div>
          <div className="text-xl font-[480] text-[#5266eb] mt-1">{summary.ready}</div>
        </div>

        <div className="p-3.5 bg-white rounded-[14px] border border-[#e9eaf2]/70 shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-[420] text-[#70707d] uppercase tracking-wider">Needs Attention</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#8a6a26]" />
          </div>
          <div className="text-xl font-[480] text-[#8a6a26] mt-1">{summary.notReady}</div>
        </div>

        <div className="p-3.5 bg-white rounded-[14px] border border-[#e9eaf2]/70 shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-[420] text-[#70707d] uppercase tracking-wider">Not Yet Checked</span>
            <Clock className="w-3.5 h-3.5 text-[#70707d]" />
          </div>
          <div className="text-xl font-[480] text-[#70707d] mt-1">{summary.notReported}</div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Export */}
      <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] p-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'READY', 'NOT_READY', 'NOT_REPORTED'].map((st) => {
              const active = statusFilter === st
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`text-xs font-[420] px-3 py-1.5 rounded-[40px] transition cursor-pointer ${
                    active
                      ? 'bg-[#5266eb] text-white shadow-xs'
                      : 'bg-[#fbfbff] hover:bg-[#edecfb] text-[#28253b] border border-[#e9eaf2]/80'
                  }`}
                >
                  {st === 'ALL'
                    ? 'All Students'
                    : st === 'READY'
                    ? 'Ready'
                    : st === 'NOT_READY'
                    ? 'Needs Attention'
                    : 'Not Reported'}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 text-[#70707d] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs font-[420] h-9 rounded-[32px] border-[#e9eaf2] bg-[#fbfbff] focus:bg-white text-[#28253b]"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchReadiness}
              disabled={loading}
              className="gap-1.5 text-xs font-[420] rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 text-xs font-[420] rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent cursor-pointer"
            >
              <a href={`/api/v1/exams/${examId}/readiness/export`} target="_blank" rel="noreferrer">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </a>
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
          {error}
        </div>
      )}

      {/* Readiness Telemetry Table */}
      <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-[#fbfbff] border-b border-[#e9eaf2]">
          <CardTitle className="text-xs font-[480] text-[#28253b]">
            Telemetry & Pre-flight Diagnostics ({readinessList.length})
          </CardTitle>
          <span className="text-[11px] text-[#70707d] font-[360]">
            Privacy minimized: strictly excludes IP addresses, hardware IDs, and snapshots
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Diagnosed Issues / Reasons</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Hardware & Net</TableHead>
                <TableHead>Secure Browser</TableHead>
                <TableHead>Last Reported</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && readinessList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-[#70707d] font-[360]">
                    Loading student readiness telemetry...
                  </TableCell>
                </TableRow>
              ) : readinessList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-[#70707d] font-[360]">
                    No students match the current filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                readinessList.map((item) => (
                  <TableRow key={item.studentId}>
                    <TableCell>
                      <div>
                        <div className="text-xs font-[480] text-[#28253b]">{item.studentName}</div>
                        <div className="text-[11px] text-[#70707d] font-[360]">{item.email}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {item.status === 'READY' ? (
                        <Badge variant="outline" className="text-[10px] font-[480] bg-[#edecfb] text-[#5266eb] border-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                        </Badge>
                      ) : item.status === 'NOT_READY' ? (
                        <Badge variant="outline" className="text-[10px] font-[480] bg-[#fdf5e6] text-[#8a6a26] border-0">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Attention
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-[420] bg-[#fbfbff] text-[#70707d] border-0">
                          Not Reported
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {item.reasons && item.reasons.length > 0 ? (
                        <div className="flex flex-col gap-1 max-w-xs">
                          {item.reasons.map((r, idx) => (
                            <span key={idx} className="text-[11px] font-[420] text-[#554e7b] bg-[#edecfb] px-2 py-0.5 rounded-[12px] inline-block">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#70707d] font-[360]">All checks cleared</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-[#28253b] font-[420] flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-[#5266eb]" />
                        <span>{item.osFamily} • {item.browserFamily}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-[#554e7b] font-[360] space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Camera className="w-3 h-3 text-[#5266eb]" />
                          <span>Camera: {item.cameraOk ? 'Verified' : 'Unavailable'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-[#5266eb]" />
                          <span>Latency: {item.latencyBucket}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {item.sebVerified ? (
                        <Badge variant="outline" className="text-[10px] font-[420] bg-[#edecfb] text-[#5266eb] border-0">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Verified Active
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-[#70707d] font-[360]">Not verified</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-[#70707d] font-[360]">
                      {item.reportedAt ? new Date(item.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

