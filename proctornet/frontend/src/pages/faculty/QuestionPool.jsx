import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, Save, X, FileText, Sparkles,
  ChevronDown, ChevronUp, Upload, Loader2, CheckCircle,
  BookOpen, AlertCircle, RefreshCw
} from 'lucide-react'

// ── Difficulty badge ──────────────────────────────────────────
const diffColor = { EASY: 'bg-green-100 text-green-700', MEDIUM: 'bg-amber-100 text-amber-700', HARD: 'bg-red-100 text-red-700' }

// ── Single question card ──────────────────────────────────────
function QuestionCard({ q, index, onDelete, onEdit }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
        <p className="flex-1 text-sm text-gray-800 font-medium line-clamp-2">{q.questionText}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${diffColor[q.difficulty] || diffColor.MEDIUM}`}>{q.difficulty}</span>
          <span className="text-xs text-gray-400 font-medium">{q.marks}m</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{q.type}</span>
          <button onClick={e => { e.stopPropagation(); onEdit(q) }} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500"><Edit3 size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(q.id) }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={13} /></button>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>
      {open && q.type === 'MCQ' && Array.isArray(q.options) && q.options.length > 0 && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          {q.options.map((opt, i) => {
            const text = typeof opt === 'string' ? opt : opt.text
            const correct = typeof opt === 'object' ? opt.isCorrect : text === q.correctAnswer
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${correct ? 'bg-green-50 border border-green-200 text-green-800 font-semibold' : 'bg-gray-50 text-gray-600'}`}>
                {correct && <CheckCircle size={12} className="text-green-500 flex-shrink-0" />}
                <span>{text}</span>
              </div>
            )
          })}
        </div>
      )}
      {open && q.type !== 'MCQ' && q.correctAnswer && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400 mb-1">Model Answer / Key Points</p>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{q.correctAnswer}</p>
        </div>
      )}
    </div>
  )
}

// ── Option row for MCQ builder ────────────────────────────────
function OptionRow({ opt, index, onChange, onRemove, onMark }) {
  return (
    <div className="flex items-center gap-2">
      <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => onMark(index)} className="accent-indigo-600" />
      <input value={opt.text} onChange={e => onChange(index, e.target.value)}
        placeholder={`Option ${String.fromCharCode(65 + index)}`}
        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      <button onClick={() => onRemove(index)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><X size={13} /></button>
    </div>
  )
}

