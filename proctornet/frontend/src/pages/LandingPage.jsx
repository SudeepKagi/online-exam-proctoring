import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useState, useRef, useEffect } from 'react'
import {
  Shield, ChevronRight, Eye, FileText,
  ArrowRight, Monitor, UserCheck, ChevronDown, Check, CheckCircle2,
  Laptop, Video, Cpu, Menu, X
} from 'lucide-react'

// ── Verified Role Portals (Matching AccioJob Course Card Anatomy) ──
const rolePortals = [
  {
    role: 'Student',
    category: 'candidates',
    themeColor: 'blue',
    headerBg: 'bg-[#f8fafc]',
    iconBg: 'bg-[#eff6ff] text-[#2f80ed] border border-[#dbeafe]',
    borderClass: 'border-[#e2e8f0]',
    bottomBadgeBg: 'bg-[#eff6ff] text-[#2563eb] border-t border-[#dbeafe]',
    bottomText: 'SECURE EXAM ENVIRONMENT',
    icon: UserCheck,
    title: 'Student Exam Portal',
    subtitle: 'Candidate Assessment Workspace',
    description: 'Take assigned exams in a secure full-screen exam mode with guided pre-exam checks, identity verification, and objective-type assessments.',
    highlights: [
      'Secure full-screen exam mode',
      'Identity verification before and during exams',
      'Live camera & screen monitoring'
    ],
    path: '/student/login',
    buttonText: 'Student Login'
  },
  {
    role: 'Faculty',
    category: 'faculty',
    themeColor: 'purple',
    headerBg: 'bg-[#f8fafc]',
    iconBg: 'bg-[#f5f3ff] text-[#7c3aed] border border-[#ede9fe]',
    borderClass: 'border-[#e2e8f0]',
    bottomBadgeBg: 'bg-[#faf5ff] text-[#7c3aed] border-t border-[#ede9fe]',
    bottomText: 'EVALUATION & QUESTION BANK',
    icon: FileText,
    title: 'Faculty Exam Suite',
    subtitle: 'Paper Authoring & Evaluation Workspace',
    description: 'Create and manage question papers, build exams from a topic or your own material with a question assistant, and review results and integrity reports.',
    highlights: [
      'Assisted question creation',
      'Build exams from your material',
      'Instant results & integrity reports'
    ],
    path: '/faculty/login',
    buttonText: 'Faculty Login'
  },
  {
    role: 'Invigilator',
    category: 'supervisors',
    themeColor: 'green',
    headerBg: 'bg-[#f8fafc]',
    iconBg: 'bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7]',
    borderClass: 'border-[#e2e8f0]',
    bottomBadgeBg: 'bg-[#f0fdf4] text-[#16a34a] border-t border-[#dcfce7]',
    bottomText: 'REAL-TIME SUPERVISION',
    icon: Eye,
    title: 'Live Invigilator Grid',
    subtitle: 'Real-Time Supervision Workspace',
    description: 'Supervise concurrent exam sessions from a live monitoring grid, receive instant alerts, and message candidates directly.',
    highlights: [
      'Live multi-candidate monitoring',
      'Instant incident alerts',
      'Candidate details & messaging'
    ],
    path: '/invigilator-login',
    buttonText: 'Invigilator Login'
  },
  {
    role: 'Admin',
    category: 'supervisors',
    themeColor: 'navy',
    headerBg: 'bg-[#f8fafc]',
    iconBg: 'bg-[#f1f5f9] text-[#1c4d8e] border border-[#e2e8f0]',
    borderClass: 'border-[#e2e8f0]',
    bottomBadgeBg: 'bg-[#f8fafc] text-[#475569] border-t border-[#e2e8f0]',
    bottomText: 'INSTITUTIONAL ADMINISTRATION',
    icon: Shield,
    title: 'Administrator Console',
    subtitle: 'User Approvals & System Parameters',
    description: 'Configure exam policies, approve accounts, onboard rosters in bulk, and review a complete audit trail.',
    highlights: [
      'Role-specific permissions',
      'Bulk roster onboarding',
      'Complete activity audit trail'
    ],
    path: '/admin/login',
    buttonText: 'Admin Login'
  }
]

