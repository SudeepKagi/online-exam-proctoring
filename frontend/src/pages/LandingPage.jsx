import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, Cpu, ArrowRight, Lock, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      title: 'Verified Onboarding',
      category: 'Identity Assurance',
      desc: 'Admin account provisioning with student face and institutional verification.',
      icon: Shield
    },
    {
      title: 'Pre-Exam Identity & Screen Check',
      category: 'Session Security',
      desc: 'Facial comparison verification and mandatory full-screen monitor sharing.',
      icon: Lock
    },
    {
      title: 'Exam Authoring & Instant Grading',
      category: 'Evaluation Engine',
      desc: 'Create MCQ assessments, import questions, and evaluate submissions deterministically.',
      icon: Cpu
    },
    {
      title: 'Live Invigilator Console',
      category: 'Real-Time Oversight',
      desc: 'Monitor active exam attempts, review screen-share violation events, and manage sessions.',
      icon: Eye
    }
  ]

  const workflowSteps = [
    {
      num: '01',
      title: 'Provision & Verify Accounts',
      desc: 'Administrators provision accounts; candidates submit face reference photos for verification.'
    },
    {
      num: '02',
      title: 'Author & Schedule Exams',
      desc: 'Faculty configure MCQ tests, set start/end windows, and assign proctors to student cohorts.'
    },
    {
      num: '03',
      title: 'Identity & Screen Verification',
      desc: 'Before the exam unlocks, students pass facial comparison and activate screen sharing.'
    },
    {
      num: '04',
      title: 'Monitored Exam & Instant Grading',
      desc: 'Exam runner autosaves answers with network resilience and computes deterministic final scores.'
    }
  ]

  const roles = [
    { role: 'STUDENT', name: 'Student Portal', desc: 'Secure student identity onboarding, full-screen examination arena, and verified score reports.', route: '/login?role=student' },
    { role: 'FACULTY', name: 'Faculty Console', desc: 'Design assessments, configure positive/negative marking rules, and inspect student score breakdowns.', route: '/login?role=faculty' },
    { role: 'INVIGILATOR', name: 'Proctor Station', desc: 'Live candidate monitoring console, violation event feeds, and instant session management.', route: '/login?role=invigilator' },
    { role: 'ADMIN', name: 'Administrative Suite', desc: 'Manage institutional accounts, assign RBAC permissions, and review tamper-evident audit logs.', route: '/login?role=admin' }
  ]

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] font-sans antialiased selection:bg-[#5266eb] selection:text-white relative">
      {/* Top Navigation Bar: 72px */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-[480]">P</div>
            <div>
              <span className="text-base font-[480] tracking-wide text-[#28253b]">Proctor<span className="text-[#5266eb]">Net</span></span>
              <span className="block text-[10px] font-[500] text-[#554e7b] uppercase tracking-widest -mt-1">Enterprise</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2 text-sm font-[420] text-[#554e7b]">
            <a href="#features" className="px-4 py-2 rounded-full hover:bg-[rgba(82,102,235,0.08)] hover:text-[#28253b] transition">Features</a>
            <a href="#how-it-works" className="px-4 py-2 rounded-full hover:bg-[rgba(82,102,235,0.08)] hover:text-[#28253b] transition">How It Works</a>
            <a href="#roles" className="px-4 py-2 rounded-full hover:bg-[rgba(82,102,235,0.08)] hover:text-[#28253b] transition">Roles</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 h-10 rounded-[32px] text-sm font-[420] text-white bg-[#5266eb] hover:bg-[#4354d0] transition cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 sm:px-8 max-w-7xl mx-auto text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#edecfb] text-[#28253b] text-xs font-[420] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#5266eb] animate-pulse" />
          <span className="font-[500] text-[#5266eb]">Institutional Examination Platform</span>
          <span className="text-[#554e7b]">• Production Ready</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-[480] text-[#28253b] tracking-tight max-w-4xl mx-auto leading-[1.14]">
          Online Examination &amp; Proctoring Platform for Institutions
        </h1>
        <p className="mt-6 text-base sm:text-lg text-[#554e7b] max-w-2xl mx-auto font-[360] leading-relaxed">
          A unified enterprise portal for administrators, faculty, invigilators, and students to conduct secure, resilient assessments.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="px-6 h-10 rounded-[32px] bg-[#5266eb] hover:bg-[#4354d0] text-white text-sm font-[420] transition flex items-center gap-2 cursor-pointer"
          >
            Open Examination Portal <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-[#fbfbff] z-10 relative">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">SYSTEM CAPABILITIES</span>
            <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Core Platform Capabilities</h2>
            <p className="text-sm text-[#554e7b] mt-2 font-[360]">Quiet, precise evaluation infrastructure built on deterministic server authority.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((f, idx) => {
              const Icon = f.icon
              return (
                <div key={idx} className="p-8 rounded-xl bg-[#edecfb] transition">
                  <div className="w-10 h-10 rounded-full bg-white text-[#5266eb] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-[500] uppercase tracking-wider text-[#554e7b]">{f.category}</span>
                  <h3 className="text-xl font-[480] text-[#28253b] mt-1">{f.title}</h3>
                  <p className="text-sm text-[#554e7b] mt-2 leading-relaxed font-[360]">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-6 sm:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">EXAMINATION LIFECYCLE</span>
          <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Step-by-Step Examination Flow</h2>
          <p className="text-sm text-[#554e7b] mt-2 font-[360]">How institutions schedule, monitor, and deliver trusted evaluations.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((step, idx) => (
            <div key={idx} className="bg-[#fbfbff] rounded-xl p-8 flex flex-col justify-between">
              <div>
                <span className="text-2xl font-mono font-[480] text-[#5266eb]">{step.num}</span>
                <h3 className="text-base font-[480] text-[#28253b] mt-4">{step.title}</h3>
                <p className="text-sm text-[#554e7b] mt-2 font-[360] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-24 bg-[#fbfbff] max-w-7xl mx-auto px-6 sm:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">INSTITUTIONAL ECOSYSTEM</span>
          <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Tailored Portals for Every Stakeholder</h2>
          <p className="text-sm text-[#554e7b] mt-2 font-[360]">Dedicated workflows built for administrators, faculty examiners, students, and proctors.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((r, idx) => (
            <div key={idx} className="bg-white rounded-xl p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-[500] px-3 py-1 rounded-full bg-[#edecfb] text-[#554e7b]">{r.role}</span>
                <h3 className="text-lg font-[480] text-[#28253b] mt-4">{r.name}</h3>
                <p className="text-sm text-[#554e7b] mt-2 font-[360] leading-relaxed">{r.desc}</p>
              </div>
              <button
                onClick={() => navigate(r.route)}
                className="mt-8 w-full h-10 rounded-full bg-[rgba(82,102,235,0.10)] hover:bg-[rgba(82,102,235,0.18)] text-[#28253b] text-sm font-[420] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                Enter Portal <ChevronRight className="w-4 h-4 text-[#5266eb]" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 px-6 sm:px-8 text-xs text-[#554e7b] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-xs">P</div>
            <span className="font-[480] text-[#28253b]">ProctorNet Enterprise</span>
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
