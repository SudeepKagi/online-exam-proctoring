import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/apiClient'
import { Settings, Trash2, Loader2, Save, ShieldCheck, Clock } from 'lucide-react'
import {
  getClientTimezone,
  utcIsoToDatetimeLocal,
  datetimeLocalToUtcIso,
  formatTimezoneLabel
} from '@/lib/scheduleUtils'

export default function ExamSettingsModal({ exam, isReadOnly = false, lifecycle = 'DRAFT', onUpdated }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const userTz = getClientTimezone()

  const initialSebRequired = Boolean(exam?.proctoringConfig?.sebRequired)
  const initialSebKey = exam?.proctoringConfig?.sebConfigKey || ''

  const [sebRequired, setSebRequired] = useState(initialSebRequired)
  const [sebConfigKey, setSebConfigKey] = useState(initialSebKey)
  const [keyChanged, setKeyChanged] = useState(false)
  const [keyRemoved, setKeyRemoved] = useState(false)

  const [form, setForm] = useState({
    title: exam?.title || '',
    courseCode: exam?.courseCode || '',
    durationMinutes: exam?.durationMinutes || 60,
    startTime: exam?.startTime ? utcIsoToDatetimeLocal(exam.startTime, userTz) : '',
    endTime: exam?.endTime ? utcIsoToDatetimeLocal(exam.endTime, userTz) : '',
  })

  useEffect(() => {
    if (open) {
      setSebRequired(Boolean(exam?.proctoringConfig?.sebRequired))
      setSebConfigKey(exam?.proctoringConfig?.sebConfigKey || '')
      setKeyChanged(false)
      setKeyRemoved(false)
      setForm({
        title: exam?.title || '',
        courseCode: exam?.courseCode || '',
        durationMinutes: exam?.durationMinutes || 60,
        startTime: exam?.startTime ? utcIsoToDatetimeLocal(exam.startTime, userTz) : '',
        endTime: exam?.endTime ? utcIsoToDatetimeLocal(exam.endTime, userTz) : '',
      })
    }
  }, [open, exam, userTz])

  const handleKeyChange = (e) => {
    setSebConfigKey(e.target.value)
    setKeyChanged(true)
    setKeyRemoved(false)
  }

  const handleRemoveKey = () => {
    setSebConfigKey('')
    setKeyChanged(false)
    setKeyRemoved(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (isReadOnly) return
    setSaving(true)
    setError('')
    try {
      const startUtcIso = datetimeLocalToUtcIso(form.startTime, userTz)
      const endUtcIso = datetimeLocalToUtcIso(form.endTime, userTz)

      const payload = {
        title: form.title,
        courseCode: form.courseCode,
        durationMinutes: parseInt(form.durationMinutes, 10),
        startTime: startUtcIso,
        endTime: endUtcIso,
        proctoringConfig: {
          ...(exam?.proctoringConfig || {}),
          timezone: userTz,
          sebRequired: Boolean(sebRequired)
        }
      }

      if (keyRemoved) {
        payload.clearSebConfigKey = true
        payload.proctoringConfig.clearSebConfigKey = true
        payload.proctoringConfig.sebConfigKey = null
      } else if (keyChanged && sebConfigKey.trim() && !sebConfigKey.trim().startsWith('•')) {
        payload.proctoringConfig.sebConfigKey = sebConfigKey.trim()
      }

      const res = await api.put(`/exams/${exam.id}`, payload)
      const updatedExam = res?.data?.exam || res?.data
      if (updatedExam?.proctoringConfig?.sebConfigKey) {
        setSebConfigKey(updatedExam.proctoringConfig.sebConfigKey)
      } else if (keyRemoved) {
        setSebConfigKey('')
      }
      setOpen(false)
      onUpdated?.('Exam configuration updated successfully!')
    } catch (err) {
      setError(errorMessage(err, 'Failed to update exam'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (isReadOnly) return
    if (!window.confirm('Are you sure you want to delete this draft exam? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/exams/${exam.id}`)
      setOpen(false)
      navigate('/faculty/exams')
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete exam'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent cursor-pointer">
          <Settings className="w-3.5 h-3.5 text-[#5266eb]" /> {isReadOnly ? 'View Settings' : 'Exam Settings'}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md font-sans">
        <DialogHeader className="border-b border-[#e9eaf2] pb-3">
          <DialogTitle className="text-base font-[480] text-[#28253b]">
            {isReadOnly ? 'Examination Settings (Read-Only)' : 'Edit Examination Settings'}
          </DialogTitle>
        </DialogHeader>

        {isReadOnly && (
          <div className="p-3 bg-[#edecfb] text-xs text-[#554e7b] rounded-[12px] font-[420] border-0">
            This examination is {lifecycle.toLowerCase()}. Configuration is locked and cannot be edited or deleted.
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#edecfb] text-xs text-[#28253b] rounded-[12px] font-[420] border-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-[420] text-[#554e7b]">Exam Title</Label>
            <Input
              required
              disabled={isReadOnly}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-[420] text-[#554e7b]">Course Code</Label>
            <Input
              required
              disabled={isReadOnly}
              value={form.courseCode}
              onChange={(e) => setForm({ ...form, courseCode: e.target.value })}
              className="h-9 text-xs font-mono uppercase"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-[420] text-[#554e7b] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#5266eb]" /> Timezone: {formatTimezoneLabel(userTz)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-[420] text-[#554e7b]">Start Window</Label>
              <Input
                required
                disabled={isReadOnly}
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-[420] text-[#554e7b]">End Window</Label>
              <Input
                required
                disabled={isReadOnly}
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-[420] text-[#554e7b]">Duration (Minutes)</Label>
            <Input
              required
              disabled={isReadOnly}
              type="number"
              min={5}
              max={300}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* Safe Exam Browser Section */}
          <div className="pt-3 border-t border-[#e9eaf2] space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="seb-required-toggle" className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5 cursor-pointer">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Safe Exam Browser
                </Label>
                <p className="text-[11px] text-[#70707d] font-[360]">Enforce kiosk lockdown mode using Safe Exam Browser</p>
              </div>
              <label htmlFor="seb-required-toggle" data-testid="label-seb-required" className="relative inline-flex items-center cursor-pointer">
                <input
                  id="seb-required-toggle"
                  data-testid="toggle-seb-required"
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={sebRequired}
                  onChange={(e) => setSebRequired(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#c3c3cc] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5266eb]"></div>
              </label>
            </div>

            {sebRequired && (
              <div className="p-3 bg-[#fbfbff] rounded-[12px] space-y-3 border-0">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="seb-config-key-input" className="text-[11px] font-[420] text-[#554e7b]">Config Key (Optional per-exam override)</Label>
                    {!isReadOnly && (sebConfigKey || initialSebKey) && (
                      <button
                        type="button"
                        data-testid="btn-remove-seb-key"
                        onClick={handleRemoveKey}
                        className="text-[11px] text-[#5266eb] hover:underline font-[420] cursor-pointer bg-transparent border-0 p-0"
                      >
                        Remove key
                      </button>
                    )}
                  </div>
                  <Input
                    id="seb-config-key-input"
                    data-testid="input-seb-config-key"
                    disabled={isReadOnly}
                    value={sebConfigKey}
                    onChange={handleKeyChange}
                    placeholder="Paste 64-hex Config Key or leave empty for default"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[11px] text-[#70707d] font-[360]">
                    Copy the CONFIG KEY, not the Browser Exam Key
                  </p>
                </div>

                <div className="pt-2 border-t border-[#e9eaf2]/80 space-y-1.5">
                  <p className="text-[11px] font-[480] text-[#28253b]">Configuration Checklist:</p>
                  <ul className="text-[11px] text-[#554e7b] font-[360] space-y-1 pl-1">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb]" />
                      "Use Browser &amp; Config Keys" ON
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb]" />
                      Camera allowed
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb]" />
                      Quit URL set
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {!isReadOnly && (
            <div className="pt-3 flex items-center justify-between border-t border-[#e9eaf2] mt-4">
              {exam?.status === 'DRAFT' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="text-xs text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb] gap-1 rounded-[40px] px-3 cursor-pointer border-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Draft
                </Button>
              )}

              <Button
                type="submit"
                disabled={saving}
                className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-9 px-4 rounded-[32px] shadow-xs ml-auto flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
