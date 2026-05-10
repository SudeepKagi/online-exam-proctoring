import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, FormTextarea, SubmitButton, SelectInput } from '@/components/common/FormComponents'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import Editor from '@monaco-editor/react'
import { 
  Plus, Trash2, Edit3, Save, X, 
  HelpCircle, Code, FileText, 
  ChevronDown, ChevronUp, AlertTriangle,
  Layers, CheckCircle2
} from 'lucide-react'

export default function QuestionPool() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  
  const [questions, setQuestions] = useState([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [questionType, setQuestionType] = useState('MCQ')
  const [currentQuestionId, setCurrentQuestionId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // MCQ State
  const [mcqData, setMcqData] = useState({
    questionText: '',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    marks: 2,
    negativeMarks: 0,
    difficulty: 'MEDIUM'
  })

  // Code State
  const [codeData, setCodeData] = useState({
    questionText: '',
    codeLanguage: 'python',
    codeTemplate: '',
    testCases: [{ input: '', output: '' }],
    marks: 10,
    difficulty: 'HARD'
  })

  // Subjective State
  const [subjectiveData, setSubjectiveData] = useState({
    questionText: '',
    wordLimitMin: 100,
    wordLimitMax: 500,
    marks: 5,
    difficulty: 'MEDIUM'
  })

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await api.get(`/faculty/exams/${examId}/questions`)
      setQuestions(res.data.questions)
    } catch (err) {
      toast.error('Failed to load questions')
    } finally {
      setIsLoading(false)
    }
  }, [examId])

  useEffect(() => {
    if (examId) fetchQuestions()
  }, [examId, fetchQuestions])

  const resetForms = () => {
    setMcqData({
      questionText: '',
      options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
      marks: 2,
      negativeMarks: 0,
      difficulty: 'MEDIUM'
    })
    setCodeData({
      questionText: '',
      codeLanguage: 'python',
      codeTemplate: '',
      testCases: [{ input: '', output: '' }],
      marks: 10,
      difficulty: 'HARD'
    })
    setSubjectiveData({
      questionText: '',
      wordLimitMin: 100,
      wordLimitMax: 500,
      marks: 5,
      difficulty: 'MEDIUM'
    })
    setCurrentQuestionId(null)
  }

  const handleOptionChange = (index, value) => {
    const updated = [...mcqData.options]
    updated[index].text = value
    setMcqData({ ...mcqData, options: updated })
  }

  const handleCorrectAnswer = (index) => {
    const updated = mcqData.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index
    }))
    setMcqData({ ...mcqData, options: updated })
  }

  const addTestCase = () => {
    setCodeData({
      ...codeData,
      testCases: [...codeData.testCases, { input: '', output: '' }]
    })
  }

  const removeTestCase = (index) => {
    const updated = codeData.testCases.filter((_, i) => i !== index)
    setCodeData({ ...codeData, testCases: updated })
  }

  const handleTestCaseChange = (index, field, value) => {
    const updated = [...codeData.testCases]
    updated[index][field] = value
    setCodeData({ ...codeData, testCases: updated })
  }

  const saveQuestion = async () => {
    const payload = questionType === 'MCQ' 
      ? { type: 'MCQ', ...mcqData }
      : questionType === 'CODE'
      ? { type: 'CODE', ...codeData }
      : { type: 'SUBJECTIVE', ...subjectiveData }
    
    // Validation
    if (!payload.questionText.trim()) {
      toast.error('Question text is required')
      return
    }

    try {
      if(currentQuestionId) {
        await api.put(`/faculty/questions/${currentQuestionId}`, payload)
        toast.success('Question updated!')
      } else {
        await api.post(`/faculty/exams/${examId}/questions`, payload)
        toast.success('Question added!')
      }
      fetchQuestions()
      setShowBuilder(false)
      resetForms()
    } catch(err) {
      toast.error('Failed to save question')
    }
  }

  const deleteQuestion = async (qid) => {
    if(!window.confirm('Delete this question?')) return
    try {
      await api.delete(`/faculty/questions/${qid}`)
      toast.success('Question deleted')
      fetchQuestions()
    } catch(err) {
      toast.error('Failed to delete')
    }
  }

  const editQuestion = (q) => {
    setCurrentQuestionId(q.id)
    setQuestionType(q.type)
    if(q.type === 'MCQ') setMcqData({ ...q })
    if(q.type === 'CODE') setCodeData({ ...q })
    if(q.type === 'SUBJECTIVE') setSubjectiveData({ ...q })
    setShowBuilder(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Pool</h1>
          <p className="text-gray-500 text-sm">Manage the assessment items for this examination.</p>
        </div>
        {!showBuilder && (
          <button 
            onClick={() => { resetForms(); setShowBuilder(true) }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={18} /> Add New Question
          </button>
        )}
      </div>

      {showBuilder && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                {currentQuestionId ? <Edit3 size={18} /> : <Plus size={18} />}
              </span>
              {currentQuestionId ? 'Edit Question' : 'Question Builder'}
            </h2>
            <button onClick={() => setShowBuilder(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { id: 'MCQ', label: 'Multiple Choice', icon: <HelpCircle size={18} />, color: 'blue' },
              { id: 'CODE', label: 'Programming', icon: <Code size={18} />, color: 'purple' },
              { id: 'SUBJECTIVE', label: 'Subjective/Essay', icon: <FileText size={18} />, color: 'amber' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setQuestionType(type.id)}
                disabled={currentQuestionId}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  questionType === type.id
                    ? `border-${type.color}-600 bg-${type.color}-50 text-${type.color}-700 shadow-md`
                    : 'border-gray-100 hover:border-gray-200 text-gray-500 hover:bg-gray-50'
                } ${currentQuestionId && questionType !== type.id ? 'opacity-50 grayscale' : ''}`}
              >
                {type.icon}
                <span className="font-bold">{type.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            <FormTextarea 
              label="Question Stem" 
              value={questionType === 'MCQ' ? mcqData.questionText : questionType === 'CODE' ? codeData.questionText : subjectiveData.questionText}
              onChange={(e) => {
                if(questionType === 'MCQ') setMcqData({...mcqData, questionText: e.target.value})
                else if(questionType === 'CODE') setCodeData({...codeData, questionText: e.target.value})
                else setSubjectiveData({...subjectiveData, questionText: e.target.value})
              }}
              placeholder="Enter the main question text or prompt here..."
              rows={4}
            />

            {questionType === 'MCQ' && (
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700">Options & Correct Answer</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {mcqData.options.map((opt, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${opt.isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-100 focus-within:border-blue-200'}`}>
                      <button 
                        onClick={() => handleCorrectAnswer(idx)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${opt.isCorrect ? 'bg-green-600 text-white' : 'border-2 border-gray-300 hover:border-blue-400'}`}
                      >
                        {opt.isCorrect && <CheckCircle2 size={14} />}
                      </button>
                      <input 
                        type="text" 
                        value={opt.text}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questionType === 'CODE' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <SelectInput 
                    label="Language" 
                    value={codeData.codeLanguage} 
                    onChange={(e) => setCodeData({...codeData, codeLanguage: e.target.value})}
                    options={[
                      { value: 'python', label: 'Python 3' },
                      { value: 'javascript', label: 'JavaScript (Node)' },
                      { value: 'cpp', label: 'C++' },
                      { value: 'java', label: 'Java' }
                    ]}
                  />
                  <div className="flex items-end h-full pb-1 text-sm text-gray-500">
                    Students will write their code in the Monaco Editor.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Starter Code / Template</label>
                  <div className="rounded-xl overflow-hidden border border-gray-200">
                    <Editor
                      height="200px"
                      language={codeData.codeLanguage}
                      value={codeData.codeTemplate}
                      onChange={(val) => setCodeData({...codeData, codeTemplate: val})}
                      theme="vs-dark"
                      options={{ minimap: { enabled: false }, fontSize: 14 }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-semibold text-gray-700">Auto-Grade Test Cases</label>
                    <button onClick={addTestCase} className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline">
                      <Plus size={14} /> Add Test Case
                    </button>
                  </div>
                  {codeData.testCases.map((tc, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 p-4 bg-gray-50 rounded-xl relative group">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Input</label>
                        <input 
                          type="text" 
                          value={tc.input}
                          onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="e.g. 5 10"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Expected Output</label>
                        <input 
                          type="text" 
                          value={tc.output}
                          onChange={(e) => handleTestCaseChange(idx, 'output', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="e.g. 15"
                        />
                      </div>
                      {codeData.testCases.length > 1 && (
                        <button onClick={() => removeTestCase(idx)} className="absolute -right-2 -top-2 bg-white text-red-500 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity border border-gray-100">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questionType === 'SUBJECTIVE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormInput 
                  label="Min Word Limit" 
                  type="number" 
                  value={subjectiveData.wordLimitMin} 
                  onChange={(e) => setSubjectiveData({...subjectiveData, wordLimitMin: Number(e.target.value)})}
                />
                <FormInput 
                  label="Max Word Limit" 
                  type="number" 
                  value={subjectiveData.wordLimitMax} 
                  onChange={(e) => setSubjectiveData({...subjectiveData, wordLimitMax: Number(e.target.value)})}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t">
              <FormInput 
                label="Question Weightage (Marks)" 
                type="number" 
                value={questionType === 'MCQ' ? mcqData.marks : questionType === 'CODE' ? codeData.marks : subjectiveData.marks}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if(questionType === 'MCQ') setMcqData({...mcqData, marks: val})
                  else if(questionType === 'CODE') setCodeData({...codeData, marks: val})
                  else setSubjectiveData({...subjectiveData, marks: val})
                }}
              />
              <SelectInput 
                label="Difficulty Level" 
                value={questionType === 'MCQ' ? mcqData.difficulty : questionType === 'CODE' ? codeData.difficulty : subjectiveData.difficulty}
                onChange={(e) => {
                  if(questionType === 'MCQ') setMcqData({...mcqData, difficulty: e.target.value})
                  else if(questionType === 'CODE') setCodeData({...codeData, difficulty: e.target.value})
                  else setSubjectiveData({...subjectiveData, difficulty: e.target.value})
                }}
                options={[
                  { value: 'EASY', label: 'Beginner (Easy)' },
                  { value: 'MEDIUM', label: 'Standard (Medium)' },
                  { value: 'HARD', label: 'Advanced (Hard)' }
                ]}
              />
              {questionType === 'MCQ' && (
                <FormInput 
                  label="Negative Marking" 
                  type="number" 
                  step="0.25"
                  value={mcqData.negativeMarks} 
                  onChange={(e) => setMcqData({...mcqData, negativeMarks: Number(e.target.value)})}
                />
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowBuilder(false)} className="px-6 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                Discard Changes
              </button>
              <button 
                onClick={saveQuestion}
                className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
              >
                <Save size={18} /> {currentQuestionId ? 'Update Question' : 'Save Question to Pool'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Questions in this Exam ({questions.length})
          </h3>
          <div className="text-sm font-medium text-gray-500">
            Total Weighted Marks: <span className="text-blue-600 font-bold">{questions.reduce((sum, q) => sum + q.marks, 0)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Synchronizing pool...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <HelpCircle size={32} />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">Question Pool is Empty</h4>
            <p className="text-gray-500 max-w-sm mx-auto mb-8">You haven't added any questions to this exam yet. Use the builder to populate your assessment.</p>
            {!showBuilder && (
              <button 
                onClick={() => setShowBuilder(true)}
                className="inline-flex items-center gap-2 bg-white border border-blue-200 text-blue-600 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-all"
              >
                <Plus size={18} /> Start Building Now
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                  <th className="px-6 py-4">S.No</th>
                  <th className="px-6 py-4">Question Details</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-center">Marks</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-md truncate font-semibold text-gray-800" title={q.questionText}>
                        {q.questionText}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        q.type === 'MCQ' ? 'bg-blue-100 text-blue-700' : 
                        q.type === 'CODE' ? 'bg-purple-100 text-purple-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {q.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-900">{q.marks}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          q.difficulty === 'HARD' ? 'bg-red-500' : 
                          q.difficulty === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
                        }`}></div>
                        <span className="font-medium text-gray-600">{q.difficulty}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => editQuestion(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => deleteQuestion(q.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
