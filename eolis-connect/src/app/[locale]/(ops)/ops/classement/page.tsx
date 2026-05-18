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

  // Speed score: 100-(temps/cible)×100 par urgence, pondéré par nombre de tickets
  // Cibles: HIGH 3h, MEDIUM 5h, LOW 10h — si urgence absente, exclue automatiquement
  const speedParts = (['HIGH','MEDIUM','LOW'] as const).map(u => {
    const uts = treated.filter(t => t.urgency === u && (t.closedAt ?? t.updatedAt))
    const ts  = uts.map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
      .filter(h => !isNaN(h) && isFinite(h) && h >= 0)
    if (!ts.length) return null
    const avg = ts.reduce((a, b) => a + b, 0) / ts.length
    return { score: Math.max(0, 100 - (avg / SLA_HOURS[u]) * 100), n: ts.length }
  }).filter(Boolean) as { score: number; n: number }[]
  const speedN     = speedParts.reduce((s, p) => s + p.n, 0)
  const speedScore = speedN > 0 ? speedParts.reduce((s, p) => s + p.score * p.n, 0) / speedN : null

  // First response score: 100-(réponse/(cible/3))×100 par urgence, pondéré par nombre de tickets
  // Cibles 1ère réponse: HIGH 1h, MEDIUM ~1h40, LOW ~3h20 (= SLA/3)
  const agentTickets = allTickets.filter(t => t.agentId === agentId)
  const firstRParts  = (['HIGH','MEDIUM','LOW'] as const).map(u => {
    const ts = agentTickets.filter(t => t.urgency === u).map(getFirstResponseH).filter(h => h !== null) as number[]
    if (!ts.length) return null
    const avg = ts.reduce((a, b) => a + b, 0) / ts.length
    return { score: Math.max(0, 100 - (avg / (SLA_HOURS[u] / 3)) * 100), n: ts.length }
  }).filter(Boolean) as { score: number; n: number }[]
  const firstRN     = firstRParts.reduce((s, p) => s + p.n, 0)
  const firstRScore = firstRN > 0 ? firstRParts.reduce((s, p) => s + p.score * p.n, 0) / firstRN : null

  const satScore = avgSat    !== null ? (avgSat / 5) * 100 : null
  const slaScore = slaGlobal !== null ? slaGlobal          : null

  const components = ([
    { score: satScore,    weight: 0.25 },
    { score: speedScore,  weight: 0.25 },
    { score: slaScore,    weight: 0.30 },
    { score: firstRScore, weight: 0.20 },
  ] as { score: number | null; weight: number }[]).filter(c => c.score !== null) as { score: number; weight: number }[]

  const totalWeight = components.reduce((s, c) => s + c.weight, 0)
  const composite   = components.length > 0
    ? +(components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0)).toFixed(2)
    : null

  return { count: treated.length, avgSat, avgTime, avgFirstR, slaGlobal, composite, satScore, speedScore, slaScore, firstRScore }
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
  const [tableOpen, setTableOpen]           = useState(false)
  const [expandedBadge, setExpandedBadge]   = useState<string | null>(null)
  const [expandedStrip, setExpandedStrip]   = useState<string | null>(null)
  const [scoreTooltip, setScoreTooltip]     = useState<{ agent: any; x: number; y: number } | null>(null)
  const [awardsGuideOpen, setAwardsGuideOpen] = useState(false)
  const [criteriaOpen, setCriteriaOpen]       = useState(false)
  const [equite, setEquite] = useState(false)

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

  // ── Mode équité : normalise chaque agent au même nombre de dossiers ───────
  // N = le minimum de dossiers traités parmi tous les agents du filtre actuel
  // Pour chaque agent on prend ses N dossiers les plus récents
  const equiteN = (() => {
    if (!equite) return null
    const counts = new Map<string, number>()
    for (const t of filteredClosed) {
      if (t.agentId) counts.set(t.agentId, (counts.get(t.agentId) ?? 0) + 1)
    }
    if (!counts.size) return null
    return Math.min(...Array.from(counts.values()))
  })()

  function applyEquite(src: any[]): any[] {
    if (!equiteN) return src
    const perAgent = new Map<string, any[]>()
    for (const t of src) {
      if (!t.agentId) continue
      if (!perAgent.has(t.agentId)) perAgent.set(t.agentId, [])
      perAgent.get(t.agentId)!.push(t)
    }
    const result: any[] = []
    for (const [, ts] of perAgent) {
      const sorted = [...ts].sort((a, b) =>
        new Date(b.closedAt ?? b.updatedAt).getTime() - new Date(a.closedAt ?? a.updatedAt).getTime()
      )
      result.push(...sorted.slice(0, equiteN))
    }
    return result
  }

  const equiteClosed     = applyEquite(filteredClosed)
  const equitePrevClosed = applyEquite(filteredPrevClosed)

  // ── Build ranked list ─────────────────────────────────────────────────────
  const ranked = agents
    .map(a => {
      const stats = computeAgentStats(a.id, equiteClosed, tickets)
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
      const stats = computeAgentStats(a.id, equitePrevClosed, tickets)
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

    // 🏁 Fastest resolution (lowest avgTime)
    const withTime = ranked.filter((a: any) => a.avgTime !== null)
    if (withTime.length) {
      const minTime = Math.min(...withTime.map((a: any) => a.avgTime))
      withTime.filter((a: any) => a.avgTime === minTime).forEach((a: any) => giveBadge(a.id, isFr ? '🏁 Résolution' : '🏁 Resolution'))
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
    noTreated:    isFr ? 'Aucun dossier traité' : 'No treated tickets',
    equiteLabel:  isFr ? 'Équité' : 'Fairness',
    equiteActive: isFr ? `Mode équité — N=${equiteN} dossiers les plus récents par agent` : `Fairness mode — N=${equiteN} most recent tickets per agent`,
    equiteOff:    isFr ? 'Activer le mode équité (même base de dossiers par agent)' : 'Enable fairness mode (same ticket base per agent)',
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
        <button
          onClick={() => setEquite(e => !e)}
          title={equite ? L.equiteActive : L.equiteOff}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
            equite
              ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400 hover:text-violet-600'
          }`}
        >
          ⚖️ {L.equiteLabel}
          {equite && equiteN !== null && (
            <span className="ml-1 bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              N={equiteN}
            </span>
          )}
        </button>
      </div>
      {equite && equiteN !== null && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-700 flex items-center gap-2">
          <span>⚖️</span>
          <span>{L.equiteActive}</span>
        </div>
      )}

      {/* ── Encart formule du score ── */}
      <div className="bg-[#EDF1F7] border border-[#1B3A5C]/10 rounded-2xl px-4 py-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#1B3A5C] text-sm font-bold flex-shrink-0">
            ℹ️ {isFr ? 'Score calculé sur 4 critères' : 'Score based on 4 criteria'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {([
              {
                icon: '⭐', label: isFr ? 'Satisfaction' : 'Satisfaction', pct: '25%',
                cls: 'bg-amber-100 text-amber-800 border-amber-200',
                title: isFr ? '(note moyenne / 5) × 100 — ex: 4.5/5 → 90/100' : '(avg rating / 5) × 100 — e.g. 4.5/5 → 90/100',
              },
              {
                icon: '🏁', label: isFr ? 'Vitesse résolution' : 'Resolution speed', pct: '25%',
                cls: 'bg-blue-100 text-blue-800 border-blue-200',
                title: isFr
                  ? 'Par urgence : 100-(temps moyen / cible SLA)×100, puis moyenne pondérée. Cibles : HIGH 3h · MEDIUM 5h · LOW 10h'
                  : 'Per urgency: 100-(avg time / SLA target)×100, then weighted avg. Targets: HIGH 3h · MEDIUM 5h · LOW 10h',
              },
              {
                icon: '🎯', label: 'SLA %', pct: '30%',
                cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                title: isFr
                  ? '(tickets résolus dans le délai cible / total tickets) × 100. Cibles : HIGH <3h · MEDIUM <5h · LOW <10h'
                  : '(tickets resolved within target / total tickets) × 100. Targets: HIGH <3h · MEDIUM <5h · LOW <10h',
              },
              {
                icon: '⚡', label: isFr ? '1ère réponse' : '1st response', pct: '20%',
                cls: 'bg-purple-100 text-purple-800 border-purple-200',
                title: isFr
                  ? 'Par urgence : 100-(1ère réponse / Cr)×100, puis moyenne pondérée. Cr (cible réactivité) = HIGH 1h · MEDIUM ~1h40 · LOW ~3h20'
                  : 'Per urgency: 100-(1st response / Cr)×100, then weighted avg. Cr (responsiveness target) = HIGH 1h · MEDIUM ~1h40 · LOW ~3h20',
              },
            ] as { icon: string; label: string; pct: string; cls: string; title: string }[]).map(c => (
              <span key={c.label} title={c.title} className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border cursor-help ${c.cls}`}>
                {c.icon} {c.label} <span className="font-normal opacity-60">{c.pct}</span>
              </span>
            ))}
            <span className="text-xs text-gray-400 italic">
              {isFr ? '· critère absent → poids redistribué aux autres' : '· missing criterion → weight redistributed'}
            </span>
          </div>
        </div>
        {/* Légende formules */}
        <div className="mt-2.5 pt-2.5 border-t border-[#1B3A5C]/10 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
          {([
            { icon: '⭐', formula: isFr ? '(note/5) × 100' : '(rating/5) × 100' },
            { icon: '🏁', formula: isFr ? '100 − (temps/cibleSLA) × 100  ·  par urgence' : '100 − (time/SLA target) × 100  ·  per urgency' },
            { icon: '🎯', formula: isFr ? 'tickets dans délai / total × 100' : 'on-time tickets / total × 100' },
            { icon: '⚡', formula: isFr ? '100 − (réponse/Cr) × 100  ·  par urgence  ·  Cr = HIGH 1h · MED 1h40 · LOW 3h20' : '100 − (response/Cr) × 100  ·  per urgency  ·  Cr = HIGH 1h · MED 1h40 · LOW 3h20' },
          ]).map(r => (
            <p key={r.icon} className="text-[10px] text-gray-500 leading-tight">
              <span className="mr-1">{r.icon}</span>{r.formula}
            </p>
          ))}
        </div>
      </div>

      {/* ── Comprendre les critères du score (accordion) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow mb-5 overflow-hidden">
        <button
          onClick={() => setCriteriaOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-bold text-[#1B3A5C] flex items-center gap-2">
            📐 {isFr ? 'Comprendre les critères du score' : 'Understanding score criteria'}
          </span>
          <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${criteriaOpen ? 'rotate-180' : ''}`} />
        </button>
        {criteriaOpen && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1B3A5C] text-white text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left w-36">{isFr ? 'Critère' : 'Criterion'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Ce qu\'il mesure' : 'What it measures'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Formule' : 'Formula'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Si hors délai / données manquantes' : 'If over deadline / missing data'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Exemple' : 'Example'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {([
                  {
                    icon: '⭐', label: isFr ? 'Satisfaction (25%)' : 'Satisfaction (25%)',
                    what: isFr ? 'Note moyenne laissée par les clients sur les dossiers clôturés (/5)' : 'Average rating left by clients on closed tickets (/5)',
                    formula: '(note / 5) × 100',
                    edge: isFr ? 'Aucun ticket noté → critère ignoré, son poids 25% est redistribué aux 3 autres' : 'No rated ticket → criterion ignored, 25% weight redistributed to the other 3',
                    example: isFr ? '4.5/5 → 90/100 · 5/5 → 100/100' : '4.5/5 → 90/100 · 5/5 → 100/100',
                    cls: 'text-amber-700',
                  },
                  {
                    icon: '🏁', label: isFr ? 'Vitesse résolution (25%)' : 'Resolution speed (25%)',
                    what: isFr ? 'À quelle vitesse le dossier est résolu, relativement à la cible SLA de son urgence' : 'How fast the ticket is resolved, relative to its urgency SLA target',
                    formula: isFr ? '100 − (temps / cibleSLA) × 100  ·  par urgence, puis moyenne pondérée' : '100 − (time / SLA target) × 100  ·  per urgency, then weighted avg',
                    edge: isFr ? 'Temps > cible SLA → score = 0 pour cette urgence (le SLA% est aussi impacté)' : 'Time > SLA target → score = 0 for that urgency (SLA% is also impacted)',
                    example: isFr ? 'HIGH 3h cible : 30min → 83/100 · 2h → 33/100 · 4h → 0/100' : 'HIGH target 3h: 30min → 83/100 · 2h → 33/100 · 4h → 0/100',
                    cls: 'text-blue-700',
                  },
                  {
                    icon: '🎯', label: 'SLA % (30%)',
                    what: isFr
                      ? 'Taux de dossiers résolus dans le délai cible. Chaque ticket est évalué individuellement (✅ ou ❌), puis le score = % de tickets ✅ sur le total.'
                      : 'Rate of tickets resolved within the target deadline. Each ticket is evaluated individually (✅ or ❌), then score = % of ✅ tickets over total.',
                    formula: isFr ? '(tickets ✅ dans délai / total tickets) × 100' : '(✅ on-time tickets / total tickets) × 100',
                    edge: isFr
                      ? 'Aucun dossier → critère ignoré. Chaque dossier hors délai fait baisser le taux progressivement (ex: 4/5 → 80, 3/5 → 60)'
                      : 'No tickets → criterion ignored. Each overdue ticket lowers the rate gradually (e.g. 4/5 → 80, 3/5 → 60)',
                    example: isFr ? '5/5 dans délai → 100/100 · 4/5 → 80/100 · 0/5 → 0/100' : '5/5 on time → 100/100 · 4/5 → 80/100 · 0/5 → 0/100',
                    cls: 'text-emerald-700',
                  },
                  {
                    icon: '⚡', label: isFr ? '1ère réponse (20%)' : '1st response (20%)',
                    what: isFr
                      ? 'Temps avant le 1er message de l\'agent. Même logique que la vitesse de résolution, avec une cible de réactivité Cr définie par urgence.'
                      : 'Time before the agent\'s first message. Same logic as resolution speed, with a responsiveness target Cr defined per urgency.',
                    formula: isFr
                      ? '100 − (1ère réponse / Cr) × 100  ·  par urgence, puis moyenne pondérée\nCr = HIGH : 1h · MEDIUM : ~1h40 · LOW : ~3h20'
                      : '100 − (1st response / Cr) × 100  ·  per urgency, then weighted avg\nCr = HIGH: 1h · MEDIUM: ~1h40 · LOW: ~3h20',
                    edge: isFr
                      ? 'Réponse > Cr → score = 0 pour cette urgence. Aucune réponse enregistrée → critère ignoré, poids redistribué'
                      : 'Response > Cr → score = 0 for that urgency. No response recorded → criterion ignored, weight redistributed',
                    example: isFr ? 'HIGH (Cr = 1h) : 10min → 83/100 · 50min → 17/100 · 1h10 → 0/100' : 'HIGH (Cr = 1h): 10min → 83/100 · 50min → 17/100 · 1h10 → 0/100',
                    cls: 'text-purple-700',
                  },
                ] as { icon: string; label: string; what: string; formula: string; edge: string; example: string; cls: string }[]).map((row, i) => (
                  <tr key={row.icon} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${row.cls}`}>{row.icon} {row.label}</td>
                    <td className="px-4 py-3 text-gray-700 leading-relaxed max-w-xs">{row.what}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-800 bg-gray-50 whitespace-nowrap">{row.formula}</td>
                    <td className="px-4 py-3 text-gray-600 leading-relaxed max-w-xs">{row.edge}</td>
                    <td className="px-4 py-3 text-gray-500 leading-relaxed whitespace-nowrap">{row.example}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#EDF1F7]">
                  <td colSpan={5} className="px-4 py-2.5 text-xs text-gray-500 italic">
                    {isFr
                      ? '* SLA % et Vitesse résolution mesurent deux choses différentes : le SLA répond à "as-tu respecté le délai ?" (oui/non), la Vitesse répond à "à quelle vitesse ?" (0→100). Un agent peut avoir 100% SLA et une vitesse faible s\'il résout systématiquement juste avant la deadline.'
                      : '* SLA % and Resolution speed measure different things: SLA answers "did you meet the deadline?" (yes/no), Speed answers "how fast?" (0→100). An agent can have 100% SLA and low speed if they always resolve just before the deadline.'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Guide des distinctions (accordion) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow mb-5 overflow-hidden">
        <button
          onClick={() => setAwardsGuideOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-bold text-[#1B3A5C] flex items-center gap-2">
            🏅 {isFr ? 'Guide des distinctions — comment sont attribués les badges ?' : 'Awards guide — how are badges attributed?'}
          </span>
          <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${awardsGuideOpen ? 'rotate-180' : ''}`} />
        </button>
        {awardsGuideOpen && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1B3A5C] text-white text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{isFr ? 'Badge' : 'Badge'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Nom' : 'Name'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Ce que ça signifie' : 'What it means'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Critère d\'attribution' : 'Attribution criterion'}</th>
                  <th className="px-4 py-3 text-left">{isFr ? 'Lien avec le score composite' : 'Link to composite score'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {([
                  {
                    icon: '🏆',
                    name: 'Volume',
                    meaning: isFr
                      ? 'A traité le plus grand nombre de dossiers sur la période'
                      : 'Handled the most tickets in the period',
                    criterion: isFr
                      ? 'Agent avec le plus haut nombre de dossiers clôturés. En cas d\'égalité, les deux agents reçoivent le badge.'
                      : 'Agent with the highest number of closed tickets. Ties → both receive the badge.',
                    scoreLink: isFr
                      ? 'Hors score — quantité ≠ qualité. Reconnaît le travail fourni sans biaiser le classement.'
                      : 'Outside score — quantity ≠ quality. Rewards effort without biasing the ranking.',
                    linkColor: 'text-gray-400',
                  },
                  {
                    icon: '⭐',
                    name: isFr ? 'Satisfaction' : 'Satisfaction',
                    meaning: isFr
                      ? 'Les clients de cet agent sont les plus satisfaits en moyenne'
                      : 'This agent\'s clients are the most satisfied on average',
                    criterion: isFr
                      ? 'Agent avec la note moyenne client (/5) la plus élevée. Calculé uniquement sur les dossiers ayant reçu une note.'
                      : 'Agent with the highest average client rating (/5). Only calculated on rated tickets.',
                    scoreLink: isFr ? 'Critère score 25% — satisfaction client' : 'Score criterion 25% — client satisfaction',
                    linkColor: 'text-amber-600',
                  },
                  {
                    icon: '🏁',
                    name: isFr ? 'Résolution' : 'Resolution',
                    meaning: isFr
                      ? 'Clôture ses dossiers plus vite que tous les autres agents, relativement aux cibles SLA de chaque urgence'
                      : 'Closes tickets fastest relative to each urgency SLA target',
                    criterion: isFr
                      ? 'Agent avec le score de vitesse le plus élevé. Score = 100−(temps/cible SLA)×100 par urgence, puis moyenne pondérée par le nombre de tickets. Cibles : HIGH 3h, MEDIUM 5h, LOW 10h.'
                      : 'Agent with the highest speed score. Score = 100−(time/SLA target)×100 per urgency, then weighted avg by ticket count. Targets: HIGH 3h, MEDIUM 5h, LOW 10h.',
                    scoreLink: isFr ? 'Critère score 25% — vitesse de résolution (relative aux cibles SLA par urgence)' : 'Score criterion 25% — resolution speed (relative to SLA targets per urgency)',
                    linkColor: 'text-blue-600',
                  },
                  {
                    icon: '🎯',
                    name: 'SLA',
                    meaning: isFr
                      ? 'Respecte le mieux les délais cibles (HIGH <3h, MEDIUM <5h, LOW <10h)'
                      : 'Best at meeting SLA targets (HIGH <3h, MEDIUM <5h, LOW <10h)',
                    criterion: isFr
                      ? 'Agent avec le taux SLA% global le plus élevé. SLA% = (dossiers résolus dans le délai / total dossiers) × 100. Minimum 1 dossier requis.'
                      : 'Agent with the highest overall SLA%. SLA% = (tickets resolved on time / total tickets) × 100. Minimum 1 ticket required.',
                    scoreLink: isFr ? 'Critère score 30% — respect des délais (poids le plus fort)' : 'Score criterion 30% — deadline compliance (highest weight)',
                    linkColor: 'text-emerald-600',
                  },
                  {
                    icon: '⚡',
                    name: isFr ? 'Rapidité' : 'Speed',
                    meaning: isFr
                      ? 'Répond le plus rapidement quand un nouveau dossier arrive, relativement aux cibles de réponse de chaque urgence'
                      : 'Responds fastest relative to each urgency response target',
                    criterion: isFr
                      ? 'Agent avec le score de 1ère réponse le plus élevé. Score = 100−(réponse/(cible÷3))×100 par urgence, puis moyenne pondérée. Cibles 1ère réponse : HIGH 1h, MEDIUM ~1h40, LOW ~3h20 (= SLA÷3).'
                      : 'Agent with the highest 1st response score. Score = 100−(response/(target÷3))×100 per urgency, then weighted avg. Response targets: HIGH 1h, MEDIUM ~1h40, LOW ~3h20 (= SLA÷3).',
                    scoreLink: isFr ? 'Critère score 20% — réactivité initiale (relative aux cibles par urgence)' : 'Score criterion 20% — initial responsiveness (relative to per-urgency targets)',
                    linkColor: 'text-purple-600',
                  },
                ] as { icon: string; name: string; meaning: string; criterion: string; scoreLink: string; linkColor: string }[]).map((row, i) => (
                  <tr key={row.icon} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 text-center text-xl">{row.icon}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs leading-relaxed max-w-xs">{row.meaning}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs leading-relaxed max-w-sm">{row.criterion}</td>
                    <td className={`px-4 py-3 text-xs font-medium leading-relaxed max-w-xs ${row.linkColor}`}>{row.scoreLink}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#EDF1F7]">
                  <td colSpan={5} className="px-4 py-2.5 text-xs text-gray-500 italic">
                    {isFr
                      ? '* En cas d\'égalité sur le critère d\'un badge, tous les agents ex-æquo reçoivent le badge. Un agent peut cumuler plusieurs badges. Les badges sont attribués parmi tous les agents ayant traité au moins 1 dossier sur la période filtrée.'
                      : '* In case of a tie on a badge criterion, all tied agents receive the badge. An agent can accumulate multiple badges. Badges are attributed among all agents who handled at least 1 ticket in the filtered period.'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
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

          {/* ── Full table — accordion ── */}
          <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
            <button
              onClick={() => setTableOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <span className="font-semibold text-gray-900">
                {L.table}
                <span className="ml-2 text-xs font-normal text-gray-400">({ranked.length})</span>
              </span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
            </button>
            {tableOpen && <div className="overflow-x-auto border-t border-gray-100">
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
                          <div
                            className="inline-flex items-baseline gap-0.5 cursor-default"
                            onMouseEnter={a.composite !== null ? (e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setScoreTooltip({ agent: a, x: r.left, y: r.top })
                            } : undefined}
                            onMouseLeave={() => setScoreTooltip(null)}
                          >
                            <span className={`font-black text-base ${a.composite !== null ? (a.composite >= 70 ? 'text-emerald-600' : a.composite >= 50 ? 'text-amber-600' : 'text-red-500') : 'text-gray-300'}`}>
                              {a.composite !== null ? a.composite.toFixed(2) : '—'}
                            </span>
                            {a.composite !== null && <span className="text-gray-400 text-xs">/100</span>}
                          </div>
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
            </div>}
          </div>
        </>
      )}
      {/* Tooltip score composite — fixed, hors du contexte overflow du tableau */}
      {scoreTooltip && (() => {
        const a = scoreTooltip.agent
        const rows = [
          {
            icon: '⭐', label: isFr ? 'Satisfaction'   : 'Satisfaction',  score: a.satScore,    w: 25,
            formula: isFr ? '(note/5)×100' : '(rating/5)×100',
          },
          {
            icon: '🏁', label: isFr ? 'Vitesse résol.' : 'Resol. speed',  score: a.speedScore,  w: 25,
            formula: isFr ? 'par urgence vs cible SLA' : 'per urgency vs SLA target',
          },
          {
            icon: '🎯', label: 'SLA %',                                    score: a.slaScore,    w: 30,
            formula: isFr ? 'dans délai / total × 100' : 'on-time / total × 100',
          },
          {
            icon: '⚡', label: isFr ? '1ère réponse'  : '1st response',   score: a.firstRScore, w: 20,
            formula: isFr ? 'par urgence vs Cr (HIGH 1h · MED 1h40 · LOW 3h20)' : 'per urgency vs Cr (HIGH 1h · MED 1h40 · LOW 3h20)',
          },
        ]
        const top  = Math.max(8, scoreTooltip.y - 210)
        const left = Math.max(8, scoreTooltip.x - 260)
        return (
          <div
            style={{ position: 'fixed', top, left, zIndex: 9999, pointerEvents: 'none' }}
            className="w-64 bg-[#1B3A5C] text-white rounded-xl p-3 shadow-2xl"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200 mb-2.5">
              {isFr ? 'Décomposition du score' : 'Score breakdown'}
            </p>
            <div className="space-y-2.5">
              {rows.map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-blue-100">{r.icon} {r.label}</span>
                    <div className="flex items-center gap-2">
                      {r.score !== null
                        ? <span className="text-[11px] font-bold text-white">{r.score.toFixed(1)}<span className="text-blue-300 font-normal">/100</span></span>
                        : <span className="text-[10px] text-blue-400 italic">{isFr ? 'ignoré' : 'ignored'}</span>
                      }
                      <span className="text-[10px] text-blue-300 w-7 text-right">{r.w}%</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-blue-400/70 leading-tight pl-4">{r.formula}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/20 mt-3 pt-2 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-blue-200">Composite</span>
                <span className="text-sm font-black text-white">{a.composite?.toFixed(2)}<span className="text-blue-300 font-normal text-xs">/100</span></span>
              </div>
              <p className="text-[9px] text-blue-400/60 leading-tight">
                {isFr ? 'Cibles SLA · HIGH <3h · MEDIUM <5h · LOW <10h' : 'SLA targets · HIGH <3h · MEDIUM <5h · LOW <10h'}
              </p>
            </div>
          </div>
        )
      })()}
    </DashboardLayout>
  )
}
