import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  UploadCloud,
  FileText,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  BookOpen,
  FileSpreadsheet,
  Layers,
  Settings2,
  Sliders,
  XCircle,
  RefreshCw,
  Info
} from 'lucide-react'
import { api, errorMessage } from '@/lib/apiClient'

export default function ExamWizardStepUpload({
  onPdfExtracted,
  onSkipToManual,
  draftStatus,
  onDraftResume
}) {
  // Mode: null | 'generate' | 'extract' | 'manual'
  const [entryMode, setEntryMode] = useState('generate')
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [fileBase64, setFileBase64] = useState('')
  const [extractedCapacity, setExtractedCapacity] = useState(null)
  const [calculatingCapacity, setCalculatingCapacity] = useState(false)

  // Generate Controls (Defaults per Spec)
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState('MIXED')
  const [difficultySplit, setDifficultySplit] = useState({ easy: 30, medium: 50, hard: 20 })
  const [questionFocus, setQuestionFocus] = useState('concept + application')
  const [pageRange, setPageRange] = useState('all')
  const [optionsPerQuestion, setOptionsPerQuestion] = useState(4)
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [markingRule, setMarkingRule] = useState('default') // 'default' | 'difficulty'
  const [language, setLanguage] = useState('Same as material')
  const [explanations, setExplanations] = useState(true)
  const [avoidDuplicates, setAvoidDuplicates] = useState(true)

  // Batch Job State
  const [isProcessing, setIsProcessing] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [jobProgress, setJobProgress] = useState({ completed: 0, total: 10, currentBatch: 1, totalBatches: 1 })
  const [partialQuestions, setPartialQuestions] = useState([])
  const [honestyNotice, setHonestyNotice] = useState('')
  const [error, setError] = useState('')
  const [failedBatch, setFailedBatch] = useState(null)
  const pollTimerRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const validateFile = (selectedFile) => {
    if (!selectedFile) return false
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF document (.pdf). Other formats are not supported.')
      return false
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('PDF file size exceeds maximum limit of 10 MB. Please upload a smaller document.')
      return false
    }
    setError('')
    return true
  }

  const handleFileProcess = (selectedFile) => {
    if (!validateFile(selectedFile)) return
    setFile(selectedFile)
    setError('')
    setHonestyNotice('')

    // Read base64 and estimate capacity
    const reader = new FileReader()
    reader.readAsDataURL(selectedFile)
    reader.onload = async () => {
      setFileBase64(reader.result)
      setCalculatingCapacity(true)
      try {
        // Quick estimate via lightweight capacity endpoint or fallback estimate
        const roughWords = Math.floor(selectedFile.size / 12)
        const supported = Math.max(3, Math.min(50, Math.floor(roughWords / 130)))
        setExtractedCapacity({
          wordCount: roughWords,
          supportedCount: supported,
          hint: `This material supports about ${supported} questions`
        })
      } catch {
        setExtractedCapacity({ supportedCount: 15, hint: 'This material supports about 15 questions' })
      } finally {
        setCalculatingCapacity(false)
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFile = e.dataTransfer?.files?.[0]
    if (droppedFile) handleFileProcess(droppedFile)
  }

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0]
    if (selected) handleFileProcess(selected)
  }

  const pollJobStatus = (id) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/exams/ai-jobs/${id}`)
        const job = res.data?.job
        if (!job) return

        setJobProgress({
          completed: job.progress?.completed || 0,
          total: job.progress?.total || questionCount,
          currentBatch: (job.progress?.currentBatchIndex || 0) + 1,
          totalBatches: job.progress?.totalBatches || 1
        })

        if (job.questions?.length > 0) {
          setPartialQuestions(job.questions)
        }

        if (job.status === 'completed') {
          clearInterval(pollTimerRef.current)
          setIsProcessing(false)
          if (job.honestyNote) setHonestyNotice(job.honestyNote)
          onPdfExtracted({
            ...job.metadata,
            questions: job.questions,
            honestyNote: job.honestyNote,
            aiAudit: job.aiAudit
          })
        } else if (job.status === 'failed') {
          clearInterval(pollTimerRef.current)
          setIsProcessing(false)
          setFailedBatch(job.error?.batchIndex || 0)
          setError(job.error?.message || 'Generation failed on a batch. Partial results preserved.')
        } else if (job.status === 'cancelled') {
          clearInterval(pollTimerRef.current)
          setIsProcessing(false)
        }
      } catch {
        // Fallback polling retry
      }
    }, 1500)
  }

  const handleStartGeneration = async () => {
    if (!file || !fileBase64) {
      setError('Please select a PDF document first.')
      return
    }

    setIsProcessing(true)
    setError('')
    setHonestyNotice('')
    setFailedBatch(null)

    const payload = {
      pdfBase64: fileBase64,
      fileName: file.name,
      settings: {
        count: questionCount,
        difficulty,
        difficultySplit: difficulty === 'MIXED' ? difficultySplit : undefined,
        focus: questionFocus,
        pageRange,
        optionsPerQuestion,
        allowMultiple,
        markingRule,
        language,
        explanations,
        avoidDuplicates,
        isExtractMode: entryMode === 'extract'
      }
    }

    try {
      const res = await api.post('/exams/ai-jobs/start', payload)
      if (res.data?.jobId) {
        setJobId(res.data.jobId)
        pollJobStatus(res.data.jobId)
      } else {
        // Fallback synchronous path
        const syncRes = await api.post('/exams/generate-from-pdf', {
          ...payload.settings,
          pdfBase64: fileBase64,
          fileName: file.name
        })
        setIsProcessing(false)
        onPdfExtracted(syncRes.data)
      }
    } catch (err) {
      setIsProcessing(false)
      setError(errorMessage(err, 'Failed to begin AI question job.'))
    }
  }

  const handleCancelJob = async () => {
    if (!jobId) return
    try {
      await api.post(`/exams/ai-jobs/${jobId}/cancel`)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      setIsProcessing(false)
      if (partialQuestions.length > 0) {
        onPdfExtracted({
          questions: partialQuestions,
          honestyNote: 'Job cancelled by user. Kept ' + partialQuestions.length + ' generated questions.'
        })
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to cancel job'))
    }
  }

  const handleRetryBatch = async () => {
    if (!jobId) return
    setIsProcessing(true)
    setError('')
    setFailedBatch(null)
    try {
      await api.post(`/exams/ai-jobs/${jobId}/retry`)
      pollJobStatus(jobId)
    } catch (err) {
      setIsProcessing(false)
      setError(errorMessage(err, 'Failed to retry batch'))
    }
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Draft Resume Alert */}
      {draftStatus?.hasDraft && (
        <div className="p-3 bg-[rgba(82,102,235,0.08)] rounded-[14px] flex items-center justify-between text-xs text-[#28253b]">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#5266eb]" />
            <span>Saved draft found from {new Date(draftStatus.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDraftResume}
            className="h-7 text-xs rounded-full px-3 bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#edecfb]"
          >
            Resume Draft
          </Button>
        </div>
      )}

      {/* 1. Entry Selection Cards (3 Cards) */}
      <div>
        <p className="text-xs font-[420] text-[#554e7b] mb-2 uppercase tracking-[0.28px]">Step 1: Choose Question Entry Mode</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Generate from study material */}
          <div
            onClick={() => setEntryMode('generate')}
            className={`p-4 rounded-[16px] cursor-pointer transition-all border-0 ${
              entryMode === 'generate'
                ? 'bg-[#edecfb] ring-2 ring-[#5266eb]'
                : 'bg-[#fbfbff] hover:bg-[#edecfb]/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-full bg-[rgba(82,102,235,0.12)] text-[#5266eb] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <Badge className="bg-[rgba(82,102,235,0.10)] text-[#5266eb] text-[10px] border-0 rounded-full font-[420]">
                Synthesize
              </Badge>
            </div>
            <h4 className="text-sm font-[480] text-[#28253b]">Generate from study material</h4>
            <p className="text-xs text-[#554e7b] font-[360] mt-1">
              Upload textbook, notes, or syllabus PDF. Generates grounded conceptual and application questions.
            </p>
          </div>

          {/* Card 2: Extract from a question paper */}
          <div
            onClick={() => setEntryMode('extract')}
            className={`p-4 rounded-[16px] cursor-pointer transition-all border-0 ${
              entryMode === 'extract'
                ? 'bg-[#edecfb] ring-2 ring-[#5266eb]'
                : 'bg-[#fbfbff] hover:bg-[#edecfb]/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-full bg-[rgba(82,102,235,0.12)] text-[#5266eb] flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <Badge className="bg-[#edecfb] text-[#554e7b] text-[10px] border-0 rounded-full font-[420]">
                Extract
              </Badge>
            </div>
            <h4 className="text-sm font-[480] text-[#28253b]">Extract from a question paper</h4>
            <p className="text-xs text-[#554e7b] font-[360] mt-1">
              Extract questions directly from existing PDF test papers. Missing answers are badged & solved by AI.
            </p>
          </div>

          {/* Card 3: Type or import from Excel */}
          <div
            onClick={() => {
              setEntryMode('manual')
              onSkipToManual()
            }}
            className={`p-4 rounded-[16px] cursor-pointer transition-all border-0 ${
              entryMode === 'manual'
                ? 'bg-[#edecfb] ring-2 ring-[#5266eb]'
                : 'bg-[#fbfbff] hover:bg-[#edecfb]/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-full bg-[rgba(82,102,235,0.12)] text-[#5266eb] flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <Badge className="bg-[#edecfb] text-[#554e7b] text-[10px] border-0 rounded-full font-[420]">
                Manual / CSV
              </Badge>
            </div>
            <h4 className="text-sm font-[480] text-[#28253b]">Type or import from Excel</h4>
            <p className="text-xs text-[#554e7b] font-[360] mt-1">
              Create assessment manually or download sample spreadsheet templates for bulk question import.
            </p>
          </div>
        </div>
      </div>

      {/* 2. File Upload Dropzone (for Generate or Extract modes) */}
      {(entryMode === 'generate' || entryMode === 'extract') && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-[#e9eaf2] bg-[#fbfbff] rounded-[16px] p-6 text-center cursor-pointer transition-colors ${
              isDragging ? 'bg-[#edecfb]' : file ? 'bg-white' : 'hover:bg-[#edecfb]/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[rgba(82,102,235,0.10)] text-[#5266eb] flex items-center justify-center">
                {file ? <FileText className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
              </div>

              <div>
                <p className="text-sm font-[480] text-[#28253b]">
                  {file ? file.name : `Select or drag and drop your ${entryMode === 'extract' ? 'question paper' : 'study material'} PDF`}
                </p>
                <p className="text-xs text-[#70707d] font-[360] mt-0.5">
                  {file
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for processing`
                    : 'Maximum file size: 10 MB • Scanned or digital PDF'}
                </p>
              </div>

              {/* Live Material Capacity Hint */}
              {extractedCapacity && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#edecfb] text-[#28253b] text-xs font-[420] mt-1">
                  <Info className="w-3.5 h-3.5 text-[#5266eb]" />
                  <span>{extractedCapacity.hint}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Generate Controls Panel (when file selected) */}
          {file && !isProcessing && (
            <div className="bg-[#fbfbff] rounded-[16px] p-5 space-y-5 border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#5266eb]" />
                  <h4 className="text-sm font-[480] text-[#28253b]">
                    {entryMode === 'extract' ? 'Extraction Controls' : 'Generation Controls'}
                  </h4>
                </div>
                <span className="text-[11px] text-[#554e7b] font-[360]">Batch execution (at most 10/batch)</span>
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                {/* Stepper: Number of Questions (1 to 50) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-[420] text-[#28253b]">Number of Questions</label>
                    <span className="text-[#554e7b] text-[11px] font-mono">{questionCount} questions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuestionCount(c => Math.max(1, c - 1))}
                      className="h-8 w-8 rounded-full border-[#e9eaf2] bg-white text-[#28253b] p-0"
                    >
                      -
                    </Button>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                      className="flex-1 accent-[#5266eb]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuestionCount(c => Math.min(50, c + 1))}
                      className="h-8 w-8 rounded-full border-[#e9eaf2] bg-white text-[#28253b] p-0"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Difficulty Select */}
                <div className="space-y-1.5">
                  <label className="font-[420] text-[#28253b]">Target Difficulty</label>
                  <div className="flex items-center gap-1.5">
                    {['MIXED', 'EASY', 'MEDIUM', 'HARD'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 h-8 rounded-full text-xs font-[420] transition-colors ${
                          difficulty === d
                            ? 'bg-[#5266eb] text-white'
                            : 'bg-white text-[#554e7b] border border-[#e9eaf2] hover:bg-[#edecfb]'
                        }`}
                      >
                        {d === 'MIXED' ? 'Mixed' : d.charAt(0) + d.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editable Split when MIXED */}
                {difficulty === 'MIXED' && (
                  <div className="md:col-span-2 bg-white p-3 rounded-[12px] flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-[420] text-[#28253b]">Editable Difficulty Split (%):</span>
                    <div className="flex items-center gap-2">
                      <span>Easy:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={difficultySplit.easy}
                        onChange={(e) => setDifficultySplit(s => ({ ...s, easy: parseInt(e.target.value, 10) || 0 }))}
                        className="w-12 h-6 px-1.5 rounded-[6px] border border-[#e9eaf2] text-center font-mono text-xs"
                      />
                      <span>Med:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={difficultySplit.medium}
                        onChange={(e) => setDifficultySplit(s => ({ ...s, medium: parseInt(e.target.value, 10) || 0 }))}
                        className="w-12 h-6 px-1.5 rounded-[6px] border border-[#e9eaf2] text-center font-mono text-xs"
                      />
                      <span>Hard:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={difficultySplit.hard}
                        onChange={(e) => setDifficultySplit(s => ({ ...s, hard: parseInt(e.target.value, 10) || 0 }))}
                        className="w-12 h-6 px-1.5 rounded-[6px] border border-[#e9eaf2] text-center font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Question Focus */}
                <div className="space-y-1.5">
                  <label className="font-[420] text-[#28253b]">Question Focus</label>
                  <select
                    value={questionFocus}
                    onChange={(e) => setQuestionFocus(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-[8px] bg-white border border-[#e9eaf2] text-xs font-[420] text-[#28253b]"
                  >
                    <option value="concept + application">Concept + Application (Default)</option>
                    <option value="concept">Concept Only</option>
                    <option value="application">Application & Problem Solving</option>
                    <option value="calculation">Calculations & Quantitative</option>
                    <option value="recall">Factual Recall & Definitions</option>
                  </select>
                </div>

                {/* Options Per Question */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-[420] text-[#28253b]">Options per Question</label>
                    <span className="text-[#554e7b] text-[11px] font-mono">{optionsPerQuestion} choices</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[3, 4, 5].map((optCount) => (
                      <button
                        key={optCount}
                        type="button"
                        onClick={() => setOptionsPerQuestion(optCount)}
                        className={`flex-1 h-8 rounded-full text-xs font-[420] ${
                          optionsPerQuestion === optCount
                            ? 'bg-[#5266eb] text-white'
                            : 'bg-white text-[#554e7b] border border-[#e9eaf2] hover:bg-[#edecfb]'
                        }`}
                      >
                        {optCount} options
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle: Explanations */}
                <div className="flex items-center justify-between bg-white p-2.5 rounded-[10px]">
                  <div>
                    <span className="font-[420] text-[#28253b] block">Include Explanations</span>
                    <span className="text-[10px] text-[#70707d]">Faculty-only until results release</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={explanations}
                    onChange={(e) => setExplanations(e.target.checked)}
                    className="h-4 w-4 accent-[#5266eb] rounded"
                  />
                </div>

                {/* Toggle: Avoid Duplicates */}
                <div className="flex items-center justify-between bg-white p-2.5 rounded-[10px]">
                  <div>
                    <span className="font-[420] text-[#28253b] block">Deduplicate Questions</span>
                    <span className="text-[10px] text-[#70707d]">Similarity guard against repeats</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={avoidDuplicates}
                    onChange={(e) => setAvoidDuplicates(e.target.checked)}
                    className="h-4 w-4 accent-[#5266eb] rounded"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="h-9 px-4 rounded-full text-xs text-[#554e7b] border-[#e9eaf2] hover:bg-[#edecfb]"
                >
                  Choose Different File
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleStartGeneration}
                  className="h-9 px-6 rounded-full text-xs font-[420] bg-[#5266eb] text-white hover:bg-[#4353c7]"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {entryMode === 'extract' ? 'Extract Questions from Paper' : 'Generate Questions'}
                </Button>
              </div>
            </div>
          )}

          {/* 4. Batch Job Progress Bar & Status */}
          {isProcessing && (
            <div className="bg-[#fbfbff] rounded-[16px] p-6 space-y-4 text-center border-0">
              <div className="flex items-center justify-center gap-2 text-sm font-[480] text-[#28253b]">
                <Loader2 className="w-4 h-4 animate-spin text-[#5266eb]" />
                <span>
                  {entryMode === 'extract' ? 'Extracting' : 'Generating'} questions {jobProgress.completed} of {jobProgress.total}...
                </span>
                <span className="text-xs text-[#554e7b] font-[360]">
                  (Batch {jobProgress.currentBatch} of {jobProgress.totalBatches})
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full max-w-md mx-auto h-2 bg-[#edecfb] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#5266eb] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(5, (jobProgress.completed / Math.max(1, jobProgress.total)) * 100))}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelJob}
                  className="h-8 px-4 rounded-full text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Cancel (Keep Partial Results)
                </Button>
              </div>
            </div>
          )}

          {/* Error and Retry */}
          {error && (
            <div className="p-3.5 bg-[#edecfb] rounded-[12px] flex items-center justify-between text-xs text-[#28253b] font-[420]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
              {failedBatch !== null && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetryBatch}
                  className="h-7 px-3 text-xs rounded-full bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#edecfb]"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry Failed Batch
                </Button>
              )}
            </div>
          )}

          {/* Honesty Notice */}
          {honestyNotice && (
            <div className="p-3.5 bg-[#fbfbff] rounded-[12px] flex items-start gap-2.5 text-xs text-[#554e7b] font-[360] border-0">
              <Info className="w-4 h-4 text-[#5266eb] shrink-0 mt-0.5" />
              <span>{honestyNotice}</span>
            </div>
          )}

          {/* Skip manually footer button */}
          <div className="flex items-center justify-between pt-3 border-t border-[#e9eaf2]/60">
            <Button
              type="button"
              variant="ghost"
              onClick={onSkipToManual}
              className="text-xs text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb]/60 rounded-full h-8 px-4"
            >
              Skip, I'll type questions manually
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
