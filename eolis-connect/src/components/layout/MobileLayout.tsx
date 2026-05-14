'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Globe, LogOut, WifiOff, CheckCircle, BookOpen, Wallet } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { clearSession, isTokenExpired, getUser, apiFetch } from '@/lib/api-client'
import { syncPending } from '@/lib/offline-sync'
import { offlineDb } from '@/lib/offline-db'

interface MobileLayoutProps {
  children: React.ReactNode
  locale: string
  title?: string
  showBack?: boolean
  showLogout?: boolean
  unreadCount?: number
  noPadding?: boolean
}

export function MobileLayout({
  children, locale, title,
  showBack = false, showLogout = false,
  unreadCount = 0, noPadding = false,
}: MobileLayoutProps) {
  const router      = useRouter()
  const otherLocale = locale === 'fr' ? 'en' : 'fr'
  const isFr        = locale === 'fr'

  const [isOffline, setIsOffline]       = useState(false)
  const [toast, setToast]               = useState<string | null>(null)
  const [liveUnread, setLiveUnread]     = useState(unreadCount)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function runSync() {
    const { sent, refs } = await syncPending()
    if (sent === 0) return
    const label = refs.length > 0 ? refs.join(', ') : `${sent}`
    showToast(isFr ? `✓ Envoyé — ${label}` : `✓ Sent — ${label}`)
  }

  useEffect(() => {
    const u = getUser()
    if (u?.role === 'CLIENT') {
      function fetchNotifCount() {
        apiFetch('/api/notifications')
          .then(r => r.json())
          .then(d => { if (Array.isArray(d)) setLiveUnread(d.filter((n: any) => !n.isRead).length) })
          .catch(() => {})
      }
      fetchNotifCount()
      const notifInterval = setInterval(fetchNotifCount, 30_000)
      return () => clearInterval(notifInterval)
    }
  }, [locale])

  useEffect(() => {
    // Periodic session check — auto-logout when token expires
    const sessionCheck = setInterval(() => {
      if (isTokenExpired()) {
        clearSession()
        window.location.href = `/${locale}/login`
      }
    }, 60_000)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Set initial online state
    setIsOffline(!navigator.onLine)

    // Check for pending actions on mount (app opened while online)
    if (navigator.onLine) {
      offlineDb.hasPending().then(has => { if (has) runSync() })
    }

    function handleOnline()  { setIsOffline(false); runSync() }
    function handleOffline() { setIsOffline(true) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      clearInterval(sessionCheck)
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [locale])

  function switchLocale() {
    router.push(window.location.pathname.replace(`/${locale}/`, `/${otherLocale}/`))
  }

  function logout() {
    clearSession()
    router.replace(`/${locale}/login`)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-[#0D1F33]/55" />
      </div>

      {/* Sync success toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-lg">
          <CheckCircle size={14} />
          {toast}
        </div>
      )}

      {/* Offline banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-[11px] font-semibold py-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <WifiOff size={11} />
          {isFr ? 'Hors-ligne — données depuis le cache' : 'Offline — showing cached data'}
        </div>
      )}

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 bg-white/15 backdrop-blur-md border-b border-white/10"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.15)', marginTop: isOffline ? '22px' : 0 }}
      >
        <div className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto">
          {showBack ? (
            <button onClick={() => router.back()}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors -ml-1">
              <ArrowLeft size={20} className="text-white" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Image src="/logo.png" alt="Eolis" width={22} height={22} className="object-contain" />
            </div>
          )}
          <h1 className="flex-1 text-[15px] font-semibold text-white truncate drop-shadow">
            {title ?? 'Eolis Connect'}
          </h1>
          <button onClick={switchLocale}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors">
            <Globe size={13} />
            {otherLocale.toUpperCase()}
          </button>
          {getUser()?.role === 'CLIENT' && (
            <button onClick={() => router.push(`/${locale}/depenses`)}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
              title={isFr ? 'Mes crédits' : 'My credits'}>
              <Wallet size={15} className="text-white" />
            </button>
          )}
          <button onClick={() => router.push(`/${locale}/aide`)}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
            title={isFr ? 'Aide' : 'Help'}>
            <BookOpen size={15} className="text-white" />
          </button>
          {showLogout && (
            <button onClick={logout}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20 hover:bg-red-500/70 transition-colors">
              <LogOut size={15} className="text-white" />
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className={`flex-1 overflow-y-auto pb-20 max-w-lg mx-auto w-full ${noPadding ? '' : 'px-4 py-4'}`}>
        {children}
      </main>

      <BottomNav locale={locale} unreadCount={liveUnread} />
    </div>
  )
}
