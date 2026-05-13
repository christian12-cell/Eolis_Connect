'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge, UrgencyBadge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/card'
import { timeAgo, startOfTodayWAT } from '@/lib/utils'
import { AlertTriangle, FileText, Clock, CheckCircle, Search, RefreshCw } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'

const URGENCY_PRIORITY: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default function AgentDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [allTickets, setAllTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(60)
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [search, setSearch] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [data] = await Promise.all([
        apiFetch('/api/tickets').then(r => r.json()),
        apiFetch('/api/notifications/check-final-unread', { method: 'POST' }).catch(() => {}),
      ])
      if (Array.isArray(data)) setAllTickets(data)
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    loadTickets(false)

    // Auto-refresh every 60s
    intervalRef.current = setInterval(() => {
      loadTickets(true)
      setCountdown(60)
    }, 60_000)

    // Countdown tick every second
    setCountdown(60)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 60 : prev - 1))
    }, 1_000)

    return () => {
      if (intervalRef.current)   clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [locale, loadTickets])

  const active = allTickets.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS')

  let filtered = active
  if (urgencyFilter) filtered = filtered.filter(t => t.urgency === urgencyFilter)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(t =>
      t.ref.toLowerCase().includes(q) ||
      `${t.client?.firstName ?? ''} ${t.client?.lastName ?? ''}`.toLowerCase().includes(q)
    )
  }
  filtered = [...filtered].sort((a, b) => (URGENCY_PRIORITY[a.urgency] ?? 2) - (URGENCY_PRIORITY[b.urgency] ?? 2))

  const todayStart = startOfTodayWAT()
  const pendingCount    = allTickets.filter(t => t.status === 'PENDING').length
  const inProgressCount = allTickets.filter(t => t.status === 'IN_PROGRESS').length
  const todayTreated    = allTickets.filter(t => {
    if (t.status !== 'TREATED' && t.status !== 'CLOSED') return false
    const raw = t.closedAt ?? t.updatedAt
    if (!raw) return false
    const ts = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? new Date(raw) : new Date(raw + 'Z')
    return ts.getTime() >= todayStart
  }).length

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const warningCount = filtered.filter(t => {
    const msgs: any[] = t.messages ?? []
    const lastMsg = msgs[msgs.length - 1]
    return lastMsg && !lastMsg.isRead && new Date(lastMsg.createdAt) < oneHourAgo
  }).length

  const urgencyDot: Record<string, string> = { HIGH: 'bg-red-500', MEDIUM: 'bg-amber-400', LOW: 'bg-emerald-500' }

  const t = {
    fr: {
      title: 'Tableau de bord Agent',
      new: 'Nouveaux', inProgress: "En cours", treated: "Traités aujourd'hui",
      queue: 'File de dossiers', ref: 'Réf.', client: 'Client', category: 'Catégorie',
      urgency: 'Urgence', status: 'Statut', timeAgo: 'Soumis', viewDossier: 'Voir',
      filterAll: 'Tout', filterHigh: 'Élevée', filterMedium: 'Moyenne', filterLow: 'Faible',
      warningBanner: "dossier(s) avec message non lu depuis +1h.", noTickets: 'Aucun dossier en attente',
      searchPlaceholder: 'Rechercher par réf. ou client...',
    },
    en: {
      title: 'Agent Dashboard',
      new: 'New', inProgress: 'In progress', treated: 'Treated today',
      queue: 'Ticket queue', ref: 'Ref.', client: 'Client', category: 'Category',
      urgency: 'Urgency', status: 'Status', timeAgo: 'Submitted', viewDossier: 'View',
      filterAll: 'All', filterHigh: 'High', filterMedium: 'Medium', filterLow: 'Low',
      warningBanner: 'ticket(s) with unread message for 1h+.', noTickets: 'No pending tickets',
      searchPlaceholder: 'Search by ref. or client...',
    },
  }
  const tx = t[locale as keyof typeof t] ?? t.fr

  if (loading || !user) return null

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{tx.title}</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title={tx.new} value={pendingCount} icon={<FileText size={20} />} color="warning" />
        <StatCard title={tx.inProgress} value={inProgressCount} icon={<Clock size={20} />} color="blue" />
        <StatCard title={tx.treated} value={todayTreated} icon={<CheckCircle size={20} />} color="success" />
      </div>

      {warningCount > 0 && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <p className="text-sm font-medium"><span className="font-bold">{warningCount}</span> {tx.warningBanner}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {[
            { val: '', label: tx.filterAll }, { val: 'HIGH', label: tx.filterHigh },
            { val: 'MEDIUM', label: tx.filterMedium }, { val: 'LOW', label: tx.filterLow },
          ].map(opt => (
            <button key={opt.val} onClick={() => setUrgencyFilter(opt.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${urgencyFilter === opt.val ? 'bg-[#1B3A5C] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-48 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tx.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">
            {tx.queue} <span className="text-gray-400 font-normal text-sm">({filtered.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-gray-400 hidden sm:block">
                {locale === 'fr' ? 'Mis à jour' : 'Updated'} {timeAgo(lastRefresh, locale)}
              </span>
            )}
            {/* Countdown ring */}
            <div className="relative flex items-center justify-center" title={`${locale === 'fr' ? 'Actualisation dans' : 'Refresh in'} ${countdown}s`}>
              <svg width="32" height="32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                <circle cx="16" cy="16" r="12" fill="none" stroke="#4A8FC4" strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - countdown / 60)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
              </svg>
              <span className="absolute text-[9px] font-bold text-gray-500 tabular-nums">{countdown}</span>
            </div>
            <button
              onClick={() => { loadTickets(true); setCountdown(60) }}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-50">
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {locale === 'fr' ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <CheckCircle size={32} className="text-gray-300 mb-3" />
            <p className="text-gray-500">{tx.noTickets}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">{tx.urgency}</th>
                  <th className="px-3 py-3 text-left">{tx.ref}</th>
                  <th className="px-3 py-3 text-left">{tx.client} / Langue</th>
                  <th className="px-3 py-3 text-left">{tx.category}</th>
                  <th className="px-3 py-3 text-left">{tx.status}</th>
                  <th className="px-3 py-3 text-left">{tx.timeAgo}</th>
                  <th className="px-3 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((ticket: any) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3"><div className={`w-3 h-3 rounded-full ${urgencyDot[ticket.urgency] ?? 'bg-gray-300'}`} /></td>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-gray-500">{ticket.ref}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{ticket.client?.firstName} {ticket.client?.lastName}</p>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                        ticket.client?.language === 'en'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ticket.client?.language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600 max-w-32">
                      <p className="truncate">{ticket.category}</p>
                      <p className="text-xs text-gray-400 truncate">{ticket.subcategory}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={ticket.status} locale={locale} /></td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{timeAgo(ticket.createdAt, locale)}</td>
                    <td className="px-3 py-3">
                      {(() => {
                        const takenByOther = ticket.agentId && ticket.agentId !== user.id
                        const isAgentRole  = user.role === 'AGENT'
                        const disabled     = isAgentRole && takenByOther
                        return disabled ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-xs font-semibold cursor-not-allowed whitespace-nowrap">
                            {tx.viewDossier}
                          </span>
                        ) : (
                          <Link href={`/${locale}/agent/dossiers/${ticket.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3A5C]/5 text-[#1B3A5C] text-xs font-semibold hover:bg-[#1B3A5C]/10 transition-colors whitespace-nowrap">
                            {tx.viewDossier}
                          </Link>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
