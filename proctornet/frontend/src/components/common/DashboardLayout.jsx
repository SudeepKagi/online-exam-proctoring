import React from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'

export default function DashboardLayout({ children, title = 'SYSTEM CONSOLE' }) {
  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 64)",
        "--header-height": "calc(var(--spacing) * 13)",
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col bg-[#09090B] px-4 lg:px-6 py-4 md:py-6 gap-5">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
