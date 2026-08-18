import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import {
  Shield, Bell, UserCheck, AlertTriangle, Video, Eye, Radio,
  Maximize2, Minimize2, Lock, Camera, CheckCircle2, XCircle, Search, RefreshCw, Volume2, StopCircle, Check
} from 'lucide-react'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'
import {
  Users, MessageSquare, Terminal, Clock,
  MoreVertical, Info,
  Send, X, User, ExternalLink, Zap, Monitor
} from 'lucide-react'

// ── Live Feed Subscription Components ───────────────────
function WebcamFeed({ studentId, initialFrame, className, fallbackSize = 14 }) {
  const [frame, setFrame] = useState(initialFrame)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail.studentId === studentId && e.detail.type === 'camera') {
        setFrame(e.detail.frame)
      }
    }
    const handleStreamUpdate = (e) => {
      if (e.detail.studentId === studentId && e.detail.type === 'camera') {
        setStream(e.detail.stream)
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    window.addEventListener('student-stream-update', handleStreamUpdate)

    if (window.activeWebRTCStreams && window.activeWebRTCStreams[studentId]?.camera) {
      setStream(window.activeWebRTCStreams[studentId].camera)
    }

    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
      window.removeEventListener('student-stream-update', handleStreamUpdate)
    }
  }, [studentId])

  useEffect(() => {
    setFrame(initialFrame)
  }, [initialFrame])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (stream) {
    return <video ref={videoRef} autoPlay playsInline muted className={className} />
  }

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
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail.studentId === studentId && e.detail.type === 'screen') {
        setFrame(e.detail.frame)
      }
    }
    const handleStreamUpdate = (e) => {
      if (e.detail.studentId === studentId && e.detail.type === 'screen') {
        setStream(e.detail.stream)
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    window.addEventListener('student-stream-update', handleStreamUpdate)

    if (window.activeWebRTCStreams && window.activeWebRTCStreams[studentId]?.screen) {
      setStream(window.activeWebRTCStreams[studentId].screen)
    }

    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
      window.removeEventListener('student-stream-update', handleStreamUpdate)
    }
  }, [studentId])

  useEffect(() => {
    setFrame(initialFrame)
  }, [initialFrame])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (stream) {
    return <video ref={videoRef} autoPlay playsInline muted className={className} />
  }

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
  const pcsRef = useRef({})


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

  const requestWebRTCStream = useCallback((studentId) => {
    if (socketRef.current) {
      socketRef.current.emit('webrtc:request-stream', { studentId, examId })
    }
  }, [examId])

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
        if (exists) return prev.map(s => s.studentId === data.studentId ? { ...s, status: 'active' } : s)
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
      requestWebRTCStream(data.studentId)
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

    // ── WebRTC Signaling Listeners ──
    socket.on('webrtc:offer', async ({ offer, studentId, senderId }) => {
      console.log('Received WebRTC offer from student:', studentId)
      if (pcsRef.current[studentId]) {
        try { pcsRef.current[studentId].close() } catch (e) { }
      }
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      pcsRef.current[studentId] = pc

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', {
            candidate: event.candidate,
            targetId: studentId
          })
        }
      }

      pc.ontrack = (event) => {
        console.log('Received WebRTC track from student:', studentId, event.track.label)
        const stream = event.streams[0]
        const label = (event.track.label || '').toLowerCase()
        const settings = event.track.getSettings ? event.track.getSettings() : {}
        const isScreen = label.includes('screen') || label.includes('display') || label.includes('window') || (settings.width && settings.width > 640)

        if (!window.activeWebRTCStreams) {
          window.activeWebRTCStreams = {}
        }
        if (!window.activeWebRTCStreams[studentId]) {
          window.activeWebRTCStreams[studentId] = {}
        }

        if (isScreen) {
          window.activeWebRTCStreams[studentId].screen = stream
          window.dispatchEvent(new CustomEvent('student-stream-update', {
            detail: { studentId, type: 'screen', stream }
          }))
        } else {
          window.activeWebRTCStreams[studentId].camera = stream
          window.dispatchEvent(new CustomEvent('student-stream-update', {
            detail: { studentId, type: 'camera', stream }
          }))
        }
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('webrtc:answer', {
          answer,
          studentId
        })
      } catch (err) {
        console.error('Failed to negotiate WebRTC:', err)
      }
    })

    socket.on('webrtc:ice-candidate', async ({ candidate, studentId }) => {
      const pc = pcsRef.current[studentId]
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Failed to add remote ICE candidate:', err)
        }
      }
    })

    fetchExamData()

    return () => {
      socket.disconnect()
      Object.values(pcsRef.current).forEach(pc => {
        try { pc.close() } catch (e) { }
      })
      pcsRef.current = {}
      window.activeWebRTCStreams = {}
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

      // Auto-request WebRTC streams for all initially active students
      initialStudents.forEach(s => {
          if (s.status === 'active') {
            requestWebRTCStream(s.studentId)
          }
        })


      // Initialize chats state from pre-loaded messages
      const preloadedChats = {}
      if(res.data.chatMessages) {
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
    } catch (err) {
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
      if (diff <= 0) {
        setTimeRemaining('00:00:00')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
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
    } catch (e) { }
  }

  const warnStudent = async (studentId, message) => {
    const msg = message || prompt('Enter warning message to send to student:')
    if (!msg?.trim()) return

    // Emit via socket
    socketRef.current?.emit('inv:warn', { studentId, message: msg, examId })

    // Also save to backend
    try {
      await api.post(`/invigilator/exam/${examId}/warn/${studentId}`, { message: msg })
    } catch (e) {
      console.warn('Warning API call failed, socket still sent')
    }
    toast.success('Warning dispatched')
  }

  const terminateStudent = async (studentId) => {
    const reason = prompt('CRITICAL: Enter reason for mandatory termination:')
    if (!reason?.trim()) return

    try {
      await api.post(`/invigilator/exam/${examId}/terminate/${studentId}`, { reason })
      socketRef.current?.emit('inv:terminate', { studentId, reason, examId })
      setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status: 'terminated' } : s))
      toast.error('Student session terminated')
      setShowModal(false)
    } catch (err) {
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
    if (filter === 'all') return true
    if (filter === 'flagged') return s.flagCount > 0
    if (filter === 'active') return s.status === 'active'
    if (filter === 'offline') return s.status === 'offline'
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
    <div className="min-h-screen bg-[#0A0A0A] text-slate-100 flex flex-col font-sans">
      {/* Top HUD */}
      <header className="bg-[#0A0A0A] text-white px-6 py-3.5 flex items-center justify-between border-b border-[#232326] relative z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center font-bold text-xs">
              <ProctorNetLogo className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-bold tracking-tight text-sm text-slate-100">Live Proctor Terminal</span>
          </div>
          <div className="h-5 w-[1px] bg-[#232326]"></div>
          <div>
            <h1 className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wider leading-none">Live Assessment</h1>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{examInfo?.title || 'Initializing...'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right font-mono">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Time Remaining</div>
            <div className={`text-xl font-bold tabular-nums ${timeRemaining?.startsWith('00:0') ? 'text-red-400 animate-pulse' : 'text-slate-100'}`}>
              {timeRemaining}
            </div>
          </div>
          <button onClick={() => navigate('/')} className="bg-[#111113] hover:bg-[#18181B] p-2 rounded-md transition-all border border-[#232326]">
            <StopCircle size={18} className="text-red-400" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">

        {/* Left: Alerts Sidebar */}
        <aside className="w-80 bg-[#111113] border-r border-[#232326] flex flex-col relative z-10">
          <div className="p-4 border-b border-[#232326] bg-[#0A0A0A] flex items-center justify-between">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2 text-xs">
              <Bell size={14} className="text-indigo-400" />
              Proctoring Security Alerts
            </h2>
            <Badge variant="destructive" className="font-mono text-[9px]">
              {alerts.length} NEW
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-60">
                <Shield size={36} />
                <p className="text-xs font-mono font-semibold tracking-wider uppercase">Clean Session Log</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="p-3 rounded-xl border border-[#27272A] bg-[#18181A] text-white">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#27272A] text-white">
                      {alert.eventType}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-100 mb-2">{alert.usn || alert.studentUsn} — {alert.studentName}</p>
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
        <section className="flex-1 flex flex-col bg-background">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex bg-card rounded-lg border border-border p-1">
                {['all', 'active', 'flagged', 'offline'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${filter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by USN or Name..."
                  className="bg-card border border-border rounded-md py-1.5 pl-9 pr-3 text-xs text-foreground focus:ring-1 focus:ring-ring outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">
              <Users size={15} /> {filteredStudents.length} Connected
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredStudents.map(student => (
              <div
                key={student.studentId}
                onClick={() => {
                  setSelectedStudent(student)
                  setShowModal(true)
                  setStudents(prev => prev.map(s => s.studentId === student.studentId ? { ...s, unreadChat: 0 } : s))
                }}
                className={`group bg-card rounded-xl border transition-all cursor-pointer shadow-sm hover:border-primary/50 overflow-hidden ${student.status === 'active' ? 'border-border' :
                  student.status === 'flagged' ? 'border-amber-500/60' :
                    student.status === 'critical' ? 'border-destructive animate-pulse' : 'border-border opacity-70'
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
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg ${student.status === 'active' ? 'bg-green-500 text-white' :
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
                  <h3 className="font-bold text-slate-100 truncate mb-1">{student.name}</h3>
                  <div className="flex justify-between items-center text-slate-400 mb-3">
                    <span className="font-mono text-xs font-bold">{student.usn}</span>
                    <div className="flex items-center gap-1 text-[10px] font-mono">
                      <Clock size={12} /> {student.startedAt ? new Date(student.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                  </div>
                  {/* Face Match Score */}
                  {student.faceMatchScore !== null && student.faceMatchScore !== undefined ? (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-mono border ${student.faceMatchScore < 0.6
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}>
                      <span className="uppercase tracking-widest">
                        {student.faceMatchScore < 0.6 ? '⚠ Low Face Match' : '✓ Face Verified'}
                      </span>
                      <span className="text-xs font-bold tabular-nums">
                        {(student.faceMatchScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-mono border bg-[#18181A] border-[#27272A] text-slate-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-[#09090B]/85 backdrop-blur-md animate-in fade-in duration-300 font-sans">
          <div className="bg-[#141416] border border-[#27272A] w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-slate-100">

            <header className="px-8 py-5 border-b border-[#27272A] flex justify-between items-center bg-[#09090B]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 font-mono font-bold text-lg">
                  {selectedStudent.name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">{selectedStudent.name}</h2>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedStudent.usn}</p>
                  {/* Face Match Score in Modal */}
                  {selectedStudent.faceMatchScore !== null && selectedStudent.faceMatchScore !== undefined ? (
                    <div className="mt-2 flex items-center gap-2 font-mono">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border ${selectedStudent.faceMatchScore < 0.6
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                        <span>{selectedStudent.faceMatchScore < 0.6 ? '⚠' : '✓'}</span>
                        <span>Face Match:</span>
                        <span className="tabular-nums font-bold">{(selectedStudent.faceMatchScore * 100).toFixed(1)}%</span>
                      </div>
                      {selectedStudent.faceMatchScore < 0.6 && (
                        <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                          Flagged for Review
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="bg-[#09090B] hover:bg-[#18181B] border border-[#27272A] p-2.5 rounded-xl transition-all text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Modal Left: Visual Evidence (Webcam and Screen Sharing side-by-side) */}
              <div className="w-full md:w-2/3 p-6 md:p-8 overflow-y-auto space-y-6 border-b md:border-b-0 md:border-r border-[#27272A] bg-[#09090B]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Webcam Feed */}
                  <div className="aspect-video bg-[#141416] rounded-2xl shadow-xl overflow-hidden border border-[#27272A] relative group">
                    <WebcamFeed
                      studentId={selectedStudent.studentId}
                      initialFrame={latestFramesRef.current[selectedStudent.studentId]?.cameraFrame}
                      className="w-full h-full object-cover animate-in fade-in"
                      fallbackSize={48}
                    />
                    <div className="absolute bottom-3 right-3 bg-[#09090B]/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider border border-[#27272A]">
                      Primary Webcam
                    </div>
                  </div>

                  {/* Screen Sharing Feed */}
                  <div className="aspect-video bg-[#141416] rounded-2xl shadow-xl overflow-hidden border border-[#27272A] relative group">
                    <ScreenFeed
                      studentId={selectedStudent.studentId}
                      initialFrame={latestFramesRef.current[selectedStudent.studentId]?.screenFrame}
                      className="w-full h-full object-cover animate-in fade-in"
                      fallbackSize={48}
                    />
                    <div className="absolute bottom-3 right-3 bg-[#09090B]/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider border border-[#27272A]">
                      Live Screen Share
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#141416] rounded-2xl p-5 border border-[#27272A]">
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">Violation Timeline</h3>
                    <div className="space-y-3 font-mono">
                      {selectedStudent.events?.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">No recorded violations</p>
                      ) : (
                        selectedStudent.events.map((ev, i) => (
                          <div key={i} className="flex gap-3 group">
                            <div className="shrink-0 w-0.5 h-full bg-[#27272A] rounded-full group-last:bg-transparent"></div>
                            <div className="pb-3 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  }`}>
                                  {ev.eventType}
                                </span>
                                <span className="text-[10px] text-slate-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs text-slate-300 font-sans mb-2">{ev.details || 'System flagged potential violation'}</p>

                              {/* Render visual evidence if exists */}
                              <div className="flex gap-2 mt-2">
                                {(ev.cameraFrame || ev.cameraFrameUrl) && (
                                  <div className="flex-1 max-w-[120px] space-y-1">
                                    <span className="text-[8px] uppercase text-slate-500 block">Cam Feed</span>
                                    <img
                                      src={ev.cameraFrame || ev.cameraFrameUrl}
                                      className="w-full h-16 object-cover rounded-xl border border-[#27272A] cursor-zoom-in hover:scale-105 transition-all"
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
                                    <span className="text-[8px] uppercase text-slate-500 block">Screen Feed</span>
                                    <img
                                      src={ev.screenshot || ev.screenshotUrl}
                                      className="w-full h-16 object-cover rounded-xl border border-[#27272A] cursor-zoom-in hover:scale-105 transition-all"
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

                  <div className="space-y-4">
                    <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5 text-slate-100 font-mono shadow-xl shadow-indigo-600/5">
                      <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3">Exam Stats</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-2xl font-bold text-slate-100">{selectedStudent.progress?.answered || 0}/{selectedStudent.progress?.total || 0}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Progress</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-slate-100">{selectedStudent.flagCount || 0}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Flag Score</div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => terminateStudent(selectedStudent.studentId)}
                      className="w-full py-3.5 bg-rose-600 text-white rounded-2xl font-mono font-bold text-sm shadow-xl shadow-rose-600/20 hover:bg-rose-500 transition-all flex items-center justify-center gap-2"
                    >
                      <StopCircle size={18} /> Force Terminate Session
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Right: Communication */}
              <div className="w-full md:w-1/3 flex flex-col bg-[#141416]">
                <div className="p-6 border-b border-[#27272A]">
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">Direct Warning Dispatch</h3>
                  <div className="space-y-2.5 font-mono">
                    {['Adjust your camera', 'No talking permitted', 'Return to fullscreen', 'Identity verify needed'].map(msg => (
                      <button
                        key={msg}
                        onClick={() => warnStudent(selectedStudent.studentId, msg)}
                        className="w-full text-left px-3.5 py-2.5 bg-[#09090B] border border-[#27272A] rounded-xl text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-indigo-400 hover:bg-[#18181B] transition-all shadow-sm"
                      >
                        {msg}
                      </button>
                    ))}
                    <div className="relative pt-2">
                      <input
                        type="text"
                        value={customWarning}
                        onChange={(e) => setCustomWarning(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCustomWarningSend() }}
                        placeholder="Custom warning message..."
                        className="w-full bg-[#09090B] border border-[#27272A] rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleCustomWarningSend}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 mt-1 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scrollable chat support timeline */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#141416]">
                  <div className="px-6 py-3.5 border-b border-[#27272A] bg-[#09090B]">
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare size={13} className="text-indigo-400" />
                      Student Live Support Chat
                    </h4>
                  </div>

                  {/* Chat Message Timeline */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0 font-sans">
                    {(() => {
                      const studentId = selectedStudent.studentId
                      const messages = chats[studentId] || []
                      return messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-70">
                          <MessageSquare size={28} />
                          <p className="text-[10px] font-mono uppercase tracking-wider">No messages yet</p>
                          <p className="text-xs text-slate-400 text-center px-4">Student can send chat messages for clarification or technical help.</p>
                        </div>
                      ) : (
                        messages.map((msg, idx) => {
                          const isInv = msg.sender === 'invigilator'
                          return (
                            <div key={idx} className={`flex ${isInv ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm text-xs ${isInv
                                ? 'bg-indigo-600 text-white rounded-br-none font-sans'
                                : 'bg-[#09090B] border border-[#27272A] text-slate-200 rounded-bl-none font-sans'
                                }`}>
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                <span className={`text-[9px] font-mono block mt-1 text-right ${isInv ? 'text-indigo-200' : 'text-slate-500'}`}>
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
                  <div className="p-4 border-t border-[#27272A] bg-[#09090B]">
                    <div className="relative flex items-center font-mono">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat() }}
                        placeholder="Type reply to student..."
                        className="w-full bg-[#141416] border border-[#27272A] rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all"
                      />
                      <button
                        onClick={handleSendChat}
                        className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md shadow-indigo-600/20"
                      >
                        <Send size={13} />
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
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border shadow-sm ${activeLightbox.severity === 'HIGH' || activeLightbox.severity === 'CRITICAL'
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
