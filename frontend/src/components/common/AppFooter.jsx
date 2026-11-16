import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ExternalLink, HelpCircle } from 'lucide-react'

export default function AppFooter({ className = '' }) {
  const gitCommit =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GIT_COMMIT) ||
    'v1.0.0'
  const supportEmail =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL) ||
    'support@proctornet.org'

  return (
    <footer
      className={`bg-white py-10 px-6 sm:px-8 text-xs text-[#554e7b] font-sans border-t border-[#c3c3cc]/20 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-xs">
            P
          </div>
          <div>
            <span className="font-[480] text-[#28253b] tracking-wide">
              Proctor<span className="text-[#5266eb]">Net</span>
            </span>
            <span className="ml-2 text-[10px] font-[500] uppercase tracking-wider text-[#554e7b] bg-[#edecfb] px-2 py-0.5 rounded-full">
              Enterprise
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#554e7b] ml-1 bg-[#fbfbff] px-2 py-0.5 rounded-[40px]">
            {gitCommit.slice(0, 7)}
          </span>
        </div>

        <div className="text-[12px] text-[#554e7b] text-center md:text-left font-[360]">
          © {new Date().getFullYear()} ProctorNet Examination Systems. Institutional Assessment Runtime.
        </div>

        <div className="flex items-center gap-5 text-xs font-[420]">
          <Link
            to="/privacy"
            className="text-[#554e7b] hover:text-[#5266eb] transition-colors flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Privacy & Data Map
          </Link>
          <a
            href={`mailto:${supportEmail}`}
            className="text-[#554e7b] hover:text-[#5266eb] transition-colors flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#554e7b]" /> Support
          </a>
          <Link
            to="/login"
            className="text-[#5266eb] hover:underline font-[480] transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    </footer>
  )
}
