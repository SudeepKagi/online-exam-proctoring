import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { Save, ArrowLeft, Shield, Clock, Users, CheckCircle, Plus, Trash2, HelpCircle, Sparkles, Upload, Loader2, FileText, RefreshCw, CheckCircle2 } from 'lucide-react'

const DEPARTMENTS = ['CSE', 'ECE', 'ME', 'CV', 'ISE', 'EEE']
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

// ── AI Generator Panel for Wizard ─────────────────────────────
function AIGeneratorPanel({ onGenerated }) {
  const [file, setFile] = useState(null)
  const [extractedText, setExtractedText] = useState('')
  const [numMCQ, setNumMCQ] = useState(5)
  const [numEssay, setNumEssay] = useState(2)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [marksPerMCQ, setMarksPerMCQ] = useState(2)
  const [marksPerEssay, setMarksPerEssay] = useState(10)
  const [step, setStep] = useState('upload') // upload | preview | generating | done
  const [generating, setGenerating] = useState(false)
  const fileRef = React.useRef()

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.type !== 'application/pdf') return toast.error('Please upload a PDF file')
    setFile(f)
    setStep('upload')

    toast.loading('Extracting text from PDF…', { id: 'pdf' })
    try {
      const arrayBuffer = await f.arrayBuffer()
      let fullText = ''
      if (window.pdfjsLib) {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
        for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          let lastY
          let pageText = ''
          for (const item of content.items) {
            if (lastY === undefined || Math.abs(item.transform[5] - lastY) < 5) {
              pageText += (item.hasEOL ? '\n' : ' ') + item.str
            } else {
              pageText += '\n' + item.str
            }
            lastY = item.transform[5]
          }
          fullText += pageText + '\n'
        }
      } else {
        const text = await f.text().catch(() => '')
        fullText = text.replace(/[^\x20-\x7E\n]/g, ' ')
      }

      // Repair single spaced letters: 't i t l e' -> 'title'
      let cleaned = fullText
      for (let pass = 0; pass < 5; pass++) {
        cleaned = cleaned.replace(/(?<=\b[a-zA-Z])\s+(?=[a-zA-Z]\b)/g, '')
      }
      cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim()

      setExtractedText(cleaned)
      toast.success('Text extracted successfully!', { id: 'pdf' })
      setStep('preview')
    } catch (err) {
      console.warn('PDF extraction notice:', err)
      toast.error('Could not read PDF cleanly. You can paste notes directly.', { id: 'pdf' })
      setStep('preview')
    }
  }

  const handleGenerate = async () => {
    const text = extractedText.trim()
    if (text.length < 50) return toast.error('Need at least 50 characters of content')
    setGenerating(true)
    setStep('generating')
    try {
      const res = await api.post(`/faculty/exams/ai-generate-preview`, {
        topic: text, numMCQ: parseInt(numMCQ), numEssay: parseInt(numEssay),
        difficulty, marksPerMCQ: parseFloat(marksPerMCQ), marksPerEssay: parseFloat(marksPerEssay)
      })
      
      const newQuestions = res.data.questions || []
      if (newQuestions.length === 0) {
        throw new Error('No questions returned')
      }

      toast.success(res.data.message || 'Questions generated successfully!')
      setStep('done')
      onGenerated(newQuestions)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed')
      setStep('preview')
    } finally { setGenerating(false) }
  }

  return (
    <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 space-y-4 font-sans text-slate-900">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-9 h-9 bg-blue-50 border border-blue-100 text-[#2f80ed] rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">AI Question Generator</h3>
          <p className="text-xs text-slate-500">Upload a PDF or paste notes — Gemini AI will generate your question pool</p>
        </div>
      </div>

      {/* PDF Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-slate-300 bg-white hover:border-[#2f80ed] rounded-2xl p-6 text-center cursor-pointer transition-all">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={18} className="text-[#2f80ed]" />
            <span className="text-xs font-bold text-slate-900">{file.name}</span>
          </div>
        ) : (
          <>
            <Upload size={24} className="text-[#2f80ed] mx-auto mb-2" />
            <p className="text-xs text-slate-800 font-semibold">Click to upload PDF</p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">or paste text content below</p>
          </>
        )}
      </div>

      {/* Extracted / pasted text */}
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1 block">
          Content Text <span className="text-slate-400 font-normal">(auto-filled from PDF, or paste manually)</span>
        </label>
        <textarea value={extractedText} onChange={e => setExtractedText(e.target.value)} rows={4}
          placeholder="Paste your lecture notes, textbook content, or topic summary here…"
          className="w-full border-1.5 border-slate-300 bg-white rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold resize-none focus:outline-none focus:border-[#2f80ed]" />
        <p className="text-[11px] font-semibold text-slate-400 mt-1">{extractedText.length} characters</p>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        {[
          { label: 'MCQ Count', value: numMCQ, set: setNumMCQ, min: 1, max: 20 },
          { label: 'Essay Count', value: numEssay, set: setNumEssay, min: 0, max: 10 },
          { label: 'Marks / MCQ', value: marksPerMCQ, set: setMarksPerMCQ, min: 0.5, step: 0.5 },
          { label: 'Marks / Essay', value: marksPerEssay, set: setMarksPerEssay, min: 1 },
        ].map(({ label, value, set, min = 1, max, step = 1 }) => (
          <div key={label}>
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1 block">{label}</label>
            <input type="number" min={min} max={max} step={step} value={value} onChange={e => set(e.target.value)}
              className="w-full border-1.5 border-slate-300 bg-white rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-[#2f80ed]" />
          </div>
        ))}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1 block">Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="w-full border-1.5 border-slate-300 bg-white rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-[#2f80ed]">
            <option value="EASY">EASY</option><option value="MEDIUM">MEDIUM</option><option value="HARD">HARD</option>
          </select>
        </div>
      </div>

      {step === 'done' ? (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <p className="text-xs text-emerald-800 font-semibold flex-1">Questions added to your local pool!</p>
          <button onClick={() => { setStep('upload'); setFile(null); setExtractedText('') }}
            className="text-xs text-[#2f80ed] hover:underline flex items-center gap-1 font-bold"><RefreshCw size={12} /> Generate more</button>
        </div>
      ) : (
        <button onClick={handleGenerate} disabled={generating || extractedText.trim().length < 50}
          className="w-full py-3 text-xs font-semibold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? 'Generating with Gemini AI…' : `Generate ${numMCQ} MCQ + ${numEssay} Essay Questions`}
        </button>
      )}
    </div>
  )
}