// ── Manual Question Form ──────────────────────────────────────
function QuestionForm({ examId, editQ, onSaved, onCancel }) {
  const [type, setType] = useState(editQ?.type || 'MCQ')
  const [stem, setStem] = useState(editQ?.questionText || '')
  const [options, setOptions] = useState(() => {
    if (editQ?.type === 'MCQ' && Array.isArray(editQ.options) && editQ.options.length)
      return editQ.options.map(o => typeof o === 'string' ? { text: o, isCorrect: o === editQ.correctAnswer } : o)
    return [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]
  })
  const [correctAnswer, setCorrectAnswer] = useState(editQ?.correctAnswer || '')
  const [marks, setMarks] = useState(editQ?.marks || 2)
  const [negativeMarks, setNegativeMarks] = useState(editQ?.negativeMarks || 0)
  const [difficulty, setDifficulty] = useState(editQ?.difficulty || 'MEDIUM')
  const [saving, setSaving] = useState(false)

  const updateOpt = (i, val) => setOptions(opts => opts.map((o, idx) => idx === i ? { ...o, text: val } : o))
  const markCorrect = (i) => setOptions(opts => opts.map((o, idx) => ({ ...o, isCorrect: idx === i })))
  const removeOpt = (i) => setOptions(opts => opts.filter((_, idx) => idx !== i))
  const addOpt = () => setOptions(opts => [...opts, { text: '', isCorrect: false }])

  const handleSave = async () => {
    if (!stem.trim()) return toast.error('Question text is required')
    if (type === 'MCQ' && !options.some(o => o.isCorrect)) return toast.error('Mark at least one correct option')
    setSaving(true)
    try {
      const payload = {
        type,
        questionText: stem,
        options: type === 'MCQ' ? options : [],
        correctAnswer: type === 'MCQ' ? (options.find(o => o.isCorrect)?.text || '') : correctAnswer,
        marks: parseFloat(marks),
        negativeMarks: parseFloat(negativeMarks),
        difficulty,
      }
      if (editQ) {
        await api.put(`/faculty/questions/${editQ.id}`, payload)
        toast.success('Question updated!')
      } else {
        await api.post(`/faculty/exams/${examId}/questions`, payload)
        toast.success('Question added!')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save question')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl shadow-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{editQ ? 'Edit Question' : 'Add Question'}</h3>
        <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15} /></button>
      </div>

      {/* Type selector */}
      <div className="flex gap-2">
        {['MCQ', 'SUBJECTIVE', 'CODE'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Question stem */}
      <textarea value={stem} onChange={e => setStem(e.target.value)} rows={3}
        placeholder="Enter question text…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />

      {/* MCQ options */}
      {type === 'MCQ' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Options — select correct answer</p>
          {options.map((opt, i) => (
            <OptionRow key={i} opt={opt} index={i} onChange={updateOpt} onRemove={removeOpt} onMark={markCorrect} />
          ))}
          {options.length < 6 && (
            <button onClick={addOpt} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Plus size={12} /> Add option</button>
          )}
        </div>
      )}

      {/* Subjective/Code answer */}
      {type !== 'MCQ' && (
        <textarea value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} rows={3}
          placeholder="Model answer or key points…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      )}

      {/* Marks / difficulty */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Marks</label>
          <input type="number" min={0} step={0.5} value={marks} onChange={e => setMarks(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Negative Marks</label>
          <input type="number" min={0} step={0.5} value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option>EASY</option><option>MEDIUM</option><option>HARD</option>
          </select>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Saving…' : editQ ? 'Update Question' : 'Add Question'}
      </button>
    </div>
  )
}

// ── AI Generator Panel ────────────────────────────────────────
function AIGeneratorPanel({ examId, onGenerated }) {
  const [file, setFile] = useState(null)
  const [extractedText, setExtractedText] = useState('')
  const [numMCQ, setNumMCQ] = useState(5)
  const [numEssay, setNumEssay] = useState(2)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [marksPerMCQ, setMarksPerMCQ] = useState(2)
  const [marksPerEssay, setMarksPerEssay] = useState(10)
  const [step, setStep] = useState('upload') // upload | preview | generating | done
  const [generating, setGenerating] = useState(false)
  const fileRef = useRef()

  // Extract text from PDF using browser FileReader + pdf.js via CDN
  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.type !== 'application/pdf') return toast.error('Please upload a PDF file')
    setFile(f)
    setStep('upload')

    // Read as ArrayBuffer and extract text via pdf.js
    toast.loading('Extracting text from PDF…', { id: 'pdf' })
    try {
      const arrayBuffer = await f.arrayBuffer()
      // Use pdf.js from CDN if available, else fall back to raw text
      if (window.pdfjsLib) {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''
        for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += content.items.map(item => item.str).join(' ') + '\n'
        }
        setExtractedText(fullText.trim())
      } else {
        // Fallback: read as text (works for text-based PDFs)
        const text = await f.text().catch(() => '')
        setExtractedText(text.replace(/[^\x20-\x7E\n]/g, ' ').trim())
      }
      toast.success('Text extracted!', { id: 'pdf' })
      setStep('preview')
    } catch {
      toast.error('Could not read PDF. Try pasting text below.', { id: 'pdf' })
      setStep('preview')
    }
  }

  const handleGenerate = async () => {
    const text = extractedText.trim()
    if (text.length < 50) return toast.error('Need at least 50 characters of content')
    setGenerating(true)
    setStep('generating')
    try {
      const res = await api.post(`/faculty/exams/${examId}/ai-generate`, {
        text, numMCQ: parseInt(numMCQ), numEssay: parseInt(numEssay),
        difficulty, marksPerMCQ: parseFloat(marksPerMCQ), marksPerEssay: parseFloat(marksPerEssay)
      })
      toast.success(res.data.message || 'Questions generated!')
      setStep('done')
      onGenerated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed')
      setStep('preview')
    } finally { setGenerating(false) }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">AI Question Generator</h3>
          <p className="text-xs text-gray-500">Upload a PDF — Gemini AI will generate your question pool</p>
        </div>
      </div>

      {/* PDF Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-white/60 transition-all">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={18} className="text-indigo-500" />
            <span className="text-sm font-medium text-indigo-700">{file.name}</span>
          </div>
        ) : (
          <>
            <Upload size={24} className="text-indigo-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Click to upload PDF</p>
            <p className="text-xs text-gray-400 mt-0.5">or paste text below</p>
          </>
        )}
      </div>

      {/* Extracted / pasted text */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Content Text <span className="text-gray-400 font-normal">(auto-filled from PDF, or paste manually)</span>
        </label>
        <textarea value={extractedText} onChange={e => setExtractedText(e.target.value)} rows={5}
          placeholder="Paste your lecture notes, textbook content, or topic summary here…"
          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <p className="text-xs text-gray-400 mt-1">{extractedText.length} characters</p>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'MCQ Count', value: numMCQ, set: setNumMCQ, min: 1, max: 20 },
          { label: 'Essay Count', value: numEssay, set: setNumEssay, min: 0, max: 10 },
          { label: 'Marks / MCQ', value: marksPerMCQ, set: setMarksPerMCQ, min: 0.5, step: 0.5 },
          { label: 'Marks / Essay', value: marksPerEssay, set: setMarksPerEssay, min: 1 },
        ].map(({ label, value, set, min = 1, max, step = 1 }) => (
          <div key={label}>
            <label className="text-xs text-gray-400 mb-1 block">{label}</label>
            <input type="number" min={min} max={max} step={step} value={value} onChange={e => set(e.target.value)}
              className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option>EASY</option><option>MEDIUM</option><option>HARD</option>
          </select>
        </div>
      </div>

      {step === 'done' ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={16} className="text-green-500" />
          <p className="text-sm text-green-700 font-medium">Questions generated and saved!</p>
          <button onClick={() => { setStep('upload'); setFile(null); setExtractedText('') }}
            className="ml-auto text-xs text-green-600 hover:underline flex items-center gap-1"><RefreshCw size={11} /> Generate more</button>
        </div>
      ) : (
        <button onClick={handleGenerate} disabled={generating || extractedText.trim().length < 50}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? 'Generating with Gemini AI…' : `Generate ${numMCQ} MCQ + ${numEssay} Essay Questions`}
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function QuestionPool() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState([])
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editQ, setEditQ] = useState(null)
  const [showAI, setShowAI] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [qRes, eRes] = await Promise.all([
        api.get(`/faculty/exams/${examId}/questions`),
        api.get(`/faculty/exams/${examId}`)
      ])
      setQuestions(qRes.data.questions || [])
      setExam(eRes.data.exam)
    } catch { toast.error('Failed to load questions') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [examId])

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    try {
      await api.delete(`/faculty/questions/${id}`)
      toast.success('Question deleted')
      fetchData()
    } catch { toast.error('Failed to delete') }
  }

  const handleEdit = (q) => {
    setEditQ(q)
    setShowForm(true)
    setShowAI(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onSaved = () => {
    setShowForm(false)
    setEditQ(null)
    fetchData()
  }

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0)

  return (
    <DashboardLayout title="Question Pool">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{exam?.title || 'Question Pool'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {questions.length} questions · {totalMarks} total marks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAI(v => !v); setShowForm(false); setEditQ(null) }}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl border transition-all ${showAI ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}>
            <Sparkles size={15} /> AI Generate
          </button>
          <button onClick={() => { setShowForm(v => !v); setEditQ(null); setShowAI(false) }}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl border transition-all ${showForm && !editQ ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
            <Plus size={15} /> Add Manually
          </button>
          <button onClick={() => navigate(`/faculty/exams/${examId}`)}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl bg-white">
            ← Back
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAI && (
        <div className="mb-5">
          <AIGeneratorPanel examId={examId} onGenerated={() => { fetchData(); setShowAI(false) }} />
        </div>
      )}

      {/* Manual Form */}
      {showForm && (
        <div className="mb-5">
          <QuestionForm examId={examId} editQ={editQ} onSaved={onSaved} onCancel={() => { setShowForm(false); setEditQ(null) }} />
        </div>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : questions.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-14 text-center shadow-sm">
          <BookOpen size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No questions yet</p>
          <p className="text-sm text-gray-400 mb-5">Use AI Generate to create questions from a PDF, or add manually.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setShowAI(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700">
              <Sparkles size={14} /> AI Generate from PDF
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50">
              <Plus size={14} /> Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {questions.length > 0 && (
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-6 shadow-sm">
          {[
            { label: 'Total Questions', value: questions.length },
            { label: 'MCQ', value: questions.filter(q => q.type === 'MCQ').length },
            { label: 'Subjective', value: questions.filter(q => q.type === 'SUBJECTIVE').length },
            { label: 'Code', value: questions.filter(q => q.type === 'CODE').length },
            { label: 'Total Marks', value: totalMarks, highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-bold ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
