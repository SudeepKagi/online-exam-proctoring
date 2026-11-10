import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, AlertTriangle, CheckCircle2, Trash2, PlusCircle, Edit3, HelpCircle } from 'lucide-react'

export default function ExamWizardStepAIReview({
  questions,
  setQuestions,
  metadata,
  setMetadata,
  onAcknowledgeReview
}) {
  const [manualMode, setManualMode] = useState(false)
  const [manualQ, setManualQ] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    marks: 1,
    negativeMarks: 0,
    confidence: 1.0,
    needsReview: false
  })
  const [editingIdx, setEditingIdx] = useState(null)

  const unreviewedCount = questions.filter(q => q.needsReview).length

  const handleUpdateOption = (qIdx, optIdx, val) => {
    setQuestions(prev => {
      const copy = [...prev]
      const opts = [...copy[qIdx].options]
      opts[optIdx] = val
      copy[qIdx] = { ...copy[qIdx], options: opts }
      return copy
    })
  }

  const handleSetCorrect = (qIdx, optIdx) => {
    setQuestions(prev => {
      const copy = [...prev]
      copy[qIdx] = { ...copy[qIdx], correctOptionIndex: optIdx }
      return copy
    })
  }

  const handleAcknowledgeQuestion = (qIdx) => {
    setQuestions(prev => {
      const copy = [...prev]
      copy[qIdx] = { ...copy[qIdx], needsReview: false }
      return copy
    })
  }

  const handleDeleteQuestion = (qIdx) => {
    setQuestions(prev => prev.filter((_, idx) => idx !== qIdx))
  }

  const handleAddManualQuestion = (e) => {
    e.preventDefault()
    if (!manualQ.questionText.trim()) return
    if (manualQ.options.some(o => !o.trim())) return

    setQuestions(prev => [...prev, { ...manualQ }])
    setManualQ({
      questionText: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 1,
      negativeMarks: 0,
      confidence: 1.0,
      needsReview: false
    })
    setManualMode(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-[480] text-foreground flex items-center gap-2">
            Questions & Marking Scheme
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              {questions.length} Items
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review questions extracted by AI or entered manually. You can edit any question or choice directly.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {unreviewedCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-[420] text-xs">
              <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
              {unreviewedCount} question(s) need review
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManualMode(!manualMode)}
            className="text-xs rounded-[40px] px-3.5 h-8 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1 text-[#5266eb]" /> Add Question
          </Button>
        </div>
      </div>

      {/* Manual question entry form if active */}
      {manualMode && (
        <Card className="border border-primary/30 bg-primary/5 rounded-[16px]">
          <CardContent className="p-4 space-y-3">
            <span className="text-xs font-[480] text-primary uppercase tracking-wide">
              New Multiple Choice Question
            </span>
            <Input
              placeholder="Question prompt or problem statement"
              value={manualQ.questionText}
              onChange={e => setManualQ({ ...manualQ, questionText: e.target.value })}
              className="text-xs"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {manualQ.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="manual_correct"
                    checked={manualQ.correctOptionIndex === oIdx}
                    onChange={() => setManualQ({ ...manualQ, correctOptionIndex: oIdx })}
                    className="accent-primary"
                  />
                  <Input
                    placeholder={`Option ${oIdx + 1}`}
                    value={opt}
                    onChange={e => {
                      const opts = [...manualQ.options]
                      opts[oIdx] = e.target.value
                      setManualQ({ ...manualQ, options: opts })
                    }}
                    className="text-xs h-8"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManualMode(false)}
                className="h-7 text-xs rounded-[40px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddManualQuestion}
                className="h-7 text-xs rounded-[40px] bg-primary text-primary-foreground"
              >
                Save Question
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List of Questions */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {questions.length === 0 ? (
          <div className="text-center py-10 bg-muted/10 rounded-[16px] text-xs text-muted-foreground">
            No questions yet. Click "Add Question" to create one manually or upload a PDF document.
          </div>
        ) : (
          questions.map((q, qIdx) => (
            <Card
              key={qIdx}
              className={`border rounded-[14px] transition-colors ${
                q.needsReview
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-border bg-card'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-2">
                    <span className="font-mono text-xs text-muted-foreground mt-0.5">
                      Q{qIdx + 1}.
                    </span>
                    <div>
                      <p className="text-xs font-[480] text-foreground leading-relaxed">
                        {q.questionText}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] py-0 px-1.5 border-primary/30 text-primary"
                        >
                          <Sparkles className="w-2.5 h-2.5 mr-1" /> AI-filled
                        </Badge>
                        {q.sourcePage && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground border-border">
                            Page {q.sourcePage}
                          </Badge>
                        )}
                        {q.needsReview ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] py-0 px-1.5 border-0 font-[420]">
                            Needs Review
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 text-[10px] py-0 px-1.5 border-0 font-[420]">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {q.needsReview && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledgeQuestion(qIdx)}
                        className="h-6 text-[10px] px-2 rounded-[40px] bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteQuestion(qIdx)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-full"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Options 2x2 Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  {q.options.map((opt, oIdx) => {
                    const isCorrect = q.correctOptionIndex === oIdx
                    return (
                      <div
                        key={oIdx}
                        onClick={() => handleSetCorrect(qIdx, oIdx)}
                        className={`flex items-center space-x-2 p-2 rounded-[10px] text-xs cursor-pointer border transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                            : 'bg-muted/10 border-transparent hover:bg-muted/20 text-foreground'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct_${qIdx}`}
                          checked={isCorrect}
                          onChange={() => handleSetCorrect(qIdx, oIdx)}
                          className="accent-emerald-600"
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onClick={e => e.stopPropagation()}
                          onChange={e => handleUpdateOption(qIdx, oIdx, e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs flex-1 focus:outline-none"
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

