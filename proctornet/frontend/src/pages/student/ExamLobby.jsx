import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, Clock, BookOpen, MessageSquare, CheckCircle, AlertCircle, Send, ArrowRight } from 'lucide-react'
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
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatOpen, setChatOpen] = useState(false)

  const socketRef = useRef(null)
  const timerRef = useRef(null)
  const chatEndRef = useRef(null)

  // Fetch exam info
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await api.get(`/student/exams/${examId}/lobby`)
        const examData = res.data.exam
        setExam(examData)
        setChatMessages(res.data.chatMessages || [])

        // Countdown timer
        const startTime = new Date(examData.startTime)
        const tick = () => {
          const now = new Date()
          const diff = startTime - now

          if (diff <= 0) {
            setTimeToStart(0)
            setCanEnter(true)
            clearInterval(timerRef.current)
            return
          }

          // Allow entry 15 minutes before
          if (diff <= 15 * 60 * 1000) {
            setCanEnter(true)
          }
          setTimeToStart(diff)
        }

        tick()
        timerRef.current = setInterval(tick, 1000)
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

  // Socket connection for lobby chat
  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('proctornet_token')
    socketRef.current = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
      { auth: { token }, transports: ['websocket', 'polling'] }
    )

    const socket = socketRef.current
    socket.emit('lobby:join', { examId, studentId: user.id })

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
                <span>Time until exam starts</span>
              </div>
              {canEnter && timeToStart === 0 ? (
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
                    <p className="text-green-600 font-medium mt-2 text-sm">
                      ✓ Early entry allowed (within 15 minutes)
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
            {/* Enter Exam Button */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
              <button
                onClick={handleEnterExam}
                disabled={!canEnter}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  canEnter
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canEnter ? (
                  <>Proceed to Verification <ArrowRight size={20} /></>
                ) : (
                  'Exam Not Started Yet'
                )}
              </button>
              {!canEnter && (
                <p className="text-xs text-gray-400 mt-3">
                  Entry opens 15 minutes before start time
                </p>
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
