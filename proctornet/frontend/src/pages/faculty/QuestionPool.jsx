import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import {
  Plus, Trash2, Edit3, Save, X, Sparkles,
  ChevronDown, ChevronUp, Loader2, CheckCircle2,
  BookOpen, ArrowLeft, RefreshCw
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const diffColor = {
  EASY: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30',
  MEDIUM: 'bg-amber-500/10 text-amber-600 border border-amber-500/30',
  HARD: 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
}

function QuestionCard({ q, index, onDelete, onEdit }) {
  const [open, setOpen] = useState(true)
  return (
    <Card className="bg-card border-border overflow-hidden font-sans shadow-xs">
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <span className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <p className="flex-1 text-xs text-foreground font-semibold line-clamp-2">{q.questionText}</p>
        <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${diffColor[q.difficulty] || diffColor.MEDIUM}`}>{q.difficulty}</span>
          <span className="text-muted-foreground font-semibold">{q.marks}m</span>
          <Badge variant="outline" className="text-[10px] border-border bg-background font-mono">{q.type}</Badge>
          <button onClick={e => { e.stopPropagation(); onEdit(q) }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-primary"><Edit3 size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(q.id) }} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500"><Trash2 size={13} /></button>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>
      {open && q.type === 'MCQ' && Array.isArray(q.options) && q.options.length > 0 && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
          {q.options.map((opt, i) => {
            const text = typeof opt === 'string' ? opt : opt.text
            const letter = String.fromCharCode(65 + i)
            const isCorrect = typeof opt === 'object' && opt.isCorrect !== undefined
              ? opt.isCorrect
              : (q.correctAnswer === letter || q.correctAnswer === String(i) || text === q.correctAnswer)
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isCorrect ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold' : 'bg-background text-muted-foreground border border-border'}`}>
                <span className={`w-5 h-5 rounded-md text-[10px] font-mono font-bold flex items-center justify-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-muted text-foreground/70'}`}>
                  {letter}
                </span>
                <span className="flex-1">{text}</span>
                {isCorrect && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
              </div>
            )
          })}
        </div>
      )}
      {open && q.type !== 'MCQ' && q.correctAnswer && (
        <div className="px-4 pb-4 text-xs font-sans">
          <p className="text-[10px] font-mono text-muted-foreground mb-1">Model Answer / Key Points</p>
          <p className="text-foreground/90 bg-background border border-border rounded-xl p-3">{q.correctAnswer}</p>
        </div>
      )}
    </Card>
  )
}

