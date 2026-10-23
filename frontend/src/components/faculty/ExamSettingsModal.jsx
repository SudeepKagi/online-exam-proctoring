import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/apiClient'
import { Settings, Trash2, Loader2, Save } from 'lucide-react'

export default function ExamSettingsModal({ exam, isReadOnly = false, lifecycle = 'DRAFT', onUpdated }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: exam?.title || '',
    courseCode: exam?.courseCode || '',
    durationMinutes: exam?.durationMinutes || 60,
    startTime: exam?.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '',
    endTime: exam?.endTime ? new Date(exam.endTime).toISOString().slice(0, 16) : '',
  })

  const handleSave = async (e) => {
    e.preventDefault()
    if (isReadOnly) return
    setSaving(true)
    setError('')
    try {
      await api.put(`/exams/${exam.id}`, {
        title: form.title,
        courseCode: form.courseCode,
        durationMinutes: parseInt(form.durationMinutes, 10),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString()
      })
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
