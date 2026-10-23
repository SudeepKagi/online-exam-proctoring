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
        <Button size="sm" className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] px-4 h-9 shadow-xs cursor-pointer">
          <Sparkles className="w-3.5 h-3.5" /> ✨ AI Generate Questions
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-[#e9eaf2] pb-3">
          <DialogTitle className="text-base font-[480] text-[#28253b] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#5266eb]" />
            AI MCQ Generator & Question Assistant
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-[#edecfb] text-xs text-[#28253b] rounded-[12px] font-[420] border-0">
            {error}
          </div>
        )}

        {generated.length === 0 ? (
          <form onSubmit={handleGenerate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-[420] text-[#554e7b]">Exam Topic or Chapter</Label>
              <Input
                required
                placeholder="e.g. Process Scheduling & Synchronization, Relational Algebra, RSA Cryptography"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-10 text-xs border border-[#c3c3cc]/60 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-[420] text-[#554e7b]">Syllabus Excerpt or Specific Concepts (Optional)</Label>
              <textarea
                rows={3}
                placeholder="Paste key learning objectives, formulas, or lecture notes to focus the generator..."
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                className="w-full text-xs p-3 border border-[#c3c3cc]/60 rounded-xl focus:outline-none focus:border-[#5266eb] font-sans text-[#28253b]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-[420] text-[#554e7b]">Target Difficulty</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full h-10 text-xs border border-[#c3c3cc]/60 rounded-xl px-2.5 bg-white font-[420] text-[#28253b] outline-none focus:border-[#5266eb]"
                >
                  <option value="EASY">EASY (Foundational Definitions)</option>
                  <option value="MEDIUM">MEDIUM (Conceptual Application)</option>
                  <option value="HARD">HARD (Complex Scenarios & Analysis)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-[420] text-[#554e7b]">Number of Questions</Label>
                <select
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-full h-10 text-xs border border-[#c3c3cc]/60 rounded-xl px-2.5 bg-white font-[420] text-[#28253b] outline-none focus:border-[#5266eb]"
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
                className="w-full h-10 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center justify-center gap-2 cursor-pointer"
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
              <span className="text-xs font-[480] text-[#28253b]">
                Generated {generated.length} Questions for "{topic}"
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerated([])}
                className="text-xs font-[420] rounded-[40px] px-3 h-7 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent"
              >
                Regenerate
              </Button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {generated.map((q, idx) => (
                <div key={idx} className="p-3 bg-[#fbfbff] border border-[#e9eaf2] rounded-[12px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-[480] text-[#5266eb]">Question {idx + 1} ({q.marks} Mark)</span>
                    <Badge variant="outline" className="text-[10px] font-[420] bg-white border-[#e9eaf2] text-[#554e7b]">{q.difficulty}</Badge>
                  </div>
                  <p className="text-xs font-[480] text-[#28253b]">{q.questionText}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {(q.options || []).map((opt, i) => (
                      <div
                        key={i}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-[420] ${
                          i === q.correctOptionIndex
                            ? 'bg-[#edecfb] text-[#5266eb] border-[#5266eb]/30 font-[480]'
                            : 'bg-white text-[#554e7b] border-[#e9eaf2]'
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

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#e9eaf2]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs font-[420] rounded-[40px] px-4 h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={inserting}
                onClick={handleInsertAll}
                className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-4 h-9 shadow-xs flex items-center gap-1.5 cursor-pointer"
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
