import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, Clock, BookOpen, MessageSquare, CheckCircle, AlertCircle, Send, ArrowRight, Camera, CameraOff } from 'lucide-react'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'
import DashboardLayout from '@/components/common/DashboardLayout'

const navItems = [
  { to: '/student/dashboard', icon: '🏠', label: 'Home' },
  { to: '/student/exams', icon: '📝', label: 'My Exams' },
  { to: '/student/results', icon: '🏆', label: 'Results' },
]

function formatCountdown(ms) {
  if (!ms || ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ExamLobby() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeToStart, setTimeToStart] = useState(null)
  const [canEnter, setCanEnter] = useState(false)
  const [isOver, setIsOver] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [cameraOk, setCameraOk] = useState(false)

  const socketRef = useRef(null)
  const timerRef = useRef(null)
  const chatEndRef = useRef(null)
  const lobbyVideoRef = useRef(null)
  const lobbyStreamRef = useRef(null)

  // Fetch exam info
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await api.get(`/student/exams/${examId}/lobby`)
        
        if (res.data.isEligible === false) {
          setError('You are not eligible to take this exam (Department or Semester mismatch).')
          toast.error('Exam eligibility check failed.')
          setTimeout(() => navigate('/student/exams'), 3000)
          setLoading(false)
          return
        }

        const examData = res.data.exam
        setExam(examData)
        setChatMessages(res.data.chatMessages || [])

        // Countdown timer
        const startTime = new Date(examData.startTime)
        const endTime = new Date(examData.endTime)
        const ENTRY_WINDOW_MS = 15 * 60 * 1000 // 15 minutes before start

        const serverTime = res.data.serverTime ? new Date(res.data.serverTime) : new Date()
        const offset = serverTime.getTime() - Date.now()

        const tick = () => {
          const now = new Date(Date.now() + offset)
          const diffToStart = startTime - now
          const diffToEnd = endTime - now

          // Exam is over
          if (diffToEnd <= 0) {
            setIsOver(true)
            setCanEnter(false)
            setTimeToStart(0)
            if (timerRef.current) clearInterval(timerRef.current)
            return
          }

          // Exam started — allow entry
          if (diffToStart <= 0) {
            setTimeToStart(0)
            setCanEnter(true)
            setIsOver(false)
            return
          }

          // Within 15-min window before start — show button
          if (diffToStart <= ENTRY_WINDOW_MS) {
            setCanEnter(true)
          } else {
            setCanEnter(false)
          }

          setTimeToStart(diffToStart)
        }

        timerRef.current = setInterval(tick, 1000)
        tick()
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load exam. Please try again.')
        toast.error('Exam not found or you are not eligible.')
        setTimeout(() => navigate('/student/exams'), 2000)
      } finally {
        setLoading(false)
      }
    }

    fetchExam()
    return () => clearInterval(timerRef.current)
  }, [examId])

  // Lobby camera preview initialization
  useEffect(() => {
    if (!exam || !exam.cameraRequired) return

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        lobbyStreamRef.current = stream
        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = stream
          lobbyVideoRef.current.onloadedmetadata = () => {
            lobbyVideoRef.current.play().catch(e => console.warn('Play error:', e))
          }
        }
        setCameraOk(true)
      })
      .catch((err) => {
        console.error('Lobby camera access error:', err)
        setCameraOk(false)
      })

    return () => {
      if (lobbyStreamRef.current) {
        lobbyStreamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [exam])

  // Socket connection for lobby chat
  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('proctornet_token')
    socketRef.current = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
      { auth: { token }, transports: ['websocket', 'polling'] }
    )

    const socket = socketRef.current
    socket.emit('lobby:join', { examId, studentId: user.id, name: user.name, usn: user.usn })

    socket.on('inv:chatReply', (data) => {
      setChatMessages(prev => [...prev, {
        sender: 'invigilator',
        message: data.message,
        timestamp: new Date().toISOString()
      }])
      if (!chatOpen) toast.success('Message from invigilator')
    })

    return () => socket.disconnect()
  }, [examId, user])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendChat = () => {
    if (!chatInput.trim()) return
    const message = chatInput.trim()

    socketRef.current?.emit('exam:chat', {
      examId,
      studentId: user?.id,
      studentName: user?.name,
      message
    })

    setChatMessages(prev => [...prev, {
      sender: 'student',
      message,
      timestamp: new Date().toISOString()
    }])

    api.post(`/student/exams/${examId}/chat`, { message }).catch(() => {})
    setChatInput('')
  }

  const handleEnterExam = () => {
    navigate(`/student/exams/${examId}/security`)
  }

  if (loading) return (
    <DashboardLayout navItems={navItems}>
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading exam details...</p>
        </div>
      </div>
    </DashboardLayout>
  )

  if (error) return (
    <DashboardLayout navItems={navItems}>
      <div className="max-w-lg mx-auto mt-20 text-center">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load Exam</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout navItems={navItems}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-200 text-sm mb-2">
                <Shield size={14} />
                <span>Proctored Examination</span>
              </div>
              <h1 className="text-3xl font-bold mb-1">{exam.title}</h1>
              <p className="text-blue-200">{exam.subject} &bull; Prof. {exam.faculty?.name}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-300 mb-1">Status</div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                exam.status === 'ACTIVE' || exam.status === 'IN_PROGRESS'
                  ? 'bg-green-400 text-green-900'
                  : 'bg-blue-400 text-blue-900'
              }`}>
                {exam.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exam Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Countdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                <Clock size={16} />
                <span>
                  {isOver ? 'Exam status' : timeToStart === 0 ? 'Exam is live' : 'Time until exam starts'}
                </span>
              </div>
              {isOver ? (
                <div className="text-center">
                  <div className="text-5xl font-mono font-black text-red-500 mb-2">ENDED</div>
                  <p className="text-red-400 font-medium">This exam has concluded</p>
                </div>
              ) : timeToStart === 0 ? (
                <div className="text-center">
                  <div className="text-5xl font-mono font-black text-green-600 mb-2">LIVE</div>
                  <p className="text-green-600 font-medium">Exam is now active</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-5xl font-mono font-black text-gray-900">
                    {formatCountdown(timeToStart)}
                  </div>
                  {canEnter && (
                    <p className="text-amber-500 text-sm font-semibold mt-2">
                      ⏰ Entry opens 15 min early — you may enter now
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-600" /> Exam Instructions
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'Duration', value: `${exam.duration} minutes` },
                  { label: 'Total Marks', value: `${exam.totalMarks} points` },
                  { label: 'Start Time', value: new Date(exam.startTime).toLocaleString() },
                  { label: 'End Time', value: new Date(exam.endTime).toLocaleString() },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-1">{item.label}</div>
                    <div className="text-sm font-bold text-gray-800">{item.value}</div>
                  </div>
                ))}
              </div>

              <ul className="space-y-2.5 text-sm text-gray-600">
                {[
                  'This is a proctored exam — camera and screen are monitored continuously.',
                  'Do not switch tabs or minimize the browser. Violations are logged immediately.',
                  'Ensure you are in a quiet, well-lit room. No other person should be present.',
                  'Keep your face clearly visible to the camera at all times.',
                  'The exam auto-submits when the timer reaches zero.',
                  exam.cameraRequired && 'A working webcam is required for this exam.',
                  exam.fullScreenMode && 'Fullscreen mode is enforced. Exiting will pause the exam.',
                ].filter(Boolean).map((inst, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>

              {exam.description && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-800">{exam.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions + Chat */}
          <div className="space-y-4">
            {/* Webcam Preview Card */}
            {exam.cameraRequired && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm overflow-hidden text-center space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Camera size={16} className="text-blue-600" />
                  <span>Lobby Webcam Preview</span>
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center border border-gray-100 shadow-inner">
                  {cameraOk ? (
                    <video
                      ref={lobbyVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <CameraOff size={32} className="text-gray-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Camera permission or hardware is required for this proctored exam.</p>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 flex items-center justify-center gap-1.5 bg-blue-50/50 py-1.5 rounded-lg font-semibold">
                  <span className={`w-2 h-2 rounded-full ${cameraOk ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span>{cameraOk ? 'Webcam ready for exam' : 'Webcam blocked or loading'}</span>
                </div>
              </div>
            )}

            {/* Enter Exam Button */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
              {isOver ? (
                <>
                  <div className="w-full py-4 rounded-xl font-bold text-lg bg-red-50 border-2 border-red-200 text-red-500 flex items-center justify-center gap-2">
                    🚫 Exam is Over
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    This examination has ended. Check your results soon.
                  </p>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEnterExam}
                    disabled={!canEnter}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                      canEnter
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 active:scale-95'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {canEnter ? (
                      <>Proceed to Verification <ArrowRight size={20} /></>
                    ) : (
                      'Exam Not Yet Available'
                    )}
                  </button>
                  <p className="text-xs text-gray-400 mt-3">
                    {canEnter
                      ? 'Entry is open. You may begin your security check.'
                      : `Entry opens 15 minutes before the exam — at ${new Date(new Date(exam.startTime) - 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </p>
                </>
              )}
            </div>

            {/* Chat */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <MessageSquare size={16} className="text-blue-600" />
                  Chat with Invigilator
                </div>
                <span className="text-gray-400 text-xs">{chatOpen ? '▲' : '▼'}</span>
              </button>

              {chatOpen && (
                <div className="border-t border-gray-100">
                  <div className="h-48 overflow-y-auto p-3 space-y-2">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        No messages yet. Ask the invigilator a question.
                      </p>
                    ) : chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs ${
                          msg.sender === 'student'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex items-center gap-2 p-3 border-t border-gray-100">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Ask a question..."
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={sendChat}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
