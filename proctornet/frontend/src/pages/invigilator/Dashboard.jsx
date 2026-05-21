import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { 
  Users, AlertTriangle, MessageSquare, Video, 
  Terminal, Clock, Shield, Search, Filter,
  MoreVertical, Bell, Info, StopCircle, 
  Send, X, User, ExternalLink, Zap, Monitor
} from 'lucide-react'

// ── Live Feed Subscription Components ───────────────────
function WebcamFeed({ studentId, initialFrame, className, fallbackSize = 14 }) {
  const [frame, setFrame] = useState(initialFrame)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail.studentId === studentId && e.detail.type === 'camera') {
        setFrame(e.detail.frame)
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
    }
  }, [studentId])

  useEffect(() => {
    setFrame(initialFrame)
  }, [initialFrame])

  if (frame) {
    return <img src={frame} className={className} alt="Webcam" />
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
      <Video size={fallbackSize} />
      <span className="text-[6px] font-bold uppercase tracking-tighter mt-0.5">Cam Off</span>
    </div>
  )
}

function ScreenFeed({ studentId, initialFrame, className, fallbackSize = 32 }) {
  const [frame, setFrame] = useState(initialFrame)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail.studentId === studentId && e.detail.type === 'screen') {
        setFrame(e.detail.frame)
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
    }
  }, [studentId])

  useEffect(() => {
    setFrame(initialFrame)
  }, [initialFrame])

  if (frame) {
    return <img src={frame} className={className} alt="Screen" />
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-600 border-b border-slate-800">
      <Monitor size={fallbackSize} className="mb-1 text-slate-700 animate-pulse" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Screen Standby</span>
    </div>
  )
}

