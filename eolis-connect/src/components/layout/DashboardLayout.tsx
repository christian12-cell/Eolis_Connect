'use client'

import { useState } from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

interface DashboardLayoutProps {
  children: React.ReactNode
  locale: string
  userName: string
  role: string
}

export function DashboardLayout({ children, locale, userName, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <OfflineBanner />
      <Navbar
        locale={locale}
        userName={userName}
        role={role}
        onMenuToggle={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          locale={locale}
          role={role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main
          className="flex-1 overflow-y-auto bg-cover bg-center"
          style={{ backgroundImage: 'url(/bg-auth.jpg)', backgroundAttachment: 'fixed' }}
        >
          <div className="min-h-full bg-[#0D1F33]/78">
            <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
