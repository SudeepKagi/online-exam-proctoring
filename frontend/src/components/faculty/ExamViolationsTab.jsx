import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import EmptyState from '@/components/common/EmptyState'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { formatViolationType } from '@/shared/violationTypes'
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Search,
  Download,
  RefreshCw,
  Maximize2,
  X,
  FileImage
} from 'lucide-react'

export default function ExamViolationsTab({ examId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('ALL')
  const [screenshotsOnly, setScreenshotsOnly] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  const loadLogs = async () => {
    if (!examId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/proctoring/exams/${examId}/logs`)
      setLogs(ensureArray(res.data?.logs || res.data))
    } catch (err) {
      setError(errorMessage(err, 'Could not load violation logs'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [examId])

  // Computed KPIs
  const totalEvents = logs.length
  const candidateSet = new Set()
  const typeCounts = {}

  logs.forEach((l) => {
    const studentIdentifier = l.studentId || l.studentEmail || l.attemptId
    if (studentIdentifier) candidateSet.add(studentIdentifier)
    const t = l.eventType || 'UNKNOWN'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  })

  const uniqueCandidates = candidateSet.size
  let topType = 'None'
  let topTypeCount = 0
  Object.entries(typeCounts).forEach(([t, count]) => {
    if (count > topTypeCount) {
      topType = formatViolationType(t)
      topTypeCount = count
    }
  })

  // Filtered logs
  const filteredLogs = logs.filter((l) => {
    const sName = (l.studentName || '').toLowerCase()
    const sEmail = (l.studentEmail || '').toLowerCase()
    const matchesSearch = !search || sName.includes(search.toLowerCase()) || sEmail.includes(search.toLowerCase())
    const matchesType = selectedType === 'ALL' || l.eventType === selectedType
    const hasImage = Boolean(l.evidenceS3Key || l.evidenceKey || l.metadata?.snapshotDataUrl)
    const matchesScreenshot = !screenshotsOnly || hasImage
    return matchesSearch && matchesType && matchesScreenshot
  })

  const availableTypes = Array.from(new Set(logs.map((l) => l.eventType).filter(Boolean)))

  return (
    <div className="space-y-4 font-sans">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 bg-[#fbfbff] shadow-xs rounded-[12px] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-[420] text-[#554e7b] uppercase tracking-wider">Total Recorded Events</p>
            <p className="text-xl font-[480] text-[#28253b] mt-1">{totalEvents}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </Card>

        <Card className="border-0 bg-[#fbfbff] shadow-xs rounded-[12px] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-[420] text-[#554e7b] uppercase tracking-wider">Candidates With Events</p>
            <p className="text-xl font-[480] text-[#28253b] mt-1">{uniqueCandidates}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
            <Users className="w-4 h-4" />
          </div>
        </Card>

        <Card className="border-0 bg-[#fbfbff] shadow-xs rounded-[12px] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-[420] text-[#554e7b] uppercase tracking-wider">Most Frequent Incident</p>
            <p className="text-sm font-[480] text-[#28253b] mt-1 truncate" title={topType}>
              {topType} {topTypeCount > 0 ? `(${topTypeCount})` : ''}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-0 bg-white shadow-xs rounded-[12px] overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-[#fbfbff] border-b border-[#e9eaf2]/70">
          <div>
            <CardTitle className="text-xs font-[480] text-[#28253b]">Integrity Violation Log</CardTitle>
            <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5">
              All client security incidents and page capture snapshots recorded across student sessions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative min-w-[160px] flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#554e7b]" />
              <Input
                placeholder="Search candidate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-[32px] bg-white border-[#e9eaf2] text-[#28253b]"
              />
            </div>

            {/* Type Filter */}
            {availableTypes.length > 0 && (
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-[32px] bg-white border border-[#e9eaf2] text-[#28253b] focus:outline-none"
              >
                <option value="ALL">All Event Types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>{formatViolationType(t)}</option>
                ))}
              </select>
            )}

            {/* Screenshots toggle */}
            <label className="flex items-center gap-1.5 text-xs text-[#28253b] font-[420] cursor-pointer select-none px-2 py-1 bg-[#edecfb]/60 rounded-[32px]">
              <input
                type="checkbox"
                checked={screenshotsOnly}
                onChange={(e) => setScreenshotsOnly(e.target.checked)}
                className="rounded border-[#c3c3cc] text-[#5266eb] focus:ring-0"
              />
              Screenshots only
            </label>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
              className="h-8 w-8 p-0 rounded-full hover:bg-[rgba(82,102,235,0.08)] text-[#28253b]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Export CSV */}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 px-3 text-xs font-[420] rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0"
            >
              <a href={`/api/v1/exams/${examId}/incidents/export`} target="_blank" rel="noreferrer">
                <Download className="w-3.5 h-3.5 mr-1 text-[#5266eb]" /> Export CSV
              </a>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#554e7b] font-[420] flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#5266eb]" />
              Loading violation records...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-[#28253b] space-y-2">
              <p className="text-destructive font-[420]">{error}</p>
              <Button
                size="sm"
                onClick={loadLogs}
                className="h-8 px-4"
              >
                Retry loading
              </Button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              title={logs.length === 0 ? 'No violations recorded' : 'No matching events found'}
              description={
                logs.length === 0
                  ? 'All student attempts have maintained full integrity with zero security violations logged.'
                  : 'Try clearing your candidate search or event type filters to view more records.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#e9eaf2]">
                    <TableHead className="text-xs font-[480] text-[#554e7b]">Timestamp</TableHead>
                    <TableHead className="text-xs font-[480] text-[#554e7b]">Candidate</TableHead>
                    <TableHead className="text-xs font-[480] text-[#554e7b]">Incident Type</TableHead>
                    <TableHead className="text-xs font-[480] text-[#554e7b]">Severity</TableHead>
                    <TableHead className="text-xs font-[480] text-[#554e7b]">Screenshot Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const snapUrl = log.metadata?.snapshotDataUrl || (log.evidenceS3Key?.startsWith('data:') ? log.evidenceS3Key : null)
                    const s3Key = log.evidenceS3Key || log.evidenceKey
                    const hasEvidence = Boolean(snapUrl || (s3Key && !s3Key.startsWith('data:')))

                    return (
                      <TableRow key={log.id} className="border-b border-[#e9eaf2]/60 hover:bg-[#fbfbff]/60">
                        <TableCell className="text-xs font-mono text-[#554e7b]">
                          {new Date(log.createdAt || log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-[480] text-[#28253b]">{log.studentName || 'Candidate'}</p>
                          <p className="text-[11px] text-[#554e7b]">{log.studentEmail || '—'}</p>
                        </TableCell>
                        <TableCell className="text-xs font-[420] text-[#28253b]">
                          {formatViolationType(log.eventType)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono border-0 ${
                              log.severity === 'CRITICAL'
                                ? 'bg-[#edecfb] text-[#28253b]'
                                : log.severity === 'HIGH'
                                ? 'bg-[#edecfb] text-[#554e7b]'
                                : 'bg-[rgba(82,102,235,0.08)] text-[#28253b]'
                            }`}
                          >
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {snapUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setPreviewImage({ url: snapUrl, title: `${log.studentName} — ${formatViolationType(log.eventType)}` })}
                              className="group relative w-16 h-10 p-0 rounded overflow-hidden hover:opacity-90 transition"
                            >
                              <img src={snapUrl} alt="Screenshot" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </Button>
                          ) : s3Key && !s3Key.startsWith('data:') ? (
                            <Badge variant="outline" className="text-[10px] font-mono border-0 bg-[#edecfb] text-[#5266eb] flex items-center gap-1 w-fit">
                              <FileImage className="w-3 h-3" /> S3 Stored
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-[#70707d] font-[360]">Metadata only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screenshot Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] max-w-3xl w-full overflow-hidden shadow-2xl border-0 animate-in fade-in-50">
            <div className="flex items-center justify-between p-3.5 bg-[#fbfbff] border-b border-[#e9eaf2]">
              <span className="text-xs font-[480] text-[#28253b]">{previewImage.title}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setPreviewImage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-3 bg-[#fbfcfd] flex items-center justify-center max-h-[75vh] overflow-auto">
              <img src={previewImage.url} alt="Full screenshot" className="max-w-full h-auto rounded-lg shadow-inner" />
            </div>
            <div className="p-3 text-right bg-[#fbfbff] border-t border-[#e9eaf2]">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPreviewImage(null)}
              >
                Close preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
