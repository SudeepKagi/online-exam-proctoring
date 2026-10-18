import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage } from '@/lib/apiClient'
import { Sparkles, Loader2, CheckCircle2, Plus, ArrowRight } from 'lucide-react'

export default function ExamAiModal({ examId, onQuestionsAdded }) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [syllabusText, setSyllabusText] = useState('')
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [generated, setGenerated] = useState([])
  const [error, setError] = useState('')

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!topic.trim()) {
      setError('Please provide a subject topic for question generation.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await api.post(`/exams/${examId}/generate-questions`, {
        topic: topic.trim(),
        syllabusText: syllabusText.trim(),
        difficulty,
        count: parseInt(count, 10) || 5
      })
      setGenerated(res.data?.questions || [])
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate questions. Please retry.'))
    } finally {
      setLoading(false)
    }
  }

  const handleInsertAll = async () => {
    if (generated.length === 0) return
    setInserting(true)
    setError('')
    try {
      await api.post(`/exams/${examId}/questions/bulk`, { questions: generated })
      setOpen(false)
      setGenerated([])
      setTopic('')
      setSyllabusText('')
      onQuestionsAdded?.(`Successfully added ${generated.length} AI-generated questions to the exam!`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to save generated questions to exam.'))
    } finally {
      setInserting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-1.5 text-xs font-bold rounded-xl shadow-xs">
          <Sparkles className="w-3.5 h-3.5" /> ✨ AI Generate Questions
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            AI MCQ Generator & Question Assistant
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium">
            {error}
          </div>
        )}

        {generated.length === 0 ? (
          <form onSubmit={handleGenerate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Exam Topic or Chapter</Label>
              <Input
                required
                placeholder="e.g. Process Scheduling & Synchronization, Relational Algebra, RSA Cryptography"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-10 text-xs border-slate-300 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Syllabus Excerpt or Specific Concepts (Optional)</Label>
              <textarea
                rows={3}
                placeholder="Paste key learning objectives, formulas, or lecture notes to focus the generator..."
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Target Difficulty</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full h-10 text-xs border border-slate-300 rounded-xl px-2.5 bg-white font-medium"
                >
                  <option value="EASY">EASY (Foundational Definitions)</option>
                  <option value="MEDIUM">MEDIUM (Conceptual Application)</option>
                  <option value="HARD">HARD (Complex Scenarios & Analysis)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Number of Questions</Label>
                <select
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-full h-10 text-xs border border-slate-300 rounded-xl px-2.5 bg-white font-medium"
                >
                  <option value="3">3 Questions</option>
                  <option value="5">5 Questions</option>
                  <option value="10">10 Questions</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing Rigorous MCQs...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Questions Preview
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Generated {generated.length} Questions for "{topic}"
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerated([])}
                className="text-xs rounded-lg h-7"
              >
                Regenerate
              </Button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {generated.map((q, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-600">Question {idx + 1} ({q.marks} Mark)</span>
                    <Badge variant="outline" className="text-[10px] bg-white">{q.difficulty}</Badge>
                  </div>
                  <p className="text-xs font-semibold text-slate-900">{q.questionText}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {(q.options || []).map((opt, i) => (
                      <div
                        key={i}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                          i === q.correctOptionIndex
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}. {opt}
                        {i === q.correctOptionIndex && ' (Correct)'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={inserting}
                onClick={handleInsertAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                {inserting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Insert All {generated.length} Questions into Exam
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
