import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { UserCheck, UserPlus, Copy, Trash2, Eye, EyeOff, Check, Loader2, KeyRound } from 'lucide-react'

export default function ExamInvigilatorsTab({ examId, onStatusUpdate }) {
  const [invigilators, setInvigilators] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [revealedIds, setRevealedIds] = useState(new Set())
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    room: 'Hall A',
    password: ''
  })

  const loadInvigilators = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/exams/${examId}/invigilators`)
      setInvigilators(ensureArray(res.data?.invigilators || res.data))
    } catch (err) {
      setError(errorMessage(err, 'Failed to load invigilators'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvigilators()
  }, [examId])

  const handleGenerate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/exams/${examId}/invigilators`, form)
      setDialogOpen(false)
      setForm({ fullName: '', room: 'Hall A', password: '' })
      onStatusUpdate?.('Invigilator account generated successfully!')
      loadInvigilators()
    } catch (err) {
      setError(errorMessage(err, 'Failed to create invigilator'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (userId) => {
    try {
      await api.delete(`/exams/${examId}/invigilators/${userId}`)
      onStatusUpdate?.('Invigilator removed from this exam.')
      loadInvigilators()
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove invigilator'))
    }
  }

  const toggleReveal = (id) => {
    setRevealedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyCredentials = (invig) => {
    const text = `ProctorNet Live Invigilator Access:
Exam: ${examId}
Room: ${invig.room}
Invigilator ID: ${invig.institutionId}
Email: ${invig.email}
Access Password: ${invig.generatedPasswordHint || '(configured by invigilator)'}
Portal: https://proctornet.duckdns.org/login?role=invigilator`

    navigator.clipboard.writeText(text)
    setCopiedId(invig.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Assigned Exam Invigilators</h3>
          <p className="text-xs text-slate-500">Generate and distribute credentials for proctors overseeing candidate rooms.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs font-bold rounded-xl shadow-xs">
              <UserPlus className="w-3.5 h-3.5" /> + Generate Invigilator Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Generate Invigilator Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGenerate} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Invigilator Name</Label>
                <Input
                  required
                  placeholder="e.g. Dr. Ramesh Kumar"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Exam Hall / Room Number</Label>
                <Input
                  required
                  placeholder="e.g. Lab 302 or Hall B"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold">Access Password (Optional)</Label>
                  <span className="text-[10px] text-slate-400">Leave blank to auto-generate</span>
                </div>
                <Input
                  type="text"
                  placeholder="Leave empty for auto secure pin"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-10 rounded-xl mt-2">
                {submitting ? 'Generating Account...' : 'Generate & Assign Invigilator'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/70">
                <TableHead className="text-xs font-semibold text-slate-600">Invigilator</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">ID / Access Code</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Room / Hall</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Password Hint</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">Loading invigilators...</TableCell></TableRow>
              ) : invigilators.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">No invigilators assigned yet. Click "+ Generate Invigilator Account" to create credentials.</TableCell></TableRow>
              ) : (
                invigilators.map((invig) => {
                  const isRevealed = revealedIds.has(invig.id)
                  const isCopied = copiedId === invig.id
                  return (
                    <TableRow key={invig.id} className="border-slate-100 hover:bg-slate-50/60">
                      <TableCell>
                        <div className="font-bold text-slate-900 text-xs">{invig.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{invig.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">
                        {invig.institutionId}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        {invig.room}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span>{isRevealed ? (invig.generatedPasswordHint || '—') : '••••••••'}</span>
                          {invig.generatedPasswordHint && (
                            <button
                              onClick={() => toggleReveal(invig.id)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyCredentials(invig)}
                            className="h-7 px-2.5 text-xs font-semibold gap-1 rounded-lg"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                            {isCopied ? 'Copied!' : 'Copy Info'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(invig.id)}
                            className="h-7 px-2 text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
