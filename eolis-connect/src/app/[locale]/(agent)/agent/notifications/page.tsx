'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUser, apiFetch } from '@/lib/api-client'
import { timeAgo } from '@/lib/utils'
import { Bell, CheckCheck, Inbox, ChevronRight } from 'lucide-react'

const TYPE_META: Record<string, { dot: string; badge: string; label_fr: string; label_en: string }> = {
  MENTION:          { dot: 'bg-purple-400',  badge: 'bg-purple-50 text-purple-600',  label_fr: 'Mention',           label_en: 'Mention'          },
  FINAL_UNREAD:     { dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-600',  label_fr: 'Réponse non lue',   label_en: 'Unread response'  },
  CLIENT_MSG_UNREAD:{ dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-600',    label_fr: 'Message en attente',label_en: 'Pending message'  },
  INTERNAL_NOTE:    { dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-600',      label_fr: 'Note interne',      label_en: 'Internal note'    },
  DOCS_SUBMITTED:   { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-600',label_fr: 'Documents reçus',   label_en: 'Docs received'    },
  NEW_MESSAGE:      { dot: 'bg-[#4A8FC4]',   badge: 'bg-blue-50 text-blue-600',      label_fr: 'Nouveau message',   label_en: 'New message'      },
}
const DEFAULT_META = { dot: 'bg-gray-300', badge: 'bg-gray-50 text-gray-500', label_fr: 'Notification', label_en: 'Notification' }

export default function StaffNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]           = useState('fr')
  const [user, setUser]               = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<'all' | 'unread'>('unread')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN', 'FINANCE_AGENT'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    apiFetch('/api/notifications').then(r => r.json()).then(data => {
      setNotifications(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [locale])

  if (loading || !user) return null

  const isFr = locale === 'fr'
  const unreadCount = notifications.filter(n => !n.isRead).length

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications

  async function markRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  async function markAllRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const T = {
    title:    isFr ? 'Mes notifications' : 'My notifications',
    all:      isFr ? 'Toutes' : 'All',
    unread:   isFr ? 'Non lues' : 'Unread',
    markAll:  isFr ? 'Tout marquer lu' : 'Mark all read',
    empty:    isFr ? 'Aucune notification' : 'No notifications',
    emptySub: isFr ? 'Vous êtes à jour !' : "You're all caught up!",
    view:     isFr ? 'Voir le dossier' : 'View ticket',
    unreadBadge: (n: number) => isFr ? `${n} non lue(s)` : `${n} unread`,
  }

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{T.title}</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
              {T.unreadBadge(unreadCount)}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
            <CheckCheck size={15} /> {T.markAll}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit mb-5">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-[#1B3A5C] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {f === 'all' ? T.all : T.unread}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow flex flex-col items-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{T.empty}</p>
          <p className="text-xs text-gray-400">{T.emptySub}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
          <div className="divide-y divide-gray-50">
            {displayed.map((n: any) => {
              const meta = TYPE_META[n.type] ?? DEFAULT_META
              const label = isFr ? meta.label_fr : meta.label_en
              const link = n.ticketId ? `/${locale}/agent/dossiers/${n.ticketId}` : null
              const content = (
                <div className={`flex items-start gap-4 px-5 py-4 transition-colors group ${!n.isRead ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                  {/* Dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${n.isRead ? 'bg-gray-200' : meta.dot}`} />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>{label}</span>
                      <span className="text-[10px] text-gray-300">{timeAgo(n.createdAt, locale)}</span>
                    </div>
                    <p className={`text-sm leading-snug ${n.isRead ? 'text-gray-500 font-normal' : 'text-gray-900 font-semibold'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                  {/* Arrow */}
                  {link && (
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                  )}
                </div>
              )

              if (link) {
                return (
                  <Link key={n.id} href={link}
                    onClick={() => { if (!n.isRead) markRead(n.id) }}>
                    {content}
                  </Link>
                )
              }
              return <div key={n.id}>{content}</div>
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
