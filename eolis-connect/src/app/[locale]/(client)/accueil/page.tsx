'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { FileText, PlusCircle, ChevronRight, Inbox, RefreshCw } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'
import { timeAgo } from '@/lib/utils'

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  TREATED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

const statusLabels: Record<string, Record<string, string>> = {
  PENDING: { fr: 'En attente', en: 'Pending' },
  IN_PROGRESS: { fr: 'En cours', en: 'In progress' },
  TREATED: { fr: 'Traité', en: 'Treated' },
  CLOSED: { fr: 'Clôturé', en: 'Closed' },
}

export default function AccueilPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  const loadData = useCallback((silent = false) => {
    if (!silent) setRefreshing(true)
    Promise.all([
      apiFetch('/api/tickets').then(r => r.json()),
      apiFetch('/api/notifications').then(r => r.json()),
    ]).then(([tks, notifs]) => {
      setTickets(Array.isArray(tks) ? tks : [])
      const unread = Array.isArray(notifs) ? notifs.filter((n: any) => !n.isRead).length : 0
      setUnreadCount(unread)
      setLoading(false)
    }).catch(() => setLoading(false))
      .finally(() => setRefreshing(false))
  }, [])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
    loadData()
    window.addEventListener('eolis-sync-done', () => loadData())
    return () => window.removeEventListener('eolis-sync-done', () => loadData())
  }, [locale, loadData])

  useEffect(() => {
    const refreshIv = setInterval(() => { loadData(true); setCountdown(30) }, 30000)
    const countIv   = setInterval(() => setCountdown(p => p > 0 ? p - 1 : 30), 1000)
    return () => { clearInterval(refreshIv); clearInterval(countIv) }
  }, [loadData])

  if (loading || !user) return null

  const isFr = locale === 'fr'
  const pending = tickets.filter(t => t.status === 'PENDING').length
  const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length
  const treated = tickets.filter(t => t.status === 'TREATED' || t.status === 'CLOSED').length
  const recent = tickets.slice(0, 5)

  const t = {
    welcome: isFr ? 'Bonjour' : 'Hello',
    sub: isFr ? 'Voici vos demandes récentes' : 'Here are your recent requests',
    total: isFr ? 'Total' : 'Total',
    pending: isFr ? 'En attente' : 'Pending',
    inProgress: isFr ? 'En cours' : 'In progress',
    treated: isFr ? 'Traités' : 'Treated',
    recent: isFr ? 'Activité récente' : 'Recent activity',
    viewAll: isFr ? 'Tout voir' : 'View all',
    newRequest: isFr ? 'Nouvelle demande' : 'New request',
    empty: isFr ? 'Aucune demande pour l\'instant' : 'No requests yet',
    emptySub: isFr ? 'Créez votre première demande' : 'Create your first request',
  }

  const circumference = 2 * Math.PI * 12

  return (
    <MobileLayout locale={locale} title={`${t.welcome}, ${user.firstName}`} unreadCount={unreadCount} showLogout>
      {/* Auto-refresh bar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-xs text-gray-400">{isFr ? 'Actualisation automatique' : 'Auto-refresh'}</p>
        <div className="flex items-center gap-2">
          <svg width="28" height="28" className="-rotate-90">
            <circle cx="14" cy="14" r="12" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="12" fill="none" stroke="#4A8FC4" strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - countdown / 30)} />
          </svg>
          <button onClick={() => { loadData(); setCountdown(30) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-600 active:bg-gray-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {isFr ? 'Actualiser' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: t.pending, value: pending, color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
          { label: t.inProgress, value: inProgress, color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
          { label: t.treated, value: treated, color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-3 ${s.color}`}>
            <div className={`w-2 h-2 rounded-full ${s.dot} mb-2`} />
            <p className="text-2xl font-bold leading-none mb-1">{s.value}</p>
            <p className="text-[11px] font-medium opacity-80 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* New request CTA */}
      <Link href={`/${locale}/nouvelle-demande`}
        className="flex items-center justify-between w-full bg-[#1B3A5C] text-white rounded-2xl px-5 py-4 mb-5 shadow-lg active:scale-[0.98] transition-transform">
        <div>
          <p className="font-bold text-base">{t.newRequest}</p>
          <p className="text-xs text-blue-200 mt-0.5">
            {isFr ? 'Soumettez une nouvelle demande' : 'Submit a new request'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <PlusCircle size={22} className="text-white" />
        </div>
      </Link>

      {/* Recent tickets */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{t.recent}</h2>
        <Link href={`/${locale}/mes-demandes`}
          className="flex items-center gap-1 text-xs text-[#4A8FC4] font-medium">
          {t.viewAll} <ChevronRight size={13} />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t.empty}</p>
          <p className="text-xs text-gray-400">{t.emptySub}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((ticket: any) => (
            <Link key={ticket.id} href={`/${locale}/mes-demandes/${ticket.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100 active:scale-[0.99] transition-transform">
              <div className="w-10 h-10 rounded-xl bg-[#1B3A5C]/8 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-[#1B3A5C]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {ticket.category}{ticket.subcategory ? ` — ${ticket.subcategory}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(ticket.createdAt, locale)}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusColors[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {statusLabels[ticket.status]?.[locale] ?? ticket.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </MobileLayout>
  )
}
