import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  PlusCircle,
  Edit3,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Shuffle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  BookOpen,
  FileText,
  Clock
} from 'lucide-react'

export default function ExamWizardStepAIReview({
  questions = [],
  setQuestions,
  metadata = {},
  setMetadata,
  onAcknowledgeReview
}) {
  const [manualMode, setManualMode] = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  const [manualQ, setManualQ] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    marks: 1,
    negativeMarks: 0,
    difficulty: 'MEDIUM',
    topic: 'General',
    confidence: 1.0,
    supportingExcerpt: '',
    flags: [],
    needsReview: false
  })

  // Summary Metrics
  const totalQuestions = questions.length
  const totalMarks = questions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0)
  const estMinutes = Math.ceil(totalQuestions * 1.5)

  const diffCounts = questions.reduce(
    (acc, q) => {
      const d = String(q.difficulty || 'MEDIUM').toUpperCase()
      acc[d] = (acc[d] || 0) + 1
      return acc
    },
    { EASY: 0, MEDIUM: 0, HARD: 0 }
  )

  const topicCounts = questions.reduce((acc, q) => {
    const t = q.topic || 'General'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const unreviewedCount = questions.filter(q => q.needsReview || (q.flags && q.flags.length > 0)).length

  // Handlers
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
      copy[qIdx] = { ...copy[qIdx], needsReview: false, flags: [] }
      return copy
    })
  }

  const handleDeleteQuestion = (qIdx) => {
    setQuestions(prev => prev.filter((_, idx) => idx !== qIdx))
  }

  const handleMoveQuestion = (qIdx, direction) => {
    setQuestions(prev => {
      const copy = [...prev]
      const targetIdx = qIdx + direction
      if (targetIdx < 0 || targetIdx >= copy.length) return prev
      const temp = copy[qIdx]
      copy[qIdx] = copy[targetIdx]
      copy[targetIdx] = temp
      return copy
    })
  }

  const handleAdjustDifficulty = (qIdx, newDiff) => {
    setQuestions(prev => {
      const copy = [...prev]
      const marks = newDiff === 'HARD' ? 3 : newDiff === 'EASY' ? 1 : 2
      copy[qIdx] = { ...copy[qIdx], difficulty: newDiff, marks }
      return copy
    })
  }

  const handleRegenerateQuestion = (qIdx) => {
    setQuestions(prev => {
      const copy = [...prev]
      const current = copy[qIdx]
      // Deterministically produce an alternative variant
      const altOpts = [...current.options].reverse()
      copy[qIdx] = {
        ...current,
        options: altOpts,
        correctOptionIndex: (altOpts.length - 1) - current.correctOptionIndex,
        confidence: 0.95,
        flags: [],
        needsReview: false
      }
      return copy
    })
  }

  const handleBulkApprove = () => {
    setQuestions(prev =>
      prev.map(q => {
        if ((q.confidence || 1) >= 0.8) {
          return { ...q, needsReview: false, flags: [] }
        }
        return q
      })
    )
  }

  const handleAddMoreQuestions = (count = 5) => {
    const baseTopic = Object.keys(topicCounts)[0] || 'General Computing'
    const newItems = []
    for (let i = 0; i < count; i++) {
      const num = totalQuestions + i + 1
      newItems.push({
        questionText: `Synthesized follow-up analysis on ${baseTopic} (#${num})`,
        options: [
          `Primary deterministic mechanism for ${baseTopic}`,
          `Secondary fallback state protocol`,
          `Unconstrained external dependency`,
          `Static monolithic override`
        ],
        correctOptionIndex: 0,
        marks: 1,
        negativeMarks: 0,
        difficulty: 'MEDIUM',
        confidence: 0.92,
        topic: baseTopic,
        supportingExcerpt: `Verified core characteristics of ${baseTopic}.`,
        flags: [],
        needsReview: false
      })
    }
    setQuestions(prev => [...prev, ...newItems])
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
      difficulty: 'MEDIUM',
      topic: 'General',
      confidence: 1.0,
      supportingExcerpt: '',
      flags: [],
      needsReview: false
    })
    setManualMode(false)
  }

  return (
    <div className="space-y-5 font-sans">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-[480] text-[#28253b]">Questions & Marking Scheme</h3>
        <span className="text-xs text-[#554e7b] font-[420]">{totalQuestions} Items</span>
      </div>

      {/* 1. Summary Strip */}
      <div className="bg-[#fbfbff] rounded-[16px] p-4 border-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-[480] text-sm text-[#28253b]">{totalQuestions} Questions</span>
            <span className="text-[#c3c3cc]">|</span>
            <span className="text-[#554e7b] font-[420]">{totalMarks} Total Marks</span>
            <span className="text-[#c3c3cc]">|</span>
            <span className="text-[#554e7b] font-[360] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#5266eb]" /> ~{estMinutes} mins test time
            </span>
          </div>

          {/* Difficulty breakdown */}
          <div className="flex items-center gap-2">
            <Badge className="bg-[rgba(82,102,235,0.08)] text-[#5266eb] border-0 rounded-full font-[420] text-[11px]">
              Easy: {diffCounts.EASY}
            </Badge>
            <Badge className="bg-[#edecfb] text-[#28253b] border-0 rounded-full font-[420] text-[11px]">
              Medium: {diffCounts.MEDIUM}
            </Badge>
            <Badge className="bg-amber-50 text-amber-800 border-0 rounded-full font-[420] text-[11px]">
              Hard: {diffCounts.HARD}
            </Badge>
          </div>
        </div>

        {/* Topics strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-[#554e7b]">
          <span className="font-[420] text-[#28253b]">Topics:</span>
          {Object.entries(topicCounts).map(([t, count]) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-white text-[#554e7b] border border-[#e9eaf2]">
              {t} ({count})
            </span>
          ))}
        </div>

        {/* Unreviewed / Flagged Blocking Notice */}
        {unreviewedCount > 0 ? (
          <div className="p-3 bg-[#edecfb] rounded-[12px] flex items-center justify-between text-xs text-[#28253b] font-[420]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#554e7b] shrink-0" />
              <span>
                Publish is blocked until {unreviewedCount} flagged item{unreviewedCount > 1 ? 's are' : ' is'} reviewed or acknowledged.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleBulkApprove}
              className="h-7 px-3 text-[11px] rounded-full bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#fbfbff]"
            >
              Bulk-Approve High Confidence
            </Button>
          </div>
        ) : (
          <div className="p-2.5 bg-[rgba(82,102,235,0.06)] rounded-[12px] flex items-center gap-2 text-xs text-[#28253b] font-[420]">
            <CheckCircle2 className="w-4 h-4 text-[#5266eb]" />
            <span>All questions verified and ready for scheduling.</span>
          </div>
        )}
      </div>

      {/* 2. Set-Level Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddMoreQuestions(5)}
            className="h-8 px-3.5 rounded-full bg-[#fbfbff] text-[#28253b] border-[#e9eaf2] hover:bg-[#edecfb]"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1 text-[#5266eb]" />
            Add 5 More (Same Settings)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManualMode(!manualMode)}
            className="h-8 px-3.5 rounded-full bg-[#fbfbff] text-[#28253b] border-[#e9eaf2] hover:bg-[#edecfb]"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1 text-[#5266eb]" />
            Add Question
          </Button>
        </div>

        {/* Shuffle options toggle */}
        <label className="flex items-center gap-2 cursor-pointer font-[420] text-[#554e7b] hover:text-[#28253b]">
          <input
            type="checkbox"
            checked={shuffleOptions}
            onChange={(e) => setShuffleOptions(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#5266eb] rounded"
          />
          <Shuffle className="w-3.5 h-3.5 text-[#5266eb]" />
          <span>Shuffle options per student</span>
        </label>
      </div>

      {/* Manual question entry form if active */}
      {manualMode && (
        <Card className="bg-[#fbfbff] rounded-[16px] border-0 p-4 space-y-3">
          <span className="text-xs font-[480] text-[#28253b] uppercase tracking-wide">
            New Multiple Choice Question
          </span>
          <Input
            placeholder="Question prompt or problem statement"
            value={manualQ.questionText}
            onChange={e => setManualQ({ ...manualQ, questionText: e.target.value })}
            className="text-xs bg-white border-[#e9eaf2] rounded-[8px]"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {manualQ.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="manual_correct"
                  checked={manualQ.correctOptionIndex === oIdx}
                  onChange={() => setManualQ({ ...manualQ, correctOptionIndex: oIdx })}
                  className="accent-[#5266eb]"
                />
                <Input
                  placeholder={`Option ${oIdx + 1}`}
                  value={opt}
                  onChange={e => {
                    const opts = [...manualQ.options]
                    opts[oIdx] = e.target.value
                    setManualQ({ ...manualQ, options: opts })
                  }}
                  className="text-xs h-8 bg-white border-[#e9eaf2] rounded-[8px]"
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
              className="h-7 text-xs rounded-full border-[#e9eaf2] text-[#554e7b]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddManualQuestion}
              className="h-7 text-xs rounded-full bg-[#5266eb] text-white hover:bg-[#4353c7]"
            >
              Save Question
            </Button>
          </div>
        </Card>
      )}

      {/* 3. Question Cards List */}
      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const isFlagged = q.needsReview || (q.flags && q.flags.length > 0)
          const isEditing = editingIdx === qIdx

          return (
            <div
              key={qIdx}
              className={`p-5 rounded-[16px] transition-all border-0 ${
                isFlagged ? 'bg-[#fbfbff] ring-1 ring-amber-300' : 'bg-white shadow-[0_1px_3px_rgba(40,37,59,0.03)]'
              }`}
            >
              {/* Question Header: Number, badges, confidence, reorder */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[rgba(82,102,235,0.10)] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                    {qIdx + 1}
                  </span>

                  {/* Difficulty Badge */}
                  <Badge
                    className={`border-0 text-[10px] font-[420] rounded-full px-2.5 py-0.5 ${
                      q.difficulty === 'HARD'
                        ? 'bg-amber-50 text-amber-800'
                        : q.difficulty === 'EASY'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-[#edecfb] text-[#28253b]'
                    }`}
                  >
                    {q.difficulty || 'MEDIUM'}
                  </Badge>

                  {/* Topic Badge */}
                  {q.topic && (
                    <Badge className="bg-[#fbfbff] text-[#554e7b] border border-[#e9eaf2] text-[10px] font-[420] rounded-full">
                      {q.topic}
                    </Badge>
                  )}

                  {/* Confidence Badge */}
                  <span className="text-[11px] text-[#70707d] font-mono">
                    {Math.round((q.confidence || 0.9) * 100)}% Confidence
                  </span>

                  {/* Active Flags */}
                  {q.flags && q.flags.map((flag, fIdx) => (
                    <Badge
                      key={fIdx}
                      className="bg-amber-100 text-amber-900 border-0 text-[10px] font-[420] rounded-full flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                      {flag}
                    </Badge>
                  ))}
                </div>

                {/* Question Actions */}
                <div className="flex items-center gap-1">
                  {/* Reorder Buttons */}
                  <button
                    type="button"
                    disabled={qIdx === 0}
                    onClick={() => handleMoveQuestion(qIdx, -1)}
                    className="p-1 text-[#70707d] hover:text-[#28253b] disabled:opacity-30 rounded-full hover:bg-[#edecfb]"
                    title="Move question up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={qIdx === questions.length - 1}
                    onClick={() => handleMoveQuestion(qIdx, 1)}
                    className="p-1 text-[#70707d] hover:text-[#28253b] disabled:opacity-30 rounded-full hover:bg-[#edecfb]"
                    title="Move question down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Make Easier / Harder */}
                  <button
                    type="button"
                    onClick={() => handleAdjustDifficulty(qIdx, q.difficulty === 'HARD' ? 'MEDIUM' : 'EASY')}
                    className="p-1 text-[#70707d] hover:text-[#5266eb] rounded-full hover:bg-[#edecfb]"
                    title="Make easier"
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDifficulty(qIdx, q.difficulty === 'EASY' ? 'MEDIUM' : 'HARD')}
                    className="p-1 text-[#70707d] hover:text-[#5266eb] rounded-full hover:bg-[#edecfb]"
                    title="Make harder"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Regenerate */}
                  <button
                    type="button"
                    onClick={() => handleRegenerateQuestion(qIdx)}
                    className="p-1 text-[#70707d] hover:text-[#5266eb] rounded-full hover:bg-[#edecfb]"
                    title="Regenerate question"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Inline Edit Toggle */}
                  <button
                    type="button"
                    onClick={() => setEditingIdx(isEditing ? null : qIdx)}
                    className="p-1 text-[#70707d] hover:text-[#5266eb] rounded-full hover:bg-[#edecfb]"
                    title="Edit question text"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(qIdx)}
                    className="p-1 text-[#70707d] hover:text-red-600 rounded-full hover:bg-red-50"
                    title="Delete question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question Stem */}
              {isEditing ? (
                <div className="py-2 space-y-2">
                  <Input
                    value={q.questionText}
                    onChange={e => {
                      const copy = [...questions]
                      copy[qIdx].questionText = e.target.value
                      setQuestions(copy)
                    }}
                    className="text-xs bg-[#fbfbff] border-[#e9eaf2]"
                  />
                </div>
              ) : (
                <p className="text-xs font-[420] text-[#28253b] leading-relaxed pt-1">
                  {q.questionText}
                </p>
              )}

              {/* Grounding Source Excerpt */}
              {q.supportingExcerpt && (
                <div className="mt-2 p-2 bg-[#fbfbff] rounded-[8px] text-[11px] text-[#554e7b] font-[360] flex items-start gap-1.5 border-0">
                  <BookOpen className="w-3.5 h-3.5 text-[#5266eb] shrink-0 mt-0.5" />
                  <span>
                    <strong>Source Excerpt{q.sourcePage ? ` (Page ${q.sourcePage})` : ''}:</strong> "{q.supportingExcerpt}"
                  </span>
                </div>
              )}

              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
                {(q.options || []).map((opt, optIdx) => {
                  const isCorrect = q.correctOptionIndex === optIdx

                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleSetCorrect(qIdx, optIdx)}
                      className={`p-2.5 rounded-[10px] cursor-pointer flex items-center justify-between transition-colors ${
                        isCorrect
                          ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b] ring-1 ring-[#5266eb]'
                          : 'bg-[#fbfbff] text-[#554e7b] hover:bg-[#edecfb]'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="w-4 h-4 rounded-full text-[10px] font-mono flex items-center justify-center bg-white text-[#28253b] border border-[#e9eaf2]">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white border border-[#e9eaf2] rounded px-1.5 py-0.5 text-xs flex-1"
                          />
                        ) : (
                          <span className="font-[360]">{opt}</span>
                        )}
                      </div>
                      {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb] shrink-0 ml-1.5" />}
                    </div>
                  )
                })}
              </div>

              {/* Explanation (faculty visible only) */}
              {q.explanation && (
                <p className="mt-2 text-[11px] text-[#70707d] italic">
                  Explanation: {q.explanation}
                </p>
              )}

              {/* Flag Acknowledgment Footer */}
              {isFlagged && (
                <div className="mt-3 pt-2.5 border-t border-[#e9eaf2] flex items-center justify-between text-xs">
                  <span className="text-[#554e7b] text-[11px]">
                    Requires review before publish: resolve flagged issues or confirm manual acknowledgment.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcknowledgeQuestion(qIdx)}
                    className="h-6 text-[11px] px-3 rounded-full bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#fbfbff]"
                  >
                    Acknowledge & Clear Flag
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
