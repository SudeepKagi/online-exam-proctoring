import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import * as faceapi from 'face-api.js'
import Editor from '@monaco-editor/react'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import {
  Clock, Camera, CameraOff, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, Flag, Send, Eye, Code, List
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }
function formatTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// ── Small status pill ──────────────────────────────────
function StatusPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

export default function ExamInterface() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Exam data ──
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Navigation ──
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})    // { questionId: { selected, code, text } }
  const [flagged, setFlagged] = useState(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Timer ──
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)

  // ── Camera / Face-API ──
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const faceIntervalRef = useRef(null)
  const [cameraOk, setCameraOk] = useState(false)
  const [faceOk, setFaceOk] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  // ── Socket ──
  const socketRef = useRef(null)
  const [violations, setViolations] = useState(0)

  // ── Auto-save ──
  const autoSaveRef = useRef(null)

  // ─────────────────────────────────────────────────────
  // 1. Load exam data
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/student/exams/${examId}/start`)
      .then(res => {
        const { exam, questions: qs } = res.data
        setExam(exam)
        setQuestions(qs || [])
        const secs = (exam.duration || 60) * 60
        setTimeLeft(secs)
        // Pre-fill saved answers
        if (res.data.savedAnswers) {
          const saved = {}
          res.data.savedAnswers.forEach(a => { saved[a.questionId] = { selected: a.selectedOption, code: a.codeAnswer, text: a.textAnswer } })
          setAnswers(saved)
        }
      })
      .catch(() => toast.error('Failed to load exam'))
      .finally(() => setLoading(false))
  }, [examId])

  // ─────────────────────────────────────────────────────
  // 2. Countdown timer
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || submitted) return
    if (timeLeft <= 0) { handleSubmit(true); return }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timeLeft, submitted])

  // ─────────────────────────────────────────────────────
  // 3. Socket.io — join room + listen for warnings
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('proctornet_token')
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token }, transports: ['websocket', 'polling']
    })
    socketRef.current = socket
    socket.emit('exam:join', { examId, studentId: user?.id, name: user?.name, usn: user?.usn })
    socket.on('exam:warning', ({ message }) => toast.error(`⚠️ ${message}`, { duration: 6000 }))
    socket.on('exam:terminated', () => { toast.error('Exam terminated by invigilator'); handleSubmit(true) })
    return () => socket.disconnect()
  }, [examId])

  // ─────────────────────────────────────────────────────
  // 4. Tab-switch / window-blur detection
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (submitted) return
    const handleBlur = () => emitViolation('TAB_SWITCH', 'MEDIUM')
    const handleVisibility = () => { if (document.hidden) emitViolation('TAB_SWITCH', 'MEDIUM') }
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [submitted])

  // ─────────────────────────────────────────────────────
  // 5. Load face-api models + start camera
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const MODEL_URL = '/models'
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]).then(() => setModelsLoaded(true)).catch(() => console.warn('Face models unavailable'))

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.warn('Play error:', e))
          }
        }
        setCameraOk(true)
      })
      .catch((err) => {
        console.error('Camera access error:', err)
        setCameraOk(false)
        emitViolation('CAMERA_BLOCKED', 'HIGH')
        toast.error('Camera access denied — violations will be logged')
      })

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      clearInterval(faceIntervalRef.current)
    }
  }, [])

  // ─────────────────────────────────────────────────────
  // 6. Face detection loop (every 5s)
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelsLoaded || !cameraOk || submitted) return
    faceIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      try {
        if (socketRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d')
          canvasRef.current.width = videoRef.current.videoWidth
          canvasRef.current.height = videoRef.current.videoHeight
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
          const frame = canvasRef.current.toDataURL('image/jpeg', 0.5)
          socketRef.current.emit('exam:frame', { examId, studentId: user?.id, frame })
        }

        const options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
        const detections = await faceapi.detectAllFaces(videoRef.current, options)
        if (detections.length === 0) {
          setFaceOk(false)
          emitViolation('NO_FACE', 'HIGH')
        } else if (detections.length > 1) {
          setFaceOk(false)
          emitViolation('MULTIPLE_FACES', 'CRITICAL')
          toast.error('Multiple faces detected!', { duration: 4000 })
        } else {
          setFaceOk(true)
        }
      } catch { /* silent */ }
    }, 5000)
    return () => clearInterval(faceIntervalRef.current)
  }, [modelsLoaded, cameraOk, submitted])

  // ─────────────────────────────────────────────────────
  // 7. Auto-save every 30s
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      Object.entries(answers).forEach(([questionId, ans]) => {
        api.post(`/student/exams/${examId}/autosave`, { questionId, ...ans }).catch(() => {})
      })
    }, 30000)
    return () => clearInterval(autoSaveRef.current)
  }, [answers, examId])

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────
  const emitViolation = useCallback((type, severity) => {
    setViolations(v => v + 1)
    socketRef.current?.emit('exam:flag', { examId, studentId: user?.id, studentName: user?.name, eventType: type, severity })
    api.post(`/student/exams/${examId}/violation`, { eventType: type, severity }).catch(() => {})
  }, [examId, user])

  const setAnswer = (questionId, field, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], [field]: value } }))
    api.post(`/student/exams/${examId}/answer`, { questionId, [field]: value }).catch(() => {})
  }

  const toggleFlag = (id) => {
    setFlagged(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const handleSubmit = async (auto = false) => {
    if (submitting || submitted) return
    if (!auto && !confirm('Are you sure you want to submit? You cannot change answers after submission.')) return
    setSubmitting(true)
    clearInterval(autoSaveRef.current)
    clearInterval(faceIntervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    try {
      await api.post(`/student/exams/${examId}/submit`, { answers })
      setSubmitted(true)
      toast.success('Exam submitted successfully!')
      setTimeout(() => navigate('/student/results'), 3000)
    } catch { toast.error('Submission failed. Try again.') }
    finally { setSubmitting(false) }
  }

  // ── Loading / Submit states ──
  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" /><p className="text-gray-400">Loading exam…</p></div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} className="text-green-400" /></div>
        <h2 className="text-2xl font-bold text-white mb-2">Submitted!</h2>
        <p className="text-gray-400">Redirecting to results…</p>
      </div>
    </div>
  )

  const currentQ = questions[currentIdx]
  const answered = Object.keys(answers).length
  const timerColor = timeLeft < 300 ? 'text-red-400' : timeLeft < 600 ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Top bar ── */}
      <header className="bg-gray-900 border-b border-gray-800 h-14 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><Eye size={14} className="text-white" /></div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">{exam?.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{exam?.subject} • {questions.length} questions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill ok={cameraOk} label="Camera" />
          <StatusPill ok={faceOk} label="Face" />
          {violations > 0 && <span className="text-xs font-semibold text-red-400 bg-red-950 px-2 py-0.5 rounded-full">{violations} flags</span>}
          <div className={`font-mono text-lg font-bold ${timerColor}`}>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: question panel ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentQ ? (
            <div className="flex-1 overflow-y-auto p-5 lg:p-6">
              {/* Question header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Q{currentIdx + 1} of {questions.length}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      currentQ.difficulty === 'HARD' ? 'bg-red-900/60 text-red-300' : currentQ.difficulty === 'EASY' ? 'bg-green-900/60 text-green-300' : 'bg-amber-900/60 text-amber-300'
                    }`}>{currentQ.difficulty}</span>
                    <span className="text-xs text-gray-500">{currentQ.marks} marks</span>
                  </div>
                  <p className="text-base font-medium text-gray-100 leading-relaxed max-w-2xl">{currentQ.questionText}</p>
                </div>
                <button onClick={() => toggleFlag(currentQ.id)}
                  className={`p-2 rounded-lg transition-colors ${flagged.has(currentQ.id) ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-gray-800 text-gray-500'}`}>
                  <Flag size={16} />
                </button>
              </div>

              {/* MCQ */}
              {currentQ.type === 'MCQ' && (
                <div className="space-y-2.5">
                  {['A','B','C','D'].map((opt, i) => {
                    const text = currentQ[`option${opt}`] || currentQ.options?.[i]
                    if (!text) return null
                    const selected = answers[currentQ.id]?.selected === opt
                    return (
                      <button key={opt} onClick={() => setAnswer(currentQ.id, 'selected', opt)}
                        className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                          selected ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                        }`}>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${selected ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>{opt}</span>
                        {text}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Coding question */}
              {currentQ.type === 'CODE' && (
                <div className="rounded-xl overflow-hidden border border-gray-700">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-gray-400"><Code size={13} /> Code Editor</div>
                    <select className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border-0">
                      <option>Python</option><option>JavaScript</option><option>Java</option><option>C++</option>
                    </select>
                  </div>
                  <Editor
                    height="320px"
                    defaultLanguage="python"
                    value={answers[currentQ.id]?.code || '# Write your solution here\n'}
                    onChange={val => setAnswer(currentQ.id, 'code', val)}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, wordWrap: 'on' }}
                  />
                </div>
              )}

              {/* Subjective */}
              {currentQ.type === 'SUBJECTIVE' && (
                <textarea
                  value={answers[currentQ.id]?.text || ''}
                  onChange={e => setAnswer(currentQ.id, 'text', e.target.value)}
                  placeholder="Write your answer here…"
                  rows={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl text-gray-200 text-sm p-4 focus:outline-none focus:border-blue-500 resize-none"
                />
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">No questions loaded.</div>
          )}

          {/* ── Question navigation footer ── */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
            <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors">
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <CheckCircle size={14} className="text-green-400" />
              <span><span className="text-green-400 font-semibold">{answered}</span>/{questions.length} answered</span>
            </div>
            {currentIdx < questions.length - 1 ? (
              <button onClick={() => setCurrentIdx(i => i + 1)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button disabled={submitting} onClick={() => handleSubmit(false)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
                Submit Exam
              </button>
            )}
          </div>
        </main>

        {/* ── Right sidebar ── */}
        <aside className="w-60 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0 hidden lg:flex">
          {/* Camera feed */}
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Live Camera</p>
            <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {!cameraOk && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                  <div className="text-center"><CameraOff size={20} className="text-red-400 mx-auto mb-1" /><p className="text-xs text-red-400">No Camera</p></div>
                </div>
              )}
            </div>
          </div>

          {/* Question palette */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-1"><List size={11} /> Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id]?.selected || !!answers[q.id]?.code || !!answers[q.id]?.text
                const isFlagged = flagged.has(q.id)
                const isCurrent = i === currentIdx
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(i)}
                    className={`w-full aspect-square rounded-lg text-xs font-bold transition-all ${
                      isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-400' :
                      isFlagged ? 'bg-amber-500/30 text-amber-400 border border-amber-600' :
                      isAnswered ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }`}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 space-y-1.5">
              {[['bg-blue-600', 'Current'], ['bg-green-500/20 border border-green-700', 'Answered'], ['bg-amber-500/30 border border-amber-600', 'Flagged'], ['bg-gray-800', 'Unanswered']].map(([cls, label]) => (
                <div key={label} className="flex items-center gap-2 text-xs text-gray-500">
                  <div className={`w-3 h-3 rounded ${cls}`} />{label}
                </div>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <div className="p-3 border-t border-gray-800">
            <button disabled={submitting} onClick={() => handleSubmit(false)}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
              Submit Exam
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
