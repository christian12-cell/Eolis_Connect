'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUser, apiFetch } from '@/lib/api-client'
import {
  Trophy, Medal, Star, Zap, Target, TrendingUp, TrendingDown,
  Minus, ChevronDown, X, BarChart2,
} from 'lucide-react'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SLA_HOURS: Record<string, number> = { HIGH: 3, MEDIUM: 5, LOW: 10 }
const SLA_CAP = 24

function fmtH(h: number | null): string {
  if (h === null || isNaN(h)) return '—'
  if (h < 1) return `${Math.round(h * 60)}min`
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60)
  return mn > 0 ? `${hr}h ${mn}min` : `${hr}h`
}

function getFirstResponseH(ticket: any): number | null {
  const msgs: any[] = ticket.messages ?? []
  const first = msgs.find(m => !['CLIENT','INTERNAL_NOTE','DOCS_SUBMITTED','SYSTEM'].includes(m.senderType))
  if (!first) return null
  const h = (new Date(first.createdAt).getTime() - new Date(ticket.createdAt).getTime()) / 3600000
  return isNaN(h) || !isFinite(h) || h < 0 ? null : +h.toFixed(2)
}

// ── MultiSelect ────────────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onToggle, onClear, isFr }: {
  label: string; options: { value: number | string; label: string }[]
  selected: (number | string)[]; onToggle: (v: number | string) => void
  onClear: () => void; isFr: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn)
  }, [])
  function toggle() {
    if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }) }
    setOpen(o => !o)
  }
  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${selected.length > 0 ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
        {label}{selected.length > 0 && ` (${selected.length})`}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg min-w-[170px] py-1.5 max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <button onClick={() => { onClear(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100 mb-1">
              <X size={11} /> {isFr ? 'Effacer' : 'Clear'}
            </button>
          )}
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" className="rounded accent-[#1B3A5C]" checked={selected.includes(opt.value)} onChange={() => onToggle(opt.value)} />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Agent stat computation ─────────────────────────────────────────────────
function computeAgentStats(agentId: string, closedSrc: any[], allTickets: any[]) {
  const treated = closedSrc.filter(t => t.agentId === agentId)
  if (!treated.length) return null

  const scores   = treated.filter(t => t.satisfactionRating?.score).map(t => t.satisfactionRating.score)
  const avgSat   = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null

  const times    = treated.filter(t => t.closedAt ?? t.updatedAt)
    .map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
    .filter(h => !isNaN(h) && isFinite(h) && h >= 0)
  const avgTime  = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null

  const firstR   = allTickets.filter(t => t.agentId === agentId).map(getFirstResponseH).filter(h => h !== null) as number[]
  const avgFirstR = firstR.length ? firstR.reduce((a, b) => a + b, 0) / firstR.length : null

  const slaRows  = ['HIGH','MEDIUM','LOW'].map(u => {
    const uts = treated.filter(t => t.urgency === u && (t.closedAt ?? t.updatedAt))
    const ok  = uts.filter(t => {
      const h = (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000
      return h <= SLA_HOURS[u]
    }).length
    return { total: uts.length, ok }
  })
  const totalSla = slaRows.reduce((s, r) => s + r.total, 0)
  const okSla    = slaRows.reduce((s, r) => s + r.ok, 0)
  const slaGlobal = totalSla ? Math.round(okSla / totalSla * 100) : null

  // composite 0-100 : satisfaction (50%) + vitesse vs plafond 24h (50%)
  const satScore   = avgSat  !== null ? (avgSat / 5) * 100 : null
  const speedScore = avgTime !== null ? Math.max(0, 100 - (avgTime / SLA_CAP) * 100) : null
  const composite  = satScore !== null || speedScore !== null
    ? +((satScore ?? 50) * 0.5 + (speedScore ?? 50) * 0.5).toFixed(2) : null

  return { count: treated.length, avgSat, avgTime, avgFirstR, slaGlobal, composite }
}

export default function ClassementPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]         = useState('fr')
  const [user, setUser]             = useState<any>(null)
  const [tickets, setTickets]       = useState<any[]>([])
  const [agents, setAgents]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [yearFilter, setYearFilter]   = useState<number[]>([])
  const [monthFilter, setMonthFilter] = useState<number[]>([])
  const [dayFilter, setDayFilter]     = useState<number[]>([])
  const [urgencyFilter, setUrgencyFilter]   = useState<string[]>([])
  const [expandedBadge, setExpandedBadge]   = useState<string | null>(null)
  const [expandedStrip, setExpandedStrip]   = useState<string | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['OPS_ADMIN','SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    Promise.all([
      apiFetch('/api/tickets').then(r => r.json()),
      apiFetch('/api/users').then(r => r.json()),
    ]).then(([tks, usrs]) => {
      setTickets(Array.isArray(tks) ? tks : [])
      setAgents(Array.isArray(usrs) ? usrs.filter((u: any) => u.role === 'AGENT') : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [locale])

  if (loading || !user) return null

  const isFr   = locale === 'fr'
  const MONTHS = isFr ? MONTHS_FR : MONTHS_EN
  const now    = new Date()

  const hasFilter = !!(yearFilter.length || monthFilter.length || dayFilter.length || urgencyFilter.length)
  const closedAll = tickets.filter(t => t.status === 'TREATED' || t.status === 'CLOSED')

  // ── Filter helper ────────────────────────────────────────────────────────
  function filterByDate(src: any[], key: 'createdAt' | 'closed'): any[] {
    if (!hasFilter) return src
    return src.filter(t => {
      const raw = key === 'closed' ? (t.closedAt ?? t.updatedAt) : t.createdAt
      if (!raw) return false
      const d = new Date(raw)
      if (yearFilter.length  && !yearFilter.includes(d.getFullYear())) return false
      if (monthFilter.length && !monthFilter.includes(d.getMonth() + 1)) return false
      if (dayFilter.length   && !dayFilter.includes(d.getDate())) return false
      return true
    })
  }

  const periodClosed = filterByDate(closedAll, 'closed')

  const filteredClosed = urgencyFilter.length > 0
    ? periodClosed.filter(t => urgencyFilter.includes(t.urgency))
    : periodClosed

  // ── Previous period ──────────────────────────────────────────────────────
  const prevClosed = (() => {
    if (monthFilter.length > 0) {
      return closedAll.filter(t => {
        const d = new Date(t.closedAt ?? t.updatedAt)
        const prevMonths = monthFilter.map(m => m === 1 ? 12 : m - 1)
        const prevYears  = monthFilter.map(m => m === 1 ? (yearFilter[0] ?? now.getFullYear()) - 1 : (yearFilter[0] ?? now.getFullYear()))
        return prevMonths.some((pm, i) => d.getMonth() + 1 === pm && d.getFullYear() === prevYears[i])
      })
    }
    if (yearFilter.length > 0) return closedAll.filter(t => yearFilter.map(y => y - 1).includes(new Date(t.closedAt ?? t.updatedAt).getFullYear()))
    // default: previous 30 days
    return closedAll.filter(t => {
      const d = new Date(t.closedAt ?? t.updatedAt).getTime()
      return d >= now.getTime() - 60 * 86400000 && d < now.getTime() - 30 * 86400000
    })
  })()

  const filteredPrevClosed = urgencyFilter.length > 0
    ? prevClosed.filter(t => urgencyFilter.includes(t.urgency))
    : prevClosed

  // ── Build ranked list ─────────────────────────────────────────────────────
  const ranked = agents
    .map(a => {
      const stats = computeAgentStats(a.id, filteredClosed, tickets)
      return stats ? { ...a, ...stats } : null
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // 1. Score composite (décroissant)
      if (b.composite !== null && a.composite !== null) {
        const diff = b.composite - a.composite
        if (Math.abs(diff) > 0.05) return diff
      } else {
        if (b.composite !== null) return 1
        if (a.composite !== null) return -1
      }
      // 2. Satisfaction — ignoré si l'un n'a pas de notes
      if (a.avgSat !== null && b.avgSat !== null) {
        const satDiff = b.avgSat - a.avgSat
        if (Math.abs(satDiff) > 0.05) return satDiff
      }
      // 3. SLA %
      const slaDiff = (b.slaGlobal ?? 0) - (a.slaGlobal ?? 0)
      if (slaDiff !== 0) return slaDiff
      // 4. Délai moyen (croissant — plus rapide = meilleur)
      return (a.avgTime ?? Infinity) - (b.avgTime ?? Infinity)
    }) as any[]

  // Previous period ranks
  const prevRanked = agents
    .map(a => {
      const stats = computeAgentStats(a.id, filteredPrevClosed, tickets)
      return stats ? { id: a.id, ...stats } : null
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (b.composite !== null && a.composite !== null) {
        const diff = b.composite - a.composite
        if (Math.abs(diff) > 0.05) return diff
      } else {
        if (b.composite !== null) return 1
        if (a.composite !== null) return -1
      }
      return (a.avgTime ?? Infinity) - (b.avgTime ?? Infinity)
    }) as any[]

  // ── Badges ───────────────────────────────────────────────────────────────
  const badges: Record<string, string[]> = {}
  function giveBadge(id: string, badge: string) {
    if (!badges[id]) badges[id] = []
    badges[id].push(badge)
  }

  if (ranked.length > 0) {
    // 🏆 Volume: most treated
    const maxTreated = Math.max(...ranked.map((a: any) => a.count))
    ranked.filter((a: any) => a.count === maxTreated && maxTreated > 0).forEach((a: any) => giveBadge(a.id, isFr ? '🏆 Volume' : '🏆 Volume'))

    // ⭐ Best satisfaction
    const withSat = ranked.filter((a: any) => a.avgSat !== null)
    if (withSat.length) {
      const maxSat = Math.max(...withSat.map((a: any) => a.avgSat))
      withSat.filter((a: any) => a.avgSat === maxSat).forEach((a: any) => giveBadge(a.id, isFr ? '⭐ Satisfaction' : '⭐ Satisfaction'))
    }

    // ⚡ Fastest 1st response
    const withFirstR = ranked.filter((a: any) => a.avgFirstR !== null)
    if (withFirstR.length) {
      const minFirstR = Math.min(...withFirstR.map((a: any) => a.avgFirstR))
      withFirstR.filter((a: any) => a.avgFirstR === minFirstR).forEach((a: any) => giveBadge(a.id, isFr ? '⚡ Rapidité' : '⚡ Speed'))
    }

    // 🎯 SLA champion
    const withSla = ranked.filter((a: any) => a.slaGlobal !== null)
    if (withSla.length) {
      const maxSla = Math.max(...withSla.map((a: any) => a.slaGlobal))
      if (maxSla > 0) withSla.filter((a: any) => a.slaGlobal === maxSla).forEach((a: any) => giveBadge(a.id, isFr ? '🎯 SLA' : '🎯 SLA'))
    }
  }

  const availableYears = [...new Set(tickets.map(t => new Date(t.createdAt).getFullYear()))].sort((a, b) => b - a)
  const availableDays  = [...Array(31)].map((_, i) => i + 1)

  const podiumColors = ['text-amber-500','text-gray-400','text-orange-500']
  const podiumBg     = ['border-amber-200 bg-amber-50','border-gray-200 bg-gray-50','border-orange-200 bg-orange-50']

  const L = {
    title:    isFr ? 'Classement des agents' : 'Agent rankings',
    clearAll: isFr ? 'Effacer les filtres' : 'Clear filters',
    noData:   isFr ? 'Aucune donnée pour cette période' : 'No data for this period',
    podium:   isFr ? 'Podium' : 'Podium',
    table:    isFr ? 'Classement complet' : 'Full rankings',
    rank:     isFr ? 'Rang' : 'Rank',
    agent:    'Agent',
    score:    isFr ? 'Score' : 'Score',
    treated:  isFr ? 'Traités' : 'Treated',
    sat:      isFr ? 'Satisfaction' : 'Satisfaction',
    delay:    isFr ? 'Délai moy.' : 'Avg time',
    firstR:   isFr ? '1ère réponse' : '1st response',
    sla:      'SLA %',
    evol:     isFr ? 'Évol.' : 'Trend',
    badgesL:  isFr ? 'Distinctions' : 'Awards',
    detail:   isFr ? 'Performances →' : 'Performance →',
    noTreated: isFr ? 'Aucun dossier traité' : 'No treated tickets',
  }

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{L.title}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <MultiSelect label={isFr ? 'Année' : 'Year'} isFr={isFr}
          options={availableYears.map(y => ({ value: y, label: String(y) }))}
          selected={yearFilter}
          onToggle={v => setYearFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number])}
          onClear={() => setYearFilter([])} />
        <MultiSelect label={isFr ? 'Mois' : 'Month'} isFr={isFr}
          options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          selected={monthFilter}
          onToggle={v => setMonthFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number])}
          onClear={() => setMonthFilter([])} />
        <MultiSelect label={isFr ? 'Jour' : 'Day'} isFr={isFr}
          options={availableDays.map(d => ({ value: d, label: String(d) }))}
          selected={dayFilter}
          onToggle={v => setDayFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number])}
          onClear={() => setDayFilter([])} />
        <MultiSelect label={isFr ? 'Urgence' : 'Urgency'} isFr={isFr}
          options={[
            { value: 'HIGH',   label: isFr ? '🔴 Élevée'  : '🔴 High'   },
            { value: 'MEDIUM', label: isFr ? '🟡 Moyenne' : '🟡 Medium' },
            { value: 'LOW',    label: isFr ? '🟢 Faible'  : '🟢 Low'    },
          ]}
          selected={urgencyFilter}
          onToggle={v => setUrgencyFilter(p => p.includes(v as string) ? p.filter(x => x !== v) : [...p, v as string])}
          onClear={() => setUrgencyFilter([])} />
        {hasFilter && (
          <button onClick={() => { setYearFilter([]); setMonthFilter([]); setDayFilter([]); setUrgencyFilter([]) }}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium">
            <X size={14} /> {L.clearAll}
          </button>
        )}
      </div>

      {ranked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow flex flex-col items-center py-20">
          <Trophy size={36} className="text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">{L.noData}</p>
        </div>
      ) : (
        <>
          {/* ── Badges strip — top 3 only ── */}
          {ranked.slice(0, 3).some((a: any) => badges[a.id]?.length) && (() => {
            const stripMeta = [
              { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  badgeBg: 'bg-amber-100 border-amber-300 text-amber-800',  medal: '🥇' },
              { bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-600',   badgeBg: 'bg-gray-100 border-gray-300 text-gray-700',      medal: '🥈' },
              { bg: 'bg-orange-50', border: 'border-orange-200',text: 'text-orange-700', badgeBg: 'bg-orange-100 border-orange-300 text-orange-800', medal: '🥉' },
            ]
            return (
              <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-4 mb-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{L.badgesL}</p>
                <div className="flex flex-wrap gap-3">
                  {ranked.slice(0, 3).map((a: any, i: number) => {
                    if (!badges[a.id]?.length) return null
                    const m = stripMeta[i]
                    const isOpen = expandedStrip === a.id
                    return (
                      <button key={a.id} onClick={() => setExpandedStrip(isOpen ? null : a.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${m.bg} ${m.border} hover:opacity-80`}>
                        <span className="text-base">{m.medal}</span>
                        <span className={`text-xs font-bold ${m.text}`}>{a.firstName} {a.lastName}</span>
                        {isOpen ? (
                          <div className="flex gap-1 ml-1">
                            {badges[a.id].map((b: string, bi: number) => (
                              <span key={bi} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg border ${m.badgeBg} whitespace-nowrap`}>
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm tracking-wide">
                            {badges[a.id].map((b: string) => b.split(' ')[0]).join('')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Podium ── */}
          {ranked.length >= 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-6 mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-6 text-center">{L.podium}</p>
              <div className="flex items-end justify-center gap-4">
                {/* 2nd place */}
                {ranked[1] && (
                  <div className="flex flex-col items-center">
                    <div className={`w-24 rounded-2xl border-2 ${podiumBg[1]} flex flex-col items-center justify-center py-4 px-3 mb-3`}>
                      <Medal size={22} className={podiumColors[1]} />
                      <p className="text-xs font-bold text-gray-700 mt-1 text-center truncate max-w-full">{ranked[1].firstName}</p>
                      <p className="text-xs font-black text-gray-800 mt-1">{ranked[1].composite?.toFixed(2) ?? '—'}<span className="text-[10px] font-normal">/100</span></p>
                      <div className="mt-1.5 space-y-0.5 text-center">
                        {ranked[1].avgSat !== null && <p className="text-[10px] text-amber-600">⭐ {ranked[1].avgSat.toFixed(1)}/5</p>}
                        <p className="text-[10px] text-gray-400">{fmtH(ranked[1].avgTime)}</p>
                        {ranked[1].slaGlobal !== null && <p className="text-[10px] text-emerald-600">SLA {ranked[1].slaGlobal}%</p>}
                      </div>
                    </div>
                    <div className="bg-gray-300 w-20 h-14 rounded-t-lg flex items-center justify-center">
                      <span className="text-xl font-black text-white">2</span>
                    </div>
                  </div>
                )}

                {/* 1st place */}
                <div className="flex flex-col items-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <div className={`w-28 rounded-2xl border-2 ${podiumBg[0]} flex flex-col items-center justify-center py-5 px-3 mb-3`}>
                    <Trophy size={26} className={podiumColors[0]} />
                    <p className="text-sm font-bold text-gray-800 mt-1 text-center truncate max-w-full">{ranked[0].firstName}</p>
                    <p className="text-lg font-black text-gray-900 mt-1">{ranked[0].composite?.toFixed(2) ?? '—'}<span className="text-xs font-normal">/100</span></p>
                    <div className="mt-2 space-y-0.5 text-center">
                      {ranked[0].avgSat !== null && <p className="text-xs text-amber-600 font-semibold">⭐ {ranked[0].avgSat.toFixed(1)}/5</p>}
                      <p className="text-xs text-gray-500">{fmtH(ranked[0].avgTime)}</p>
                      {ranked[0].slaGlobal !== null && <p className="text-xs text-emerald-600 font-semibold">SLA {ranked[0].slaGlobal}%</p>}
                    </div>
                    {badges[ranked[0].id]?.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center mt-2">
                        {badges[ranked[0].id].map((b: string, i: number) => (
                          <span key={i} className="text-[10px]">{b.split(' ')[0]}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-amber-400 w-24 h-20 rounded-t-lg flex items-center justify-center">
                    <span className="text-3xl font-black text-white">1</span>
                  </div>
                </div>

                {/* 3rd place */}
                {ranked[2] && (
                  <div className="flex flex-col items-center">
                    <div className={`w-24 rounded-2xl border-2 ${podiumBg[2]} flex flex-col items-center justify-center py-4 px-3 mb-3`}>
                      <Medal size={20} className={podiumColors[2]} />
                      <p className="text-xs font-bold text-gray-700 mt-1 text-center truncate max-w-full">{ranked[2].firstName}</p>
                      <p className="text-xs font-black text-gray-800 mt-1">{ranked[2].composite?.toFixed(2) ?? '—'}<span className="text-[10px] font-normal">/100</span></p>
                      <div className="mt-1.5 space-y-0.5 text-center">
                        {ranked[2].avgSat !== null && <p className="text-[10px] text-amber-600">⭐ {ranked[2].avgSat.toFixed(1)}/5</p>}
                        <p className="text-[10px] text-gray-400">{fmtH(ranked[2].avgTime)}</p>
                        {ranked[2].slaGlobal !== null && <p className="text-[10px] text-emerald-600">SLA {ranked[2].slaGlobal}%</p>}
                      </div>
                    </div>
                    <div className="bg-orange-300 w-20 h-10 rounded-t-lg flex items-center justify-center">
                      <span className="text-xl font-black text-white">3</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Full table ── */}
          <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{L.table}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="px-5 py-3 text-left w-14">{L.rank}</th>
                    <th className="px-3 py-3 text-left">{L.agent}</th>
                    <th className="px-3 py-3 text-right">{L.score}</th>
                    <th className="px-3 py-3 text-right">{L.treated}</th>
                    <th className="px-3 py-3 text-right">{L.sat}</th>
                    <th className="px-3 py-3 text-right">{L.delay}</th>
                    <th className="px-3 py-3 text-right">{L.firstR}</th>
                    <th className="px-3 py-3 text-right">{L.sla}</th>
                    <th className="px-3 py-3 text-center">{L.evol}</th>
                    <th className="px-3 py-3 text-left">{L.badgesL}</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ranked.map((a: any, i: number) => {
                    const prevIdx = prevRanked.findIndex((p: any) => p.id === a.id)
                    const prevRank = prevIdx >= 0 ? prevIdx + 1 : null
                    const rankChange = prevRank !== null ? prevRank - (i + 1) : null

                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center w-8 h-8">
                            {i === 0 ? <span className="text-lg">🥇</span>
                              : i === 1 ? <span className="text-lg">🥈</span>
                              : i === 2 ? <span className="text-lg">🥉</span>
                              : <span className="text-gray-400 text-sm font-medium">{i + 1}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1B3A5C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {a.firstName?.[0]}
                            </div>
                            <span className="font-medium text-gray-900">{a.firstName} {a.lastName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-black text-base ${a.composite !== null ? (a.composite >= 70 ? 'text-emerald-600' : a.composite >= 50 ? 'text-amber-600' : 'text-red-500') : 'text-gray-300'}`}>
                            {a.composite !== null ? a.composite.toFixed(2) : '—'}
                          </span>
                          {a.composite !== null && <span className="text-gray-400 text-xs">/100</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900">{a.count}</td>
                        <td className="px-3 py-3 text-right">
                          {a.avgSat !== null ? (
                            <div className="flex items-center justify-end gap-1">
                              <Star size={11} className="text-amber-400 fill-amber-400" />
                              <span className={`font-semibold text-xs ${a.avgSat >= 4 ? 'text-emerald-600' : a.avgSat >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                                {a.avgSat.toFixed(1)}
                              </span>
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600 text-xs">{fmtH(a.avgTime)}</td>
                        <td className="px-3 py-3 text-right text-gray-600 text-xs">{fmtH(a.avgFirstR)}</td>
                        <td className="px-3 py-3 text-right">
                          {a.slaGlobal !== null ? (
                            <span className={`text-xs font-semibold ${a.slaGlobal >= 80 ? 'text-emerald-600' : a.slaGlobal >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                              {a.slaGlobal}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {rankChange === null ? (
                            <span className="text-gray-300 text-xs">—</span>
                          ) : rankChange > 0 ? (
                            <span className="flex items-center justify-center gap-0.5 text-emerald-600 text-xs font-semibold">
                              <TrendingUp size={13} /> +{rankChange}
                            </span>
                          ) : rankChange < 0 ? (
                            <span className="flex items-center justify-center gap-0.5 text-red-500 text-xs font-semibold">
                              <TrendingDown size={13} /> {rankChange}
                            </span>
                          ) : (
                            <span className="flex items-center justify-center text-gray-400">
                              <Minus size={13} />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {(badges[a.id] ?? []).length === 0 ? (
                            <span className="text-gray-200 text-xs">—</span>
                          ) : (
                            <button
                              onClick={() => setExpandedBadge(expandedBadge === a.id ? null : a.id)}
                              className="flex items-center gap-1 group"
                              title={expandedBadge === a.id ? (isFr ? 'Réduire' : 'Collapse') : (isFr ? 'Voir les distinctions' : 'Show awards')}>
                              {expandedBadge === a.id ? (
                                <div className="flex gap-1 flex-wrap">
                                  {badges[a.id].map((b: string, bi: number) => (
                                    <span key={bi} className="text-[10px] bg-[#1B3A5C]/5 border border-[#1B3A5C]/20 text-[#1B3A5C] px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm tracking-wide">
                                    {badges[a.id].map((b: string) => b.split(' ')[0]).join('')}
                                  </span>
                                  <span className="text-[10px] text-gray-400 group-hover:text-gray-600">
                                    ({badges[a.id].length})
                                  </span>
                                </div>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/${locale}/ops/performances`}
                            className="flex items-center gap-1 text-xs text-[#4A8FC4] font-medium hover:text-[#1B3A5C] whitespace-nowrap">
                            <BarChart2 size={12} /> {L.detail}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
