import React, { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/apiClient'
import ExamAiModal from '@/components/faculty/ExamAiModal'
import { PlusCircle, Trash2, Upload, Loader2 } from 'lucide-react'

export default function ExamQuestionsTab({ examId, questions, isReadOnly = false, onRefresh, onNotify }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ questionText: '', option0: '', option1: '', option2: '', option3: '', correctOptionIndex: 0, marks: 1 })
  const fileInputRef = useRef(null)

  const handleUploadQuestions = async (e) => {
    if (isReadOnly) return
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/exams/${examId}/questions/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onNotify(`Imported ${res.data?.count || 0} questions successfully.`, 'success')
      onRefresh()
    } catch (err) {
      onNotify(errorMessage(err, 'Failed to upload questions'), 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddQuestion = async (e) => {
    e.preventDefault()
    if (isReadOnly) return
    try {
      const options = [form.option0, form.option1, form.option2, form.option3]
      await api.post(`/exams/${examId}/questions`, {
        questionText: form.questionText,
        options,
        correctOptionIndex: parseInt(form.correctOptionIndex, 10),
        marks: parseFloat(form.marks),
      })
      setDialogOpen(false)
      setForm({ questionText: '', option0: '', option1: '', option2: '', option3: '', correctOptionIndex: 0, marks: 1 })
      onNotify('Question added successfully.', 'success')
      onRefresh()
    } catch (err) {
      onNotify(errorMessage(err, 'Failed to add question'), 'error')
    }
  }

  const handleDeleteQuestion = async (qId) => {
    if (isReadOnly) return
    try {
      await api.delete(`/exams/${examId}/questions/${qId}`)
      onRefresh()
    } catch (err) {
      onNotify(errorMessage(err, 'Delete failed'), 'error')
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-xs text-[#70707d] font-[360]">Curate multiple choice questions via manual authoring, Excel import, or AI generation.</p>
        {isReadOnly ? (
          <div className="px-3.5 py-1.5 rounded-[40px] bg-[#edecfb] text-[#554e7b] text-xs font-[420] flex items-center gap-1.5">
            <span>Locked (Read-Only Mode)</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ExamAiModal examId={examId} onQuestionsAdded={(t) => { onNotify(t, 'success'); onRefresh() }} />
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadQuestions} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs font-[420] rounded-[40px] px-3.5 h-9 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload Excel
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] px-4 h-9 shadow-xs cursor-pointer">
                  <PlusCircle className="w-3.5 h-3.5" /> + Add MCQ
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md font-sans">
                <DialogHeader><DialogTitle className="text-base font-[480] text-[#28253b]">New Multiple Choice Question</DialogTitle></DialogHeader>
                <form onSubmit={handleAddQuestion} className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-[420] text-[#554e7b]">Question Prompt</Label>
                    <Input required value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} placeholder="Enter question..." className="h-9 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div key={idx} className="space-y-1">
                        <Label className="text-xs font-[420] text-[#554e7b]">Option {String.fromCharCode(65 + idx)}</Label>
                        <Input required value={form[`option${idx}`]} onChange={(e) => setForm({ ...form, [`option${idx}`]: e.target.value })} placeholder={`Opt ${idx + 1}`} className="h-9 text-xs" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-[420] text-[#554e7b]">Correct Choice</Label>
                      <select className="w-full border border-[#c3c3cc]/60 rounded-xl p-1.5 text-xs bg-white h-9 text-[#28253b] font-[420] outline-none focus:border-[#5266eb]" value={form.correctOptionIndex} onChange={(e) => setForm({ ...form, correctOptionIndex: e.target.value })}>
                        <option value={0}>Option A</option><option value={1}>Option B</option><option value={2}>Option C</option><option value={3}>Option D</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-[420] text-[#554e7b]">Marks</Label>
                      <Input required type="number" min={0.5} step={0.5} value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} className="h-9 text-xs" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] mt-2 cursor-pointer">Save Question</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
        <CardContent className="p-4 space-y-3">
          {questions.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#70707d] font-[360]">No questions added yet. Use "✨ AI Generate Questions" or "+ Add MCQ" to populate this exam.</div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id || idx} className="p-3 border border-[#e9eaf2] rounded-[12px] bg-[#fbfbff] flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-[480] text-[#5266eb] mb-1">Question {idx + 1} ({q.marks} pts)</div>
                  <p className="text-xs font-[480] text-[#28253b]">{q.questionText}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                    {(Array.isArray(q.options) ? q.options : []).map((opt, i) => (
                      <div key={i} className={`text-xs px-2.5 py-1.5 rounded-lg border font-[420] ${i === q.correctOptionIndex ? 'border-[#5266eb]/30 bg-[#edecfb] text-[#5266eb] font-[480]' : 'border-[#e9eaf2] bg-white text-[#554e7b]'}`}>
                        {String.fromCharCode(65 + i)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
                {!isReadOnly && (
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(q.id)} className="text-[#70707d] hover:text-[#28253b] h-8 rounded-[40px] cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
