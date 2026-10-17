import React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'

/**
 * DashboardShell Layout
 * Standard container for Admin, Faculty, and Invigilator dashboard views.
 * Adheres strictly to the UI/UX Constitution:
 * - Canvas: bg-slate-50
 * - Surface: bg-white
 * - Sidebar: bg-slate-900
 * - Border: border-slate-200
 */
export default function DashboardShell({ children, title = 'SYSTEM CONSOLE' }) {
  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col md:flex-row font-sans antialiased text-slate-900">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
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

export { DashboardShell }
