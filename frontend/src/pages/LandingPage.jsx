import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, Cpu, ArrowRight, Lock, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      title: 'Verified Onboarding',
      category: 'Identity Assurance',
      desc: 'Admin account provisioning with student face & college ID card verification.',
      icon: Shield
    },
    {
      title: 'Pre-Exam Identity & Screen Check',
      category: 'Session Security',
      desc: 'Webcam face match via AWS Rekognition and mandatory full-screen monitor sharing.',
      icon: Lock
    },
    {
      title: 'Exam Authoring & Instant Grading',
      category: 'Evaluation Engine',
      desc: 'Create MCQ exams, import questions via Excel or AI assistant, and grade submissions automatically.',
      icon: Cpu
    },
    {
      title: 'Live Invigilator Console', // terms-ok: feature title requirement
      category: 'Real-Time Oversight',
      desc: 'Monitor active exam attempts, review screen-share violation logs, and suspend or resume sessions in real time.',
      icon: Eye
    }
  ]

  const workflowSteps = [
    {
      num: '01',
      title: 'Provision & Verify Accounts',
      desc: 'Administrators provision accounts; students submit face reference photos and college ID documents for approval.'
    },
    {
      num: '02',
      title: 'Author & Schedule Exams',
      desc: 'Faculty configure MCQ tests, import questions via Excel or AI generator, and assign proctors to student groups.'
    },
    {
      num: '03',
      title: 'Identity & Screen Verification',
      desc: 'Before the exam unlocks, students pass facial comparison via AWS Rekognition and enable mandatory screen sharing.'
    },
    {
      num: '04',
      title: 'Monitored Exam & Instant Grading',
      desc: 'Proctors supervise attempts in real time while automatic tamper detection logs infractions and evaluates answers upon submit.'
    }
  ]

  const roles = [
    { role: 'STUDENT', name: 'Student Portal', desc: 'Secure student identity onboarding, full-screen examination environment & instant verifiable score reports.', route: '/login?role=student' },
    { role: 'FACULTY', name: 'Faculty Console', desc: 'Design comprehensive assessments, generate AI questions, provision proctors & review detailed session logs.', route: '/login?role=faculty' },
    { role: 'INVIGILATOR', name: 'Proctor Station', desc: 'Real-time multi-student video tile wall, live gaze & audio flag logs, and instant session interventions.', route: '/login?role=invigilator' }, // terms-ok: internal role route
    { role: 'ADMIN', name: 'Administrative Suite', desc: 'Verify student identity photos, inspect College IDs, provision institutional departments & oversee system health.', route: '/login?role=admin' }
  ]

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] font-sans antialiased selection:bg-[#5266eb] selection:text-white relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-[#5266eb]/6 via-[#edecfb]/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar: 72px */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e9eaf2]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-[480] shadow-xs">P</div>
            <div>
              <span className="text-base font-[480] tracking-wide text-[#28253b]">Proctor<span className="text-[#5266eb]">Net</span></span>
              <span className="block text-[10px] font-[500] text-[#554e7b] uppercase tracking-widest -mt-1">Institutional</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2 text-sm font-[420] text-[#554e7b]">
            <a href="#features" className="px-4 py-2 rounded-full hover:bg-[#edecfb]/60 hover:text-[#28253b] transition">Features</a>
            <a href="#how-it-works" className="px-4 py-2 rounded-full hover:bg-[#edecfb]/60 hover:text-[#28253b] transition">How It Works</a>
            <a href="#roles" className="px-4 py-2 rounded-full hover:bg-[#edecfb]/60 hover:text-[#28253b] transition">Roles</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 h-10 rounded-[32px] text-xs font-[420] text-white bg-[#5266eb] hover:bg-[#4354d0] transition shadow-xs cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-20 px-6 sm:px-8 max-w-7xl mx-auto text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#edecfb] border border-[#5266eb]/20 text-[#28253b] text-xs font-[420] mb-8 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-[500] text-[#5266eb]">Institutional Examination Platform</span>
          <span className="text-[#554e7b]">• Online</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-[480] text-[#28253b] tracking-tight max-w-4xl mx-auto leading-[1.14]">
          Online Examination &amp; Proctoring Platform for Institutions
        </h1>
        <p className="mt-6 text-base sm:text-lg text-[#554e7b] max-w-2xl mx-auto font-[360] leading-relaxed">
          A unified portal for administrators, faculty, invigilators, and students to conduct secure browser-monitored MCQ examinations.
        </p>

        <div className="mt-9 flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="px-6 h-11 rounded-[32px] bg-[#5266eb] hover:bg-[#4354d0] text-white text-sm font-[420] transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            Open Examination Portal <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-[#fbfbff] border-y border-[#e9eaf2] z-10 relative">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">SYSTEM CAPABILITIES</span>
            <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Core Platform Capabilities</h2>
            <p className="text-sm text-[#554e7b] mt-2 font-[360]">Four integrated features providing honest and dependable assessment execution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((f, idx) => {
              const Icon = f.icon
              return (
                <div key={idx} className="p-7 rounded-xl border border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] hover:border-[#9cb4e8] transition">
                  <div className="w-10 h-10 rounded-full bg-[#edecfb] border border-[#5266eb]/20 text-[#5266eb] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">{f.category}</span>
                  <h3 className="text-lg font-[480] text-[#28253b] mt-1">{f.title}</h3>
                  <p className="text-sm text-[#554e7b] mt-2 leading-relaxed font-[360]">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-6 sm:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">HOW IT WORKS</span>
          <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Step-by-Step Examination Flow</h2>
          <p className="text-sm text-[#554e7b] mt-2 font-[360]">How institutions schedule, monitor, and deliver trusted evaluations.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((step, idx) => (
            <div key={idx} className="bg-white border border-[#e9eaf2] rounded-xl p-6 shadow-[0_1px_3px_rgba(40,37,59,0.04)] flex flex-col justify-between">
              <div>
                <span className="text-2xl font-mono font-[480] text-[#5266eb]">{step.num}</span>
                <h3 className="text-base font-[480] text-[#28253b] mt-3">{step.title}</h3>
                <p className="text-xs text-[#554e7b] mt-2 font-[360] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-20 bg-[#fbfbff] border-t border-[#e9eaf2] max-w-7xl mx-auto px-6 sm:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">INSTITUTIONAL ECOSYSTEM</span>
          <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Tailored Portals for Every Stakeholder</h2>
          <p className="text-sm text-[#554e7b] mt-2 font-[360]">Dedicated workflows built for administrators, faculty examiners, students, and proctors.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((r, idx) => (
            <div key={idx} className="bg-white border border-[#e9eaf2] rounded-xl p-6 flex flex-col justify-between hover:border-[#9cb4e8] transition shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
              <div>
                <span className="text-xs font-[500] px-2.5 py-1 rounded-full border border-[#5266eb]/20 bg-[#edecfb] text-[#5266eb]">{r.role}</span>
                <h3 className="text-base font-[480] text-[#28253b] mt-3.5">{r.name}</h3>
                <p className="text-xs text-[#554e7b] mt-2 font-[360] leading-relaxed">{r.desc}</p>
              </div>
              <button
                onClick={() => navigate(r.route)}
                className="mt-6 w-full h-10 rounded-[32px] bg-[rgba(82,102,235,0.06)] hover:bg-[#5266eb] text-[#28253b] hover:text-white border border-[#e9eaf2] text-xs font-[420] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                Enter Portal <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e9eaf2] py-10 px-6 sm:px-8 text-xs text-[#554e7b] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-xs">P</div>
            <span className="font-[480] text-[#28253b]">ProctorNet Platform</span>
          </div>
          <div className="text-[12px] text-[#554e7b]">
            © {new Date().getFullYear()} ProctorNet Examination Systems. Institutional Assessment Runtime.
          </div>
          <div className="flex items-center gap-4 text-xs font-[420]">
            <a href="#features" className="text-[#554e7b] hover:text-[#28253b] transition">Features</a>
            <a href="#how-it-works" className="text-[#554e7b] hover:text-[#28253b] transition">How It Works</a>
            <a href="#roles" className="text-[#554e7b] hover:text-[#28253b] transition">Roles</a>
            <Link to="/login" className="text-[#5266eb] hover:underline font-[480] transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