export default function CreateExam() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successData, setSuccessData] = useState(null)
  
  const [questions, setQuestions] = useState([])
  const [activeTab, setActiveTab] = useState('manual')

  const [qForm, setQForm] = useState({
    type: 'MCQ',
    questionText: '',
    marks: 5,
    difficulty: 'MEDIUM',
    negativeMarks: 0,
    options: ['', '', '', ''],
    correctAnswer: 'A',
    codeTemplate: '',
    wordLimitMax: 250
  })

  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    startTime: '',
    endTime: '',
    duration: 90,
    totalMarks: 0,
    questionsPerStudent: 0,
    negativeMarking: false,
    negativeValue: 0.25,
      cameraRequired: true,
      browserLock: true,
      fullScreenMode: true,
      watermarkRequired: true,
      randomiseQuestions: true,
      randomiseOptions: true,
      allowedDepartments: ['CSE'],
      allowedSemesters: [5]
    })

    const handleChange = (field, val) => {
      setFormData(prev => {
        const next = { ...prev, [field]: val }
        // Auto compute endTime if startTime or duration changed
        if ((field === 'startTime' || field === 'duration') && next.startTime && next.duration) {
          const start = new Date(next.startTime)
          if (!isNaN(start.getTime())) {
            const end = new Date(start.getTime() + Number(next.duration) * 60000)
            const year = end.getFullYear()
            const month = String(end.getMonth() + 1).padStart(2, '0')
            const day = String(end.getDate()).padStart(2, '0')
            const hours = String(end.getHours()).padStart(2, '0')
            const mins = String(end.getMinutes()).padStart(2, '0')
            next.endTime = `${year}-${month}-${day}T${hours}:${mins}`
          }
        }
        return next
      })
    }

    const toggleSelection = (field, val) => {
      setFormData(prev => {
        const arr = prev[field] || []
        const exists = arr.includes(val)
        const updated = exists ? arr.filter(x => x !== val) : [...arr, val]
        return { ...prev, [field]: updated }
      })
    }

    const validateStep2 = () => {
    if (!formData.title.trim()) { toast.error('Exam title is required'); return false }
    if (!formData.subject.trim()) { toast.error('Subject code is required'); return false }
    if (!formData.startTime) { toast.error('Start time is required'); return false }
    return true
  }

  const handleAddQuestionLocal = () => {
    if (!qForm.questionText.trim()) return toast.error('Question prompt cannot be empty')
    
    let formattedOptions = []
    if (qForm.type === 'MCQ') {
      if (qForm.options.some(opt => !opt.trim())) return toast.error('All 4 MCQ options must be filled')
      formattedOptions = qForm.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i)
        return { text: opt.trim(), isCorrect: letter === qForm.correctAnswer }
      })
    }

    const newQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      type: qForm.type,
      questionText: qForm.questionText.trim(),
      marks: Number(qForm.marks || 5),
      difficulty: qForm.difficulty,
      negativeMarks: Number(qForm.negativeMarks || 0),
      options: formattedOptions,
      correctAnswer: qForm.correctAnswer,
      codeTemplate: qForm.codeTemplate,
      wordLimitMax: qForm.type === 'SUBJECTIVE' ? Number(qForm.wordLimitMax || 250) : null
    }

    setQuestions(prev => [...prev, newQuestion])
    setFormData(prev => ({ ...prev, totalMarks: prev.totalMarks + newQuestion.marks }))
    
    // Reset form
    setQForm({
      type: 'MCQ',
      questionText: '',
      marks: 5,
      difficulty: 'MEDIUM',
      negativeMarks: 0,
      options: ['', '', '', ''],
      correctAnswer: 'A',
      codeTemplate: '',
      wordLimitMax: 250
    })
    toast.success('Question added to exam pool')
  }

  const handleAIGenerated = (newQuestionsRaw) => {
    if (!Array.isArray(newQuestionsRaw) || newQuestionsRaw.length === 0) return

    const formattedQuestions = newQuestionsRaw.map(q => {
      const parsedMarks = parseFloat(q.marks || 2)
      
      let correctIdx = 0
      if (typeof q.correctOption === 'number') correctIdx = q.correctOption
      else if (typeof q.correctOption === 'string' && q.correctOption.length === 1) {
        correctIdx = q.correctOption.toUpperCase().charCodeAt(0) - 65
      }

      const correctLetter = String.fromCharCode(65 + correctIdx)
      const rawCorrectAnswer = q.correctAnswer || correctLetter

      let formattedOptions = []
      if (q.type === 'MCQ') {
        const rawOpts = Array.isArray(q.options) && q.options.length > 0 ? q.options : [
          'Core Principle of topic',
          'Secondary Rule',
          'Deprecated Method',
          'External Dependency'
        ]
        formattedOptions = rawOpts.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx)
          const isCurrCorrect = idx === correctIdx || letter === rawCorrectAnswer
          if (typeof opt === 'string') {
            return { text: opt, isCorrect: isCurrCorrect }
          }
          return {
            text: opt.text || opt.value || String(opt),
            isCorrect: opt.isCorrect !== undefined ? Boolean(opt.isCorrect) : isCurrCorrect
          }
        })
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        type: (q.type || 'MCQ').toUpperCase(),
        questionText: q.questionText || '',
        marks: parsedMarks,
        difficulty: (q.difficulty || 'MEDIUM').toUpperCase(),
        negativeMarks: 0,
        options: formattedOptions,
        correctAnswer: rawCorrectAnswer,
        codeTemplate: q.codeTemplate || '',
        wordLimitMax: q.type === 'SUBJECTIVE' ? Number(q.wordLimitMax || 250) : null
      }
    })

    setQuestions(prev => [...prev, ...formattedQuestions])
    const marksSum = formattedQuestions.reduce((sum, q) => sum + q.marks, 0)
    setFormData(prev => ({ ...prev, totalMarks: prev.totalMarks + marksSum }))
  }

  const handleRemoveQuestionLocal = (id, marks) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
    setFormData(prev => ({ ...prev, totalMarks: Math.max(0, prev.totalMarks - marks) }))
    toast.success('Question removed')
  }

  const handleDeployExam = async () => {
    if (questions.length === 0) {
      toast.error('Please add at least one question in Step 1')
      setStep(1)
      return
    }
    if (!validateStep2()) {
      setStep(2)
      return
    }

    let payload = { ...formData }
    if (!payload.endTime && payload.startTime && payload.duration) {
      const start = new Date(payload.startTime)
      if (!isNaN(start.getTime())) {
        const end = new Date(start.getTime() + Number(payload.duration) * 60000)
        const year = end.getFullYear()
        const month = String(end.getMonth() + 1).padStart(2, '0')
        const day = String(end.getDate()).padStart(2, '0')
        const hours = String(end.getHours()).padStart(2, '0')
        const mins = String(end.getMinutes()).padStart(2, '0')
        payload.endTime = `${year}-${month}-${day}T${hours}:${mins}`
      }
    }

    if (!payload.endTime) {
      toast.error('End Time is required. Please set start time and duration.')
      setStep(2)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.post('/faculty/exams', payload)
      const createdExam = res.data.exam
      
      const questionsToUpload = questions.map(({ type, questionText, options, correctAnswer, marks, negativeMarks, difficulty, codeTemplate, wordLimitMax }) => ({
        type, questionText, options, correctAnswer, marks, negativeMarks, difficulty, codeTemplate, wordLimitMax
      }))

      await api.post('/faculty/questions/bulk', {
        examId: createdExam.id,
        questions: questionsToUpload
      })

      const publishRes = await api.post(`/faculty/exams/${createdExam.id}/publish`)
      toast.success('Exam deployed successfully!')
      setSuccessData(publishRes.data)
    } catch(err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create exam')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successData) {
    return (
      <DashboardLayout title="Faculty Console">
        <div className="max-w-3xl mx-auto py-10 px-4 font-sans">
          {/* Header Hero Banner */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xs">
              <CheckCircle2 size={40} className="text-[#10b981]" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Exam Deployed Successfully!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
              Assessment <span className="font-semibold text-slate-800">"{successData.exam.title}"</span> is scheduled, published, and live in the system registry.
            </p>
          </div>

          {/* Invigilator Access Credentials Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm text-left space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-[#2f80ed] flex items-center justify-center shrink-0">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#2f80ed] uppercase tracking-wider">
                    Invigilator Access Credentials
                  </h3>
                  <p className="text-xs font-bold text-slate-800">
                    Live Monitoring Portal Passkey & Credentials
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE GATEWAY
              </span>
            </div>

            <div className="space-y-4">
              {/* Exam ID Row */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Exam Unique Identifier (ID)
                </label>
                <div className="flex items-center gap-2.5 bg-[#f8fafc] border border-slate-200 p-2 rounded-2xl">
                  <div className="flex-1 font-mono text-xs font-bold text-slate-900 px-3 break-all select-all">
                    {successData.exam.id}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(successData.exam.id)
                      toast.success('Exam ID Copied to Clipboard!')
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Grid: Invigilator ID & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Invigilator ID Card */}
                <div className="bg-[#f8fafc] border border-slate-200 p-4 rounded-2xl">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Invigilator ID
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-slate-900 font-mono tracking-wide">
                      {successData.invCredentials?.invId || 'INV-101'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(successData.invCredentials?.invId || 'INV-101')
                        toast.success('Invigilator ID Copied!')
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Access Password Card */}
                <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-2xl">
                  <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block mb-1">
                    Access Password
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-[#2f80ed] font-mono tracking-widest bg-white px-3 py-1 rounded-xl border border-blue-200 shadow-2xs">
                      {successData.invCredentials?.password || 'Pass123!'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(successData.invCredentials?.password || 'Pass123!')
                        toast.success('Access Password Copied!')
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-[#2f80ed] bg-white border border-blue-200 rounded-lg cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Navigation Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3.5 justify-center">
            <button
              type="button"
              onClick={() => navigate('/faculty/exams')}
              className="px-6 py-3 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl shadow-2xs transition-all cursor-pointer"
            >
              View All Exams
            </button>
            <button
              type="button"
              onClick={() => navigate(`/faculty/exams/${successData.exam.id}`)}
              className="px-7 py-3 text-xs font-semibold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              View Exam Details →
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-6 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link to="/faculty/exams" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f80ed] hover:underline mb-1">
              <ArrowLeft size={15} /> Back to Exams
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Examination Wizard</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">3-step builder to design questions, security rules, and publish your exam.</p>
          </div>
        </div>

        {/* Wizard Stepper Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            {[
              { step: 1, label: 'Add Questions', desc: 'Build MCQ, Code & Subjective items' },
              { step: 2, label: 'Timing & Security', desc: 'Configure schedules & rules' },
              { step: 3, label: 'Review & Publish', desc: 'Verify and deploy assessment' }
            ].map((s) => (
              <button 
                key={s.step}
                type="button"
                onClick={() => setStep(s.step)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  step === s.step
                    ? 'bg-white border-2 border-[#2f80ed] shadow-xs'
                    : 'bg-[#f8fafc] border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-semibold text-xs shrink-0 ${
                  step === s.step ? 'bg-[#2f80ed] text-white' : step > s.step ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {step > s.step ? '✓' : s.step}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className={`text-xs font-semibold ${step === s.step ? 'text-[#2f80ed]' : 'text-slate-900'}`}>{s.label}</div>
                  <div className="text-[11px] text-slate-500 font-semibold truncate">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* STEP 1: QUESTION BUILDER */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#2f80ed]" /> Question Editor
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === 'manual'
                          ? 'bg-[#2f80ed] text-white shadow-xs'
                          : 'bg-[#f8fafc] border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Plus size={15} /> Add Manually
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ai')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === 'ai'
                          ? 'bg-[#2f80ed] text-white shadow-xs'
                          : 'bg-[#f8fafc] border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles size={15} /> AI Generate
                    </button>
                  </div>
                </div>

                {activeTab === 'manual' ? (
                  <div className="space-y-5 text-xs font-sans">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Question Type</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { type: 'MCQ', label: 'Multiple Choice' },
                          { type: 'CODE', label: 'Coding Test' },
                          { type: 'SUBJECTIVE', label: 'Subjective' }
                        ].map(t => (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => setQForm(prev => ({ ...prev, type: t.type }))}
                            className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                              qForm.type === t.type 
                                ? 'bg-[#2f80ed] text-white border-[#2f80ed] shadow-xs'
                                : 'bg-[#f8fafc] border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">Question Prompt</label>
                      <textarea
                        value={qForm.questionText}
                        onChange={(e) => setQForm(prev => ({ ...prev, questionText: e.target.value }))}
                        placeholder="Enter the question detail or prompt here..."
                        rows={3}
                        className="w-full p-3.5 rounded-xl bg-[#f8fafc] border-1.5 border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-[#2f80ed]"
                      />
                    </div>

                    {qForm.type === 'MCQ' && (
                      <div className="space-y-3 p-4 bg-[#f8fafc] rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-900">MCQ Options & Correct Choice</label>
                        {['A', 'B', 'C', 'D'].map((opt, i) => (
                          <div key={opt} className="flex gap-2.5 items-center">
                            <button
                              type="button"
                              onClick={() => setQForm(prev => ({ ...prev, correctAnswer: opt }))}
                              className={`w-9 h-9 rounded-xl font-semibold text-xs flex items-center justify-center transition-all ${
                                qForm.correctAnswer === opt 
                                  ? 'bg-[#10b981] text-white shadow-xs' 
                                  : 'bg-[#475569] text-white'
                              }`}
                            >
                              {opt}
                            </button>
                            <input
                              type="text"
                              value={qForm.options[i]}
                              onChange={(e) => {
                                const updatedOpts = [...qForm.options]
                                updatedOpts[i] = e.target.value
                                setQForm(prev => ({ ...prev, options: updatedOpts }))
                              }}
                              placeholder={`Option ${opt} text`}
                              className="flex-1 px-3.5 py-2 border-1.5 border-slate-300 rounded-xl text-xs bg-white text-slate-900 font-bold focus:outline-none focus:border-[#2f80ed]"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Marks</label>
                        <input
                          type="number"
                          value={qForm.marks}
                          onChange={(e) => setQForm(prev => ({ ...prev, marks: Number(e.target.value) }))}
                          className="w-full px-3.5 py-2 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-xs text-slate-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Difficulty</label>
                        <select
                          value={qForm.difficulty}
                          onChange={(e) => setQForm(prev => ({ ...prev, difficulty: e.target.value }))}
                          className="w-full px-3.5 py-2 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-xs text-slate-900 font-bold"
                        >
                          <option value="EASY">EASY</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HARD">HARD</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddQuestionLocal}
                      className="w-full py-3 text-xs font-semibold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-xl shadow-md shadow-blue-100 flex items-center justify-center gap-2 mt-2"
                    >
                      <Plus size={16} /> Add Question to Exam Pool
                    </button>
                  </div>
                ) : (
                  <AIGeneratorPanel onGenerated={handleAIGenerated} />
                )}
              </div>
            </div>

            {/* Question pool side tracker */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
                <span>Question Pool</span>
                <span className="px-2.5 py-0.5 bg-blue-50 text-[#2f80ed] rounded-md text-xs font-semibold">{questions.length}</span>
              </h3>
              
              <div className="max-h-[320px] overflow-y-auto space-y-2.5 mb-4 pr-1 text-xs">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3.5 bg-[#f8fafc] border border-slate-200 rounded-xl flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">Q{idx + 1} • {q.type}</div>
                      <p className="text-xs text-slate-600 truncate mt-0.5 font-semibold">{q.questionText}</p>
                      <div className="flex gap-2 mt-1.5 text-[11px] text-[#2f80ed] font-semibold">
                        <span>{q.marks} Marks</span> • <span>{q.difficulty}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestionLocal(q.id, q.marks)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <HelpCircle size={32} className="mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="text-xs font-semibold">No questions added yet.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex justify-between text-xs font-semibold text-slate-900">
                  <span>Total Marks:</span>
                  <span className="text-[#2f80ed] font-semibold text-sm">{formData.totalMarks} Marks</span>
                </div>
                <button
                  type="button"
                  disabled={questions.length === 0}
                  onClick={() => setStep(2)}
                  className="w-full py-3 text-xs font-semibold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-xl shadow-md shadow-blue-100 disabled:opacity-50"
                >
                  Configure Rules & Schedules →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURATION & SCHEDULING */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">Basic Information</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">Exam Title *</label>
                    <input 
                      type="text"
                      value={formData.title} 
                      onChange={(e) => handleChange('title', e.target.value)} 
                      placeholder="Midterm - Operating Systems" 
                      className="w-full px-3.5 py-2.5 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-[#2f80ed]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">Subject Code *</label>
                    <input 
                      type="text"
                      value={formData.subject} 
                      onChange={(e) => handleChange('subject', e.target.value)} 
                      placeholder="CS402" 
                      className="w-full px-3.5 py-2.5 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-[#2f80ed]"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">Instructions for Students</label>
                  <textarea 
                    value={formData.description} 
                    onChange={(e) => handleChange('description', e.target.value)} 
                    placeholder="Instructions for candidates..." 
                    rows={3} 
                    className="w-full px-3.5 py-2.5 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-[#2f80ed]"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">Timing & Duration</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">Start Time *</label>
                    <input 
                      type="datetime-local" 
                      value={formData.startTime} 
                      onChange={(e) => handleChange('startTime', e.target.value)} 
                      className="w-full px-3.5 py-2.5 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-slate-900 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">Duration (Minutes) *</label>
                    <input 
                      type="number" 
                      value={formData.duration} 
                      onChange={(e) => handleChange('duration', Number(e.target.value))} 
                      className="w-full px-3.5 py-2.5 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-slate-900 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">End Time *</label>
                    <input 
                      type="datetime-local" 
                      value={formData.endTime} 
                      onChange={(e) => handleChange('endTime', e.target.value)} 
                      className="w-full px-3.5 py-2.5 border-1.5 border-slate-300 bg-[#f8fafc] rounded-xl text-slate-900 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">Candidate Eligibility</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Allowed Departments</label>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENTS.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleSelection('allowedDepartments', dept)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            formData.allowedDepartments.includes(dept)
                              ? 'bg-[#2f80ed] text-white shadow-xs'
                              : 'bg-[#f8fafc] text-slate-600 border border-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Target Semesters</label>
                    <div className="flex flex-wrap gap-2">
                      {SEMESTERS.map(sem => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => toggleSelection('allowedSemesters', sem)}
                          className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all ${
                            formData.allowedSemesters.includes(sem)
                              ? 'bg-[#2f80ed] text-white shadow-xs'
                              : 'bg-[#f8fafc] text-slate-600 border border-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {sem}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-4">
              <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">Security Profile</h2>
              
              <div className="space-y-2.5">
                {[
                  { key: 'cameraRequired', label: 'Face AI Monitoring', desc: 'Continuous camera verification' },
                  { key: 'browserLock', label: 'Browser Lockdown', desc: 'Block multi-tab navigation' },
                  { key: 'fullScreenMode', label: 'Enforce Fullscreen', desc: 'Exit terminates session' },
                  { key: 'watermarkRequired', label: 'Dynamic Watermark', desc: 'Overlay USN on screen' },
                  { key: 'randomiseQuestions', label: 'Randomise Questions', desc: 'Shuffle question order per user' },
                  { key: 'randomiseOptions', label: 'Randomise Options', desc: 'Shuffle MCQ options order' },
                ].map(item => (
                  <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-[#f8fafc] cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-0.5 w-4.5 h-4.5 rounded accent-[#2f80ed]" 
                      checked={formData[item.key]} 
                      onChange={(e) => handleChange(item.key, e.target.checked)}
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{item.label}</div>
                      <div className="text-[11px] text-slate-500 font-semibold">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3)
                  else toast.error('Please fill required fields')
                }}
                className="w-full py-3 text-xs font-semibold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-xl shadow-md shadow-blue-100 mt-4"
              >
                Proceed to Review →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FINAL REVIEW & DEPLOY */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans text-xs">
            {/* Left Column (2 Cols): Comprehensive Assessment Summary */}
            <div className="lg:col-span-2 space-y-5">
              {/* Primary Details Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2f80ed] border border-blue-100 uppercase tracking-wider">
                      FINAL EXAMINATION AUDIT
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
                      {formData.title || 'Untitled Assessment'}
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Subject Code: <span className="font-semibold text-slate-800">{formData.subject || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#f8fafc] hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl cursor-pointer"
                    >
                      Edit Questions
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#f8fafc] hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl cursor-pointer"
                    >
                      Edit Schedule
                    </button>
                  </div>
                </div>

                {/* 4 Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Items</p>
                    <p className="text-2xl font-bold text-slate-900">{questions.length}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Question Pool</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Marks</p>
                    <p className="text-2xl font-bold text-[#2f80ed]">{formData.totalMarks}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Maximum Points</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-2xl font-bold text-slate-900">{formData.duration}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Minutes Allocated</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Proctoring</p>
                    <p className="text-2xl font-bold text-[#10b981]">STRICT</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">WireGuard AI Active</p>
                  </div>
                </div>

                {/* Timing & Target Audience Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-1">
                      Schedule & Time Windows
                    </h4>
                    <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                      <p><strong className="text-slate-900">Start Time:</strong> {formData.startTime ? new Date(formData.startTime).toLocaleString() : 'Not Set'}</p>
                      <p><strong className="text-slate-900">End Time:</strong> {formData.endTime ? new Date(formData.endTime).toLocaleString() : 'Not Set'}</p>
                      <p><strong className="text-slate-900">Time Window:</strong> {formData.duration} Minutes</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-1">
                      Target Student Eligibility
                    </h4>
                    <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                      <p><strong className="text-slate-900">Allowed Departments:</strong> {formData.allowedDepartments?.join(', ') || 'All'}</p>
                      <p><strong className="text-slate-900">Target Semesters:</strong> {formData.allowedSemesters?.map(s => `Sem ${s}`).join(', ') || 'All'}</p>
                      <p><strong className="text-slate-900">Student Access:</strong> Explicit Dept/Sem Enforcement</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (1 Col): Security Profile & Deployment Action */}
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#10b981] border border-emerald-100 flex items-center justify-center">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Security Audit Summary</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">Active Integrity Controls</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-bold text-slate-800">
                  {[
                    { label: 'Continuous Face AI & Camera', active: formData.cameraRequired },
                    { label: 'Browser Multi-Tab Lockdown', active: formData.browserLock },
                    { label: 'Kiosk Fullscreen Enforcement', active: formData.fullScreenMode },
                    { label: 'Dynamic USN Anti-Leak Watermark', active: formData.watermarkRequired },
                    { label: 'WireGuard Network Isolation VPN', active: true },
                    { label: 'Shuffled Questions & Options', active: formData.randomiseQuestions || formData.randomiseOptions }
                  ].map(sec => (
                    <div key={sec.label} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200">
                      <span className="text-slate-700 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={15} className={sec.active ? 'text-[#10b981]' : 'text-slate-300'} />
                        {sec.label}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        sec.active ? 'bg-emerald-50 text-[#10b981]' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {sec.active ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Main Action Buttons */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDeployExam}
                    disabled={isSubmitting}
                    className="w-full py-4 text-xs font-semibold bg-[#10b981] hover:bg-[#059669] text-white rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    {isSubmitting ? 'Deploying Examination...' : 'Deploy & Publish Exam'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full py-3 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl transition-all cursor-pointer text-center"
                  >
                    ← Edit Rules & Schedules
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
