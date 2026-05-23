'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { Bell, ChevronRight, CheckCheck, Inbox } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'
import { timeAgo } from '@/lib/utils'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'

const TYPE_DOT: Record<string, string> = {
  NEW_MESSAGE:        'bg-blue-400',
  TICKET_UPDATED:     'bg-amber-400',
  TICKET_CLOSED:      'bg-emerald-400',
  TICKET_ASSIGNED:    'bg-purple-400',
  FINAL_RESPONSE:     'bg-emerald-400',
  DOCUMENT_REQUEST:   'bg-orange-400',
  DOCS_SUBMITTED:     'bg-blue-400',
  CREDITS_ADDED:      'bg-emerald-400',
  CREDITS_REJECTED:   'bg-red-400',
  CREDIT_REQUEST_NEW: 'bg-amber-400',
}

function pick(text: string, isFr: boolean): string {
  if (!text) return text
  const parts = text.split('|||')
  return isFr ? parts[0] : (parts[1] ?? parts[0])
}

function inRange(dateStr: string, range: DateRange | null): boolean {
  if (!range) return true
  const d = dateStr.slice(0, 10)
  return d >= range.from && d <= range.to
}

function NotifCard({ notif, locale, isFr }: { notif: any; locale: string; isFr: boolean }) {
  return (
    <div className={`flex items-start gap-3 bg-white rounded-2xl px-4 py-3.5 border transition-opacity ${
      notif.isRead ? 'border-gray-100 opacity-60' : 'border-[#1B3A5C]/10 shadow-sm'
    }`}>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${
        notif.isRead ? 'bg-gray-200' : (TYPE_DOT[notif.type] ?? 'bg-gray-400')
      }`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${notif.isRead ? 'text-gray-500' : 'text-gray-900'}`}>
          {pick(notif.title, isFr)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{pick(notif.message, isFr)}</p>
        <p className="text-[10px] text-gray-300 mt-1">{timeAgo(notif.createdAt, locale)}</p>
      </div>
      {notif.ticketId && (
        <Link href={`/${locale}/mes-demandes/${notif.ticketId}`}
          className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <ChevronRight size={15} className="text-gray-400" />
        </Link>
      )}
    </div>
  )
}

export default function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]           = useState('fr')
  const [user, setUser]               = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [range, setRange]             = useState<DateRange | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
    apiFetch('/api/notifications').then(r => r.json()).then(data => {
      setNotifications(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [locale])

  const handlePeriod = useCallback((r: DateRange | null) => setRange(r), [])

  if (loading || !user) return null

  const isFr = locale === 'fr'

  function markAllRead() {
    apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const filtered  = notifications.filter(n => inRange(n.createdAt, range))
  const unread    = filtered.filter(n => !n.isRead)
  const read      = filtered.filter(n => n.isRead)
  const totalUnread = notifications.filter(n => !n.isRead).length

  return (
    <MobileLayout locale={locale} title={isFr ? 'Notifications' : 'Notifications'} unreadCount={0}>

      {/* Filters row */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <PeriodFilter onChange={handlePeriod} isFr={isFr} dark={false} />
        {totalUnread > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold flex-shrink-0">
            <CheckCheck size={13} /> {isFr ? 'Tout lire' : 'Mark all read'}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">
            {isFr ? 'Aucune notification' : 'No notifications'}
          </p>
          <p className="text-xs text-gray-400">
            {isFr ? 'Vous êtes à jour !' : 'You\'re all caught up!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Non lues ── */}
          {unread.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={13} className="text-[#1B3A5C]" />
                <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wide">
                  {isFr ? 'Non lues' : 'Unread'} ({unread.length})
                </p>
              </div>
              <div className="space-y-2">
                {unread.map(n => <NotifCard key={n.id} notif={n} locale={locale} isFr={isFr} />)}
              </div>
            </div>
          )}

          {/* ── Lues ── */}
          {read.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCheck size={13} className="text-gray-400" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  {isFr ? 'Lues' : 'Read'} ({read.length})
                </p>
              </div>
              <div className="space-y-2">
                {read.map(n => <NotifCard key={n.id} notif={n} locale={locale} isFr={isFr} />)}
              </div>
            </div>
          )}

        </div>
      )}
    </MobileLayout>
  )
}