// ── 4-Stage Security Pipeline ──
const verificationStages = [
  {
    step: '01',
    title: 'Environment Check',
    desc: 'Confirms your browser, display and device meet exam requirements.'
  },
  {
    step: '02',
    title: 'Camera & Screen',
    desc: 'Checks that your camera and screen sharing are working.'
  },
  {
    step: '03',
    title: 'Identity Match',
    desc: 'Matches you against your registered profile photo.'
  },
  {
    step: '04',
    title: 'Secure Exam Mode',
    desc: 'Starts full-screen mode with focus and window monitoring.'
  }
]

// ── Built-in Proctoring Engines ──
const builtFeatures = [
  {
    icon: UserCheck,
    title: 'Identity Verification',
    desc: 'Confirms the registered candidate is the one taking the exam.'
  },
  {
    icon: Video,
    title: 'Live Camera & Screen Monitoring',
    desc: 'Lets invigilators supervise candidates in real time.'
  },
  {
    icon: Monitor,
    title: 'Secure Exam Mode',
    desc: 'Flags tab switches, window changes and full-screen exits instantly.'
  },
  {
    icon: CheckCircle2,
    title: 'Instant Objective Evaluation',
    desc: 'Fast, accurate scoring for multiple-choice exams.'
  },
  {
    icon: Cpu,
    title: 'Integrity Insights',
    desc: 'Highlights unusual activity and patterns across attempts.'
  },
  {
    icon: Laptop,
    title: 'Device Readiness Check',
    desc: 'Checks the candidate device before the exam.'
  }
]

