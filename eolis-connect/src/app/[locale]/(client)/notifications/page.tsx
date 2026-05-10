'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { Bell, ChevronRight, CheckCheck, Inbox } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'
import { timeAgo } from '@/lib/utils'

const TYPE_STYLE: Record<string, string> = {
  NEW_MESSAGE:      'bg-blue-50 text-blue-600',
  TICKET_UPDATED:   'bg-amber-50 text-amber-600',
  TICKET_CLOSED:    'bg-emerald-50 text-emerald-600',
  TICKET_ASSIGNED:  'bg-purple-50 text-purple-600',
}
const TYPE_DOT: Record<string, string> = {
  NEW_MESSAGE:      'bg-blue-400',
  TICKET_UPDATED:   'bg-amber-400',
  TICKET_CLOSED:    'bg-emerald-400',
  TICKET_ASSIGNED:  'bg-purple-400',
}

export default function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
    apiFetch('/api/notifications').then(r => r.json()).then(data => {
      setNotifications(Array.isArray(data) ? data : [])
      setLoading(false)
      // Mark all as read silently
      apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    }).catch(() => setLoading(false))
  }, [locale])

  if (loading || !user) return null

  const isFr = locale === 'fr'
  const unread = notifications.filter(n => !n.isRead).length

  const t = {
    title: isFr ? 'Notifications' : 'Notifications',
    markAll: isFr ? 'Tout lire' : 'Mark all read',
    empty: isFr ? 'Aucune notification' : 'No notifications',
    emptySub: isFr ? 'Vous êtes à jour !' : 'You\'re all caught up!',
  }

  async function markAllRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  return (
    <MobileLayout locale={locale} title={t.title} unreadCount={0}>
      {/* Header action */}
      {unread > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400 font-medium">
            {unread} {isFr ? 'non lue(s)' : 'unread'}
          </p>
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold">
            <CheckCheck size={13} /> {t.markAll}
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t.empty}</p>
          <p className="text-xs text-gray-400">{t.emptySub}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif: any) => (
            <div key={notif.id}
              className={`flex items-start gap-3 bg-white rounded-2xl px-4 py-3.5 border transition-opacity ${
                notif.isRead ? 'border-gray-100 opacity-70' : 'border-[#1B3A5C]/10 shadow-sm'
              }`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${
                notif.isRead ? 'bg-gray-200' : (TYPE_DOT[notif.type] ?? 'bg-gray-400')
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${notif.isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                  {notif.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{notif.message}</p>
                <p className="text-[10px] text-gray-300 mt-1">{timeAgo(notif.createdAt, locale)}</p>
              </div>
              {notif.ticketId && (
                <Link href={`/${locale}/mes-demandes/${notif.ticketId}`}
                  className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <ChevronRight size={15} className="text-gray-400" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </MobileLayout>
  )
}
