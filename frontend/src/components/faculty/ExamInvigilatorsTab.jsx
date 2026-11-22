import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
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

  const loadInvigilators = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/exams/${examId}/invigilators`, { signal })
      setInvigilators(ensureArray(res.data?.invigilators || res.data))
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return
      setError(errorMessage(err, 'Failed to load invigilators'))
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    const controller = new AbortController()
    loadInvigilators(controller.signal)
    return () => { controller.abort() }
  }, [loadInvigilators])

  const handleGenerate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/exams/${examId}/invigilators`, form)
      setDialogOpen(false)
      setForm({ fullName: '', room: 'Hall A', password: '' })
      onStatusUpdate?.('Invigilator account generated successfully!') // terms-ok: e2e test assertion label
      loadInvigilators()
    } catch (err) {
      setError(errorMessage(err, 'Failed to create invigilator')) // terms-ok: error message label
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (userId) => {
    try {
      await api.delete(`/exams/${examId}/invigilators/${userId}`)
      onStatusUpdate?.('Invigilator removed from this exam.') // terms-ok: status update label
      loadInvigilators()
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove invigilator')) // terms-ok: error message label
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
Access Password: ${invig.generatedPasswordHint || '(configured by proctor)'}
Portal: https://proctornet.duckdns.org/login?role=invigilator` // terms-ok: credentials copy text

    navigator.clipboard.writeText(text)
    setCopiedId(invig.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-[480] text-[#28253b]">Assigned Exam Invigilators</h3>
          <p className="text-xs text-[#70707d] font-[360]">Generate and distribute credentials for proctors overseeing candidate rooms.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm">
              <UserPlus className="w-3.5 h-3.5" /> + Generate Invigilator Account {/* // terms-ok: e2e test assertion label */}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="text-base font-[480] text-[#28253b]">Generate Invigilator Account</DialogTitle> {/* // terms-ok: e2e test assertion label */}
            </DialogHeader>
            <form onSubmit={handleGenerate} className="space-y-3 pt-2">
              <FormField label="Invigilator Full Name" required> {/* // terms-ok: e2e test field label */}
                <Input required placeholder="e.g. Dr. Ramesh Kumar" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-9 text-xs" />
              </FormField>
              <FormField label="Exam Hall / Room" required>
                <Input required placeholder="e.g. Lab 302 or Hall B" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="h-9 text-xs" />
              </FormField>
              <FormField label="Access Password" hint="Leave empty for auto-generated secure PIN">
                <PasswordInput placeholder="Leave blank to auto-generate" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </FormField>
              <Button type="submit" variant="primary" disabled={submitting} className="w-full mt-2">
                {submitting ? 'Generating Account...' : 'Generate & Assign Invigilator'} {/* // terms-ok: e2e test assertion label */}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="p-3 bg-[#edecfb] text-xs text-[#28253b] rounded-[12px] font-[420] border-0">
          {error}
        </div>
      )}

      <Card className="border-0 bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[16px] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proctor</TableHead>
                <TableHead>ID / Access Code</TableHead>
                <TableHead>Room / Hall</TableHead>
                <TableHead>Password Hint</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-[#70707d] font-[360]">Loading invigilators...</TableCell></TableRow>
              ) : invigilators.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-[#70707d] font-[360]">No invigilators assigned yet. Click "+ Generate Invigilator Account" to create credentials.</TableCell></TableRow> // terms-ok: e2e test assertion label
              ) : (
                invigilators.map((invig) => {
                  const isRevealed = revealedIds.has(invig.id)
                  const isCopied = copiedId === invig.id
                  return (
                    <TableRow key={invig.id}>
                      <TableCell>
                        <div className="font-[480] text-[#28253b] text-xs">{invig.fullName}</div>
                        <div className="text-[11px] font-mono text-[#70707d]">{invig.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-[480] text-[#5266eb]">
                        {invig.institutionId}
                      </TableCell>
                      <TableCell className="text-xs font-[400] text-[#554e7b]">
                        {invig.room}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span>{isRevealed ? (invig.generatedPasswordHint || '—') : '••••••••'}</span>
                          {invig.generatedPasswordHint && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => toggleReveal(invig.id)}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => copyCredentials(invig)}
                          >
                            {isCopied ? <Check className="w-3 h-3 text-[#5266eb]" /> : <Copy className="w-3 h-3 text-[#554e7b]" />}
                            {isCopied ? 'Copied!' : 'Copy Info'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(invig.id)}
                            className="h-7 px-2 text-[#70707d] hover:text-[#28253b] rounded-[40px] cursor-pointer"
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
