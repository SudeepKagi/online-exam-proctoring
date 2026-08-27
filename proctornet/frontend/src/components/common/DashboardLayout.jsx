import React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'

export default function DashboardLayout({ children, title = 'SYSTEM CONSOLE' }) {
  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col md:flex-row font-sans antialiased text-[#0f172a]">
      {/* Full-height Left Sidebar - Edge-to-Edge with zero outer gaps */}
      <AppSidebar />

      {/* Main Content Area - Full width and height */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        <SiteHeader title={title} />
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
