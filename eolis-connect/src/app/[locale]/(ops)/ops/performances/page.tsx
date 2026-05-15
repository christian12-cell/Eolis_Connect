'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUser, apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import {
  Star, Clock, CheckCircle, MessageSquare, ChevronDown,
  X, ArrowLeft, Activity, Users, AlertTriangle, Zap,
} from 'lucide-react'
import AgentPerformanceCharts from './AgentPerformanceCharts'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SLA_HOURS: Record<string, number> = { HIGH: 3, MEDIUM: 5, LOW: 10 }
const SLA_CAP = 24
const URGENCY_META: Record<string, { emoji: string; fr: string; en: string; text: string; bar: string }> = {
  HIGH:   { emoji: '🔴', fr: 'Élevée',  en: 'High',   text: 'text-red-600',    bar: 'bg-red-500'     },
  MEDIUM: { emoji: '🟡', fr: 'Moyenne', en: 'Medium', text: 'text-amber-600',  bar: 'bg-amber-400'   },
  LOW:    { emoji: '🟢', fr: 'Faible',  en: 'Low',    text: 'text-emerald-600',bar: 'bg-emerald-500' },
}

function fmtH(h: number | null): string {
  if (h === null || isNaN(h)) return '—'
  if (h < 1) return `${Math.round(h * 60)}min`
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60)
  return mn > 0 ? `${hr}h ${mn}min` : `${hr}h`
}

const CLIENT_SIDE = ['CLIENT', 'INTERNAL_NOTE', 'DOCS_SUBMITTED', 'SYSTEM']

function getFirstResponseH(ticket: any): number | null {
  const msgs: any[] = ticket.messages ?? []
  const first = msgs.find(m => !CLIENT_SIDE.includes(m.senderType))
  if (!first) return null
  const h = (new Date(first.createdAt).getTime() - new Date(ticket.createdAt).getTime()) / 3600000
  return isNaN(h) || !isFinite(h) ? null : +h.toFixed(2)
}

function getMsgCount(ticket: any): number {
  return (ticket.messages ?? []).filter((m: any) => m.senderType !== 'INTERNAL_NOTE').length
}

// ── MultiSelect ────────────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onToggle, onClear, isFr }: {
  label: string; options: { value: number | string; label: string }[]
  selected: (number | string)[]; onToggle: (v: number | string) => void
  onClear: () => void; isFr: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
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

