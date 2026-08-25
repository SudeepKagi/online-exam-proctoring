import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { Save, ArrowLeft, Shield, Clock, Users, CheckCircle, Plus, Trash2, HelpCircle, Sparkles, Upload, Loader2, FileText, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const DEPARTMENTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']
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
      const res = await api.post(`/faculty/exams/ai-generate-preview`, {
        text, numMCQ: parseInt(numMCQ), numEssay: parseInt(numEssay),
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
    <div className="bg-[#09090B] border border-[#27272A] rounded-2xl p-5 space-y-4 font-sans text-slate-100">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} />
        </div>
        <div>
          <h3 className="font-bold text-slate-100 text-sm">AI Question Generator</h3>
          <p className="text-xs text-slate-400">Upload a PDF — Gemini AI will generate your question pool</p>
        </div>
      </div>

      {/* PDF Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-[#27272A] bg-[#141416] hover:border-indigo-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={18} className="text-indigo-400" />
            <span className="text-xs font-mono text-indigo-300">{file.name}</span>
          </div>
        ) : (
          <>
            <Upload size={24} className="text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-300 font-medium">Click to upload PDF</p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">or paste text below</p>
          </>
        )}
      </div>

      {/* Extracted / pasted text */}
      <div>
        <label className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-1 block">
          Content Text <span className="text-slate-500 font-normal">(auto-filled from PDF, or paste manually)</span>
        </label>
        <textarea value={extractedText} onChange={e => setExtractedText(e.target.value)} rows={4}
          placeholder="Paste your lecture notes, textbook content, or topic summary here…"
          className="w-full border border-[#27272A] bg-[#141416] rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-indigo-500 text-slate-100 font-sans" />
        <p className="text-[10px] font-mono text-slate-500 mt-1">{extractedText.length} characters</p>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
        {[
          { label: 'MCQ Count', value: numMCQ, set: setNumMCQ, min: 1, max: 20 },
          { label: 'Essay Count', value: numEssay, set: setNumEssay, min: 0, max: 10 },
          { label: 'Marks / MCQ', value: marksPerMCQ, set: setMarksPerMCQ, min: 0.5, step: 0.5 },
          { label: 'Marks / Essay', value: marksPerEssay, set: setMarksPerEssay, min: 1 },
        ].map(({ label, value, set, min = 1, max, step = 1 }) => (
          <div key={label}>
            <label className="text-[10px] text-slate-400 mb-1 block">{label}</label>
            <input type="number" min={min} max={max} step={step} value={value} onChange={e => set(e.target.value)}
              className="w-full border border-[#27272A] bg-[#141416] rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" />
          </div>
        ))}
        <div>
          <label className="text-[10px] text-slate-400 mb-1 block">Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="w-full border border-[#27272A] bg-[#141416] rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500">
            <option value="EASY">EASY</option><option value="MEDIUM">MEDIUM</option><option value="HARD">HARD</option>
          </select>
        </div>
      </div>

      {step === 'done' ? (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <p className="text-xs text-emerald-300 font-semibold flex-1">Questions added to your local pool!</p>
          <button onClick={() => { setStep('upload'); setFile(null); setExtractedText('') }}
            className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-mono"><RefreshCw size={11} /> Generate more</button>
        </div>
      ) : (
        <Button onClick={handleGenerate} disabled={generating || extractedText.trim().length < 50}
          className="w-full text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
          {generating ? <Loader2 size={14} className="animate-spin mr-2" /> : <Sparkles size={14} className="mr-2" />}
          {generating ? 'Generating with Gemini AI…' : `Generate ${numMCQ} MCQ + ${numEssay} Essay Questions`}
        </Button>
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
    randomiseQuestions: true,
    randomiseOptions: true,
    allowedDepartments: ['CSE'],
    allowedSemesters: [5],
    cameraRequired: true,
    browserLock: true,
    fullScreenMode: true,
    watermarkRequired: true,
    tabSwitchLimit: 3
  })

  const [errors, setErrors] = useState({})

  const validateStep2 = () => {
    const newErrors = {}
    if(!formData.title.trim()) newErrors.title = 'Exam title is required'
    if(!formData.subject.trim()) newErrors.subject = 'Subject code is required'
    if(!formData.startTime) newErrors.startTime = 'Start time is required'
    if(!formData.endTime) newErrors.endTime = 'End time is required'
    if(new Date(formData.startTime) >= new Date(formData.endTime))
      newErrors.endTime = 'End time must be after start time'
    if(formData.duration < 1) newErrors.duration = 'Minimum duration is 1 minute'
    if(formData.allowedDepartments.length === 0)
      newErrors.allowedDepartments = 'Select at least one department'
    if(formData.allowedSemesters.length === 0)
      newErrors.allowedSemesters = 'Select at least one semester'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startTime' || field === 'duration') {
        if (next.startTime && next.duration) {
          const start = new Date(next.startTime)
          if (!isNaN(start.getTime())) {
            const end = new Date(start.getTime() + next.duration * 60000)
            const tzOffset = end.getTimezoneOffset() * 60000
            next.endTime = new Date(end.getTime() - tzOffset).toISOString().slice(0, 16)
          }
        }
      }
      return next
    })
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        if (field === 'startTime' || field === 'duration') {
          delete next.endTime
        }
        return next
      })
    }
  }

  const toggleSelection = (field, value) => {
    const current = formData[field]
    const updated = current.includes(value)
      ? current.filter(i => i !== value)
      : [...current, value]
    handleChange(field, updated)
  }

  const handleAddQuestionLocal = () => {
    if (!qForm.questionText.trim()) {
      toast.error('Question prompt is required')
      return
    }
    if (qForm.type === 'MCQ' && qForm.options.some(o => !o.trim())) {
      toast.error('Please enter all four option values for the MCQ')
      return
    }
    
    const newQuestion = {
      ...qForm,
      id: Math.random().toString(36).substr(2, 9),
      marks: Number(qForm.marks),
      negativeMarks: Number(qForm.negativeMarks),
      wordLimitMax: qForm.type === 'SUBJECTIVE' ? Number(qForm.wordLimitMax) : null
    }

    setQuestions(prev => [...prev, newQuestion])
    setFormData(prev => ({ ...prev, totalMarks: prev.totalMarks + Number(qForm.marks) }))

    setQForm(prev => ({
      ...prev,
      questionText: '',
      options: ['', '', '', ''],
      codeTemplate: '',
      correctAnswer: 'A'
    }))
    
    toast.success('Question added to the exam pool')
  }

  const handleAIGenerated = (newQuestions) => {
    const formattedQuestions = newQuestions.map(q => {
      const parsedMarks = Number(q.marks || 2)
      let formattedOptions = []
      if (q.type === 'MCQ' && Array.isArray(q.options)) {
        formattedOptions = q.options.map(opt => {
          if (typeof opt === 'string') {
            return { text: opt, isCorrect: opt === q.correctAnswer }
          }
          return {
            text: opt.text || '',
            isCorrect: opt.isCorrect !== undefined ? Boolean(opt.isCorrect) : opt.text === q.correctAnswer
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
        correctAnswer: q.correctAnswer || null,
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
      toast.error('Please fill all required settings in Step 2')
      setStep(2)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.post('/faculty/exams', formData)
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
        <div className="max-w-2xl mx-auto py-8 text-center font-sans">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-1">Exam Deployed Successfully!</h1>
          <p className="text-xs text-slate-400 mb-6">
            Exam "<span className="font-semibold text-slate-200">{successData.exam.title}</span>" is now scheduled and published.
          </p>

          <Card className="bg-[#141416] border-[#27272A] p-6 text-left space-y-4">
            <h3 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Shield size={14} /> Invigilator Access Credentials
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Exam ID</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-[#09090B] border border-[#27272A] px-3 py-1.5 rounded-lg text-slate-200 break-all">{successData.exam.id}</div>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(successData.exam.id); toast.success('Exam ID Copied!') }} className="h-7 text-xs border-[#27272A]">Copy</Button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Invigilator ID</label>
                <div className="text-lg font-bold text-slate-100 mt-0.5">{successData.invCredentials?.invId || 'INV-101'}</div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Access Password</label>
                <div className="text-base font-bold text-indigo-400 bg-[#09090B] border border-[#27272A] px-3 py-1 rounded inline-block mt-0.5">
                  {successData.invCredentials?.password || 'Pass123!'}
                </div>
              </div>
            </div>
          </Card>

          <div className="mt-6 flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/faculty/exams')} className="text-xs font-mono border-[#27272A]">View All Exams</Button>
            <Button onClick={() => navigate(`/faculty/exams/${successData.exam.id}`)} className="text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white">View Details →</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link to="/faculty/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-1 font-mono">
              <ArrowLeft size={14} /> Back to Exams
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">Create New Examination Wizard</h1>
            <p className="text-xs text-slate-400 mt-0.5">3-step builder to design questions, security rules, and publish your exam.</p>
          </div>
        </div>

        {/* Wizard Stepper */}
        <Card className="bg-[#141416] border-[#27272A] p-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { step: 1, label: 'Add Questions', desc: 'Build MCQ, Code & Subjective items' },
              { step: 2, label: 'Timing & Security', desc: 'Configure schedules & rules' },
              { step: 3, label: 'Review & Publish', desc: 'Verify and deploy assessment' }
            ].map((s) => (
              <button 
                key={s.step}
                type="button"
                onClick={() => setStep(s.step)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  step === s.step
                    ? 'bg-[#09090B] border-indigo-500/50 text-slate-100'
                    : 'bg-[#141416] border-transparent text-slate-500 hover:border-[#27272A]'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                  step === s.step ? 'bg-white text-black' : step > s.step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#09090B] text-slate-500 border border-[#27272A]'
                }`}>
                  {step > s.step ? '✓' : s.step}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className="text-xs font-bold truncate">{s.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* STEP 1: QUESTION BUILDER */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-[#141416] border-[#27272A] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272A] pb-4 mb-4">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Question Editor
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={activeTab === 'manual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveTab('manual')}
                      className="text-xs font-mono"
                    >
                      <Plus size={14} className="mr-1" /> Add Manually
                    </Button>
                    <Button
                      type="button"
                      variant={activeTab === 'ai' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveTab('ai')}
                      className="text-xs font-mono"
                    >
                      <Sparkles size={14} className="mr-1" /> AI Generate
                    </Button>
                  </div>
                </div>

                {activeTab === 'manual' ? (
                  <div className="space-y-4 text-xs font-sans">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Question Type</label>
                      <div className="grid grid-cols-3 gap-2 font-mono">
                        {[
                          { type: 'MCQ', label: 'Multiple Choice' },
                          { type: 'CODE', label: 'Coding Test' },
                          { type: 'SUBJECTIVE', label: 'Subjective' }
                        ].map(t => (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => setQForm(prev => ({ ...prev, type: t.type }))}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                              qForm.type === t.type 
                                ? 'bg-white text-black border-white'
                                : 'bg-[#09090B] border-[#27272A] text-slate-400 hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Question Prompt</label>
                      <textarea
                        value={qForm.questionText}
                        onChange={(e) => setQForm(prev => ({ ...prev, questionText: e.target.value }))}
                        placeholder="Enter the question detail or prompt here..."
                        rows={3}
                        className="w-full p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {qForm.type === 'MCQ' && (
                      <div className="space-y-2.5 p-4 bg-[#09090B] rounded-xl border border-[#27272A]">
                        <label className="block text-xs font-bold text-slate-200">MCQ Options & Correct Choice</label>
                        {['A', 'B', 'C', 'D'].map((opt, i) => (
                          <div key={opt} className="flex gap-2 items-center">
                            <button
                              type="button"
                              onClick={() => setQForm(prev => ({ ...prev, correctAnswer: opt }))}
                              className={`w-8 h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all ${
                                qForm.correctAnswer === opt 
                                  ? 'bg-emerald-500 text-black' 
                                  : 'bg-[#141416] border border-[#27272A] text-slate-400'
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
                              className="flex-1 px-3 py-1.5 border border-[#27272A] rounded-lg text-xs bg-[#141416] text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Marks</label>
                        <input
                          type="number"
                          value={qForm.marks}
                          onChange={(e) => setQForm(prev => ({ ...prev, marks: Number(e.target.value) }))}
                          className="w-full px-3 py-1.5 border border-[#27272A] bg-[#09090B] rounded-xl text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Difficulty</label>
                        <select
                          value={qForm.difficulty}
                          onChange={(e) => setQForm(prev => ({ ...prev, difficulty: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-[#27272A] bg-[#09090B] rounded-xl text-xs text-slate-100"
                        >
                          <option value="EASY">EASY</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HARD">HARD</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleAddQuestionLocal}
                      className="w-full text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white mt-2"
                    >
                      <Plus size={14} className="mr-1.5" /> Add Question to Exam
                    </Button>
                  </div>
                ) : (
                  <AIGeneratorPanel onGenerated={handleAIGenerated} />
                )}
              </Card>
            </div>

            {/* Question pool side tracker */}
            <Card className="bg-[#141416] border-[#27272A] p-5 h-fit">
              <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center justify-between">
                <span>Question Pool</span>
                <Badge variant="outline" className="font-mono text-xs">{questions.length}</Badge>
              </h3>
              
              <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4 pr-1 font-mono text-xs">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3 bg-[#09090B] border border-[#27272A] rounded-xl flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate">Q{idx + 1} • {q.type}</div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">{q.questionText}</p>
                      <div className="flex gap-2 mt-1 text-[10px] text-indigo-400">
                        <span>{q.marks} Marks</span> • <span>{q.difficulty}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestionLocal(q.id, q.marks)}
                      className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
                    No questions added yet.
                  </div>
                )}
              </div>

              <div className="border-t border-[#27272A] pt-3 space-y-3 font-mono">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Total Marks:</span>
                  <span className="text-emerald-400">{formData.totalMarks} Marks</span>
                </div>
                <Button
                  type="button"
                  disabled={questions.length === 0}
                  onClick={() => setStep(2)}
                  className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Configure Rules & Schedules →
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 2: CONFIGURATION & SCHEDULING */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 font-sans text-xs">
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-[#141416] border-[#27272A] p-5">
                <h2 className="text-sm font-bold text-slate-100 mb-4 border-b border-[#27272A] pb-3">Basic Information</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Exam Title *</label>
                    <input 
                      type="text"
                      value={formData.title} 
                      onChange={(e) => handleChange('title', e.target.value)} 
                      placeholder="Midterm - Operating Systems" 
                      className="w-full px-3 py-2 border border-[#27272A] bg-[#09090B] rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Subject Code *</label>
                    <input 
                      type="text"
                      value={formData.subject} 
                      onChange={(e) => handleChange('subject', e.target.value)} 
                      placeholder="CS402" 
                      className="w-full px-3 py-2 border border-[#27272A] bg-[#09090B] rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] text-slate-400 mb-1">Instructions for Students</label>
                  <textarea 
                    value={formData.description} 
                    onChange={(e) => handleChange('description', e.target.value)} 
                    placeholder="Instructions for candidate..." 
                    rows={3} 
                    className="w-full px-3 py-2 border border-[#27272A] bg-[#09090B] rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </Card>

              <Card className="bg-[#141416] border-[#27272A] p-5">
                <h2 className="text-sm font-bold text-slate-100 mb-4 border-b border-[#27272A] pb-3">Timing & Duration</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Start Time *</label>
                    <input 
                      type="datetime-local" 
                      value={formData.startTime} 
                      onChange={(e) => handleChange('startTime', e.target.value)} 
                      className="w-full px-3 py-1.5 border border-[#27272A] bg-[#09090B] rounded-xl text-slate-100 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Duration (Minutes)</label>
                    <input 
                      type="number" 
                      value={formData.duration} 
                      onChange={(e) => handleChange('duration', Number(e.target.value))} 
                      className="w-full px-3 py-1.5 border border-[#27272A] bg-[#09090B] rounded-xl text-slate-100 text-xs"
                    />
                  </div>
                </div>
              </Card>

              <Card className="bg-[#141416] border-[#27272A] p-5">
                <h2 className="text-sm font-bold text-slate-100 mb-4 border-b border-[#27272A] pb-3">Candidate Eligibility</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-2">Allowed Departments</label>
                    <div className="flex flex-wrap gap-2 font-mono">
                      {DEPARTMENTS.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleSelection('allowedDepartments', dept)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            formData.allowedDepartments.includes(dept)
                              ? 'bg-white text-black'
                              : 'bg-[#09090B] text-slate-400 border border-[#27272A] hover:text-white'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-2">Target Semesters</label>
                    <div className="flex flex-wrap gap-2 font-mono">
                      {SEMESTERS.map(sem => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => toggleSelection('allowedSemesters', sem)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                            formData.allowedSemesters.includes(sem)
                              ? 'bg-white text-black'
                              : 'bg-[#09090B] text-slate-400 border border-[#27272A] hover:text-white'
                          }`}
                        >
                          {sem}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="bg-[#141416] border-[#27272A] p-5 h-fit space-y-4">
              <h2 className="text-sm font-bold text-slate-100 border-b border-[#27272A] pb-3">Security Profile</h2>
              
              <div className="space-y-2">
                {[
                  { key: 'cameraRequired', label: 'Face AI Monitoring', desc: 'Continuous camera verification' },
                  { key: 'browserLock', label: 'Browser Lockdown', desc: 'Block multi-tab navigation' },
                  { key: 'fullScreenMode', label: 'Enforce Fullscreen', desc: 'Exit terminates session' },
                  { key: 'watermarkRequired', label: 'Dynamic Watermark', desc: 'Overlay USN on screen' },
                  { key: 'randomiseQuestions', label: 'Randomise Questions', desc: 'Shuffle question order per user' },
                  { key: 'randomiseOptions', label: 'Randomise Options', desc: 'Shuffle MCQ options order' },
                ].map(item => (
                  <label key={item.key} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[#27272A] bg-[#09090B] cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-0.5 w-4 h-4 rounded accent-indigo-500" 
                      checked={formData[item.key]} 
                      onChange={(e) => handleChange(item.key, e.target.checked)}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-200">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3)
                  else toast.error('Please fill required fields')
                }}
                className="w-full text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white mt-4"
              >
                Proceed to Review →
              </Button>
            </Card>
          </div>
        )}

        {/* STEP 3: FINAL REVIEW & DEPLOY */}
        {step === 3 && (
          <div className="max-w-3xl mx-auto space-y-4 font-sans text-xs">
            <Card className="bg-[#141416] border-[#27272A] p-6">
              <h2 className="text-base font-bold text-slate-100 mb-4 pb-3 border-b border-[#27272A]">Review & Publish Examination</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Exam Details</span>
                  <div className="p-3 bg-[#09090B] rounded-xl border border-[#27272A] space-y-1.5 font-mono">
                    <p><strong className="text-slate-300">Title:</strong> {formData.title}</p>
                    <p><strong className="text-slate-300">Subject:</strong> {formData.subject}</p>
                    <p><strong className="text-slate-300">Duration:</strong> {formData.duration} mins</p>
                    <p><strong className="text-slate-300">Total Marks:</strong> {formData.totalMarks}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Target Roster</span>
                  <div className="p-3 bg-[#09090B] rounded-xl border border-[#27272A] space-y-1.5 font-mono">
                    <p><strong className="text-slate-300">Depts:</strong> {formData.allowedDepartments.join(', ')}</p>
                    <p><strong className="text-slate-300">Semesters:</strong> Sem {formData.allowedSemesters.join(', ')}</p>
                    <p><strong className="text-slate-300">Questions:</strong> {questions.length} items</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 text-xs font-mono border-[#27272A] bg-[#09090B]"
                >
                  ← Edit Rules
                </Button>
                <Button
                  type="button"
                  onClick={handleDeployExam}
                  disabled={isSubmitting}
                  className="flex-1 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                  Deploy & Publish Exam
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
