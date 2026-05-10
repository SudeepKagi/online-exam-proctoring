import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as faceapi from 'face-api.js'
import { io } from 'socket.io-client'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import Editor from '@monaco-editor/react'
import { 
  Shield, Timer, Camera, AlertCircle, 
  ChevronLeft, ChevronRight, CheckCircle, 
  FileText, Code, Monitor, Maximize, Send, WifiOff
} from 'lucide-react'

// --- Constants ---
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'

export default function ExamInterface() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // State
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [vpnConnected, setVpnConnected] = useState(true)
  const [isPaused, setIsPaused] = useState(false)

  // Refs
  const socketRef = useRef(null)
  const videoRef = useRef(null)
  const timerRef = useRef(null)
  const faceDetectionIntv = useRef(null)
  const frameStreamIntv = useRef(null)
  const vpnCheckRef = useRef(null)

  // 1. Initial Load & Socket Setup
  useEffect(() => {
    fetchExamData()
    setupSecurity()
    
    return () => {
      cleanup()
    }
  }, [examId])

  // 1.5 VPN Monitor
  useEffect(() => {
    vpnCheckRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/vpn/status/${examId}`) // Using api instance instead of axios
        
        if(!res.data.connected && vpnConnected) {
          setVpnConnected(false)
          setIsPaused(true)
          
          socketRef.current?.emit('exam:flag', {
            examId,
            studentId: user.id,
            eventType: 'vpn_disconnected',
            severity: 'HIGH',
            studentName: user.name
          })
          
          toast.error(
            '⚠️ VPN Disconnected! Exam paused. Reconnect WireGuard immediately.',
            { duration: 0 }
          )
        }
        
        if(res.data.connected && !vpnConnected) {
          setVpnConnected(true)
          setIsPaused(false)
          toast.dismiss()
          toast.success('VPN reconnected — Exam resumed')
        }
        
      } catch(err) {}
    }, 120000)
    
    return () => clearInterval(vpnCheckRef.current)
  }, [examId, vpnConnected, user])

  const fetchExamData = async () => {
    try {
      const res = await api.get(`/student/exams/${examId}/start`)
      setExam(res.data.exam)
      setQuestions(res.data.questions)
      
      // Map existing answers
      const initialAnswers = {}
      res.data.answers.forEach(a => {
        initialAnswers[a.questionId] = a.selectedOption || a.codeAnswer || a.subjectiveAnswer || ''
      })
      setAnswers(initialAnswers)

      // Time sync
      const endTime = new Date(res.data.exam.endTime).getTime()
      const now = new Date().getTime()
      const diff = Math.floor((endTime - now) / 1000)
      setTimeLeft(Math.max(0, diff))
      
      setIsLoading(false)
      startTimer()
    } catch(err) {
      toast.error('Eligibility check failed or exam not found')
      navigate('/student/dashboard')
    }
  }

  const setupSecurity = async () => {
    // Socket
    const token = localStorage.getItem('proctornet_token')
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket']
    })
    
    const socket = socketRef.current
    socket.emit('student:join', { examId, name: user.name, usn: user.usn })

    socket.on('inv:warn', (data) => {
      toast.error(`INVIGILATOR WARNING: ${data.message}`, { duration: 10000, icon: '⚠️' })
    })

    socket.on('inv:terminate', (data) => {
      alert(`SESSION TERMINATED: ${data.reason}`)
      navigate('/student/dashboard')
    })

    // Face API Models
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      ])
    } catch(e) { console.error('FaceAPI Models failed to load') }

    // Media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      if(videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onplay = () => startProctoringLoops()
      }
    } catch(e) {
      logViolation('CAMERA_BLOCKED', 'Student denied camera access')
    }

    // Fullscreen Listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    window.addEventListener('blur', handleWindowBlur)
  }

  const cleanup = () => {
    if(socketRef.current) socketRef.current.disconnect()
    if(timerRef.current) clearInterval(timerRef.current)
    if(faceDetectionIntv.current) clearInterval(faceDetectionIntv.current)
    if(frameStreamIntv.current) clearInterval(frameStreamIntv.current)
    if(vpnCheckRef.current) clearInterval(vpnCheckRef.current)
    
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    window.removeEventListener('blur', handleWindowBlur)
    
    const stream = videoRef.current?.srcObject
    stream?.getTracks().forEach(t => t.stop())
  }

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if(isPaused) return prev // Stop timer if paused
        if(prev <= 1) {
          clearInterval(timerRef.current)
          autoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const startProctoringLoops = () => {
    // Face Detection Loop (Every 4s)
    faceDetectionIntv.current = setInterval(async () => {
      if(!videoRef.current) return
      const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      
      if(detections.length === 0) logViolation('NO_FACE_DETECTED', 'Face not visible in camera')
      else if(detections.length > 1) logViolation('MULTIPLE_FACES', `${detections.length} faces detected in frame`)
    }, 4000)

    // Frame Streaming Loop (Every 2s - low res)
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const ctx = canvas.getContext('2d')
    
    frameStreamIntv.current = setInterval(() => {
      if(!videoRef.current || !socketRef.current) return
      ctx.drawImage(videoRef.current, 0, 0, 160, 120)
      const frame = canvas.toDataURL('image/jpeg', 0.4)
      socketRef.current.emit('student:frame', { examId, frame })
    }, 2000)
  }

  const logViolation = async (type, details) => {
    setViolationCount(prev => prev + 1)
    const log = {
      examId,
      eventType: type,
      details,
      timestamp: new Date()
    }
    
    // Alert Socket
    socketRef.current.emit('student:violation', log)
    
    // Persist to DB
    try {
      await api.post(`/student/exams/${examId}/violation`, log)
    } catch(e) {}

    toast.error(`Security Alert: ${details}`, { icon: '🚨' })
    
    if(violationCount > (exam?.tabSwitchLimit || 3)) {
      autoSubmit('Excessive security violations')
    }
  }

  const handleFullscreenChange = () => {
    const isFull = !!document.fullscreenElement
    setIsFullscreen(isFull)
    if(!isFull && !isSubmitting) {
      logViolation('FULLSCREEN_EXIT', 'Student exited fullscreen mode')
    }
  }

  const handleWindowBlur = () => {
    if(!isSubmitting) {
      logViolation('TAB_SWITCH', 'Window focus lost (possible tab switch)')
    }
  }

  const enterFullscreen = () => {
    const el = document.documentElement
    if(el.requestFullscreen) el.requestFullscreen()
    else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  }

  const handleAnswerChange = async (val) => {
    const q = questions[currentIdx]
    setAnswers(prev => ({ ...prev, [q.id]: val }))
    
    // Async background save
    try {
      await api.post(`/student/exams/${examId}/autosave`, {
        questionId: q.id,
        answer: val
      })
    } catch(e) {}
  }

  const autoSubmit = async (reason = 'Time Expired') => {
    if(isSubmitting) return
    setIsSubmitting(true)
    toast.loading(`Mandatory Submission: ${reason}...`)
    try {
      await api.post(`/student/exams/${examId}/submit`)
      toast.dismiss()
      navigate('/student/results')
    } catch(e) {
      navigate('/student/dashboard')
    }
  }

  const handleManualSubmit = async () => {
    if(!window.confirm('Final submission? This cannot be undone.')) return
    setIsSubmitting(true)
    try {
      await api.post(`/student/exams/${examId}/submit`)
      toast.success('Exam submitted successfully')
      navigate('/student/dashboard')
    } catch(err) {
      toast.error('Submission failed. Check connection.')
      setIsSubmitting(false)
    }
  }

  const formatTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  if(isLoading) return (
    <div className="h-screen bg-white flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-gray-500 uppercase tracking-widest text-xs">Initializing Secure Environment...</p>
    </div>
  )

  const currentQuestion = questions[currentIdx]

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden select-none">
      
      {/* VPN disconnected overlay UI */}
      {!vpnConnected && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 max-w-md text-center space-y-6 shadow-2xl border-4 border-red-500">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <WifiOff size={48} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">VPN Disconnected!</h2>
              <p className="text-slate-500 mt-2 font-medium">Your exam is paused. Reconnect your WireGuard VPN to resume.</p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-6 text-left border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recovery Steps</p>
              <div className="space-y-3 text-sm font-medium text-slate-600">
                <p className="flex gap-3"><span className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center text-xs">1</span> Open WireGuard app</p>
                <p className="flex gap-3"><span className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center text-xs">2</span> Select ProctorNet tunnel</p>
                <p className="flex gap-3"><span className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center text-xs">3</span> Click "Activate"</p>
                <p className="flex gap-3"><span className="w-5 h-5 rounded border border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center text-xs">4</span> Auto-resumes</p>
              </div>
            </div>
            
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 p-3 rounded-xl">
              This incident has been logged
            </p>
          </div>
        </div>
      )}

      {/* HUD Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{exam.title}</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{user.usn}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Session</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className={`flex items-center gap-3 px-6 py-2 rounded-2xl font-mono font-black text-lg tabular-nums border-2 transition-all ${
            timeLeft < 300 ? 'bg-red-50 border-red-500 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-700'
          }`}>
            <Timer size={20} />
            {formatTime(timeLeft)}
          </div>
          
          <button 
            onClick={handleManualSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-8 py-2.5 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all disabled:bg-slate-300 flex items-center gap-2"
          >
            {isSubmitting ? 'Finalizing...' : <><Send size={18} /> Finish Exam</>}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Navigation Sidebar */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-20">
          <div className="p-6 flex-1 overflow-y-auto">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Question Matrix</h3>
            <div className="grid grid-cols-4 gap-3">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`aspect-square rounded-xl font-bold text-sm transition-all border-2 ${
                    i === currentIdx ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-inner scale-110' : 
                    answers[q.id] ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-slate-50 bg-slate-50 text-slate-400'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Mini Proctor View */}
          <div className="p-6 border-t bg-slate-50/50">
            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative border-4 border-white">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
              <div className="absolute top-3 right-3 flex gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mt-3 flex items-center justify-center gap-2">
              <Camera size={12} /> Proctoring Active
            </p>
          </div>
        </aside>

        {/* Question Interface */}
        <main className="flex-1 overflow-y-auto p-12 bg-slate-100/30">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Fullscreen Overlay Trigger */}
            {!isFullscreen && (
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-between animate-bounce">
                <div className="flex items-center gap-4">
                  <Monitor className="text-blue-400" size={32} />
                  <div>
                    <h3 className="font-bold text-lg">Fullscreen Environment Required</h3>
                    <p className="text-slate-400 text-sm">Exam security protocol requires total isolation.</p>
                  </div>
                </div>
                <button onClick={enterFullscreen} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all">
                  <Maximize size={18} /> Lock Environment
                </button>
              </div>
            )}

            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden min-h-[60vh] flex flex-col">
              <div className="px-10 py-8 border-b flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold">
                    {currentIdx + 1}
                  </span>
                  <div className="h-6 w-[1px] bg-slate-200"></div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {currentQuestion.type === 'MCQ' ? 'Multiple Choice' : currentQuestion.type === 'CODE' ? 'Technical Snippet' : 'Creative Writing'}
                  </span>
                </div>
                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Weight: {currentQuestion.marks} Marks
                </div>
              </div>

              <div className="p-10 flex-1 space-y-10">
                <div className="text-xl font-bold text-slate-800 leading-relaxed">
                  {currentQuestion.questionText}
                </div>

                {/* MCQ Renderer */}
                {currentQuestion.type === 'MCQ' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentQuestion.options?.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswerChange(opt.text)}
                        className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all text-left font-bold ${
                          answers[currentQuestion.id] === opt.text 
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md scale-[1.02]' 
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                          answers[currentQuestion.id] === opt.text ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}

                {/* CODE Renderer */}
                {currentQuestion.type === 'CODE' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>{currentQuestion.codeLanguage} Runtime</span>
                      <span className="flex items-center gap-1"><Maximize size={12} /> Auto-Saving...</span>
                    </div>
                    <div className="rounded-[2rem] overflow-hidden border-2 border-slate-100 shadow-inner">
                      <Editor
                        height="400px"
                        language={currentQuestion.codeLanguage || 'python'}
                        value={answers[currentQuestion.id] || currentQuestion.codeTemplate || ''}
                        onChange={(val) => handleAnswerChange(val)}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          padding: { top: 20 },
                          scrollBeyondLastLine: false,
                          lineNumbers: 'on',
                          roundedSelection: true
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* SUBJECTIVE Renderer */}
                {currentQuestion.type === 'SUBJECTIVE' && (
                  <div className="space-y-4">
                    <textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Synthesize your response here..."
                      className="w-full min-h-[300px] p-8 rounded-[2rem] border-2 border-slate-100 focus:border-blue-300 focus:ring-0 outline-none transition-all text-lg leading-relaxed placeholder:italic placeholder:text-slate-300 shadow-inner"
                    />
                    <div className="flex justify-end px-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        { (answers[currentQuestion.id] || '').split(/\s+/).filter(Boolean).length } Words Typed
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="px-10 py-8 bg-slate-50/30 border-t flex justify-between items-center">
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(prev => prev - 1)}
                  className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-all disabled:opacity-0"
                >
                  <ChevronLeft size={20} /> Previous
                </button>
                <div className="flex gap-2">
                  {currentIdx < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentIdx(prev => prev + 1)}
                      className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-100"
                    >
                      Next Question <ChevronRight size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={handleManualSubmit}
                      className="bg-green-600 text-white px-10 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-xl shadow-green-100"
                    >
                      <CheckCircle size={20} /> Finish Attempt
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Dynamic Watermark */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] flex items-center justify-center overflow-hidden rotate-[-30deg] whitespace-nowrap">
        <div className="text-[150px] font-black text-slate-900 select-none">
          {user.usn} • {user.usn} • {user.usn} • {user.usn}
        </div>
      </div>
    </div>
  )
}