// ── Agent dropdown ─────────────────────────────────────────────────────────
function AgentSelect({ agents, value, onChange, isFr }: {
  agents: any[]; value: string; onChange: (id: string) => void; isFr: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])
  const selected = agents.find(a => a.id === value)
  const label = value === 'all'
    ? (isFr ? 'Tous les agents' : 'All agents')
    : selected ? `${selected.firstName} ${selected.lastName}` : (isFr ? 'Tous les agents' : 'All agents')
  function toggle() {
    if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }) }
    setOpen(o => !o)
  }
  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:border-gray-300 transition-all min-w-[200px]">
        <Users size={15} className="text-[#1B3A5C]" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl min-w-[220px] py-1.5 max-h-72 overflow-y-auto">
          <button onClick={() => { onChange('all'); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${value === 'all' ? 'font-semibold text-[#1B3A5C]' : 'text-gray-700'}`}>
            <Users size={14} /> {isFr ? 'Tous les agents' : 'All agents'}
          </button>
          <div className="border-t border-gray-100 my-1" />
          {agents.map(a => (
            <button key={a.id} onClick={() => { onChange(a.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${value === a.id ? 'font-semibold text-[#1B3A5C]' : 'text-gray-700'}`}>
              <div className="w-6 h-6 rounded-full bg-[#1B3A5C]/10 text-[#1B3A5C] text-xs font-bold flex items-center justify-center flex-shrink-0">
                {a.firstName?.[0]}
              </div>
              {a.firstName} {a.lastName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat KPI card with benchmark ───────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color, diff, diffLabel }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: string
  diff?: number | null; diffLabel?: string
}) {
  const palette: Record<string, string> = {
    navy:    'bg-[#1B3A5C]/10 text-[#1B3A5C]',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple:  'bg-purple-50 text-purple-600',
    red:     'bg-red-50 text-red-600',
  }
  const diffColor = diff === null || diff === undefined ? '' : diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'
  const diffSign  = diff !== null && diff !== undefined && diff > 0 ? '+' : ''
  return (
    <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${palette[color] ?? palette.navy}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {diff !== null && diff !== undefined && diffLabel && (
        <p className={`text-xs font-semibold mt-1 ${diffColor}`}>
          {diffSign}{diffLabel}
        </p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PerformancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]             = useState('fr')
  const [user, setUser]                 = useState<any>(null)
  const [tickets, setTickets]           = useState<any[]>([])
  const [agents, setAgents]             = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [yearFilter, setYearFilter]     = useState<number[]>([])
  const [monthFilter, setMonthFilter]   = useState<number[]>([])
  const [urgencyFilter, setUrgencyFilter] = useState<string[]>([])

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
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

  // ── Filter tickets by period ─────────────────────────────────────────────
  const hasFilter = !!(yearFilter.length || monthFilter.length || urgencyFilter.length)
  const closedAll = tickets.filter(t => t.status === 'TREATED' || t.status === 'CLOSED')

  const periodClosed = (yearFilter.length || monthFilter.length) ? closedAll.filter(t => {
    const d = new Date(t.closedAt ?? t.updatedAt)
    if (yearFilter.length  && !yearFilter.includes(d.getFullYear())) return false
    if (monthFilter.length && !monthFilter.includes(d.getMonth() + 1)) return false
    return true
  }) : closedAll

  // Apply urgency filter on top of period filter
  const filteredClosed = urgencyFilter.length > 0
    ? periodClosed.filter(t => urgencyFilter.includes(t.urgency))
    : periodClosed

  const filteredClosedAll = urgencyFilter.length > 0
    ? closedAll.filter(t => urgencyFilter.includes(t.urgency))
    : closedAll

  // Previous period for comparison (same duration before)
  const prevClosed = (() => {
    if (monthFilter.length > 0) {
      return closedAll.filter(t => {
        const d = new Date(t.closedAt ?? t.updatedAt)
        const prevMonths = monthFilter.map(m => m === 1 ? 12 : m - 1)
        const prevYears  = monthFilter.map(m => m === 1 ? (yearFilter[0] ?? now.getFullYear()) - 1 : (yearFilter[0] ?? now.getFullYear()))
        return prevMonths.some((pm, i) => d.getMonth() + 1 === pm && d.getFullYear() === prevYears[i])
      })
    }
    if (yearFilter.length > 0) {
      return closedAll.filter(t => {
        const d = new Date(t.closedAt ?? t.updatedAt)
        return yearFilter.map(y => y - 1).includes(d.getFullYear())
      })
    }
    // default: previous 30 days
    return closedAll.filter(t => {
      const d = new Date(t.closedAt ?? t.updatedAt).getTime()
      return d >= now.getTime() - 60 * 86400000 && d < now.getTime() - 30 * 86400000
    })
  })()

  // ── Per-agent stat computation ────────────────────────────────────────────
  function computeStats(agentId: string, src: any[]) {
    const treated = src.filter(t => t.agentId === agentId)
    const scores  = treated.filter(t => t.satisfactionRating?.score).map(t => t.satisfactionRating.score)
    const avgSat  = scores.length ? +(scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : null

    const resTimes = treated.filter(t => t.closedAt ?? t.updatedAt)
      .map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
      .filter(h => !isNaN(h) && isFinite(h))
    const avgRes = resTimes.length ? +(resTimes.reduce((a, b) => a + b, 0) / resTimes.length).toFixed(1) : null

    const assigned    = tickets.filter(t => t.agentId === agentId)
    const firstRespT  = assigned.map(getFirstResponseH).filter(h => h !== null) as number[]
    const avgFirstR   = firstRespT.length ? +(firstRespT.reduce((a, b) => a + b, 0) / firstRespT.length).toFixed(1) : null

    const msgCounts = assigned.map(getMsgCount)
    const avgMsgs   = msgCounts.length ? +(msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length).toFixed(1) : null

    const sla = ['HIGH', 'MEDIUM', 'LOW'].reduce((acc, u) => {
      const uts = treated.filter(t => t.urgency === u && (t.closedAt ?? t.updatedAt))
      const ok  = uts.filter(t => {
        const h = (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000
        return h <= SLA_HOURS[u]
      }).length
      return { ...acc, [u]: { total: uts.length, ok, pct: uts.length ? Math.round(ok / uts.length * 100) : null } }
    }, {} as Record<string, { total: number; ok: number; pct: number | null }>)

    const slaGlobal = (() => {
      const allSla = Object.values(sla)
      const totalU = allSla.reduce((s, v) => s + v.total, 0)
      const totalOk = allSla.reduce((s, v) => s + v.ok, 0)
      return totalU ? Math.round(totalOk / totalU * 100) : null
    })()

    const urgency = {
      HIGH:   treated.filter(t => t.urgency === 'HIGH').length,
      MEDIUM: treated.filter(t => t.urgency === 'MEDIUM').length,
      LOW:    treated.filter(t => t.urgency === 'LOW').length,
    }
    const active   = tickets.filter(t => t.agentId === agentId && (t.status === 'PENDING' || t.status === 'IN_PROGRESS')).length
    const comments = treated
      .filter(t => t.satisfactionRating?.comment)
      .map(t => ({ comment: t.satisfactionRating.comment, score: t.satisfactionRating.score, ref: t.ref, date: t.updatedAt ?? t.closedAt }))

    return { count: treated.length, avgSat, avgRes, avgFirstR, avgMsgs, sla, slaGlobal, urgency, active, comments }
  }

  // Team averages — computed on raw values (no intermediate rounding)
  const teamStats = (() => {
    function rawAvg(vals: number[]): number | null {
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    function avgOf(vals: (number | null)[]): number | null {
      const valid = vals.filter(v => v !== null) as number[]
      return valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : null
    }

    const allResTimes = agents.flatMap(a =>
      filteredClosed.filter(t => t.agentId === a.id && (t.closedAt ?? t.updatedAt))
        .map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
        .filter(h => !isNaN(h) && isFinite(h))
    )
    const urgTix = urgencyFilter.length > 0
      ? tickets.filter(t => urgencyFilter.includes(t.urgency))
      : tickets
    const allFirstR = agents.flatMap(a =>
      urgTix.filter(t => t.agentId === a.id).map(getFirstResponseH).filter(h => h !== null) as number[]
    )
    const allMsgs = agents.flatMap(a =>
      urgTix.filter(t => t.agentId === a.id).map(getMsgCount)
    )
    const allScores = filteredClosed.filter(t => t.satisfactionRating?.score).map(t => t.satisfactionRating.score)

    const perAgent  = agents.map(a => computeStats(a.id, filteredClosed))
    const slaGlobal = avgOf(perAgent.map(s => s.slaGlobal))

    return {
      count:     filteredClosed.length,
      avgSat:    allScores.length ? +(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1) : null,
      avgRes:    rawAvg(allResTimes),   // raw float → fmtH handles display
      avgFirstR: rawAvg(allFirstR),
      avgMsgs:   allMsgs.length ? +(allMsgs.reduce((a, b) => a + b, 0) / allMsgs.length).toFixed(1) : null,
      slaGlobal,
    }
  })()

  // All agents stats for comparison table — tri multi-critères
  const allAgentStats = agents.map(a => ({ ...a, stats: computeStats(a.id, filteredClosed) }))
    .sort((a, b) => {
      // 1. Volume traité (décroissant)
      if (b.stats.count !== a.stats.count) return b.stats.count - a.stats.count
      // 2. Satisfaction (décroissant)
      const satDiff = (b.stats.avgSat ?? 0) - (a.stats.avgSat ?? 0)
      if (Math.abs(satDiff) > 0.05) return satDiff
      // 3. SLA global % (décroissant)
      const slaDiff = (b.stats.slaGlobal ?? 0) - (a.stats.slaGlobal ?? 0)
      if (slaDiff !== 0) return slaDiff
      // 4. Délai résolution (croissant — plus rapide = meilleur)
      return (a.stats.avgRes ?? Infinity) - (b.stats.avgRes ?? Infinity)
    })

  // Selected agent stats
  const selStats = selectedAgent !== 'all' ? computeStats(selectedAgent, filteredClosed) : null
  const selPrevStats = selectedAgent !== 'all' ? computeStats(selectedAgent, prevClosed) : null
  const selAgent = agents.find(a => a.id === selectedAgent)

  // ── Trend data for charts (individual agent) ──────────────────────────────
  function buildTrend(agentId: string) {
    const src = agentId === 'all' ? filteredClosedAll : filteredClosedAll.filter(t => t.agentId === agentId)
    if (!src.length) return []
    const timestamps = src.map(t => new Date(t.closedAt ?? t.updatedAt).getTime()).filter(d => !isNaN(d))
    if (!timestamps.length) return []
    const dayRange = (Date.now() - Math.min(...timestamps)) / 86400000
    const by: 'day' | 'week' | 'month' = dayRange > 60 ? 'month' : dayRange > 14 ? 'week' : 'day'
    const n = 12

    return Array.from({ length: n }, (_, i) => {
      let label = '', pts: any[] = []
      if (by === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
        label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        pts = src.filter(t => { const td = new Date(t.closedAt ?? t.updatedAt); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() })
      } else if (by === 'week') {
        const ws = new Date(now); ws.setDate(ws.getDate() - (n - 1 - i) * 7); ws.setHours(0, 0, 0, 0)
        const we = new Date(ws); we.setDate(we.getDate() + 6); we.setHours(23, 59, 59, 999)
        label = ws.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        pts = src.filter(t => { const td = new Date(t.closedAt ?? t.updatedAt); return td >= ws && td <= we })
      } else {
        const d = new Date(now); d.setDate(d.getDate() - (n - 1 - i)); d.setHours(0, 0, 0, 0)
        label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        pts = src.filter(t => { const td = new Date(t.closedAt ?? t.updatedAt); return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() })
      }
      const scores  = pts.filter(t => t.satisfactionRating?.score).map(t => t.satisfactionRating.score)
      const avgSat  = scores.length ? +(scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : null
      const times   = pts.filter(t => t.closedAt ?? t.updatedAt)
        .map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
        .filter(h => !isNaN(h) && isFinite(h))
      const avgTime = times.length ? +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : null
      return { date: label, count: pts.length, avgSat, avgTime }
    })
  }

  const trendData    = selectedAgent !== 'all' ? buildTrend(selectedAgent) : buildTrend('all')
  const urgencyData  = (() => {
    const src = selectedAgent !== 'all' ? filteredClosed.filter(t => t.agentId === selectedAgent) : filteredClosed
    return [
      { name: `🔴 ${isFr ? 'Élevée' : 'High'}`,   value: src.filter(t => t.urgency === 'HIGH').length,   color: '#EF4444' },
      { name: `🟡 ${isFr ? 'Moyenne' : 'Medium'}`, value: src.filter(t => t.urgency === 'MEDIUM').length, color: '#F59E0B' },
      { name: `🟢 ${isFr ? 'Faible' : 'Low'}`,    value: src.filter(t => t.urgency === 'LOW').length,    color: '#10B981' },
    ].filter(d => d.value > 0)
  })()

  const availableYears = [...new Set(tickets.map(t => new Date(t.createdAt).getFullYear()))].sort((a, b) => b - a)

  // ── i18n ─────────────────────────────────────────────────────────────────
  const L = {
    title:      isFr ? 'Performances des agents' : 'Agent performance',
    allAgents:  isFr ? 'Tous les agents'         : 'All agents',
    backToAll:  isFr ? '← Tous les agents'       : '← All agents',
    clearAll:   isFr ? 'Effacer les filtres'     : 'Clear filters',
    noData:     isFr ? 'Pas de données'          : 'No data',
    vsTeam:     isFr ? 'Moy. équipe'             : 'Team avg',
    vsPrev:     isFr ? 'vs période préc.'        : 'vs prev period',
    active:     isFr ? 'En cours actuellement'   : 'Currently active',
    slaTitle:   isFr ? 'Conformité SLA'          : 'SLA Compliance',
    slaTarget:  (u: string) => `${isFr ? 'Obj.' : 'Target'} <${SLA_HOURS[u]}h`,
    comments:   isFr ? 'Commentaires clients'    : 'Client feedback',
    noComments: isFr ? 'Aucun commentaire'       : 'No comments',
    kpi: {
      treated:    isFr ? 'Dossiers traités'       : 'Tickets treated',
      sat:        isFr ? 'Satisfaction moy.'      : 'Avg satisfaction',
      resolution: isFr ? 'Délai résolution moy.'  : 'Avg resolution',
      firstResp:  isFr ? '1ère réponse moy.'      : 'Avg first response',
      messages:   isFr ? 'Messages / dossier'     : 'Messages / ticket',
      charge:     isFr ? 'Charge actuelle'        : 'Current workload',
    },
    table: {
      rank:       isFr ? 'Rang'          : 'Rank',
      agent:      isFr ? 'Agent'         : 'Agent',
      treated:    isFr ? 'Traités'       : 'Treated',
      sat:        isFr ? 'Satisfaction'  : 'Satisfaction',
      resolution: isFr ? 'Délai moy.'   : 'Avg time',
      firstResp:  isFr ? '1ère réponse' : '1st response',
      sla:        'SLA %',
      msgs:       isFr ? 'Msgs/dossier' : 'Msgs/ticket',
      charge:     isFr ? 'En cours'     : 'Active',
      detail:     isFr ? 'Détail'       : 'Detail',
      teamAvg:    isFr ? 'Moy. équipe'  : 'Team average',
    },
  }

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{L.title}</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <AgentSelect agents={agents} value={selectedAgent} onChange={setSelectedAgent} isFr={isFr} />
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
        <MultiSelect label={isFr ? 'Urgence' : 'Urgency'} isFr={isFr}
          options={[
            { value: 'HIGH',   label: `🔴 ${isFr ? 'Élevée' : 'High'}` },
            { value: 'MEDIUM', label: `🟡 ${isFr ? 'Moyenne' : 'Medium'}` },
            { value: 'LOW',    label: `🟢 ${isFr ? 'Faible' : 'Low'}` },
          ]}
          selected={urgencyFilter}
          onToggle={v => setUrgencyFilter(p => p.includes(v as string) ? p.filter(x => x !== v) : [...p, v as string])}
          onClear={() => setUrgencyFilter([])} />
        {hasFilter && (
          <button onClick={() => { setYearFilter([]); setMonthFilter([]); setUrgencyFilter([]) }}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium">
            <X size={14} /> {L.clearAll}
          </button>
        )}
      </div>

      {/* ── INDIVIDUAL AGENT VIEW ── */}
      {selectedAgent !== 'all' && selStats && selAgent && (
        <>
          {/* Agent header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedAgent('all')}
                className="text-sm text-[#4A8FC4] hover:text-[#1B3A5C] font-medium">{L.backToAll}</button>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#1B3A5C] text-white text-sm font-bold flex items-center justify-center">
                  {selAgent.firstName?.[0]}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selAgent.firstName} {selAgent.lastName}</p>
                  <p className="text-xs text-gray-400">{selAgent.email}</p>
                </div>
              </div>
            </div>
            {selStats.active > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Activity size={13} /> {selStats.active} {isFr ? 'dossier(s) actif(s)' : 'active ticket(s)'}
              </span>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
            <KpiCard label={L.kpi.treated} value={selStats.count} icon={<CheckCircle size={16}/>} color="emerald"
              diff={selPrevStats ? selStats.count - selPrevStats.count : null}
              diffLabel={selPrevStats ? `${selStats.count - selPrevStats.count > 0 ? '+' : ''}${selStats.count - selPrevStats.count} ${L.vsPrev}` : undefined} />
            <KpiCard label={L.kpi.sat}
              value={selStats.avgSat !== null ? `${selStats.avgSat}/5` : L.noData}
              sub={teamStats.avgSat !== null ? `${L.vsTeam}: ${teamStats.avgSat}/5` : undefined}
              icon={<Star size={16}/>} color="amber"
              diff={selStats.avgSat !== null && teamStats.avgSat !== null ? +(selStats.avgSat - teamStats.avgSat) : null}
              diffLabel={selStats.avgSat !== null && teamStats.avgSat !== null ? `${selStats.avgSat >= teamStats.avgSat ? '+' : ''}${(selStats.avgSat - teamStats.avgSat).toFixed(1)} ${L.vsTeam}` : undefined} />
            <KpiCard label={L.kpi.resolution}
              value={fmtH(selStats.avgRes)}
              sub={teamStats.avgRes !== null ? `${L.vsTeam}: ${fmtH(teamStats.avgRes)}` : undefined}
              icon={<Clock size={16}/>} color="blue" />
            <KpiCard label={L.kpi.firstResp}
              value={fmtH(selStats.avgFirstR)}
              sub={teamStats.avgFirstR !== null ? `${L.vsTeam}: ${fmtH(teamStats.avgFirstR)}` : undefined}
              icon={<Zap size={16}/>} color="purple" />
            <KpiCard label={L.kpi.messages}
              value={selStats.avgMsgs ?? L.noData}
              sub={teamStats.avgMsgs !== null ? `${L.vsTeam}: ${teamStats.avgMsgs}` : undefined}
              icon={<MessageSquare size={16}/>} color="navy" />
            <KpiCard label={L.kpi.charge} value={selStats.active} icon={<Activity size={16}/>} color="red" />
          </div>

          {/* SLA compliance */}
          <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.slaTitle}</h3>
            <div className="grid grid-cols-3 gap-6">
              {(['HIGH','MEDIUM','LOW'] as const).map(urgency => {
                const { total, ok, pct } = selStats.sla[urgency] ?? { total: 0, ok: 0, pct: null }
                const m = URGENCY_META[urgency]
                const scoreColor = pct !== null ? (pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600') : 'text-gray-300'
                return (
                  <div key={urgency}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${m.text}`}>{m.emoji} {isFr ? m.fr : m.en}</span>
                      <span className="text-[10px] text-gray-400">{L.slaTarget(urgency)}</span>
                    </div>
                    <p className={`text-xl font-bold mb-1 ${scoreColor}`}>{pct !== null ? `${pct}%` : L.noData}</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                      <div className={`h-1.5 rounded-full ${m.bar}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <p className="text-xs text-gray-400">{ok}/{total} {isFr ? 'dossier(s)' : 'ticket(s)'}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Charts */}
          <AgentPerformanceCharts trendData={trendData} urgencyData={urgencyData} locale={locale} />

          {/* Comments */}
          <div className="bg-white rounded-2xl border border-gray-100 card-shadow mt-5 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.comments}</h3>
            {selStats.comments.length === 0 ? (
              <p className="text-sm text-gray-400">{L.noComments}</p>
            ) : (
              <div className="space-y-3">
                {selStats.comments.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex-shrink-0">
                      <div className="flex gap-0.5 mt-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={11} className={s <= c.score ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 italic">&ldquo;{c.comment}&rdquo;</p>
                      <p className="text-xs text-gray-400 mt-1">{c.ref} · {formatDate(c.date, locale)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ALL AGENTS COMPARISON TABLE ── */}
      {selectedAgent === 'all' && (
        <>
          {/* Global charts */}
          <AgentPerformanceCharts trendData={trendData} urgencyData={urgencyData} locale={locale} />

          {/* Comparison table */}
          <div className="bg-white rounded-2xl border border-gray-100 card-shadow mt-5 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{isFr ? 'Comparatif des agents' : 'Agent comparison'}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="px-5 py-3 text-left w-10">{L.table.rank}</th>
                    <th className="px-3 py-3 text-left">{L.table.agent}</th>
                    <th className="px-3 py-3 text-right">{L.table.treated}</th>
                    <th className="px-3 py-3 text-right">{L.table.sat}</th>
                    <th className="px-3 py-3 text-right">{L.table.resolution}</th>
                    <th className="px-3 py-3 text-right">{L.table.firstResp}</th>
                    <th className="px-3 py-3 text-right">{L.table.sla}</th>
                    <th className="px-3 py-3 text-right">{L.table.msgs}</th>
                    <th className="px-3 py-3 text-right">{L.table.charge}</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allAgentStats.map((a, i) => {
                    const s = a.stats
                    const satColor = s.avgSat !== null && teamStats.avgSat !== null
                      ? s.avgSat >= teamStats.avgSat ? 'text-emerald-600' : 'text-red-500'
                      : 'text-gray-500'
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedAgent(a.id)}>
                        <td className="px-5 py-3 text-center">
                          <span className="text-sm">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-400 text-xs">{i+1}</span>}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1B3A5C]/10 text-[#1B3A5C] text-xs font-bold flex items-center justify-center">{a.firstName?.[0]}</div>
                            <span className="font-medium text-gray-900">{a.firstName} {a.lastName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900">{s.count}</td>
                        <td className={`px-3 py-3 text-right font-semibold ${satColor}`}>
                          {s.avgSat !== null ? `${s.avgSat}/5` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{fmtH(s.avgRes)}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{fmtH(s.avgFirstR)}</td>
                        <td className="px-3 py-3 text-right">
                          {s.slaGlobal !== null ? (
                            <span className={`font-semibold text-xs ${s.slaGlobal >= 80 ? 'text-emerald-600' : s.slaGlobal >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                              {s.slaGlobal}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{s.avgMsgs ?? '—'}</td>
                        <td className="px-3 py-3 text-right">
                          {s.active > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">{s.active}</span>
                          ) : <span className="text-gray-300">0</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-[#4A8FC4] font-medium hover:text-[#1B3A5C]">{L.table.detail} →</span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Team average row */}
                  <tr className="bg-[#1B3A5C]/5 font-semibold border-t-2 border-[#1B3A5C]/20">
                    <td className="px-5 py-3" />
                    <td className="px-3 py-3 text-xs font-bold text-[#1B3A5C] uppercase tracking-wide">{L.table.teamAvg}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{teamStats.count}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{teamStats.avgSat !== null ? `${teamStats.avgSat}/5` : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmtH(teamStats.avgRes)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmtH(teamStats.avgFirstR)}</td>
                    <td className="px-3 py-3 text-right">
                      {teamStats.slaGlobal !== null ? (
                        <span className={`font-semibold text-xs ${teamStats.slaGlobal >= 80 ? 'text-emerald-600' : teamStats.slaGlobal >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                          {teamStats.slaGlobal}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{teamStats.avgMsgs ?? '—'}</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* All comments */}
          <div className="bg-white rounded-2xl border border-gray-100 card-shadow mt-5 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.comments}</h3>
            {(() => {
              const allComments = allAgentStats.flatMap(a =>
                a.stats.comments.map((c: any) => ({ ...c, agentName: `${a.firstName} ${a.lastName}` }))
              ).slice(0, 10)
              return allComments.length === 0 ? (
                <p className="text-sm text-gray-400">{L.noComments}</p>
              ) : (
                <div className="space-y-3">
                  {allComments.map((c, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="flex-shrink-0">
                        <p className="text-xs font-semibold text-gray-600 mb-1">{c.agentName}</p>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={11} className={s <= c.score ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 italic">&ldquo;{c.comment}&rdquo;</p>
                        <p className="text-xs text-gray-400 mt-1">{c.ref} · {formatDate(c.date, locale)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </>
      )}

    </DashboardLayout>
  )
}
