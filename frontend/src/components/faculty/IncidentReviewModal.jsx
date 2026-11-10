import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage } from '@/lib/apiClient'
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  X,
  Clock,
  User,
  Eye,
  FileText,
  Save,
  Filter
} from 'lucide-react'

export default function IncidentReviewModal({ attemptId, isOpen, onClose, onReviewSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [reviewStatus, setReviewStatus] = useState('PENDING')
  const [reviewNotes, setReviewNotes] = useState('')
  const [isFlagged, setIsFlagged] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [zoomedSnapshot, setZoomedSnapshot] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const loadIncidents = useCallback(async () => {
    if (!attemptId) return
    setLoading(true)
    setMsg({ text: '', type: '' })
    try {
      const res = await api.get(`/attempts/${attemptId}/incidents`)
      const data = res.data || {}
      setAttempt(data.attempt || null)
      setIncidents(data.incidents || [])
      if (data.attempt) {
        setReviewStatus(data.attempt.reviewStatus || 'PENDING')
        setReviewNotes(data.attempt.reviewNotes || '')
        setIsFlagged(Boolean(data.attempt.isFlagged))
      }
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to load incident history'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    if (isOpen && attemptId) {
      loadIncidents()
    }
  }, [isOpen, attemptId, loadIncidents])

  if (!isOpen) return null

  const handleSaveReview = async () => {
    setSaving(true)
    setMsg({ text: '', type: '' })
    try {
      const res = await api.patch(`/attempts/${attemptId}/review`, {
        reviewStatus,
        reviewNotes,
        isFlagged
      })
      setMsg({ text: 'Review status and invigilator notes updated successfully.', type: 'success' })
      if (onReviewSaved) {
        onReviewSaved(res.data?.attempt)
      }
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to save review'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Filter incidents
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter
    const matchesType = typeFilter === 'ALL' || inc.eventType === typeFilter
    return matchesSeverity && matchesType
  })

  // Unique event types for filter selector
  const availableTypes = Array.from(new Set(incidents.map((i) => i.eventType)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#28253b]/40 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#fbfcfd] rounded-[20px] shadow-xl overflow-hidden flex flex-col border border-[#e9eaf2]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-[#e9eaf2] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-[480] text-[#28253b]">
                Proctoring Incident Review — {attempt?.studentName || 'Student Attempt'}
              </h3>
              <p className="text-[11px] text-[#70707d] font-[360]">
                {attempt?.email} • USN: {attempt?.usn || '—'} • Score: {attempt?.score != null ? `${attempt.score} pts` : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 text-xs font-[420] rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent cursor-pointer"
            >
              <a href={`/api/v1/attempts/${attemptId}/incidents/export`} target="_blank" rel="noreferrer">
                <Download className="w-3.5 h-3.5" /> Export Incidents CSV
              </a>
            </Button>
            <button
              onClick={onClose}
              data-testid="close-review-modal"
              className="w-8 h-8 rounded-full hover:bg-[#edecfb] text-[#70707d] flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {msg.text && (
            <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
              {msg.text}
            </div>
          )}

          {/* Review Decision & Invigilator Notes Card */}
          <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[16px] p-4 font-sans">
            <h4 className="text-xs font-[480] text-[#28253b] mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#5266eb]" /> Invigilator Adjudication & Notes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-[420] text-[#70707d] block mb-1">
                  Adjudication Status
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => {
                    const st = e.target.value
                    setReviewStatus(st)
                    if (st === 'CONFIRMED') setIsFlagged(true)
                    if (st === 'DISMISSED') setIsFlagged(false)
                  }}
                  className="w-full text-xs font-[420] h-9 px-3 rounded-[12px] border border-[#e9eaf2] bg-[#fbfbff] text-[#28253b] focus:bg-white"
                >
                  <option value="PENDING">Pending Review</option>
                  <option value="REVIEWED">Reviewed (Inconclusive)</option>
                  <option value="DISMISSED">Dismissed (False Positive)</option>
                  <option value="CONFIRMED">Confirmed Violation</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-[420] text-[#70707d] block mb-1">
                  Integrity Flag
                </label>
                <label className="flex items-center gap-2 h-9 px-3 bg-[#fbfbff] rounded-[12px] border border-[#e9eaf2] text-xs font-[420] text-[#28253b] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFlagged}
                    onChange={(e) => setIsFlagged(e.target.checked)}
                    className="rounded accent-[#5266eb]"
                  />
                  <span>Flag Attempt for Disciplinary Audit</span>
                </label>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleSaveReview}
                  disabled={saving}
                  className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-9 rounded-[32px] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? 'Saving Review...' : 'Save Adjudication'}
                </Button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[11px] font-[420] text-[#70707d] block mb-1">
                Invigilator Notes & Audit Justification
              </label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document verification findings, false-positive context, or disciplinary references..."
                className="w-full text-xs font-[420] p-2.5 rounded-[12px] border border-[#e9eaf2] bg-[#fbfbff] text-[#28253b] focus:bg-white resize-none"
              />
            </div>
          </Card>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-[12px] border border-[#e9eaf2]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-[420] text-[#70707d] mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Severity:
              </span>
              {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((sev) => {
                const active = severityFilter === sev
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`text-[11px] font-[420] px-2.5 py-1 rounded-[40px] transition cursor-pointer ${
                      active
                        ? 'bg-[#5266eb] text-white shadow-xs'
                        : 'bg-[#fbfbff] hover:bg-[#edecfb] text-[#28253b] border border-[#e9eaf2]/70'
                    }`}
                  >
                    {sev}
                  </button>
                )
              })}
            </div>

            {availableTypes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-[420] text-[#70707d]">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs font-[420] h-8 px-2.5 rounded-[10px] border border-[#e9eaf2] bg-[#fbfbff] text-[#28253b]"
                >
                  <option value="ALL">All Violation Types</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Violation Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-[480] text-[#28253b] flex items-center justify-between">
              <span>Integrity Violation Timeline ({filteredIncidents.length} events)</span>
              <span className="text-[11px] text-[#70707d] font-[360]">Ordered chronologically</span>
            </h4>

            {loading ? (
              <div className="text-center py-12 text-xs text-[#70707d] font-[360]">
                Loading timeline and presigned evidence snapshots...
              </div>
            ) : filteredIncidents.length === 0 ? (
              <Card className="border-[#e9eaf2] bg-white p-8 text-center rounded-[12px] shadow-xs">
                <CheckCircle2 className="w-8 h-8 text-[#5266eb] mx-auto mb-2 opacity-80" />
                <p className="text-xs text-[#28253b] font-[480]">No incidents found</p>
                <p className="text-[11px] text-[#70707d] font-[360] mt-0.5">
                  No integrity anomalies match the selected filters for this attempt.
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {filteredIncidents.map((inc) => {
                  const severityStyle =
                    inc.severity === 'CRITICAL'
                      ? 'bg-[#ffebee] text-[#c62828]'
                      : inc.severity === 'HIGH'
                      ? 'bg-[#fff3e0] text-[#e65100]'
                      : inc.severity === 'MEDIUM'
                      ? 'bg-[#edecfb] text-[#5266eb]'
                      : 'bg-[#fbfbff] text-[#70707d]'

                  return (
                    <div
                      key={inc.id}
                      className="p-3.5 bg-white rounded-[14px] border border-[#e9eaf2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-[#5266eb]/30 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-[480] px-2 py-0.5 rounded-[12px] ${severityStyle}`}>
                            {inc.severity}
                          </span>
                          <span className="text-xs font-[480] text-[#28253b]">
                            {inc.displayLabel || inc.eventType}
                          </span>
                          {inc.eventType !== inc.displayLabel && (
                            <span className="text-[10px] text-[#70707d] font-mono">
                              ({inc.eventType})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#70707d] font-[360]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#5266eb]" />
                            {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span>{new Date(inc.timestamp).toLocaleDateString()}</span>
                        </div>

                        {inc.metadata && Object.keys(inc.metadata).length > 0 && (
                          <div className="text-[11px] text-[#554e7b] font-mono bg-[#fbfbff] p-1.5 rounded-[8px] max-w-lg mt-1">
                            {JSON.stringify(inc.metadata)}
                          </div>
                        )}
                      </div>

                      {/* Snapshot Thumbnail */}
                      {inc.snapshotUrl ? (
                        <div className="shrink-0 flex items-center gap-2">
                          <div
                            onClick={() => setZoomedSnapshot(inc.snapshotUrl)}
                            className="w-20 h-14 bg-[#171721] rounded-[8px] overflow-hidden cursor-pointer relative group border border-[#e9eaf2]"
                          >
                            <img
                              src={inc.snapshotUrl}
                              alt="Violation snapshot"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setZoomedSnapshot(inc.snapshotUrl)}
                            className="text-[11px] font-[420] text-[#5266eb] hover:bg-[#edecfb] rounded-[20px] h-7 px-2"
                          >
                            View
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#70707d] font-[360] italic shrink-0">
                          No snapshot captured
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Snapshot Zoom Modal */}
      {zoomedSnapshot && (
        <div
          onClick={() => setZoomedSnapshot(null)}
          className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-[#171721] rounded-[16px] overflow-hidden shadow-2xl">
            <button
              onClick={() => setZoomedSnapshot(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={zoomedSnapshot} alt="Enlarged violation snapshot" className="w-full h-auto object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
