'use client'

import { useState, useEffect } from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { isTokenExpired, clearSession } from '@/lib/api-client'

interface DashboardLayoutProps {
  children: React.ReactNode
  locale: string
  userName?: string
  role: string
}

export function DashboardLayout({ children, locale, userName = '', role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accountDeleted, setAccountDeleted] = useState(false)
  const isFr = locale === 'fr'

  useEffect(() => {
    const sessionCheck = setInterval(() => {
      if (isTokenExpired()) {
        clearSession()
        window.location.href = `/${locale}/login`
      }
    }, 60_000)
    return () => clearInterval(sessionCheck)
  }, [locale])

  useEffect(() => {
    const handler = () => setAccountDeleted(true)
    window.addEventListener('eolis:account_deleted', handler)
    return () => window.removeEventListener('eolis:account_deleted', handler)
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <OfflineBanner />

      {accountDeleted && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-5xl mb-4">🚫</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {isFr ? 'Compte supprimé' : 'Account deleted'}
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {isFr
                ? 'Votre compte a été supprimé par un administrateur.'
                : 'Your account has been deleted by an administrator.'}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {isFr
                ? 'Vous avez reçu un email et un SMS de confirmation.'
                : 'You have received a confirmation email and SMS.'}
            </p>
            <p className="text-xs text-gray-400 mb-5">
              {isFr
                ? 'Pour toute question, contactez notre support.'
                : 'For any questions, contact our support.'}
            </p>
            <button
              onClick={() => { window.location.href = `/${locale}/login` }}
              className="w-full py-3 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm">
              OK
            </button>
          </div>
        </div>
      )}
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
