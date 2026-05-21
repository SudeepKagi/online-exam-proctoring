import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, FormTextarea, InfoBox } from '@/components/common/FormComponents'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { Save, ArrowLeft, Shield, Clock, Users, CheckCircle, Plus, Trash2, Eye, HelpCircle, Sparkles, Upload, Loader2, FileText, RefreshCw } from 'lucide-react'

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
      
      // Callback to parent wizard with generated questions
      onGenerated(newQuestions)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed')
      setStep('preview')
    } finally { setGenerating(false) }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-950 text-sm">AI Question Generator</h3>
          <p className="text-xs text-gray-500">Upload a PDF — Gemini AI will generate your question pool</p>
        </div>
      </div>

      {/* PDF Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-indigo-200 bg-white rounded-2xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={18} className="text-indigo-500" />
            <span className="text-sm font-medium text-indigo-700">{file.name}</span>
          </div>
        ) : (
          <>
            <Upload size={24} className="text-indigo-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">Click to upload PDF</p>
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
          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800" />
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
              className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800" />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800">
            <option>EASY</option><option>MEDIUM</option><option>HARD</option>
          </select>
        </div>
      </div>

      {step === 'done' ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={16} className="text-green-500" />
          <p className="text-xs text-green-700 font-semibold flex-1">Questions added to your local pool!</p>
          <button onClick={() => { setStep('upload'); setFile(null); setExtractedText('') }}
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold"><RefreshCw size={11} /> Generate more</button>
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

export default function CreateExam() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successData, setSuccessData] = useState(null)
  
  // Local list of questions built in Step 1
  const [questions, setQuestions] = useState([])
  const [activeTab, setActiveTab] = useState('manual') // 'manual' | 'ai'
  
  // Question builder form state
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

  // Exam Configurations state
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    startTime: '',
    endTime: '',
    duration: 90,
    totalMarks: 0,
    questionsPerStudent: 0, // 0 for all
    negativeMarking: false,
    negativeValue: 0.25,
    randomiseQuestions: true,
    randomiseOptions: true,
    allowedDepartments: [],
    allowedSemesters: [],
    cameraRequired: true,
    micRequired: false,
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
    
    // Auto-update total marks in exam form
    setFormData(prev => ({ ...prev, totalMarks: prev.totalMarks + Number(qForm.marks) }))

    // Clear main inputs while preserving type defaults
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
      
      // Map options
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
    
    // Auto-update total marks in exam form
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
      // 1. Create Exam shell
      const res = await api.post('/faculty/exams', formData)
      const createdExam = res.data.exam
      
      // 2. Upload all questions associated with the exam
      // We maps all questions format and send a single bulk list or sequence
      const questionsToUpload = questions.map(({ type, questionText, options, correctAnswer, marks, negativeMarks, difficulty, codeTemplate, wordLimitMax }) => ({
        type, questionText, options, correctAnswer, marks, negativeMarks, difficulty, codeTemplate, wordLimitMax
      }))

      await api.post('/faculty/questions/bulk', {
        examId: createdExam.id,
        questions: questionsToUpload
      })

      // 3. Automatically publish the exam to generate the final invigilator credentials
      const publishRes = await api.patch(`/faculty/exams/${createdExam.id}/publish`)

      toast.success('Exam and all questions deployed and published successfully!')
      setSuccessData(publishRes.data)
    } catch(err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create exam')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successData) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12 px-4 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Deployed Successfully!</h1>
          <p className="text-gray-600 mb-10">
            The exam "<span className="font-semibold text-gray-800">{successData.exam.title}</span>" is now scheduled and published. 
            Provide these credentials to the physical invigilator for dashboard access.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-left shadow-inner">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield size={14} /> Invigilator Access Portal
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Exam ID</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 text-sm font-mono font-bold tracking-wide text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg break-all">{successData.exam.id}</div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(successData.exam.id); }}
                    className="shrink-0 text-xs px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-lg transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Invigilator ID</label>
                <div className="text-2xl font-mono font-bold tracking-wider text-gray-900">{successData.invCredentials.invId}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Access Password</label>
                <div className="text-2xl font-mono font-bold tracking-wider text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded inline-block">
                  {successData.invCredentials.password}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-6 py-3 rounded-xl border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-all" onClick={() => navigate('/faculty/exams')}>
              View All Exams
            </button>
            <button className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all" onClick={() => navigate(`/faculty/exams/${successData.exam.id}`)}>
              View Exam Details →
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <Link to="/faculty/exams" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-2 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Exams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Examination Wizard</h1>
        <p className="text-gray-500 text-sm">Follow the 3-step structured builder to design, configure, and publish your exam.</p>
      </div>

      {/* Wizard Progress Bar */}
      <div className="flex items-center justify-between gap-4 mb-8 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        {[
          { step: 1, label: 'Add Questions', desc: 'Build MCQ, Code & Subjective items' },
          { step: 2, label: 'Timing & Security', desc: 'Configure schedules & rules' },
          { step: 3, label: 'Review & Publish', desc: 'Verify and deploy assessment' }
        ].map((s, idx) => (
          <React.Fragment key={s.step}>
            {idx > 0 && (
              <div className={`flex-1 h-0.5 hidden sm:block ${step >= s.step ? 'bg-indigo-600' : 'bg-gray-100'}`} />
            )}
            <button 
              type="button"
              onClick={() => {
                if (s.step === 2 && questions.length === 0) {
                  toast.error('Add at least one question first')
                  return
                }
                if (s.step === 3) {
                  if (questions.length === 0) {
                    toast.error('Add questions first')
                    return
                  }
                  if (!validateStep2()) {
                    toast.error('Please configure all settings correctly')
                    return
                  }
                }
                setStep(s.step)
              }}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                step === s.step 
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' 
                  : step > s.step 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-500'
              }`}>
                {step > s.step ? '✓' : s.step}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">{s.label}</div>
                <div className="text-[10px] text-gray-400 hidden md:block">{s.desc}</div>
              </div>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: QUESTION BUILDER */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Question Creation form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                    {activeTab === 'ai' ? <Sparkles size={18} /> : <Plus size={18} />}
                  </span>
                  Question Editor
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className={`flex items-center gap-2 px-4 py-2 font-semibold text-xs rounded-xl border transition-all ${
                      activeTab === 'manual'
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Plus size={14} /> Add Manually
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai')}
                    className={`flex items-center gap-2 px-4 py-2 font-semibold text-xs rounded-xl border transition-all ${
                      activeTab === 'ai'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    <Sparkles size={14} /> AI Generate
                  </button>
                </div>
              </div>

              {activeTab === 'manual' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
                    <div className="flex gap-2">
                      {[
                        { type: 'MCQ', label: 'Multiple Choice (MCQ)' },
                        { type: 'CODE', label: 'Coding Assessment' },
                        { type: 'SUBJECTIVE', label: 'Written Subjective' }
                      ].map(t => (
                        <button
                          key={t.type}
                          type="button"
                          onClick={() => setQForm(prev => ({ ...prev, type: t.type }))}
                          className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${
                            qForm.type === t.type 
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <FormTextarea
                      label="Question Prompt"
                      value={qForm.questionText}
                      onChange={(e) => setQForm(prev => ({ ...prev, questionText: e.target.value }))}
                      placeholder="Enter the question detail or prompt here..."
                      rows={4}
                    />
                  </div>

                  {/* MCQ SPECIFIC BLOCK */}
                  {qForm.type === 'MCQ' && (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <label className="block text-sm font-bold text-gray-800">MCQ Options & Correct Choice</label>
                      {['A', 'B', 'C', 'D'].map((opt, i) => (
                        <div key={opt} className="flex gap-2 items-center">
                          <button
                            type="button"
                            onClick={() => setQForm(prev => ({ ...prev, correctAnswer: opt }))}
                            className={`w-10 h-10 rounded-lg font-bold flex items-center justify-center transition-all ${
                              qForm.correctAnswer === opt 
                                ? 'bg-green-600 text-white' 
                               : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CODING SPECIFIC BLOCK */}
                  {qForm.type === 'CODE' && (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <label className="block text-sm font-bold text-gray-800">Starting Code Template</label>
                      <textarea
                        value={qForm.codeTemplate}
                        onChange={(e) => setQForm(prev => ({ ...prev, codeTemplate: e.target.value }))}
                        placeholder={`# Python boilerplate\ndef solve(arr):\n    # Write logic here\n    pass`}
                        rows={5}
                        className="w-full p-3 font-mono text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* SUBJECTIVE SPECIFIC BLOCK */}
                  {qForm.type === 'SUBJECTIVE' && (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <FormInput
                        label="Maximum Word Limit"
                        type="number"
                        value={qForm.wordLimitMax}
                        onChange={(e) => setQForm(prev => ({ ...prev, wordLimitMax: Number(e.target.value) }))}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormInput
                      label="Question Marks"
                      type="number"
                      value={qForm.marks}
                      onChange={(e) => setQForm(prev => ({ ...prev, marks: Number(e.target.value) }))}
                    />
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty</label>
                      <select
                        value={qForm.difficulty}
                        onChange={(e) => setQForm(prev => ({ ...prev, difficulty: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                    </div>
                    <FormInput
                      label="Negative Marks"
                      type="number"
                      step="0.05"
                      value={qForm.negativeMarks}
                      onChange={(e) => setQForm(prev => ({ ...prev, negativeMarks: Number(e.target.value) }))}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddQuestionLocal}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Add Question to Exam
                  </button>
                </div>
              ) : (
                <AIGeneratorPanel onGenerated={handleAIGenerated} />
              )}
            </div>
          </div>

          {/* Local Question pool side tracker */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                Exam Question Pool ({questions.length})
              </h3>
              
              <div className="max-h-[350px] overflow-y-auto space-y-3 mb-6 pr-1">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate">Q{idx + 1} • {q.type}</div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{q.questionText}</p>
                      <div className="flex gap-2 mt-1 text-[10px] font-bold">
                        <span className="text-indigo-600">{q.marks} Marks</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-amber-600">{q.difficulty}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestionLocal(q.id, q.marks)}
                      className="p-1 hover:bg-red-50 text-red-500 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <HelpCircle size={32} className="mx-auto mb-2 opacity-30" />
                    No questions added yet. Use the editor to add questions.
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm font-bold text-gray-700">
                  <span>Total Calculated Marks:</span>
                  <span className="text-indigo-600">{formData.totalMarks} Marks</span>
                </div>
                <button
                  type="button"
                  disabled={questions.length === 0}
                  onClick={() => setStep(2)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Configure Rules & Schedules →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CONFIGURATION & SCHEDULING */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
                <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><CheckCircle size={18} /></span>
                Basic Information
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormInput 
                  label="Exam Title" 
                  value={formData.title} 
                  onChange={(e) => handleChange('title', e.target.value)} 
                  placeholder="Midterm - Operating Systems" 
                  error={errors.title}
                />
                <FormInput 
                  label="Subject Code" 
                  value={formData.subject} 
                  onChange={(e) => handleChange('subject', e.target.value)} 
                  placeholder="CS402" 
                  error={errors.subject}
                />
              </div>

              <div className="mt-4">
                <FormTextarea 
                  label="Instructions for Students" 
                  value={formData.description} 
                  onChange={(e) => handleChange('description', e.target.value)} 
                  placeholder="Instructions for students (Optional)" 
                  rows={3} 
                />
              </div>
            </section>

            {/* Timing */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
                <span className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center"><Clock size={18} /></span>
                Timing & Duration
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormInput 
                  label="Start Time" 
                  type="datetime-local" 
                  value={formData.startTime} 
                  onChange={(e) => handleChange('startTime', e.target.value)} 
                  error={errors.startTime}
                />
                <FormInput 
                  label="End Time (Auto-calculated)" 
                  type="datetime-local" 
                  value={formData.endTime} 
                  disabled
                  error={errors.endTime}
                />
                <FormInput 
                  label="Duration (Minutes)" 
                  type="number" 
                  value={formData.duration} 
                  onChange={(e) => handleChange('duration', Number(e.target.value))} 
                  error={errors.duration}
                />
                <FormInput 
                  label="Total Evaluated Marks" 
                  type="number" 
                  value={formData.totalMarks} 
                  disabled
                  error={errors.totalMarks}
                />
              </div>
            </section>

            {/* Candidate Eligibility */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
                <span className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center"><Users size={18} /></span>
                Candidate Eligibility
              </h2>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Allowed Departments</label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map(dept => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleSelection('allowedDepartments', dept)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          formData.allowedDepartments.includes(dept)
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                  {errors.allowedDepartments && <p className="text-red-500 text-xs mt-2">{errors.allowedDepartments}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Target Semesters</label>
                  <div className="flex flex-wrap gap-2">
                    {SEMESTERS.map(sem => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => toggleSelection('allowedSemesters', sem)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                          formData.allowedSemesters.includes(sem)
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {sem}
                      </button>
                    ))}
                  </div>
                  {errors.allowedSemesters && <p className="text-red-500 text-xs mt-2">{errors.allowedSemesters}</p>}
                </div>
              </div>
            </section>
          </div>

          {/* Security profile */}
          <div className="space-y-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
                <span className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center"><Shield size={18} /></span>
                Security Profile
              </h2>
              
              <div className="space-y-4">
                {[
                  { key: 'cameraRequired', label: 'Face AI Monitoring', desc: 'Continuous camera verification' },
                  { key: 'browserLock', label: 'Browser Lockdown', desc: 'Block multi-tab navigation' },
                  { key: 'fullScreenMode', label: 'Enforce Fullscreen', desc: 'Exit terminates session' },
                  { key: 'watermarkRequired', label: 'Dynamic Watermark', desc: 'Overlay USN on screen' },
                  { key: 'randomiseQuestions', label: 'Randomise Questions', desc: 'Shuffle question order per user' },
                  { key: 'randomiseOptions', label: 'Randomise Options', desc: 'Shuffle MCQ options order' },
                ].map(item => (
                  <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-transparent hover:bg-gray-50 cursor-pointer transition-colors group">
                    <div className="mt-1">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                        checked={formData[item.key]} 
                        onChange={(e) => handleChange(item.key, e.target.checked)}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </label>
                ))}

                <div className="pt-4 mt-4 border-t">
                  <FormInput 
                    label="Tab Switch Limit" 
                    type="number" 
                    value={formData.tabSwitchLimit} 
                    onChange={(e) => handleChange('tabSwitchLimit', Number(e.target.value))} 
                  />
                </div>
              </div>
            </section>

            <div className="sticky top-8 space-y-4">
              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) {
                    setStep(3)
                  } else {
                    toast.error('Please resolve configuration errors')
                  }
                }}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                Proceed to Review →
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                ← Back to Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: FINAL REVIEW & DEPLOY */}
      {step === 3 && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b">Review & Publish Examination</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Exam Summary</h3>
                <table className="w-full text-sm text-gray-600 space-y-3">
                  <tbody>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">Title:</td>
                      <td className="text-gray-900 text-right">{formData.title}</td>
                    </tr>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">Subject:</td>
                      <td className="text-gray-900 text-right">{formData.subject}</td>
                    </tr>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">Start Time:</td>
                      <td className="text-gray-900 text-right">{new Date(formData.startTime).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">End Time:</td>
                      <td className="text-gray-900 text-right">{new Date(formData.endTime).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">Duration:</td>
                      <td className="text-gray-900 text-right">{formData.duration} Minutes</td>
                    </tr>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">Total Marks:</td>
                      <td className="text-indigo-600 font-bold text-right">{formData.totalMarks} Marks</td>
                    </tr>
                    <tr className="border-b py-2">
                      <td className="font-semibold py-2">Total Questions:</td>
                      <td className="text-indigo-600 font-bold text-right">{questions.length} Questions</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Configurations & Security</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className={`p-3 rounded-xl border ${formData.cameraRequired ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    <div className="font-bold">Face AI Proctoring</div>
                    <div>{formData.cameraRequired ? 'ENABLED' : 'DISABLED'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${formData.browserLock ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    <div className="font-bold">Browser Lockdown</div>
                    <div>{formData.browserLock ? 'ENABLED' : 'DISABLED'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${formData.fullScreenMode ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    <div className="font-bold">Fullscreen Locks</div>
                    <div>{formData.fullScreenMode ? 'ENABLED' : 'DISABLED'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${formData.watermarkRequired ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    <div className="font-bold">Dynamic Watermark</div>
                    <div>{formData.watermarkRequired ? 'ENABLED' : 'DISABLED'}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <div className="mb-2"><strong>Departments:</strong> {formData.allowedDepartments.join(', ')}</div>
                  <div><strong>Semesters:</strong> Sem {formData.allowedSemesters.join(', ')}</div>
                </div>
              </div>
            </div>

            {/* Questions Table */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Questions Pool List</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-4 py-3">No.</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Prompt</th>
                      <th className="px-4 py-3">Difficulty</th>
                      <th className="px-4 py-3 text-right">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, i) => (
                      <tr key={q.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{i + 1}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 font-bold rounded-full">{q.type}</span></td>
                        <td className="px-4 py-3 truncate max-w-[300px]">{q.questionText}</td>
                        <td className="px-4 py-3 font-semibold text-xs text-amber-600">{q.difficulty}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{q.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <InfoBox>
              Once you click "Deploy Examination", the exam will be initialized on the central database, physical invigilator codes will be generated, and students belonging to the target departments can join the lobby.
            </InfoBox>

            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-4 border border-gray-300 font-bold text-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-center"
              >
                ← Edit Timing & Rules
              </button>
              <button
                type="button"
                onClick={handleDeployExam}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 disabled:bg-gray-400 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deploying...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Deploy & Publish Examination
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
