import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import {
  Plus, Trash2, Edit3, Save, X, FileText, Sparkles,
  ChevronDown, ChevronUp, Upload, Loader2, CheckCircle,
  BookOpen, AlertCircle, RefreshCw, CheckCircle2
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const diffColor = { EASY: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', MEDIUM: 'bg-amber-500/10 text-amber-400 border border-amber-500/30', HARD: 'bg-rose-500/10 text-rose-400 border border-rose-500/30' }

function QuestionCard({ q, index, onDelete, onEdit }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="bg-card border-border overflow-hidden font-sans">
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <span className="w-6 h-6 rounded-full bg-background border border-border text-foreground/90 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
        <p className="flex-1 text-xs text-foreground font-semibold line-clamp-2">{q.questionText}</p>
        <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${diffColor[q.difficulty] || diffColor.MEDIUM}`}>{q.difficulty}</span>
          <span className="text-muted-foreground">{q.marks}m</span>
          <Badge variant="outline" className="text-[10px] border-border bg-background">{q.type}</Badge>
          <button onClick={e => { e.stopPropagation(); onEdit(q) }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-primary"><Edit3 size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(q.id) }} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-400"><Trash2 size={13} /></button>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>
      {open && q.type === 'MCQ' && Array.isArray(q.options) && q.options.length > 0 && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2 text-xs font-sans">
          {q.options.map((opt, i) => {
            const text = typeof opt === 'string' ? opt : opt.text
            const correct = typeof opt === 'object' ? opt.isCorrect : text === q.correctAnswer
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${correct ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold' : 'bg-background text-muted-foreground border border-border'}`}>
                {correct && <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
                <span>{text}</span>
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

  const [form, setForm] = useState({
    type: 'MCQ', questionText: '', marks: 2, difficulty: 'MEDIUM',
    options: ['', '', '', ''], correctAnswer: 'A', codeTemplate: '', wordLimitMax: 250
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
      setExam(exRes.data.exam || exRes.data)
      setQuestions(qRes.data.questions || qRes.data || [])
    } catch {
      toast.error('Failed to load questions')
    } finally { setLoading(false) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.questionText.trim()) return toast.error('Enter question text')
    try {
      if (editQ) {
        await api.put(`/faculty/questions/${editQ.id}`, form)
        toast.success('Question updated')
      } else {
        await api.post(`/faculty/questions`, { ...form, examId })
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
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{exam?.title || 'Question Pool'}</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Subject: {exam?.subject || 'CS301'} • Total Questions: {questions.length}</p>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <Button size="sm" variant="outline" onClick={() => setShowAI(s => !s)} className="text-xs border-border">
              <Sparkles size={14} className="mr-1.5 text-primary" /> AI Generator
            </Button>
            <Button size="sm" onClick={() => { setEditQ(null); setShowForm(true) }} className="text-xs bg-primary hover:bg-primary text-white font-bold">
              <Plus size={14} className="mr-1.5" /> Add Question
            </Button>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">Loading questions…</div>
          ) : questions.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center text-xs font-mono text-slate-500">
              No questions found in pool. Use AI Generator or Add Question to populate this exam.
            </Card>
          ) : (
            questions.map((q, idx) => (
              <QuestionCard key={q.id || idx} q={q} index={idx} onDelete={handleDelete} onEdit={(q) => { setEditQ(q); setForm(q); setShowForm(true) }} />
            ))
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
