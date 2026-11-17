import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Home, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppFooter from '@/components/common/AppFooter'
import { usePageTitle } from '@/hooks/usePageTitle'
import COPY from '@/copy'

export default function NotFoundPage() {
  usePageTitle('Page Not Found')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] font-sans antialiased flex flex-col justify-between">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#c3c3cc]/20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-[480]">
              P
            </div>
            <div>
              <span className="text-base font-[480] tracking-wide text-[#28253b]">
                Proctor<span className="text-[#5266eb]">Net</span>
              </span>
              <span className="block text-[10px] font-[500] text-[#554e7b] uppercase tracking-widest -mt-1">
                Enterprise
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="px-4 h-9 rounded-[32px] text-xs font-[420] text-[#28253b] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#5266eb]" /> Go Back
          </Button>
        </div>
      </header>

      {/* Main 404 Display */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[20px] p-8 sm:p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mx-auto mb-4">
            <Compass className="w-7 h-7" />
          </div>

          <span className="text-xs font-mono font-[500] text-[#5266eb] bg-[#edecfb] px-3 py-1 rounded-full uppercase tracking-wider">
            Error 404
          </span>

          <h1 className="text-2xl font-[480] text-[#28253b] mt-4 tracking-tight">
            {COPY.errors.pageNotFoundTitle}
          </h1>

          <p className="text-xs text-[#554e7b] font-[360] mt-2 mb-8 leading-relaxed max-w-sm mx-auto">
            {COPY.errors.pageNotFoundSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              className="w-full sm:w-auto h-10 px-6 cursor-pointer"
            >
              <Link to="/">
                <Home className="w-3.5 h-3.5 mr-1.5" /> Return to Home
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto h-10 px-5 text-xs font-[420] rounded-[40px] border-0 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] cursor-pointer"
            >
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  )
}
