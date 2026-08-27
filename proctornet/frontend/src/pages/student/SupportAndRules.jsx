import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  PhoneCall,
  Mail,
  Send,
  CheckCircle2,
  Check,
  Clock,
  Eye,
  Camera,
  Mic,
  Monitor,
  Lock,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  LifeBuoy,
  FileCheck,
  AlertOctagon,
  Building,
  UserCheck
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SupportAndRules() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('rules') // rules, violations, faq, tickets, pledge
  const [exams, setExams] = useState([])
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // Ticket Form State
  const [ticketForm, setTicketForm] = useState({
    examId: '',
    category: 'TECHNICAL',
    priority: 'NORMAL',
    subject: '',
    description: ''
  })

  // FAQ Search & Open Accordion State
  const [faqSearch, setFaqSearch] = useState('')
  const [faqCategory, setFaqCategory] = useState('ALL')
  const [expandedFaq, setExpandedFaq] = useState(null)

  // Integrity Pledge State
  const [pledgeChecked, setPledgeChecked] = useState({
    webcam: false,
    aids: false,
    lockdown: false
  })
  const [pledgeSigned, setPledgeSigned] = useState(false)
  const [pledgeTimestamp, setPledgeTimestamp] = useState(null)

  useEffect(() => {
    // Fetch exams for ticket selector
    api.get('/student/exams')
      .then(res => setExams(res.data.exams || []))
      .catch(() => {})

    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoadingTickets(true)
    try {
      const res = await api.get('/student/support/tickets')
      setTickets(res.data.tickets || [])
    } catch {
      // ignore
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleTicketSubmit = async (e) => {
    e.preventDefault()
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      return toast.error('Please provide a subject and detailed description.')
    }

    setSubmittingTicket(true)
    try {
      const res = await api.post('/student/support/ticket', ticketForm)
      toast.success(`Support Ticket #${res.data.ticket?.ticketId || 'Created'} Submitted!`)
      setTicketForm({
        examId: '',
        category: 'TECHNICAL',
        priority: 'NORMAL',
        subject: '',
        description: ''
      })
      fetchTickets()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit ticket')
    } finally {
      setSubmittingTicket(false)
    }
  }

  const handleSignPledge = () => {
    if (!pledgeChecked.webcam || !pledgeChecked.aids || !pledgeChecked.lockdown) {
      return toast.error('Please review and check all three integrity affirmations.')
    }
    const time = new Date().toLocaleString()
    setPledgeSigned(true)
    setPledgeTimestamp(time)
    toast.success('Academic Integrity Pledge verified and recorded!')
  }

  // FAQ Data
  const faqs = [
    {
      id: 1,
      category: 'TECHNICAL',
      q: 'What happens if my internet connection drops during an exam?',
      a: 'ProctorNet automatically caches and autosaves your responses every 10 seconds. If your connection drops, an offline retry banner will appear. You have up to 5 minutes to restore your network connection and resume the test without losing previously answered questions.'
    },
    {
      id: 2,
      category: 'BIOMETRICS',
      q: 'Can I wear prescription glasses or headgear during the exam?',
      a: 'Standard clear prescription eyeglasses and recognized religious headwear are fully permitted. However, sunglasses, tinted eyewear, smart-glasses, and bulky hoods that obscure your forehead or jawline are strictly prohibited by AI facial recognition.'
    },
    {
      id: 3,
      category: 'HARDWARE',
      q: 'Are Bluetooth headphones or external earphones allowed?',
      a: 'No. All external listening devices, wired or wireless earbuds, and headsets are prohibited to prevent audio communication. Your computer speakers and integrated microphone must be used exclusively.'
    },
    {
      id: 4,
      category: 'EXAM_FLOW',
      q: 'How does the tab switching restriction work?',
      a: 'The assessment operates in full-screen lockdown. Navigating away from the exam tab, minimizing the browser, opening developer tools, or pressing Alt+Tab immediately logs a security infraction. After 3 recorded warnings, your session may be automatically submitted and locked.'
    },
    {
      id: 5,
      category: 'SECURITY',
      q: 'How does the AI object detection model work?',
      a: 'ProctorNet runs a real-time YOLOv8 computer vision model via the camera feed. It detects unauthorized items such as mobile phones, books, smartwatches, or additional individuals appearing in the frame, and immediately pings the live invigilator.'
    },
    {
      id: 6,
      category: 'SUBMISSION',
      q: 'What happens when the exam timer expires?',
      a: 'When the timer hits 00:00, all answered questions are automatically packaged and finalized to the central examination server. You do not need to panic if you run out of time while clicking the final question.'
    }
  ]

  const filteredFaqs = faqs.filter(f => {
    const matchCat = faqCategory === 'ALL' || f.category === faqCategory
    const matchText = !faqSearch || f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase())
    return matchCat && matchText
  })

  return (
    <DashboardLayout title="Security Policies & Student Support">
      <div className="max-w-5xl mx-auto space-y-6 font-sans text-[#0f172a]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#f1f5f9]">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0f172a] flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#2563eb]" />
              Security Policies & Student Support Center
            </h1>
            <p className="text-xs text-[#64748b] mt-0.5">
              Official university examination code of conduct, proctoring guidelines, and live candidate assistance.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#eff6ff] border border-[#dbeafe] text-[#2563eb] rounded-xl text-xs font-bold w-fit">
            <Building size={14} />
            <span>{user?.department || 'Engineering'} • Semester {user?.semester || 1}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#e2e8f0]">
          {[
            { id: 'rules', label: 'Proctoring Rules', icon: Shield },
            { id: 'violations', label: 'Violations & Penalties', icon: AlertTriangle },
            { id: 'faq', label: 'FAQ & Guidance', icon: HelpCircle },
            { id: 'tickets', label: 'Help Desk & Tickets', icon: LifeBuoy },
            { id: 'pledge', label: 'Integrity Pledge', icon: FileCheck }
          ].map(tab => {
            const IconComponent = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                }`}
              >
                <IconComponent size={14} className={isActive ? 'text-[#38bdf8]' : 'text-[#64748b]'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── TAB 1: PROCTORING RULES ── */}
        {activeTab === 'rules' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Core 4 Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Workstation & Room Environment */}
              <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <Building size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">1. Room & Workstation Environment</h3>
                    <p className="text-[11px] text-[#64748b]">Private space and desk clearance</p>
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-[#334155]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Isolated Room:</strong> You must sit alone in a quiet, well-lit room. No other individuals are permitted in the room.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Clean Desk:</strong> Clear your desk of all unauthorized objects, mobile phones, smartwatches, cheat-sheets, or books.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Proper Lighting:</strong> Sit facing the primary light source. Avoid bright backlights or windows behind you.</span>
                  </li>
                </ul>
              </Card>

              {/* Card 2: Browser Lockdown & Anti-Cheat */}
              <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">2. Browser Lockdown & Integrity</h3>
                    <p className="text-[11px] text-[#64748b]">Enforced system sandbox policies</p>
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-[#334155]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Strict Fullscreen:</strong> Exiting fullscreen mode or pressing Esc triggers an automated proctoring alert.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Tab Switching Shield:</strong> Leaving the exam window is tracked. 3 warnings will result in automated disqualification.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Disabled Shortcuts:</strong> Copy, Paste, PrintScreen, Alt+Tab, and right-click context menus are completely blocked.</span>
                  </li>
                </ul>
              </Card>

              {/* Card 3: Continuous AI Biometric Proctoring */}
              <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">3. AI Biometric & Object Detection</h3>
                    <p className="text-[11px] text-[#64748b]">Real-time facial & gaze monitoring</p>
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-[#334155]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Face Presence:</strong> Your full face must remain inside the camera frame at all times. Missing face alerts fire after 5 seconds.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Gaze Tracking:</strong> Repeatedly looking away from the screen, down at your lap, or off to the side logs a suspicious posture flag.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>No Second Person:</strong> The YOLOv8 model detects multiple faces and immediately alerts the invigilator of collusion.</span>
                  </li>
                </ul>
              </Card>

              {/* Card 4: Audio & Hardware Setup */}
              <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <Mic size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">4. Audio & Hardware Protocols</h3>
                    <p className="text-[11px] text-[#64748b]">Microphone invigilation & peripherals</p>
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-[#334155]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>No Headphones:</strong> Bluetooth, wireless, or wired earbuds and headsets are completely forbidden.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Speech Detection:</strong> Reading questions aloud or whispering to an off-screen partner triggers an audio anomaly event.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#10b981] shrink-0 mt-0.5" />
                    <span><strong>Single Display:</strong> Secondary monitors, TVs, or external displays must be physically unplugged before starting.</span>
                  </li>
                </ul>
              </Card>
            </div>

            {/* Quick Checklist Banner */}
            <Card className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center text-[#10b981] shrink-0">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a]">Ready to test your device hardware?</h4>
                    <p className="text-[11px] text-[#64748b] mt-0.5">
                      Verify your camera, microphone, screen share, and network latency in the diagnostic lab.
                    </p>
                  </div>
                </div>
                <Link to="/student/device-check">
                  <Button size="sm" className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer">
                    Open Device Diagnostic Lab
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}

        {/* ── TAB 2: VIOLATIONS & PENALTIES MATRIX ── */}
        {activeTab === 'violations' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#f1f5f9]">
                <h3 className="text-sm font-bold text-[#0f172a]">ProctorNet Academic Violation Matrix</h3>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Standardized severity tiers and immediate disciplinary responses during live examinations.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold">
                      <th className="py-3 px-4">Infraction Description</th>
                      <th className="py-3 px-4">Detection Engine</th>
                      <th className="py-3 px-4">Severity Tier</th>
                      <th className="py-3 px-4">Immediate System Action</th>
                      <th className="py-3 px-4 text-right">Academic Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
                    <tr className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-semibold">Tab Switching / Window Blur</td>
                      <td className="py-3 px-4 text-[#64748b] font-mono text-[11px]">DOM Visibility API</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
                          MODERATE
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">On-screen warning; max 3 infractions</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#ef4444]">Auto-Submit after limit</td>
                    </tr>

                    <tr className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-semibold">Mobile Phone Detected in Frame</td>
                      <td className="py-3 px-4 text-[#64748b] font-mono text-[11px]">YOLOv8 Vision Model</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]">
                          CRITICAL
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">Snapshot captured & invigilator notified</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#ef4444]">Integrity Hearing Referral</td>
                    </tr>

                    <tr className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-semibold">Multiple Faces Present (Collusion)</td>
                      <td className="py-3 px-4 text-[#64748b] font-mono text-[11px]">Face-API / OpenCV</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]">
                          CRITICAL
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">Live audio-video stream flagged red</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#ef4444]">Session Termination</td>
                    </tr>

                    <tr className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-semibold">Prolonged Gaze Deviation (&gt;10s)</td>
                      <td className="py-3 px-4 text-[#64748b] font-mono text-[11px]">Head Pose Estimation</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                          MINOR
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">Recenter face reminder toast</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#64748b]">Logged in Session Audit</td>
                    </tr>

                    <tr className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-semibold">Continuous Speech / Whispering</td>
                      <td className="py-3 px-4 text-[#64748b] font-mono text-[11px]">WebAudio / VAD</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
                          MODERATE
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">Audio clip recorded for review</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#d97706]">Faculty Review Required</td>
                    </tr>

                    <tr className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-semibold">Unauthorized Remote Tools (AnyDesk, etc.)</td>
                      <td className="py-3 px-4 text-[#64748b] font-mono text-[11px]">Local Security Agent</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]">
                          CRITICAL
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">Exam entrance blocked</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#ef4444]">Immediate Disqualification</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── TAB 3: FAQ & KNOWLEDGEBASE ── */}
        {activeTab === 'faq' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search & Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <Input
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search rules, technical questions, network policies..."
                  className="pl-9 text-xs bg-white border-[#e2e8f0] h-9 focus:border-[#2563eb]"
                />
              </div>

              <div className="flex bg-[#f1f5f9] border border-[#e2e8f0] rounded-xl p-1 gap-1">
                {['ALL', 'TECHNICAL', 'BIOMETRICS', 'HARDWARE', 'SECURITY'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFaqCategory(cat)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      faqCategory === cat
                        ? 'bg-white text-[#2563eb] shadow-2xs'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Accordion FAQ List */}
            <div className="space-y-2.5">
              {filteredFaqs.map(faq => {
                const isOpen = expandedFaq === faq.id
                return (
                  <Card
                    key={faq.id}
                    className="bg-white border border-[#e2e8f0] rounded-xl shadow-xs transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : faq.id)}
                      className="w-full p-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#f8fafc]"
                    >
                      <span className="text-xs font-bold text-[#0f172a]">{faq.q}</span>
                      <span className="text-[#64748b] shrink-0">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 text-xs text-[#475569] leading-relaxed border-t border-[#f1f5f9] pt-3 bg-[#f8fafc]">
                        {faq.a}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TAB 4: HELP DESK & TICKETS ── */}
        {activeTab === 'tickets' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Quick Emergency Contacts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <PhoneCall size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a]">Live Phone Helpline</h4>
                    <p className="text-[10px] text-[#64748b]">Active during exam hours</p>
                  </div>
                </div>
                <p className="text-xs font-mono font-bold text-[#2563eb] mt-1">+91 (080) 2345-6789</p>
              </Card>

              <Card className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a]">Support Email</h4>
                    <p className="text-[10px] text-[#64748b]">Guaranteed 24hr response</p>
                  </div>
                </div>
                <p className="text-xs font-mono font-bold text-[#2563eb] mt-1">support@proctornet.edu</p>
              </Card>

              <Card className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <LifeBuoy size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a]">Live Invigilator Chat</h4>
                    <p className="text-[10px] text-[#64748b]">Instant in-exam assistance</p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-[#10b981] mt-1">Accessible inside Exam Lobby</p>
              </Card>
            </div>

            {/* Ticket Submission Form */}
            <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs p-5">
              <h3 className="text-sm font-bold text-[#0f172a] mb-1">Submit an Inquiry or Report an Issue</h3>
              <p className="text-xs text-[#64748b] mb-4">
                Your request will be dispatched to the technical invigilation team and university exam administrators.
              </p>

              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#0f172a] mb-1">Associated Exam</label>
                    <select
                      value={ticketForm.examId}
                      onChange={(e) => setTicketForm({ ...ticketForm, examId: e.target.value })}
                      className="w-full text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-[#0f172a] focus:border-[#2563eb] outline-none"
                    >
                      <option value="">General / No Specific Exam</option>
                      {exams.map(e => (
                        <option key={e.id} value={e.id}>{e.title} ({e.subject || 'General'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#0f172a] mb-1">Issue Category</label>
                    <select
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                      className="w-full text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-[#0f172a] focus:border-[#2563eb] outline-none"
                    >
                      <option value="TECHNICAL">Hardware / Camera Issue</option>
                      <option value="NETWORK">Network / Disconnection</option>
                      <option value="QUESTION">Question Clarification</option>
                      <option value="ACCOUNT">Enrollment & Profile</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#0f172a] mb-1">Priority</label>
                    <select
                      value={ticketForm.priority}
                      onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                      className="w-full text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-[#0f172a] focus:border-[#2563eb] outline-none"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="URGENT">Urgent (Upcoming Exam)</option>
                      <option value="CRITICAL">Critical (Exam Today)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#0f172a] mb-1">Subject / Summary</label>
                  <Input
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                    placeholder="Briefly state your question or technical problem..."
                    className="text-xs bg-[#f8fafc] border-[#e2e8f0]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#0f172a] mb-1">Detailed Description</label>
                  <textarea
                    rows={4}
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                    placeholder="Describe the steps that led to the issue or questions regarding exam rules..."
                    className="w-full text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-[#0f172a] focus:border-[#2563eb] outline-none font-sans"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submittingTicket}
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold px-6 h-9 cursor-pointer"
                >
                  <Send size={13} className="mr-1.5" />
                  {submittingTicket ? 'Submitting Ticket...' : 'Submit Support Ticket'}
                </Button>
              </form>
            </Card>

            {/* My Tickets History */}
            <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#f1f5f9]">
                <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">My Support Inquiries</h3>
              </div>

              {loadingTickets ? (
                <div className="p-6 text-center text-xs text-[#94a3b8]">Loading inquiries...</div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#94a3b8]">
                  No support tickets filed yet. All your submitted tickets will appear here.
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {tickets.map(t => (
                    <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f8fafc] transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-[#2563eb]">{t.ticketId}</span>
                          <h4 className="text-xs font-bold text-[#0f172a]">{t.subject}</h4>
                        </div>
                        <p className="text-[11px] text-[#64748b] mt-1">{t.description}</p>
                        <p className="text-[10px] text-[#94a3b8] mt-1">
                          Category: {t.category} • Filed: {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                          {t.status || 'OPEN'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB 5: INTEGRITY PLEDGE ── */}
        {activeTab === 'pledge' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs p-6">
              <div className="flex items-center gap-3 mb-4 border-b border-[#f1f5f9] pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center text-[#10b981]">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Honor Code & Academic Integrity Affirmation</h3>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    Universal ethical pledge required from all verified candidates prior to online testing.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] cursor-pointer hover:border-[#2563eb] transition-all">
                  <input
                    type="checkbox"
                    checked={pledgeChecked.webcam}
                    onChange={(e) => setPledgeChecked({ ...pledgeChecked, webcam: e.target.checked })}
                    className="w-4 h-4 rounded-md mt-0.5 accent-[#2563eb] cursor-pointer"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-[#0f172a]">1. Continuous Recording & Biometric Consent</p>
                    <p className="text-[#64748b] mt-0.5">
                      I consent to continuous camera, microphone, and full-screen proctoring, and acknowledge that all biometric integrity data will be securely processed by ProctorNet.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] cursor-pointer hover:border-[#2563eb] transition-all">
                  <input
                    type="checkbox"
                    checked={pledgeChecked.aids}
                    onChange={(e) => setPledgeChecked({ ...pledgeChecked, aids: e.target.checked })}
                    className="w-4 h-4 rounded-md mt-0.5 accent-[#2563eb] cursor-pointer"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-[#0f172a]">2. Zero Unauthorized Assistance Pledge</p>
                    <p className="text-[#64748b] mt-0.5">
                      I will complete all examinations solely through my own effort without using smartphones, search engines, generative AI assistants, books, or receiving help from any third party.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] cursor-pointer hover:border-[#2563eb] transition-all">
                  <input
                    type="checkbox"
                    checked={pledgeChecked.lockdown}
                    onChange={(e) => setPledgeChecked({ ...pledgeChecked, lockdown: e.target.checked })}
                    className="w-4 h-4 rounded-md mt-0.5 accent-[#2563eb] cursor-pointer"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-[#0f172a]">3. Adherence to Browser Lockdown Policies</p>
                    <p className="text-[#64748b] mt-0.5">
                      I understand that attempting to bypass browser lockdown, disconnect webcams, or switch windows will result in automated session submission and disciplinary evaluation.
                    </p>
                  </div>
                </label>

                {!pledgeSigned ? (
                  <Button
                    onClick={handleSignPledge}
                    className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold h-10 cursor-pointer shadow-xs"
                  >
                    <FileCheck size={14} className="mr-2" />
                    Sign Academic Integrity Affirmation
                  </Button>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#ecfdf5] border-2 border-[#a7f3d0] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0">
                        <Check size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#0f172a]">Academic Integrity Pledge Digitally Signed</h4>
                        <p className="text-[11px] text-[#64748b] mt-0.5">
                          Candidate: <strong>{user?.name} ({user?.usn})</strong> • Timestamp: {pledgeTimestamp}
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#10b981] text-white">
                      VERIFIED RECEIPT
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
