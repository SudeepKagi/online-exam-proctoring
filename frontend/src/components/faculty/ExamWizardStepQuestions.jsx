import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage } from '@/lib/apiClient'
import { Sparkles, FileText, PlusCircle, Trash2, CheckCircle2, UploadCloud } from 'lucide-react'

export default function ExamWizardStepQuestions({ questions, setQuestions }) {
  const [mode, setMode] = useState('PDF') // 'PDF' | 'MANUAL'
  const [pdfFile, setPdfFile] = useState(null)
  const [topicHint, setTopicHint] = useState('')
  const [qCount, setQCount] = useState(10)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [manualQ, setManualQ] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    marks: 1,
    negativeMarks: 0
  })

  const handlePdfUpload = async (e) => {
    e.preventDefault()
    if (!pdfFile) return setError('Please choose a .pdf lecture notes file')
    setLoading(true)
    setError('')
    try {
      const reader = new FileReader()
      reader.readAsDataURL(pdfFile)
      reader.onload = async () => {
        try {
          const res = await api.post('/exams/generate-from-pdf', {
            pdfBase64: reader.result, fileName: pdfFile.name, count: qCount, difficulty, topicHint
          })
          const generated = res.data?.questions || []
          if (!generated.length) throw new Error('No questions could be extracted from this PDF.')
          setQuestions(prev => [...prev, ...generated])
          setPdfFile(null)
        } catch (err) {
          setError(errorMessage(err, 'Failed to extract AI questions from PDF.'))
        } finally { setLoading(false) }
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed reading file'))
      setLoading(false)
    }
  }

  const handleAddManual = (e) => {
    e.preventDefault()
    if (!manualQ.questionText.trim()) return setError('Question text is required.')
    if (manualQ.options.some(o => !o.trim())) return setError('All 4 options must be filled.')
    setError('')
    setQuestions(prev => [...prev, { ...manualQ }])
    setManualQ({ questionText: '', options: ['', '', '', ''], correctOptionIndex: 0, marks: 1, negativeMarks: 0 })
  }

  const removeQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4 font-sans text-[#28253b]">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between border-b border-[#e9eaf2] pb-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'PDF' ? 'default' : 'outline'}
            onClick={() => setMode('PDF')}
            className={`text-xs rounded-full h-8 px-4 cursor-pointer ${mode === 'PDF' ? 'bg-[#5266eb] text-white' : 'text-[#554e7b]'}`}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Synthesis from PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'MANUAL' ? 'default' : 'outline'}
            onClick={() => setMode('MANUAL')}
            className={`text-xs rounded-full h-8 px-4 cursor-pointer ${mode === 'MANUAL' ? 'bg-[#5266eb] text-white' : 'text-[#554e7b]'}`}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add MCQ Manually
          </Button>
        </div>
        <Badge variant="outline" className="text-xs font-[480] bg-[#fbfbff] border-[#e9eaf2] text-[#5266eb]">
          {questions.length} Question{questions.length === 1 ? '' : 's'} in Bank
        </Badge>
      </div>

      {error && <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl">{error}</div>}

      {mode === 'PDF' ? (
        <form onSubmit={handlePdfUpload} className="p-4 bg-[#fbfbff] border border-[#e9eaf2] rounded-xl space-y-3">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#c3c3cc]/60 hover:border-[#5266eb] rounded-xl p-4 transition bg-white text-center cursor-pointer relative">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud className="w-8 h-8 text-[#5266eb] mb-1.5" />
            <span className="text-xs font-[480] text-[#28253b]">
              {pdfFile ? pdfFile.name : 'Click or drop PDF Lecture Notes (Max 10MB)'}
            </span>
            <span className="text-[11px] text-[#70707d] mt-0.5">Automated text parser & syllabus-aware AI MCQ synthesis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <FormField label="Topic Hint (Optional)">
              <Input
                placeholder="e.g. Fourier Transforms"
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Questions Count">
              <Input
                type="number"
                min={1}
                max={50}
                value={qCount}
                onChange={(e) => setQCount(parseInt(e.target.value, 10) || 5)}
                className="h-9 text-xs"
              />
            </FormField>
            <FormField label="Difficulty Level">
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY" className="text-xs">Easy</SelectItem>
                  <SelectItem value="MEDIUM" className="text-xs">Medium</SelectItem>
                  <SelectItem value="HARD" className="text-xs">Hard</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-9 bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-full cursor-pointer">
            {loading ? 'Synthesizing Questions from PDF...' : 'Generate Questions from PDF'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleAddManual} className="p-4 bg-[#fbfbff] border border-[#e9eaf2] rounded-xl space-y-3">
          <FormField label="Question Prompt" required>
            <Input
              required
              placeholder="e.g. Which algorithm is used for shortest path routing?"
              value={manualQ.questionText}
              onChange={(e) => setManualQ({ ...manualQ, questionText: e.target.value })}
              className="h-9 text-xs"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {['A', 'B', 'C', 'D'].map((label, idx) => (
              <div key={label} className="flex items-center gap-2 bg-white p-2 border border-[#e9eaf2] rounded-xl">
                <input
                  type="radio"
                  name="correctOption"
                  checked={manualQ.correctOptionIndex === idx}
                  onChange={() => setManualQ({ ...manualQ, correctOptionIndex: idx })}
                  className="accent-[#5266eb] cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-[#554e7b]">{label}.</span>
                <input
                  required
                  placeholder={`Option ${label}`}
                  value={manualQ.options[idx]}
                  onChange={(e) => {
                    const next = [...manualQ.options]
                    next[idx] = e.target.value
                    setManualQ({ ...manualQ, options: next })
                  }}
                  className="flex-1 text-xs border-0 outline-none p-0 text-[#28253b]"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#70707d]">Radio indicates the correct option</span>
            <Button type="submit" size="sm" className="h-8 px-4 bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-full cursor-pointer">
              + Save Question to Bank
            </Button>
          </div>
        </form>
      )}

      {/* Review Pool */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {questions.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#70707d] border border-dashed border-[#e9eaf2] rounded-xl">
            Question bank is empty. Generate from PDF notes or add custom MCQs above.
          </div>
        ) : (
          questions.map((q, idx) => (
            <div key={idx} className="p-2.5 bg-white border border-[#e9eaf2] rounded-xl flex items-start justify-between gap-3 shadow-xs">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-[500] text-[#5266eb]">Q{idx + 1}.</span>
                  <span className="text-xs font-[480] text-[#28253b]">{q.questionText}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-[#554e7b] pl-5">
                  {(q.options || []).map((opt, oIdx) => (
                    <span key={oIdx} className={oIdx === q.correctOptionIndex ? 'text-emerald-700 font-semibold' : ''}>
                      {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === q.correctOptionIndex ? '✓' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => removeQuestion(idx)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer" title="Remove">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
