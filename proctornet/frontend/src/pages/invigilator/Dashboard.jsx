import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { 
  Users, AlertTriangle, MessageSquare, Video, 
  Terminal, Clock, Shield, Search, Filter,
  MoreVertical, Bell, Info, StopCircle, 
  Send, X, User, ExternalLink, Zap
} from 'lucide-react'

export default function InvDashboard() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  
  // State
  const [students, setStudents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('grid') // 'grid' | 'alerts' | 'chat'
  const [chatInput, setChatInput] = useState('')
  const [selectedChatStudent, setSelectedChatStudent] = useState(null)
  const [filter, setFilter] = useState('all')
  const [examInfo, setExamInfo] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

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
          startedAt: new Date()
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
      
      playAlertSound(data.severity)
    })
    
    // Camera frame event (was student:frame)
    socket.on('student:cameraFrame', (data) => {
      setStudents(prev => prev.map(s =>
        s.studentId === data.studentId
          ? { ...s, cameraFrame: data.frame }
          : s
      ))
    })

    socket.on('student:offline', (data) => {
      setStudents(prev => prev.map(s =>
        s.studentId === data.studentId
          ? { ...s, status: 'offline' }
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
                  <p className="text-sm font-bold text-slate-800 mb-2">{alert.usn} — {alert.studentName}</p>
                  {alert.cameraFrame && (
                    <img src={alert.cameraFrame} className="w-full h-24 object-cover rounded-xl border border-slate-200 mb-2" alt="Violation" />
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
                onClick={() => { setSelectedStudent(student); setShowModal(true) }}
                className={`group bg-white rounded-3xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden ${
                  student.status === 'active' ? 'border-transparent' : 
                  student.status === 'flagged' ? 'border-amber-400' : 
                  student.status === 'critical' ? 'border-red-500 animate-pulse' : 'border-slate-200 grayscale opacity-80'
                }`}
              >
                {/* Visual Feed */}
                <div className="aspect-video bg-slate-900 relative overflow-hidden">
                  {student.cameraFrame ? (
                    <img src={student.cameraFrame} className="w-full h-full object-cover" alt={student.name} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                      <Video size={48} className="mb-2" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">No Active Feed</span>
                    </div>
                  )}
                  
                  <div className="absolute top-4 left-4 flex gap-2">
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
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <button className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl">Inspect Dossier</button>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-black text-slate-900 truncate mb-1">{student.name}</h3>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="font-mono text-xs font-bold">{student.usn}</span>
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                      <Clock size={12} /> {student.startedAt ? new Date(student.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                  </div>
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
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-2xl transition-all">
                <X size={24} className="text-slate-500" />
              </button>
            </header>

            <div className="flex-1 overflow-hidden flex">
              {/* Modal Left: Visual Evidence */}
              <div className="w-2/3 p-10 overflow-y-auto space-y-8 border-r">
                <div className="aspect-video bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-slate-50 relative group">
                  {selectedStudent.cameraFrame ? (
                    <img src={selectedStudent.cameraFrame} className="w-full h-full object-cover" alt="Live" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                      <Video size={80} className="mb-4" />
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Connection Severed</span>
                    </div>
                  )}
                  <div className="absolute bottom-6 right-6 bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest border border-white/20">
                    Student Primary Feed
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
                            <div className="pb-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-slate-900 bg-white shadow-sm border border-slate-100 px-2 py-0.5 rounded uppercase">{ev.eventType}</span>
                                <span className="text-[10px] font-bold text-slate-400">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">{ev.details || 'System flagged potential violation'}</p>
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
                        placeholder="Custom warning..."
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl">
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 flex-1 flex flex-col items-center justify-center text-slate-300 gap-3 grayscale opacity-50">
                  <MessageSquare size={48} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Public Channel Disabled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
