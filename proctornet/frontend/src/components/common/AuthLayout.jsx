import * as React from 'react'
import { Link } from 'react-router-dom'

export default function AuthLayout({
  role = 'student',
  title = 'Login with your USN',
  subtitle = 'Enter your assigned credentials to access scheduled exams.',
  heroHeadline = 'Student Login',
  heroSubtitle = 'Sign in to access your proctored examinations and assessments.',
  personImage = '/login-student.jpg',
  children,
  switchRoleLink = { label: 'Faculty Login', path: '/faculty/login' },
  registerLink = { label: 'Create new account', path: '/student/register' }
}) {
  return (
    <div className="min-h-screen w-full bg-white text-[#18181b] flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* ── Left Column (50% Central Split Form Panel) ── */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between min-h-screen bg-white">
        {/* Top Header: Logo */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="ProctorNet" className="w-9 h-9 object-contain rounded-xl" />
            <div className="flex items-center">
              <span className="text-xl font-bold tracking-tight text-[#18181b]">Proctor</span>
              <span className="text-xl font-bold tracking-tight text-[#2f80ed]">Net</span>
            </div>
          </Link>
          <Link to="/" className="text-xs font-normal text-[#6b7280] hover:text-[#18181b] transition-colors">
            ← Back to Home
          </Link>
        </div>

        {/* Center: Auth Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-6">
          <div className="mb-8">
            <p className="text-xs font-normal text-[#6b7280] mb-1">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#18181b] tracking-tight">{title}</h1>
            {subtitle && <p className="text-xs text-[#6b7280] mt-1 font-normal leading-relaxed">{subtitle}</p>}
          </div>

          {children}

          {registerLink && (
            <div className="mt-6 text-center text-xs text-[#6b7280] font-normal">
              Don't have an account?{' '}
              <Link to={registerLink.path} className="text-[#2f80ed] font-medium hover:underline">
                {registerLink.label}
              </Link>
            </div>
          )}

          {switchRoleLink && (
            <div className="mt-3 text-center text-xs text-[#6b7280] font-normal">
              Switch portal:{' '}
              <Link to={switchRoleLink.path} className="text-[#1c4d8e] font-medium hover:underline">
                {switchRoleLink.label} →
              </Link>
            </div>
          )}
        </div>

        {/* Empty bottom spacer for balance since footer was removed */}
        <div className="h-6" />
      </div>

      {/* ── Right Column (50% Central Split Full-Bleed Photo Panel) ── */}
      <div className="hidden lg:relative lg:flex lg:w-1/2 min-h-screen overflow-hidden bg-[#edf5ff]">
        {/* The Photo covering the WHOLE right part */}
        <img
          src={personImage}
          alt="Portal Showcase"
          className="absolute inset-0 w-full h-full object-cover object-top select-none"
        />

        {/* Soft Vignette Gradient at Bottom for Minimal Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />

        {/* Minimal Content Overlay */}
        <div className="relative z-10 w-full h-full p-10 xl:p-14 flex flex-col justify-end text-white pointer-events-none">
          {/* Minimal Bottom Headline */}
          <div className="max-w-xl pb-2">
            <h2 className="text-3xl xl:text-4xl font-bold text-white tracking-tight leading-tight">
              {heroHeadline}
            </h2>
            {heroSubtitle && (
              <p className="text-sm xl:text-base font-normal text-white/85 mt-1.5 leading-relaxed">
                {heroSubtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