export default function QuestionPool() {
  const { id: examId } = useParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editQ, setEditQ] = useState(null)
  const [questionToDelete, setQuestionToDelete] = useState(null)

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(10)
  const [aiDifficulty, setAiDifficulty] = useState('HARD')
  const [aiGenerating, setAiGenerating] = useState(false)

  // Question Form state
  const [form, setForm] = useState({
    type: 'MCQ',
    questionText: '',
    marks: 2,
    difficulty: 'HARD',
    options: ['', '', '', ''],
    correctOption: 0,
    correctAnswer: 'A',
    codeTemplate: '',
    wordLimitMax: 250
  })

  useEffect(() => {
    loadAll()
  }, [examId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [exRes, qRes] = await Promise.all([
        api.get(`/faculty/exams/${examId}`),
        api.get(`/faculty/questions/${examId}`)
      ])
      const exData = exRes.data.exam || exRes.data
      setExam(exData)
      setAiTopic(exData.title || exData.subject || 'Operating Systems')
      setQuestions(qRes.data.questions || qRes.data || [])
    } catch {
      toast.error('Failed to load questions')
    } finally { setLoading(false) }
  }

  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) return toast.error('Please enter a topic or subject syllabus')
    setAiGenerating(true)
    try {
      const res = await api.post(`/faculty/exams/${examId}/ai-generate`, {
        topic: aiTopic,
        count: parseInt(aiCount) || 10,
        numMCQ: parseInt(aiCount) || 10,
        difficulty: aiDifficulty
      })
      toast.success(res.data.message || `Successfully generated ${aiCount} questions!`)
      setShowAI(false)
      loadAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI question generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.questionText.trim()) return toast.error('Enter question text')
    
    // Format options cleanly
    const formattedOptions = form.options.map((optText, idx) => ({
      text: optText || `Option ${String.fromCharCode(65 + idx)}`,
      isCorrect: idx === form.correctOption
    }))

    const payload = {
      ...form,
      examId,
      options: formattedOptions,
      correctAnswer: String.fromCharCode(65 + form.correctOption),
      marks: Number(form.marks || 2)
    }

    try {
      if (editQ) {
        await api.put(`/faculty/questions/${editQ.id}`, payload)
        toast.success('Question updated')
      } else {
        await api.post(`/faculty/questions`, payload)
        toast.success('Question added')
      }
      setShowForm(false)
      setEditQ(null)
      loadAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save question')
    }
  }

  const handleDelete = (id) => {
    setQuestionToDelete(id)
  }

  const performDelete = async () => {
    if (!questionToDelete) return
    try {
      await api.delete(`/faculty/questions/${questionToDelete}`)
      toast.success('Question deleted')
      loadAll()
    } catch { toast.error('Failed to delete') }
    finally { setQuestionToDelete(null) }
  }

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-5 py-2 font-sans max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <button
              onClick={() => navigate(`/faculty/exams/${examId}`)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1 cursor-pointer"
            >
              <ArrowLeft size={13} /> Back to Exam Dashboard
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{exam?.title || 'Question Pool'}</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Subject: {exam?.subject || 'CS301'} • Total Questions: {questions.length}</p>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <Button size="sm" variant={showAI ? "default" : "outline"} onClick={() => setShowAI(s => !s)} className="text-xs">
              <Sparkles size={14} className="mr-1.5" /> AI Generator
            </Button>
            <Button size="sm" onClick={() => {
              setEditQ(null)
              setForm({
                type: 'MCQ', questionText: '', marks: 2, difficulty: 'HARD',
                options: ['', '', '', ''], correctOption: 0, correctAnswer: 'A', codeTemplate: '', wordLimitMax: 250
              })
              setShowForm(true)
            }} className="text-xs font-bold">
              <Plus size={14} className="mr-1.5" /> Add Question
            </Button>
          </div>
        </div>

        {/* AI Generator Panel */}
        {showAI && (
          <Card className="bg-primary/5 border-primary/20 p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">AI Question Generator</h3>
                  <p className="text-xs text-muted-foreground">Generate comprehensive exam questions instantly based on syllabus topics</p>
                </div>
              </div>
              <button onClick={() => setShowAI(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Subject Topic / Syllabus Notes</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g. Operating Systems: Paging, Deadlocks, Scheduling, Memory Management"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Number of Questions</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={aiCount}
                  onChange={e => setAiCount(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Difficulty Level</label>
                <select
                  value={aiDifficulty}
                  onChange={e => setAiDifficulty(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleGenerateAI}
                  disabled={aiGenerating}
                  className="w-full text-xs font-bold"
                >
                  {aiGenerating ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
                  {aiGenerating ? 'Generating Questions…' : `Generate ${aiCount} Questions`}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Manual Add / Edit Question Form Modal */}
        {showForm && (
          <Card className="bg-card border-border p-5 rounded-2xl shadow-md">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">{editQ ? 'Edit Question' : 'Add New Question'}</h3>
              <button onClick={() => { setShowForm(false); setEditQ(null) }} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Question Text</label>
                <textarea
                  rows={3}
                  value={form.questionText}
                  onChange={e => setForm({ ...form, questionText: e.target.value })}
                  placeholder="Enter clear, concise question statement…"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Marks</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={form.marks}
                    onChange={e => setForm({ ...form, marks: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={e => setForm({ ...form, difficulty: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
              </div>

              {form.type === 'MCQ' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Options & Correct Answer (Select the radio button for the correct option)
                  </label>
                  {form.options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx)
                    const textVal = typeof opt === 'string' ? opt : (opt?.text || '')
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={form.correctOption === idx}
                          onChange={() => setForm({ ...form, correctOption: idx, correctAnswer: letter })}
                          className="w-4 h-4 text-primary cursor-pointer"
                        />
                        <span className="w-6 text-xs font-mono font-bold text-muted-foreground">{letter}:</span>
                        <input
                          type="text"
                          value={textVal}
                          onChange={e => {
                            const next = [...form.options]
                            next[idx] = e.target.value
                            setForm({ ...form, options: next })
                          }}
                          placeholder={`Option ${letter} text`}
                          className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                          required
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setEditQ(null) }}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="font-bold">
                  <Save size={14} className="mr-1.5" /> Save Question
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Question Cards List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading questions…</div>
          ) : questions.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center text-xs font-mono text-muted-foreground">
              No questions found in pool. Use AI Generator or Add Question to populate this exam.
            </Card>
          ) : (
            questions.map((q, idx) => {
              // Parse options if stored as string/array
              const parsedQ = {
                ...q,
                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                correctOption: typeof q.correctOption === 'number'
                  ? q.correctOption
                  : (q.correctAnswer && q.correctAnswer.length === 1 ? q.correctAnswer.charCodeAt(0) - 65 : 0)
              }
              return (
                <QuestionCard
                  key={q.id || idx}
                  q={parsedQ}
                  index={idx}
                  onDelete={handleDelete}
                  onEdit={(qToEdit) => {
                    const rawOpts = Array.isArray(qToEdit.options) ? qToEdit.options.map(o => typeof o === 'string' ? o : (o.text || '')) : ['', '', '', '']
                    setEditQ(qToEdit)
                    setForm({
                      type: qToEdit.type || 'MCQ',
                      questionText: qToEdit.questionText || '',
                      marks: qToEdit.marks || 2,
                      difficulty: qToEdit.difficulty || 'HARD',
                      options: rawOpts,
                      correctOption: qToEdit.correctOption || 0,
                      correctAnswer: qToEdit.correctAnswer || 'A',
                      codeTemplate: qToEdit.codeTemplate || '',
                      wordLimitMax: qToEdit.wordLimitMax || 250
                    })
                    setShowForm(true)
                  }}
                />
              )
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!questionToDelete}
        onOpenChange={(open) => { if (!open) setQuestionToDelete(null) }}
        title="Delete Question?"
        description="Are you sure you want to delete this question? It will be removed from this exam's question pool."
        confirmText="Delete Question"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={performDelete}
      />
    </DashboardLayout>
  )
}
