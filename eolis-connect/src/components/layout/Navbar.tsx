'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clearSession, apiFetch } from '@/lib/api-client'
import { Bell, ChevronDown, LogOut, Settings, Menu, Globe, Check } from 'lucide-react'

const roleLabels: Record<string, Record<string, string>> = {
  CLIENT:       { fr: 'Client',         en: 'Client'        },
  AGENT:        { fr: 'Agent',           en: 'Agent'         },
  OPS_ADMIN:    { fr: 'Admin Ops',       en: 'Ops Admin'     },
  SYSTEM_ADMIN: { fr: 'Administrateur',  en: 'Administrator' },
}
const roleColors: Record<string, string> = {
  CLIENT:       'bg-[#4A8FC4]/10 text-[#4A8FC4]',
  AGENT:        'bg-[#1B3A5C]/10 text-[#1B3A5C]',
  OPS_ADMIN:    'bg-[#8B5A2B]/10 text-[#8B5A2B]',
  SYSTEM_ADMIN: 'bg-red-100 text-red-600',
}

interface NavbarProps {
  locale: string
  userName: string
  role: string
  onMenuToggle?: () => void
}

export function Navbar({ locale, userName, role, onMenuToggle }: NavbarProps) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen]       = useState(false)
  const [notifs, setNotifs]             = useState<any[]>([])
  const [unreadCount, setUnreadCount]   = useState(0)
  const dropRef  = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current  && !dropRef.current.contains(e.target as Node))  setDropdownOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Fetch unread count every 15s
  useEffect(() => {
    function fetchCount() {
      apiFetch('/api/notifications').then(r => r.json()).then((data: any[]) => {
        if (Array.isArray(data)) setUnreadCount(data.filter(n => !n.isRead).length)
      }).catch(() => {})
    }
    fetchCount()
    const iv = setInterval(fetchCount, 15000)
    return () => clearInterval(iv)
  }, [])

  const otherLocale = locale === 'fr' ? 'en' : 'fr'
  function switchLocale() {
    router.push(window.location.pathname.replace(`/${locale}/`, `/${otherLocale}/`))
  }

  const settingsPath = ['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(role)
    ? `/${locale}/agent/parametres`
    : `/${locale}/parametres`

  const isStaff = ['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(role)

  function dossierLink(n: any): string {
    if (!n.ticketId) return '#'
    return isStaff
      ? `/${locale}/agent/dossiers/${n.ticketId}`
      : `/${locale}/mes-demandes/${n.ticketId}`
  }

  async function openNotifs() {
    const opening = !notifOpen
    setNotifOpen(opening)
    setDropdownOpen(false)
    if (!opening) return
    try {
      const res = await apiFetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setNotifs(data.slice(0, 30))
          setUnreadCount(data.filter((n: any) => !n.isRead).length)
        }
      }
    } catch {}
  }

  async function markRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const T = {
    fr: { settings: 'Paramètres', logout: 'Se déconnecter', notifications: 'Notifications', noNotif: 'Aucune notification', markAll: 'Tout marquer lu' },
    en: { settings: 'Settings',   logout: 'Log out',        notifications: 'Notifications', noNotif: 'No notifications',    markAll: 'Mark all read'  },
  }
  const t = T[locale as keyof typeof T] ?? T.fr

  const unreadNotifs = notifs.filter(n => !n.isRead)

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-40 card-shadow">
      {/* Mobile hamburger */}
      <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
        <Menu size={20} />
      </button>

      {/* Logo */}
      <Link href={`/${locale}/accueil`} className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#1B3A5C]/10 flex items-center justify-center">
          <Image src="/logo.png" alt="Eolis" width={28} height={28} className="object-contain" />
        </div>
        <span className="font-bold text-[#1B3A5C] text-base hidden sm:block">Eolis Connect</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Language switcher */}
        <button onClick={switchLocale}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-sm font-medium transition-colors"
          title={otherLocale === 'fr' ? 'Passer en Français' : 'Switch to English'}>
          <Globe size={16} />
          <span className="hidden sm:block uppercase text-xs">{otherLocale}</span>
        </button>

        {/* Notifications bell */}
        <div ref={notifRef} className="relative">
          <button onClick={openNotifs}
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl card-shadow border border-gray-100 z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {t.notifications}
                  {unreadCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{unreadCount}</span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="text-[11px] text-[#4A8FC4] hover:text-[#1B3A5C] font-medium flex items-center gap-1">
                    <Check size={11} /> {t.markAll}
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {unreadNotifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">{t.noNotif}</div>
                ) : (
                  unreadNotifs.map(n => (
                    <Link key={n.id} href={dossierLink(n)}
                      onClick={() => { markRead(n.id); setNotifOpen(false) }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50 bg-blue-50/30 transition-colors border-b border-gray-50 last:border-0">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-[#4A8FC4]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        {n.createdAt && (
                          <p className="text-[10px] text-gray-300 mt-1">
                            {new Date(n.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div ref={dropRef} className="relative">
          <button onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-8 h-8 rounded-full bg-[#1B3A5C] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-semibold text-gray-900 leading-tight">{userName}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-tight ${roleColors[role] ?? 'bg-gray-100 text-gray-500'}`}>
                {roleLabels[role]?.[locale] ?? role}
              </span>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl card-shadow border border-gray-100 py-1.5 z-50">
              <Link href={settingsPath} onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Settings size={16} className="text-gray-400" /> {t.settings}
              </Link>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { clearSession(); router.push(`/${locale}/login`) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <LogOut size={16} /> {t.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