export default function InvDashboard() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const selectedStudentRef = useRef(null)
  const chatEndRef = useRef(null)
  const latestFramesRef = useRef({})
  
  // State
  const [students, setStudents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)
  const [activeTab, setActiveTab] = useState('grid') // 'grid' | 'alerts' | 'chat'
  const [chatInput, setChatInput] = useState('')
  const [chats, setChats] = useState({})
  const [customWarning, setCustomWarning] = useState('')
  const [selectedChatStudent, setSelectedChatStudent] = useState(null)
  const [filter, setFilter] = useState('all')
  const [examInfo, setExamInfo] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    selectedStudentRef.current = selectedStudent
  }, [selectedStudent])

  // Initialization
  useEffect(() => {
    const token = localStorage.getItem('inv_token') || localStorage.getItem('proctornet_token')
    
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling']
    })
    
    const socket = socketRef.current
    
    socket.emit('inv:join', { examId })
    
    // Student joined the exam (new event name)
    socket.on('student:joined', (data) => {
      setStudents(prev => {
        const exists = prev.find(s => s.studentId === data.studentId)
        if(exists) return prev.map(s => s.studentId === data.studentId ? { ...s, status: 'active' } : s)
        return [...prev, {
          studentId: data.studentId,
          name: data.name,
          usn: data.usn,
          status: 'active',
          progress: { answered: 0, total: 0 },
          flagCount: 0,
          cameraFrame: null,
          events: [],
          unreadChat: 0,
          startedAt: new Date(),
          faceMatchScore: data.faceMatchScore ?? null,
          identityStatus: data.identityStatus ?? null
        }]
      })
      toast(`${data.name} is now online`, { icon: '👋' })
    })
    
    // Student flag event (was student:violation)
    socket.on('student:flag', (data) => {
      setAlerts(prev => [{
        id: Date.now(),
        ...data,
        timestamp: new Date()
      }, ...prev])
      
      setStudents(prev => prev.map(s => 
        s.studentId === data.studentId
          ? { 
              ...s, 
              flagCount: (s.flagCount || 0) + 1,
              status: (s.flagCount + 1) >= 5 ? 'critical' : 'flagged',
              events: [data, ...(s.events || [])]
            }
          : s
      ))
      
      if (selectedStudentRef.current && selectedStudentRef.current.studentId === data.studentId) {
        setSelectedStudent(prev => prev ? {
          ...prev,
          flagCount: (prev.flagCount || 0) + 1,
          status: (prev.flagCount + 1) >= 5 ? 'critical' : 'flagged',
          events: [data, ...(prev.events || [])]
        } : null)
      }
      
      playAlertSound(data.severity)
    })
    
    // Camera frame event (was student:frame)
    socket.on('student:cameraFrame', (data) => {
      if (!latestFramesRef.current[data.studentId]) {
        latestFramesRef.current[data.studentId] = {}
      }
      latestFramesRef.current[data.studentId].cameraFrame = data.frame
      
      window.dispatchEvent(new CustomEvent('student-frame-update', {
        detail: { studentId: data.studentId, type: 'camera', frame: data.frame }
      }))
    })

    // Screen frame event
    socket.on('student:screenFrame', (data) => {
      if (!latestFramesRef.current[data.studentId]) {
        latestFramesRef.current[data.studentId] = {}
      }
      latestFramesRef.current[data.studentId].screenFrame = data.frame

      window.dispatchEvent(new CustomEvent('student-frame-update', {
        detail: { studentId: data.studentId, type: 'screen', frame: data.frame }
      }))
    })

    socket.on('student:offline', (data) => {
      setStudents(prev => prev.map(s =>
        s.studentId === data.studentId
          ? { ...s, status: 'offline' }
          : s
      ))
    })

    // Student chat message
    socket.on('student:chat', (data) => {
      const { studentId, message, timestamp } = data
      setChats(prev => {
        const studentMsgs = prev[studentId] || []
        return {
          ...prev,
          [studentId]: [...studentMsgs, { sender: 'student', message, timestamp }]
        }
      })
      
      // Increment unread chat count if student modal is not open
      setStudents(prev => prev.map(s => {
        if (s.studentId === studentId) {
          const isCurrentlySelected = selectedStudentRef.current && selectedStudentRef.current.studentId === studentId
          return {
            ...s,
            unreadChat: isCurrentlySelected ? 0 : (s.unreadChat || 0) + 1
          }
        }
        return s
      }))
    })

    // Student progress update
    socket.on('student:progress', (data) => {
      const { studentId, answered, total } = data
      setStudents(prev => prev.map(s =>
        s.studentId === studentId
          ? { ...s, progress: { answered, total } }
          : s
      ))
    })

    fetchExamData()
    
    return () => {
      socket.disconnect()
    }
  }, [examId])

  const fetchExamData = async () => {
    try {
      // Use invigilator endpoint
      const res = await api.get(`/invigilator/exam/${examId}`)
      setExamInfo(res.data.exam)
      
      const initialStudents = (res.data.students || []).map(s => ({
        studentId: s.studentId || s.id,
        name: s.name,
        usn: s.usn,
        status: s.status === 'ACTIVE' ? 'active' : 'offline',
        progress: s.progress || { answered: 0, total: 0 },
        flagCount: s.flagCount || 0,
        cameraFrame: null,
        events: s.events || []
      }))
      setStudents(initialStudents)

      // Initialize chats state from pre-loaded messages
      const preloadedChats = {}
      if (res.data.chatMessages) {
        res.data.chatMessages.forEach(msg => {
          if (!preloadedChats[msg.studentId]) {
            preloadedChats[msg.studentId] = []
          }
          preloadedChats[msg.studentId].push({
            sender: msg.sender,
            message: msg.message,
            timestamp: msg.timestamp
          })
        })
      }
      setChats(preloadedChats)
      
      startTimer(res.data.exam.endTime)
    } catch(err) {
      console.error('[fetchExamData]', err)
      toast.error('Failed to synchronize terminal data')
    } finally {
      setIsLoading(false)
    }
  }

  const startTimer = (endTimeStr) => {
    const endTime = new Date(endTimeStr)
    const update = () => {
      const now = new Date()
      const diff = endTime - now
      if(diff <= 0) {
        setTimeRemaining('00:00:00')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    update()
    const intv = setInterval(update, 1000)
    return () => clearInterval(intv)
  }

  const playAlertSound = (severity) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = severity === 'HIGH' ? 880 : 440
      gain.gain.value = 0.1
      osc.start()
      setTimeout(() => osc.stop(), 200)
    } catch(e) {}
  }

  const warnStudent = async (studentId, message) => {
    const msg = message || prompt('Enter warning message to send to student:')
    if(!msg?.trim()) return
    
    // Emit via socket
    socketRef.current?.emit('inv:warn', { studentId, message: msg, examId })
    
    // Also save to backend
    try {
      await api.post(`/invigilator/exam/${examId}/warn/${studentId}`, { message: msg })
    } catch(e) {
      console.warn('Warning API call failed, socket still sent')
    }
    toast.success('Warning dispatched')
  }

  const terminateStudent = async (studentId) => {
    const reason = prompt('CRITICAL: Enter reason for mandatory termination:')
    if(!reason?.trim()) return
    
    try {
      await api.post(`/invigilator/exam/${examId}/terminate/${studentId}`, { reason })
      socketRef.current?.emit('inv:terminate', { studentId, reason, examId })
      setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status: 'terminated' } : s))
      toast.error('Student session terminated')
      setShowModal(false)
    } catch(err) {
      toast.error('Failed to terminate: ' + (err.response?.data?.error || 'Server error'))
    }
  }

  const handleCustomWarningSend = () => {
    if (!customWarning.trim() || !selectedStudent) return
    warnStudent(selectedStudent.studentId, customWarning.trim())
    setCustomWarning('')
  }

  const handleSendChat = () => {
    if (!chatInput.trim() || !selectedStudent) return
    const studentId = selectedStudent.studentId
    const message = chatInput.trim()
    
    // Emit via socket
    socketRef.current?.emit('inv:chat', { studentId, message, examId })
    
    // Append to local state
    setChats(prev => {
      const studentMsgs = prev[studentId] || []
      return {
        ...prev,
        [studentId]: [...studentMsgs, { sender: 'invigilator', message, timestamp: new Date().toISOString() }]
      }
    })
    
    setChatInput('')
  }

  useEffect(() => {
    if (showModal && selectedStudent) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chats, selectedStudent, showModal])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveLightbox(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredStudents = students.filter(s => {
    if(filter === 'all') return true
    if(filter === 'flagged') return s.flagCount > 0
    if(filter === 'active') return s.status === 'active'
    if(filter === 'offline') return s.status === 'offline'
    return true
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-blue-400">
          <Zap className="w-12 h-12 animate-pulse" />
          <p className="font-mono text-sm tracking-widest uppercase">Connecting to Secure Node...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top HUD */}
      <header className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between border-b border-white/5 shadow-2xl relative z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-400" size={24} />
            <span className="font-black italic tracking-tighter text-xl">Terminal</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <div>
            <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Live Examination</h1>
            <p className="text-lg font-black">{examInfo?.title || 'Initializing...'}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Time Remaining</div>
            <div className={`text-2xl font-mono font-black tabular-nums ${timeRemaining?.startsWith('00:0') ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {timeRemaining}
            </div>
          </div>
          <button onClick={() => navigate('/')} className="bg-white/5 hover:bg-white/10 p-3 rounded-2xl transition-all border border-white/10">
            <StopCircle size={24} className="text-red-400" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Alerts Sidebar */}
        <aside className="w-96 bg-white border-r border-slate-200 flex flex-col shadow-inner relative z-10">
          <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-black text-slate-900 flex items-center gap-2">
              <Bell size={18} className="text-blue-600" />
              Security Alerts
            </h2>
            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
              {alerts.length} New
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 grayscale opacity-50">
                <Shield size={48} />
                <p className="text-sm font-bold tracking-widest uppercase">Clean Session</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={`p-4 rounded-2xl border-l-4 shadow-sm animate-in fade-in slide-in-from-left-4 ${
                  alert.severity === 'HIGH' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      alert.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {alert.eventType}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mb-2">{alert.usn || alert.studentUsn} — {alert.studentName}</p>
                  {(alert.cameraFrame || alert.cameraFrameUrl) && (
                    <div className="space-y-1 mb-2">
                      <span className="text-[9px] font-black uppercase text-slate-400">Webcam Capture</span>
                      <img 
                        src={alert.cameraFrame || alert.cameraFrameUrl} 
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:brightness-110 transition-all" 
                        alt="Camera snap" 
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveLightbox({
                            imageUrl: alert.cameraFrame || alert.cameraFrameUrl,
                            title: 'Webcam Capture',
                            studentId: alert.studentId,
                            studentName: alert.studentName,
                            usn: alert.usn || alert.studentUsn,
                            eventType: alert.eventType,
                            severity: alert.severity,
                            timestamp: alert.timestamp,
                            details: alert.details || 'System flagged biometric deviation.'
                          })
                        }}
                      />
                    </div>
                  )}
                  {(alert.screenshot || alert.screenshotUrl) && (
                    <div className="space-y-1 mb-2">
                      <span className="text-[9px] font-black uppercase text-slate-400">Screen Capture</span>
                      <img 
                        src={alert.screenshot || alert.screenshotUrl} 
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:brightness-110 transition-all" 
                        alt="Screen snap" 
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveLightbox({
                            imageUrl: alert.screenshot || alert.screenshotUrl,
                            title: 'Screen Capture',
                            studentId: alert.studentId,
                            studentName: alert.studentName,
                            usn: alert.usn || alert.studentUsn,
                            eventType: alert.eventType,
                            severity: alert.severity,
                            timestamp: alert.timestamp,
                            details: alert.details || 'System flagged viewport deviation.'
                          })
                        }}
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => warnStudent(alert.studentId)} className="text-[10px] font-black uppercase text-blue-600 hover:underline">Dispatch Warning</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center: Grid */}
        <section className="flex-1 flex flex-col bg-slate-100/50">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
                {['all', 'active', 'flagged', 'offline'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                      filter === t ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" />
                <input 
                  type="text" 
                  placeholder="Filter by USN or Name..."
                  className="bg-white border border-slate-200 rounded-2xl py-2 pl-11 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-slate-500 font-bold text-xs uppercase tracking-widest">
              <Users size={16} /> {filteredStudents.length} Connected
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredStudents.map(student => (
              <div 
                key={student.studentId}
                onClick={() => {
                  setSelectedStudent(student)
                  setShowModal(true)
                  setStudents(prev => prev.map(s => s.studentId === student.studentId ? { ...s, unreadChat: 0 } : s))
                }}
                className={`group bg-white rounded-3xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden ${
                  student.status === 'active' ? 'border-transparent' : 
                  student.status === 'flagged' ? 'border-amber-400' : 
                  student.status === 'critical' ? 'border-red-500 animate-pulse' : 'border-slate-200 grayscale opacity-80'
                }`}
              >
                {/* Visual Feed - Dual Feed (Screen-share main background, webcam floating picture-in-picture) */}
                <div className="aspect-video bg-slate-950 relative overflow-hidden">
                  {/* Screen Frame (Background) */}
                  <ScreenFeed
                    studentId={student.studentId}
                    initialFrame={latestFramesRef.current[student.studentId]?.screenFrame}
                    className="w-full h-full object-cover animate-in fade-in"
                    fallbackSize={32}
                  />

                  {/* Webcam Frame (Floating PIP - bottom right) */}
                  <div className="absolute bottom-2 right-2 w-24 aspect-video bg-slate-950 rounded-lg overflow-hidden shadow-2xl border border-slate-800/80 z-10 transition-all group-hover:scale-105">
                    <WebcamFeed
                      studentId={student.studentId}
                      initialFrame={latestFramesRef.current[student.studentId]?.cameraFrame}
                      className="w-full h-full object-cover"
                      fallbackSize={14}
                    />
                  </div>
                  
                  <div className="absolute top-4 left-4 flex gap-2 z-20">
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg ${
                      student.status === 'active' ? 'bg-green-500 text-white' : 
                      student.status === 'flagged' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white'
                    }`}>
                      {student.status}
                    </span>
                    {student.flagCount > 0 && (
                      <span className="bg-red-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1">
                        <AlertTriangle size={10} /> {student.flagCount} Flags
                      </span>
                    )}
                    {student.unreadChat > 0 && (
                      <span className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1">
                        <MessageSquare size={10} /> {student.unreadChat} Chat
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 z-20">
                    <button className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl">Inspect Dossier</button>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-black text-slate-900 truncate mb-1">{student.name}</h3>
                  <div className="flex justify-between items-center text-slate-400 mb-3">
                    <span className="font-mono text-xs font-bold">{student.usn}</span>
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                      <Clock size={12} /> {student.startedAt ? new Date(student.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                  </div>
                  {/* Face Match Score */}
                  {student.faceMatchScore !== null && student.faceMatchScore !== undefined ? (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black border ${
                      student.faceMatchScore < 0.6
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      <span className="uppercase tracking-widest">
                        {student.faceMatchScore < 0.6 ? '⚠ Low Face Match' : '✓ Face Verified'}
                      </span>
                      <span className="text-sm font-black tabular-nums">
                        {(student.faceMatchScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black border bg-slate-50 border-slate-200 text-slate-400">
                      <span className="uppercase tracking-widest">Face Score</span>
                      <span>—</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Dossier Modal */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            <header className="px-10 py-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl">
                  {selectedStudent.name[0]}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedStudent.name}</h2>
                  <p className="text-slate-400 font-mono font-bold tracking-widest">{selectedStudent.usn}</p>
                  {/* Face Match Score in Modal */}
                  {selectedStudent.faceMatchScore !== null && selectedStudent.faceMatchScore !== undefined ? (
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black border ${
                        selectedStudent.faceMatchScore < 0.6
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      }`}>
                        <span>{selectedStudent.faceMatchScore < 0.6 ? '⚠' : '✓'}</span>
                        <span>Face Match:</span>
                        <span className="text-base tabular-nums">{(selectedStudent.faceMatchScore * 100).toFixed(1)}%</span>
                      </div>
                      {selectedStudent.faceMatchScore < 0.6 && (
                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">
                          Flagged for Review
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-2xl transition-all">
                <X size={24} className="text-slate-500" />
              </button>
            </header>

            <div className="flex-1 overflow-hidden flex">
              {/* Modal Left: Visual Evidence (Webcam and Screen Sharing side-by-side) */}
              <div className="w-2/3 p-10 overflow-y-auto space-y-8 border-r">
                <div className="grid grid-cols-2 gap-6">
                  {/* Webcam Feed */}
                  <div className="aspect-video bg-slate-950 rounded-3xl shadow-xl overflow-hidden border-4 border-slate-100 relative group">
                    <WebcamFeed
                      studentId={selectedStudent.studentId}
                      initialFrame={latestFramesRef.current[selectedStudent.studentId]?.cameraFrame}
                      className="w-full h-full object-cover animate-in fade-in"
                      fallbackSize={48}
                    />
                    <div className="absolute bottom-4 right-4 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
                      Primary Webcam
                    </div>
                  </div>

                  {/* Screen Sharing Feed */}
                  <div className="aspect-video bg-slate-950 rounded-3xl shadow-xl overflow-hidden border-4 border-slate-100 relative group">
                    <ScreenFeed
                      studentId={selectedStudent.studentId}
                      initialFrame={latestFramesRef.current[selectedStudent.studentId]?.screenFrame}
                      className="w-full h-full object-cover animate-in fade-in"
                      fallbackSize={48}
                    />
                    <div className="absolute bottom-4 right-4 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
                      Live Screen Share
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Violation Timeline</h3>
                    <div className="space-y-4">
                      {selectedStudent.events?.length === 0 ? (
                        <p className="text-sm font-bold text-slate-300 text-center py-8">No recorded violations</p>
                      ) : (
                        selectedStudent.events.map((ev, i) => (
                          <div key={i} className="flex gap-4 group">
                            <div className="shrink-0 w-1 h-full bg-slate-200 rounded-full group-last:bg-transparent"></div>
                            <div className="pb-4 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase shadow-sm ${
                                  ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
                                }`}>
                                  {ev.eventType}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs text-slate-700 font-bold mb-2">{ev.details || 'System flagged potential violation'}</p>
                              
                              {/* Render visual evidence if exists */}
                              <div className="flex gap-3 mt-2">
                                {(ev.cameraFrame || ev.cameraFrameUrl) && (
                                  <div className="flex-1 max-w-[120px] space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400 block">Cam Feed</span>
                                    <img 
                                      src={ev.cameraFrame || ev.cameraFrameUrl} 
                                      className="w-full h-16 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:scale-105 transition-all" 
                                      alt="Cam snap"
                                      onClick={() => setActiveLightbox({
                                        imageUrl: ev.cameraFrame || ev.cameraFrameUrl,
                                        title: 'Webcam Capture Evidence',
                                        studentId: selectedStudent.studentId,
                                        studentName: selectedStudent.name,
                                        usn: selectedStudent.usn,
                                        eventType: ev.eventType,
                                        severity: ev.severity,
                                        timestamp: ev.timestamp,
                                        details: ev.details || 'System flagged biometric deviation.'
                                      })}
                                    />
                                  </div>
                                )}
                                {(ev.screenshot || ev.screenshotUrl) && (
                                  <div className="flex-1 max-w-[120px] space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400 block">Screen Feed</span>
                                    <img 
                                      src={ev.screenshot || ev.screenshotUrl} 
                                      className="w-full h-16 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:scale-105 transition-all" 
                                      alt="Screen snap"
                                      onClick={() => setActiveLightbox({
                                        imageUrl: ev.screenshot || ev.screenshotUrl,
                                        title: 'Screen Capture Evidence',
                                        studentId: selectedStudent.studentId,
                                        studentName: selectedStudent.name,
                                        usn: selectedStudent.usn,
                                        eventType: ev.eventType,
                                        severity: ev.severity,
                                        timestamp: ev.timestamp,
                                        details: ev.details || 'System flagged viewport deviation.'
                                      })}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-100">
                      <h3 className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-4">Exam Stats</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-3xl font-black mb-1">{selectedStudent.progress?.answered || 0}/{selectedStudent.progress?.total || 0}</div>
                          <div className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Progress</div>
                        </div>
                        <div>
                          <div className="text-3xl font-black mb-1">{selectedStudent.flagCount || 0}</div>
                          <div className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Flag Score</div>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => terminateStudent(selectedStudent.studentId)}
                      className="w-full py-4 bg-red-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3"
                    >
                      <StopCircle size={24} /> Force Terminate Session
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Right: Communication */}
              <div className="w-1/3 flex flex-col bg-slate-50/50">
                <div className="p-8 border-b">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Direct Warning Disptach</h3>
                  <div className="space-y-4">
                    {['Adjust your camera', 'No talking permitted', 'Return to fullscreen', 'Identity verify needed'].map(msg => (
                      <button 
                        key={msg}
                        onClick={() => warnStudent(selectedStudent.studentId, msg)}
                        className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                      >
                        {msg}
                      </button>
                    ))}
                    <div className="relative pt-4">
                      <input 
                        type="text" 
                        value={customWarning}
                        onChange={(e) => setCustomWarning(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCustomWarningSend() }}
                        placeholder="Custom warning..."
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                      />
                      <button 
                        onClick={handleCustomWarningSend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Scrollable chat support timeline */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                  <div className="p-4 border-b bg-white">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare size={14} className="text-blue-500" />
                      Student Live Support Chat
                    </h4>
                  </div>

                  {/* Chat Message Timeline */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                    {(() => {
                      const studentId = selectedStudent.studentId
                      const messages = chats[studentId] || []
                      return messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-60">
                          <MessageSquare size={36} />
                          <p className="text-[10px] font-black uppercase tracking-widest">No messages yet</p>
                          <p className="text-[10px] text-slate-400 text-center font-medium px-4">Student can send chat messages for clarification or technical help.</p>
                        </div>
                      ) : (
                        messages.map((msg, idx) => {
                          const isInv = msg.sender === 'invigilator'
                          return (
                            <div key={idx} className={`flex ${isInv ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                                isInv 
                                  ? 'bg-blue-600 text-white rounded-br-none' 
                                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                              }`}>
                                <p className="text-xs font-medium whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                <span className={`text-[8px] block mt-1 text-right ${isInv ? 'text-blue-200' : 'text-slate-400'} font-bold`}>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )
                    })()}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t bg-white">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat() }}
                        placeholder="Type reply to student..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-4 pr-12 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                      <button
                        onClick={handleSendChat}
                        className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-100"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={() => setActiveLightbox(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 text-white w-full max-w-5xl h-full max-h-[85vh] md:h-[70vh] md:max-h-[680px] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button Top Right (Mobile/Float) */}
            <button 
              onClick={() => setActiveLightbox(null)}
              className="absolute top-4 right-4 md:hidden z-30 bg-slate-800/80 hover:bg-slate-700 p-2.5 rounded-full transition-all border border-slate-700"
            >
              <X size={20} className="text-slate-300" />
            </button>

            {/* Left: High-Scale Image Section */}
            <div className="flex-1 md:w-3/5 h-2/3 md:h-full bg-slate-950/80 relative flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-800">
              <img 
                src={activeLightbox.imageUrl} 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-slate-800/60" 
                alt={activeLightbox.title} 
              />
              
              {/* Quick Actions (Floating Overlay) */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <a 
                  href={activeLightbox.imageUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white uppercase tracking-wider flex items-center gap-1.5 border border-slate-800 transition-all shadow-lg"
                >
                  <ExternalLink size={12} /> Open in New Tab
                </a>
              </div>
            </div>

            {/* Right: Detailed Metadata Info Section */}
            <div className="md:w-2/5 p-8 flex flex-col justify-between h-1/3 md:h-full bg-slate-900 overflow-y-auto">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Evidence Analysis</h3>
                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                      <Zap size={18} className="text-blue-400" />
                      {activeLightbox.title}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setActiveLightbox(null)}
                    className="hidden md:flex bg-slate-800 hover:bg-slate-700/80 text-slate-400 hover:text-white p-3 rounded-2xl transition-all border border-slate-800 shadow-md"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Violation Severity & Category */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border shadow-sm ${
                    activeLightbox.severity === 'HIGH' || activeLightbox.severity === 'CRITICAL'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    Severity: {activeLightbox.severity || 'UNKNOWN'}
                  </span>
                  <span className="px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-xl text-xs font-black uppercase tracking-wider text-slate-300">
                    {activeLightbox.eventType}
                  </span>
                </div>

                <div className="border-t border-slate-800/80 my-2"></div>

                {/* Student Profile Identity Card */}
                <div className="bg-slate-950/40 rounded-2xl p-5 border border-slate-800/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg shadow-inner">
                      {activeLightbox.studentName?.[0] || '?'}
                    </div>
                    <div>
                      <h4 className="font-bold text-white leading-tight">{activeLightbox.studentName}</h4>
                      <p className="text-xs font-mono font-semibold text-slate-500 tracking-wider mt-0.5">{activeLightbox.usn}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 font-bold bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/30">
                    <span className="flex items-center gap-1 uppercase tracking-wider">
                      <Clock size={12} className="text-slate-500" /> Timestamp
                    </span>
                    <span className="font-mono text-slate-300">
                      {new Date(activeLightbox.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* AI / System Annotation Details */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Info size={12} className="text-slate-500" /> Flag Details
                  </h4>
                  <div className="bg-slate-950/30 border border-slate-800/50 rounded-2xl p-5 text-sm text-slate-300 leading-relaxed font-semibold">
                    {activeLightbox.details}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-6 border-t border-slate-800/80 mt-6 flex flex-col gap-3">
                <button
                  onClick={() => {
                    warnStudent(activeLightbox.studentId);
                    setActiveLightbox(null);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                  <Bell size={14} /> Send Alert Warning
                </button>
                <button
                  onClick={() => setActiveLightbox(null)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-slate-700/60"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