// ── Technical FAQs ──
const faqs = [
  {
    q: 'How does the system prevent window and tab switching?',
    a: 'Focus and visibility are monitored; leaving the exam window shows a compliance prompt and is logged.'
  },
  {
    q: 'How is student identity validated during the exam?',
    a: 'Your registered photo is compared with your live camera during pre-exam checks and, where your institution enables it, periodically during the exam.'
  },
  {
    q: 'What question formats are supported for faculty?',
    a: 'Single-correct multiple-choice, 2–6 options, positive and negative marking.'
  },
  {
    q: 'What supervisory controls do invigilators have?',
    a: 'Live monitoring, instant alerts, incident details, warnings, pause/resume.'
  },
  {
    q: 'What is checked during the pre-exam device check?',
    a: 'A pre-exam check confirms the device is ready and free of prohibited remote-access software.'
  }
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState(0)
  const [selectedTab, setSelectedTab] = useState('all')
  const [activeSection, setActiveSection] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sections = ['specs', 'portals', 'pipeline', 'features']
          const scrollY = window.scrollY

          let current = scrollY < 400 ? 'specs' : ''
          if (scrollY >= 400) {
            for (const sectionId of sections) {
              const el = document.getElementById(sectionId)
              if (el) {
                const rect = el.getBoundingClientRect()
                if (rect.top <= 250 && rect.bottom >= 250) {
                  current = sectionId
                  break
                }
              }
            }
          }
          if (current) {
            setActiveSection(current)
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const filteredPortals = rolePortals.filter((p) => {
    if (selectedTab === 'all') return true
    if (selectedTab === 'candidates') return p.category === 'candidates'
    if (selectedTab === 'faculty') return p.category === 'faculty'
    if (selectedTab === 'supervisors') return p.category === 'supervisors'
    return true
  })

  return (
    <div className="w-full min-h-screen bg-[#ffffff] text-[#18181b] font-sans antialiased selection:bg-[#2f80ed]/15 selection:text-[#2f80ed]">
      {/* ── Navigation Bar (Full Width & AccioJob Right-Aligned Navigation Structure) ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] shadow-[0_1px_3px_rgba(0,0,0,0.03)] w-full">
        <div className="w-full px-6 lg:px-12 h-[72px] flex items-center justify-between">
          {/* Far Left: Brand Logo & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="" className="w-9 h-9 object-contain rounded-xl" />
            <div>
              <div className="flex items-center">
                <span className="text-xl font-bold tracking-tight text-[#18181b]">Proctor</span>
                <span className="text-xl font-bold tracking-tight text-[#2f80ed]">Net</span>
              </div>
              <p className="text-[10px] text-[#71717a] font-medium leading-none mt-0.5">Online Exam Proctoring</p>
            </div>
          </div>

          {/* Far Right: Nav Links + Action Buttons grouped together (Exact AccioJob Layout) */}
          <div className="flex items-center gap-4 lg:gap-10">
            {/* Center-Right Nav Links (In Exact Order of Landing Page Sections) */}
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
              {[
                { id: 'specs', label: 'Specifications' },
                { id: 'portals', label: 'Portals' },
                { id: 'pipeline', label: 'Pre-Exam Checks' },
                { id: 'features', label: 'Features' }
              ].map((item) => {
                const isActive = activeSection === item.id
                return (
                  <div key={item.id} className="flex flex-col items-center">
                    <a
                      href={`#${item.id}`}
                      onClick={() => setActiveSection(item.id)}
                      className={`py-1 transition-colors duration-150 ${
                        isActive ? 'text-[#18181b] font-semibold' : 'text-[#4b5563] hover:text-[#18181b]'
                      }`}
                    >
                      {item.label}
                    </a>
                    <div
                      className={`h-[2px] rounded-full transition-all duration-200 ${
                        isActive ? 'w-5 bg-[#18181b]' : 'w-0 bg-transparent'
                      }`}
                    />
                  </div>
                )
              })}

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1 hover:text-[#2f80ed] transition-colors py-1 text-[#4b5563] cursor-pointer"
                >
                  <span>More</span>
                  <ChevronDown size={14} className={`text-[#71717a] transition-transform ${dropdownOpen ? 'rotate-180 text-[#2f80ed]' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#e5e7eb] rounded-2xl shadow-xl py-2 z-50 animate-in fade-in-90">
                    <a
                      href="#faqs"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#374151] hover:bg-[#eff6ff] hover:text-[#2f80ed]"
                    >
                      Frequently Asked Questions
                    </a>
                    <div className="border-t border-[#f1f5f9] my-1" />
                    <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Quick Links</div>
                    <Link
                      to="/student/login"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#374151] hover:bg-[#eff6ff] hover:text-[#2f80ed]"
                    >
                      Candidate Login
                    </Link>
                    <Link
                      to="/faculty/login"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#374151] hover:bg-[#eff6ff] hover:text-[#2f80ed]"
                    >
                      Faculty Exam Suite
                    </Link>
                    <Link
                      to="/invigilator-login"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#374151] hover:bg-[#eff6ff] hover:text-[#2f80ed]"
                    >
                      Invigilator Grid
                    </Link>
                  </div>
                )}
              </div>
            </nav>

            {/* Mobile Menu Toggle Button (Fix H-03) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#4b5563] hover:text-[#18181b] rounded-lg border border-[#e5e7eb] cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Single "Get Started" Button (Direct to Student Portal Login) */}
            <div className="hidden sm:flex items-center gap-3">
              {isAuthenticated ? (
                <button
                  onClick={() => navigate(`/${role}/dashboard`)}
                  className="bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
                >
                  Go to Dashboard <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/student/login')}
                  className="bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-[0_2px_8px_rgba(47,128,237,0.25)] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer (Fix H-03) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#e5e7eb] bg-white px-6 py-4 space-y-3 shadow-lg">
            <a
              href="#specs"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#4b5563] hover:text-[#18181b]"
            >
              Specifications
            </a>
            <a
              href="#portals"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#4b5563] hover:text-[#18181b]"
            >
              Portals
            </a>
            <a
              href="#pipeline"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#4b5563] hover:text-[#18181b]"
            >
              Pre-Exam Checks
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#4b5563] hover:text-[#18181b]"
            >
              Features
            </a>
            <a
              href="#faqs"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#4b5563] hover:text-[#18181b]"
            >
              FAQs
            </a>
            <div className="pt-2 border-t border-[#f1f5f9] flex flex-col gap-2">
              <Link
                to="/student/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center bg-[#2f80ed] text-white font-bold py-2.5 rounded-xl text-sm"
              >
                Candidate Login
              </Link>
              <Link
                to="/faculty/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center border border-[#e2e8f0] text-[#18181b] font-medium py-2 rounded-xl text-sm"
              >
                Faculty Login
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Full-Width Hero Section ── */}
      <section className="relative w-full pt-16 pb-20 px-6 lg:px-12 bg-white">
        {/* Full-Width Two-Column Hero Content */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headline, Subtitle, Trust Strip */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-[#18181b] leading-[1.12]">
              Run Secure Exams with <br />
              <span className="text-[#2f80ed]">Smart Proctoring</span> & <br />
              <span className="text-[#1c4d8e]">Verified Integrity</span>
            </h1>

            <p className="text-base sm:text-lg text-[#52525b] font-medium leading-relaxed">
              Conduct high-stakes university and college examinations with identity verification, live camera and screen monitoring, a secure exam mode, and automated integrity checks.
            </p>

            {/* Institutional Trust Badges */}
            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#52525b] border-t border-[#e5e7eb]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#d5e6fb] flex items-center justify-center text-[#2f80ed]">
                  <UserCheck size={18} />
                </div>
                <div>
                  <div className="font-bold text-[#18181b]">Identity Verification</div>
                  <div className="text-[11px] text-[#71717a]">Before and during the exam</div>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-[#e5e7eb]" />

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#d5e6fb] flex items-center justify-center text-[#2f80ed]">
                  <Video size={18} />
                </div>
                <div>
                  <div className="font-bold text-[#18181b]">Live Monitoring</div>
                  <div className="text-[11px] text-[#71717a]">Camera & screen</div>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-[#e5e7eb]" />

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#d5e6fb] flex items-center justify-center text-[#2f80ed]">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div className="font-bold text-[#18181b]">Instant Evaluation</div>
                  <div className="text-[11px] text-[#71717a]">Objective exams</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Expansive College Students Showcase Photo */}
          <div className="lg:col-span-6 flex justify-center w-full">
            <div className="relative w-full group">
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#2f80ed]/20 via-[#38bdf8]/20 to-[#6366f1]/15 rounded-3xl blur-2xl opacity-70 group-hover:opacity-100 transition duration-500 pointer-events-none" />
              
              <div className="relative w-full bg-white border border-[#e5e7eb] rounded-3xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(16,24,40,0.18)]">
                <img
                  src="/hero-students.jpg"
                  alt=""
                  className="w-full h-auto max-h-[560px] object-cover object-center rounded-3xl transition-transform duration-500 group-hover:scale-[1.01]"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Full-Width "SYSTEM SPECIFICATIONS" Navy Ribbon (AccioJob Style) ── */}
      <section id="specs" className="w-full py-10 px-6 lg:px-12">
        <div className="text-center mb-6">
          <div className="inline-block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#18181b]">SYSTEM SPECIFICATIONS</span>
            <div className="h-0.5 w-12 mx-auto bg-[#2f80ed] mt-1" />
          </div>
        </div>

        {/* Navy Interlocking Banner spanning edge-to-edge */}
        <div className="w-full relative bg-[#0d2847] text-white rounded-3xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/15 py-9 px-6 text-center">
            <div className="py-4 px-4 flex flex-col items-center justify-center">
              <div className="text-3xl lg:text-4xl font-bold text-white tracking-tight">4-Stage</div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#93c5fd] mt-1">Pre-Exam Checks</div>
              <p className="text-[11px] text-white/70 mt-1 font-medium max-w-[220px]">Device, camera & identity</p>
            </div>

            <div className="py-4 px-4 flex flex-col items-center justify-center">
              <div className="text-3xl lg:text-4xl font-bold text-white tracking-tight">Live</div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#93c5fd] mt-1">Camera & Screen Monitoring</div>
              <p className="text-[11px] text-white/70 mt-1 font-medium max-w-[220px]">Real-time supervision</p>
            </div>

            <div className="py-4 px-4 flex flex-col items-center justify-center">
              <div className="text-3xl lg:text-4xl font-bold text-white tracking-tight">100% MCQ</div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#93c5fd] mt-1">Objective Exams</div>
              <p className="text-[11px] text-white/70 mt-1 font-medium max-w-[220px]">Automatic evaluation</p>
            </div>

            <div className="py-4 px-4 flex flex-col items-center justify-center">
              <div className="text-3xl lg:text-4xl font-bold text-white tracking-tight">4 Portals</div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#93c5fd] mt-1">Role Workspaces</div>
              <p className="text-[11px] text-white/70 mt-1 font-medium max-w-[220px]">Candidate, Faculty, Invigilator & Admin</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Full-Width System Access Portals Section ── */}
      <section id="portals" className="w-full py-20 px-6 lg:px-12 bg-[#fafbfc] border-y border-[#e5e7eb]">
        <div className="w-full">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1c4d8e]">PORTALS</span>
              <div className="h-0.5 w-12 mx-auto bg-[#2f80ed] mt-1" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18181b] tracking-tight mt-3">
              <span className="text-[#2f80ed]">Candidate</span>, Faculty, and Invigilator Consoles
            </h2>
            <p className="text-sm text-[#52525b] mt-2 font-medium max-w-2xl mx-auto">
              Dedicated role-based workspaces engineered for every participant in the examination lifecycle.
            </p>

            {/* Segmented Filter Pills (Fix H-03) */}
            <div className="mt-8 inline-flex items-center p-1.5 bg-[#f1f5f9] border border-[#e2e8f0] rounded-2xl shadow-xs">
              <button
                onClick={() => setSelectedTab('all')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTab === 'all'
                    ? 'bg-white text-[#2f80ed] shadow-xs'
                    : 'text-[#52525b] hover:text-[#18181b]'
                }`}
              >
                All Portals
              </button>
              <button
                onClick={() => setSelectedTab('candidates')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTab === 'candidates'
                    ? 'bg-white text-[#2f80ed] shadow-xs'
                    : 'text-[#52525b] hover:text-[#18181b]'
                }`}
              >
                Candidate Console
              </button>
              <button
                onClick={() => setSelectedTab('faculty')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTab === 'faculty'
                    ? 'bg-white text-[#2f80ed] shadow-xs'
                    : 'text-[#52525b] hover:text-[#18181b]'
                }`}
              >
                Faculty Workspace
              </button>
              <button
                onClick={() => setSelectedTab('supervisors')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTab === 'supervisors'
                    ? 'bg-white text-[#2f80ed] shadow-xs'
                    : 'text-[#52525b] hover:text-[#18181b]'
                }`}
              >
                Supervision & Admin
              </button>
            </div>
          </div>

          {/* 4 Cards Grid - Spanning across full width with gap-8 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {filteredPortals.map((portal) => {
              const Icon = portal.icon
              return (
                <div
                  key={portal.role}
                  className={`bg-white border ${portal.borderClass} rounded-3xl overflow-hidden shadow-[0_4px_16px_-2px_rgba(16,24,40,0.08),0_2px_6px_-2px_rgba(16,24,40,0.04)] flex flex-col justify-between hover:shadow-2xl transition-all duration-200`}
                >
                  {/* Header Banner */}
                  <div>
                    <div className={`${portal.headerBg} p-7 relative border-b ${portal.borderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-2xl ${portal.iconBg} flex items-center justify-center shadow-xs`}>
                          <Icon size={24} />
                        </div>
                      </div>

                      <div className="mt-5">
                        <h3 className="text-xl font-bold text-[#18181b] tracking-tight">{portal.title}</h3>
                        <p className="text-xs text-[#64748b] font-normal mt-1">{portal.subtitle}</p>
                      </div>
                    </div>

                    {/* Simple Clean Paragraph */}
                    <div className="p-7">
                      <p className="text-xs text-[#52525b] leading-relaxed font-normal">
                        {portal.description}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Section */}
                  <div>
                    {/* Key Feature Highlights Checklist */}
                    <div className="px-7 py-4 bg-[#fafbfc] border-t border-b border-[#f1f5f9] space-y-2.5">
                      {portal.highlights.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs text-[#334155] font-medium">
                          <div className="w-4 h-4 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0">
                            <Check size={10} strokeWidth={3} />
                          </div>
                          <span className="leading-snug">{item}</span>
                        </div>
                      ))}
                    </div>

                    {/* Single Centered Access Button */}
                    <div className="p-6 pt-4">
                      <button
                        onClick={() => navigate(portal.path)}
                        className="w-full bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] text-white text-xs font-semibold py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>{portal.buttonText}</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* Light Bottom Ribbon */}
                    <div className={`${portal.bottomBadgeBg} py-2.5 px-4 text-center text-[10px] font-bold uppercase tracking-widest`}>
                      {portal.bottomText}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Full-Width 4-Stage Security Pipeline Section ── */}
      <section id="pipeline" className="relative w-full py-20 px-6 lg:px-12 bg-white border-b border-[#e5e7eb] overflow-hidden">
        <div className="text-center mb-16">
          <div className="inline-block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1c4d8e]">PRE-EXAM CHECKS</span>
            <div className="h-0.5 w-12 mx-auto bg-[#2f80ed] mt-1" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#18181b] tracking-tight mt-3">
            4-Stage Pre-Exam Check Pipeline
          </h2>
          <p className="text-sm text-[#52525b] mt-3 font-medium max-w-2xl mx-auto">
            Candidates must satisfy all four pre-exam checks before entering the proctored test room.
          </p>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {verificationStages.map((stage) => (
            <div
              key={stage.step}
              className="bg-white border border-[#e5e7eb] rounded-3xl p-8 shadow-xs hover:border-[#2f80ed]/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="text-3xl font-bold text-[#2f80ed] mb-4">{stage.step}</div>
                <h3 className="text-base font-bold text-[#18181b] mb-2.5">{stage.title}</h3>
                <p className="text-xs text-[#52525b] leading-relaxed font-medium">{stage.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Full-Width Built-in Proctoring Engines Grid ── */}
      <section id="features" className="relative w-full py-20 px-6 lg:px-12 bg-[#f8f9fa] border-b border-[#e5e7eb] overflow-hidden">
        <div className="text-center mb-16">
          <div className="inline-block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1c4d8e]">INTEGRITY FEATURES</span>
            <div className="h-0.5 w-12 mx-auto bg-[#2f80ed] mt-1" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#18181b] tracking-tight mt-3">
            Platform Security & Integrity Services
          </h2>
          <p className="text-sm text-[#52525b] mt-3 font-medium">
            Layered monitoring that combines identity checks, secure exam mode, and integrity analysis.
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {builtFeatures.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={i}
                className="bg-white border border-[#e5e7eb] rounded-3xl p-8 shadow-xs hover:border-[#2f80ed]/50 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#eff6ff] text-[#2f80ed] flex items-center justify-center border border-[#d5e6fb] mb-5 shadow-xs">
                  <Icon size={22} />
                </div>
                <h3 className="text-base font-bold text-[#18181b] mb-2.5">{f.title}</h3>
                <p className="text-xs text-[#52525b] leading-relaxed font-medium">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── FAQ Section (Comfortable Reading Width) ── */}
      <section id="faqs" className="py-20 px-6 max-w-4xl mx-auto border-t border-[#e5e7eb]">
        <div className="text-center mb-16">
          <div className="inline-block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1c4d8e]">FREQUENTLY ASKED QUESTIONS</span>
            <div className="h-0.5 w-12 mx-auto bg-[#2f80ed] mt-1" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#18181b] tracking-tight mt-3">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden shadow-xs transition-all"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === idx ? -1 : idx)}
                className="w-full text-left p-6 flex items-center justify-between font-bold text-sm text-[#18181b] cursor-pointer hover:text-[#2f80ed] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-[#71717a] transition-transform duration-200 ${activeFaq === idx ? 'rotate-180 text-[#2f80ed]' : ''}`}
                />
              </button>
              {activeFaq === idx && (
                <div className="px-6 pb-6 text-xs text-[#52525b] leading-relaxed border-t border-[#f4f4f5] pt-4 font-medium">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Full-Width Footer with New Logo ── */}
      <footer className="w-full bg-white border-t border-[#e7ebf1] text-[#13335f]">
        {/* CTA Strip */}
        <div className="bg-gradient-to-b from-[#f4f8fe] to-[#edf4fd] border-b border-[#e1ebf8] py-10 px-6 lg:px-12 w-full">
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-[#18181b]">Ready to begin an examination session?</h3>
              <p className="text-xs text-[#52525b] mt-1.5 font-medium">Select your portal below to sign in with your institutional credentials.</p>
            </div>
            <div className="flex gap-3.5">
              <button
                onClick={() => navigate('/student/login')}
                className="bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-bold px-6 py-3 rounded-xl shadow-[0_1px_2px_0_rgba(37,99,235,0.05)] cursor-pointer transition"
              >
                Student Exam Login
              </button>
              <button
                onClick={() => navigate('/faculty/login')}
                className="bg-white border border-[#9ec2f5] hover:bg-[#eff6ff] text-[#2666be] text-xs font-bold px-6 py-3 rounded-xl cursor-pointer transition"
              >
                Faculty Portal
              </button>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="w-full px-6 lg:px-12 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="" className="w-8 h-8 object-contain rounded-lg shadow-xs" />
              <span className="font-bold text-base text-[#18181b]">ProctorNet</span>
            </div>
            <p className="text-xs text-[#52525b] leading-relaxed">
              Online examination proctoring platform with identity verification, live monitoring, and a secure exam mode.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#2f80ed] uppercase tracking-wider mb-4">Exam Portals</h4>
            <ul className="space-y-2.5 text-xs text-[#52525b]">
              <li><Link to="/student/login" className="hover:text-[#2f80ed]">Student Candidate Login</Link></li>
              <li><Link to="/faculty/login" className="hover:text-[#2f80ed]">Faculty Paper Creator</Link></li>
              <li><Link to="/invigilator-login" className="hover:text-[#2f80ed]">Invigilator Live Grid</Link></li>
              <li><Link to="/admin/login" className="hover:text-[#2f80ed]">System Admin Console</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#2f80ed] uppercase tracking-wider mb-4">Security Modules</h4>
            <ul className="space-y-2.5 text-xs text-[#52525b]">
              <li><span>Identity Verification</span></li>
              <li><span>Secure Exam Mode</span></li>
              <li><span>Instant MCQ Evaluation</span></li>
              <li><span>Device Readiness Check</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#2f80ed] uppercase tracking-wider mb-4">System Status</h4>
            <p className="text-xs text-[#52525b] leading-relaxed mb-3">
              Designed for college computer laboratories and verified proctored evaluations.
            </p>
            <span className="inline-block text-[11px] font-bold text-[#166534] bg-[#ecfdf5] border border-[#bbf7d0] px-3 py-1 rounded-md">
              System Online & Operational
            </span>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-[#e7ebf1] py-6 px-6 text-center text-xs text-[#71717a] font-medium w-full">
          © {new Date().getFullYear()} ProctorNet. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
