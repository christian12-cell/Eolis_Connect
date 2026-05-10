'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUser, apiFetch } from '@/lib/api-client'
import { timeAgo, startOfTodayWAT, formatDate } from '@/lib/utils'
import {
  AlertTriangle, FileText, Clock, Star, CheckCircle,
  RefreshCw, ChevronRight, Activity, Users, Target, Zap, ChevronDown, X,
} from 'lucide-react'
import OpsDashboardCharts from './OpsDashboardCharts'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SLA_HOURS: Record<string, number> = { HIGH: 3, MEDIUM: 5, LOW: 10 }
const SLA_CAP = 24 // all urgencies: 0 pts at 24h+

const URGENCY_META: Record<string, { emoji: string; fr: string; en: string; text: string; bar: string }> = {
  HIGH:   { emoji: '🔴', fr: 'Élevée',  en: 'High',   text: 'text-red-600',    bar: 'bg-red-500'     },
  MEDIUM: { emoji: '🟡', fr: 'Moyenne', en: 'Medium', text: 'text-amber-600',  bar: 'bg-amber-400'   },
  LOW:    { emoji: '🟢', fr: 'Faible',  en: 'Low',    text: 'text-emerald-600',bar: 'bg-emerald-500' },
}

function fmtH(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ── MultiSelect dropdown ──────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onToggle, onClear, isFr }: {
  label: string
  options: { value: number | string; label: string }[]
  selected: (number | string)[]
  onToggle: (v: number | string) => void
  onClear: () => void
  isFr: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${
          selected.length > 0
            ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
        }`}>
        {label}{selected.length > 0 && ` (${selected.length})`}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg min-w-[170px] py-1.5 max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <button onClick={() => { onClear(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100 mb-1">
              <X size={11} /> {isFr ? 'Effacer' : 'Clear'}
            </button>
          )}
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" className="rounded accent-[#1B3A5C]"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)} />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, icon, color }: {
  label: string; value: string | number; sub?: string; subColor?: string
  icon: React.ReactNode; color: string
}) {
  const palette: Record<string, string> = {
    navy:    'bg-[#1B3A5C]/10 text-[#1B3A5C]',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple:  'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 leading-tight">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${palette[color] ?? palette.navy}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor ?? 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function OpsDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]           = useState('fr')
  const [user, setUser]               = useState<any>(null)
  const [tickets, setTickets]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [secAgo, setSecAgo]           = useState(0)
  const [yearFilter, setYearFilter]   = useState<number[]>([])
  const [monthFilter, setMonthFilter] = useState<number[]>([])
  const [dayFilter, setDayFilter]     = useState<number[]>([])

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  const loadData = useCallback(() => {
    setRefreshing(true)
    Promise.all([
      apiFetch('/api/tickets').then(r => r.json()),
      apiFetch('/api/notifications/check-final-unread', { method: 'POST' }).catch(() => {}),
    ]).then(([data]) => {
      setTickets(Array.isArray(data) ? data : [])
      setLastRefresh(new Date())
      setSecAgo(0)
      setLoading(false)
      setRefreshing(false)
    }).catch(() => { setLoading(false); setRefreshing(false) })
  }, [])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    loadData()
    const iv = setInterval(loadData, 60000)
    return () => clearInterval(iv)
  }, [locale, loadData])

  useEffect(() => {
    const iv = setInterval(() => setSecAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [lastRefresh])

  if (loading || !user) return null

  const isFr   = locale === 'fr'
  const MONTHS = isFr ? MONTHS_FR : MONTHS_EN
  const now    = new Date()
  const todayStart = startOfTodayWAT()

  const closedAll = tickets.filter(t => t.status === 'TREATED' || t.status === 'CLOSED')

  // ── KPIs (real-time, no filter) ──────────────────────────────────────────
  const totalTickets = tickets.length
  const pending      = tickets.filter(t => t.status === 'PENDING').length
  const inProgress   = tickets.filter(t => t.status === 'IN_PROGRESS').length
  const unassigned   = tickets.filter(t => !t.agentId && t.status === 'PENDING')

  const treatedToday = closedAll.filter(t => {
    const raw = t.closedAt ?? t.updatedAt; if (!raw) return false
    const ts = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? new Date(raw) : new Date(raw + 'Z')
    return ts.getTime() >= todayStart
  }).length

  const allScores = tickets.filter(t => t.satisfactionRating?.score).map(t => t.satisfactionRating.score)
  const avgSat    = allScores.length
    ? +(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1) : null

  const resTimes  = closedAll.filter(t => t.closedAt ?? t.updatedAt)
    .map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
  const avgResolution = resTimes.length
    ? +(resTimes.reduce((a, b) => a + b, 0) / resTimes.length).toFixed(1) : null

  // week-over-week new ticket volume (for "flux" sub on Total card)
  const last7New = tickets.filter(t => new Date(t.createdAt).getTime() >= now.getTime() - 7 * 86400000).length
  const prev7New = tickets.filter(t => {
    const d = new Date(t.createdAt).getTime()
    return d >= now.getTime() - 14 * 86400000 && d < now.getTime() - 7 * 86400000
  }).length
  const weekDiff   = last7New - prev7New
  const trendLabel = weekDiff > 0
    ? `↑ +${weekDiff} ${isFr ? 'nouveaux vs sem. dern.' : 'new vs last week'}`
    : weekDiff < 0
    ? `↓ ${weekDiff} ${isFr ? 'nouveaux vs sem. dern.' : 'new vs last week'}`
    : isFr ? '→ stable vs sem. dern.' : '→ stable vs last week'
  const trendColor = weekDiff > 0 ? 'text-red-500' : weekDiff < 0 ? 'text-emerald-600' : 'text-gray-400'

  // ── Alerts ────────────────────────────────────────────────────────────────
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600000)
  const oneHourAgo  = new Date(now.getTime() - 3600000)

  const highUnattended = tickets.filter(t =>
    t.urgency === 'HIGH' && (t.status === 'PENDING' || t.status === 'IN_PROGRESS') &&
    new Date(t.createdAt) < twoHoursAgo
  )
  const unreadMsgs = tickets.filter(t => {
    const msgs: any[] = t.messages ?? []
    const last = [...msgs].reverse().find((m: any) => m.senderType === 'CLIENT')
    return last && !last.isRead && new Date(last.createdAt) < oneHourAgo
  })

  // ── SLA compliance ────────────────────────────────────────────────────────
  const slaRows = ['HIGH', 'MEDIUM', 'LOW'].map(urgency => {
    const uts = closedAll.filter(t => t.urgency === urgency && (t.closedAt ?? t.updatedAt))
    const ok  = uts.filter(t => {
      const h = (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000
      return h <= SLA_HOURS[urgency]
    }).length
    const pct = uts.length ? Math.round(ok / uts.length * 100) : null
    return { urgency, total: uts.length, ok, pct }
  })

  // ── Record fastest per urgency ────────────────────────────────────────────
  const records = ['HIGH', 'MEDIUM', 'LOW'].map(urgency => {
    const uts = closedAll
      .filter(t => t.urgency === urgency && (t.closedAt ?? t.updatedAt))
      .map(t => ({ ...t, resH: (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000 }))
      .sort((a, b) => a.resH - b.resH)
    return uts[0] ? { urgency, ticket: uts[0] } : null
  }).filter(Boolean) as { urgency: string; ticket: any }[]

  // ── Chart filters ─────────────────────────────────────────────────────────
  const hasFilter = !!(yearFilter.length || monthFilter.length || dayFilter.length)

  const filteredTickets = hasFilter
    ? tickets.filter(t => {
        const d = new Date(t.createdAt)
        if (yearFilter.length  && !yearFilter.includes(d.getFullYear())) return false
        if (monthFilter.length && !monthFilter.includes(d.getMonth() + 1)) return false
        if (dayFilter.length   && !dayFilter.includes(d.getDate())) return false
        return true
      })
    : tickets

  // ── Volume data (with urgency-split treated lines) ────────────────────────
  function pointStats(newTickets: any[], date: { y: number; m: number; d?: number }) {
    // tickets treated (closed) on this exact date
    const treated = closedAll.filter(t => {
      const raw = t.closedAt ?? t.updatedAt; if (!raw) return false
      const td = new Date(raw)
      const yOk = td.getFullYear() === date.y
      const mOk = td.getMonth() + 1 === date.m
      const dOk = date.d !== undefined ? td.getDate() === date.d : true
      return yOk && mOk && dOk
    })
    return {
      nouveaux: newTickets.length,
      highT:    treated.filter(t => t.urgency === 'HIGH').length,
      mediumT:  treated.filter(t => t.urgency === 'MEDIUM').length,
      lowT:     treated.filter(t => t.urgency === 'LOW').length,
    }
  }

  function buildVolumeData() {
    if (monthFilter.length > 0) {
      const year = yearFilter[0] ?? now.getFullYear()
      return monthFilter.slice().sort((a, b) => a - b).flatMap(m => {
        const daysInMonth = new Date(year, m, 0).getDate()
        const days = dayFilter.length
          ? dayFilter.filter(d => d <= daysInMonth).sort((a, b) => a - b)
          : Array.from({ length: daysInMonth }, (_, i) => i + 1)
        return days.map(d => {
          const label = new Date(year, m - 1, d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          const newT = filteredTickets.filter(t => {
            const td = new Date(t.createdAt)
            return td.getDate() === d && td.getMonth() + 1 === m && td.getFullYear() === year
          })
          return { date: label, ...pointStats(newT, { y: year, m, d }) }
        })
      })
    }
    if (yearFilter.length > 0) {
      // monthly breakdown per year (day filter ignored at this granularity)
      return yearFilter.slice().sort().flatMap(year =>
        MONTHS.map((mon, mi) => {
          const m = mi + 1
          const label = `${mon.slice(0, 3)} ${String(year).slice(2)}`
          const newT = filteredTickets.filter(t => {
            const td = new Date(t.createdAt)
            return td.getMonth() + 1 === m && td.getFullYear() === year
          })
          const treated = closedAll.filter(t => {
            const raw = t.closedAt ?? t.updatedAt; if (!raw) return false
            const td = new Date(raw)
            return td.getMonth() + 1 === m && td.getFullYear() === year
          })
          return {
            date: label,
            nouveaux: newT.length,
            highT:   treated.filter(t => t.urgency === 'HIGH').length,
            mediumT: treated.filter(t => t.urgency === 'MEDIUM').length,
            lowT:    treated.filter(t => t.urgency === 'LOW').length,
          }
        })
      )
    }
    // Default: last 30 days (apply day filter to which days are shown)
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (29 - i)); return d
    }).filter(d => !dayFilter.length || dayFilter.includes(d.getDate()))

    return days.map(d => {
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      const newT = tickets.filter(t => {
        const td = new Date(t.createdAt)
        return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear()
      })
      return { date: label, ...pointStats(newT, { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }) }
    })
  }

  const volumeData = buildVolumeData()

  // status + category (from filtered tickets)
  const statusData = [
    { name: isFr ? 'En attente'  : 'Pending',    value: filteredTickets.filter(t => t.status === 'PENDING').length,    color: '#F59E0B' },
    { name: isFr ? 'En cours'    : 'In progress', value: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length, color: '#3B82F6' },
    { name: isFr ? 'Traités'     : 'Treated',     value: filteredTickets.filter(t => t.status === 'TREATED' || t.status === 'CLOSED').length, color: '#10B981' },
  ].filter(d => d.value > 0)

  const catMap: Record<string, number> = {}
  filteredTickets.forEach(t => { catMap[t.category] = (catMap[t.category] ?? 0) + 1 })
  const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }))

  // ── Performance trend: ALL closed tickets, auto-grouped, 3 urgency lines ──
  function buildPerfData() {
    if (!closedAll.length) return []
    const timestamps = closedAll.map(t => new Date(t.closedAt ?? t.updatedAt).getTime()).filter(d => !isNaN(d))
    if (!timestamps.length) return []
    const dayRange = (Date.now() - Math.min(...timestamps)) / 86400000
    type G = 'day' | 'week' | 'month'
    const by: G = dayRange > 60 ? 'month' : dayRange > 14 ? 'week' : 'day'
    const n = by === 'month' ? 12 : 12

    const series: { label: string; tickets: any[] }[] = Array.from({ length: n }, (_, i) => {
      if (by === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
        const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        return { label, tickets: closedAll.filter(t => {
          const td = new Date(t.closedAt ?? t.updatedAt)
          return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear()
        })}
      }
      if (by === 'week') {
        const ws = new Date(now); ws.setDate(ws.getDate() - (n - 1 - i) * 7); ws.setHours(0, 0, 0, 0)
        const we = new Date(ws); we.setDate(we.getDate() + 6); we.setHours(23, 59, 59, 999)
        const label = ws.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        return { label, tickets: closedAll.filter(t => {
          const td = new Date(t.closedAt ?? t.updatedAt); return td >= ws && td <= we
        })}
      }
      const d = new Date(now); d.setDate(d.getDate() - (n - 1 - i)); d.setHours(0, 0, 0, 0)
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      return { label, tickets: closedAll.filter(t => {
        const td = new Date(t.closedAt ?? t.updatedAt)
        return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear()
      })}
    })

    function computeDetail(pts: any[], urgency: string) {
      const uts = pts.filter(t => t.urgency === urgency)
      if (!uts.length) return { composite: null, avgSat: null, avgTime: null, satScore: null, speedScore: null, count: 0 }
      const scores  = uts.filter(t => t.satisfactionRating?.score).map(t => t.satisfactionRating.score)
      const avgSat  = scores.length ? +(scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2) : null
      const rawT    = uts.filter(t => t.closedAt ?? t.updatedAt)
        .map(t => (new Date(t.closedAt ?? t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
        .filter(h => !isNaN(h) && isFinite(h))
      const avgTime = rawT.length ? +(rawT.reduce((a, b) => a + b, 0) / rawT.length).toFixed(2) : null
      const satScore   = avgSat  !== null ? +(avgSat / 5 * 100).toFixed(1)                                          : null
      const speedScore = avgTime !== null ? +Math.max(0, 100 - (avgTime / SLA_CAP) * 100).toFixed(1) : null
      const composite  = satScore !== null || speedScore !== null
        ? +((satScore ?? 50) * 0.5 + (speedScore ?? 50) * 0.5).toFixed(1) : null
      return { composite, avgSat, avgTime, satScore, speedScore, count: uts.length }
    }

    return series.map(p => {
      const highD   = computeDetail(p.tickets, 'HIGH')
      const mediumD = computeDetail(p.tickets, 'MEDIUM')
      const lowD    = computeDetail(p.tickets, 'LOW')
      return {
        date:         p.label,
        HIGH:         highD.composite,
        MEDIUM:       mediumD.composite,
        LOW:          lowD.composite,
        highDetail:   highD,
        mediumDetail: mediumD,
        lowDetail:    lowD,
        totalCount:   p.tickets.length,
      }
    })
  }

  const perfData = buildPerfData()

  const availableYears = [...new Set(tickets.map(t => new Date(t.createdAt).getFullYear()))].sort((a, b) => b - a)
  const availableDays  = [...Array(31)].map((_, i) => i + 1)

  const urgentQueue = [...tickets]
    .filter(t => t.urgency === 'HIGH' && (t.status === 'PENDING' || t.status === 'IN_PROGRESS'))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 5)

  const L = {
    title:     isFr ? "Vue d'ensemble" : 'Overview',
    refreshed: isFr ? `Actualisé il y a ${secAgo}s` : `Refreshed ${secAgo}s ago`,
    refresh:   isFr ? 'Actualiser' : 'Refresh',
    clearAll:  isFr ? 'Effacer les filtres' : 'Clear filters',
    slaTarget: (u: string) => `${isFr ? 'Objectif' : 'Target'}: ${u === 'HIGH' ? '<3h' : u === 'MEDIUM' ? '<5h' : '<10h'}`,
    slaDesc:   isFr
      ? '% de dossiers résolus dans le délai cible'
      : '% of tickets resolved within target time',
    noData:    isFr ? 'Pas de données' : 'No data',
    dossiers:  isFr ? 'dossier(s)' : 'ticket(s)',
    record:    (u: string) => `${isFr ? 'Record' : 'Best time'} ${URGENCY_META[u]?.emoji} ${isFr ? URGENCY_META[u]?.fr : URGENCY_META[u]?.en}`,
    noRecord:  isFr ? 'Aucun dossier traité' : 'No treated tickets',
    queueTitle: isFr ? 'File urgente — HIGH en attente' : 'Urgent queue — HIGH pending',
    noUrgent:  isFr ? 'Aucun dossier urgent en attente ✓' : 'No urgent tickets pending ✓',
    viewAll:   isFr ? 'Voir la file complète' : 'View full queue',
    kpi: {
      total:      isFr ? 'Total dossiers'       : 'Total tickets',
      pending:    isFr ? 'En attente'            : 'Pending',
      inProgress: isFr ? 'En cours'             : 'In progress',
      today:      isFr ? "Traités aujourd'hui"   : 'Treated today',
      sat:        isFr ? 'Satisfaction moyenne'  : 'Avg satisfaction',
      resolution: isFr ? 'Délai résolution moy.' : 'Avg resolution',
    },
    col: {
      ref: isFr ? 'Réf.' : 'Ref.', client: 'Client',
      cat: isFr ? 'Catégorie' : 'Category', agent: 'Agent',
      submitted: isFr ? 'Soumis' : 'Submitted',
      view: isFr ? 'Voir' : 'View', unassigned: isFr ? 'Non assigné' : 'Unassigned',
    },
    alert: {
      high:     (n: number) => isFr ? `${n} dossier(s) HIGH sans suivi depuis +2h` : `${n} HIGH urgency ticket(s) unattended for 2h+`,
      unassign: (n: number) => isFr ? `${n} dossier(s) en attente non assigné(s)` : `${n} unassigned pending ticket(s)`,
      unread:   (n: number) => isFr ? `${n} message(s) client non lu depuis +1h` : `${n} unread client message(s) for 1h+`,
      viewQ:    isFr ? 'Voir la file' : 'View queue',
    },
  }

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{L.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{L.refreshed}</p>
        </div>
        <button onClick={loadData} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {L.refresh}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <KpiCard label={L.kpi.total} value={totalTickets} icon={<FileText size={16}/>} color="navy"
          sub={trendLabel} subColor={trendColor} />
        <KpiCard label={L.kpi.pending} value={pending} icon={<Activity size={16}/>} color="amber"
          sub={unassigned.length > 0 ? `${unassigned.length} ${isFr ? 'non assigné(s)' : 'unassigned'}` : undefined} />
        <KpiCard label={L.kpi.inProgress} value={inProgress} icon={<Clock size={16}/>} color="blue" />
        <KpiCard label={L.kpi.today} value={treatedToday} icon={<CheckCircle size={16}/>} color="emerald" />
        <KpiCard label={L.kpi.sat}
          value={avgSat !== null ? `${avgSat}/5` : '—'}
          sub={allScores.length ? `${allScores.length} ${isFr ? 'avis' : 'reviews'}` : undefined}
          icon={<Star size={16}/>} color="amber" />
        <KpiCard label={L.kpi.resolution}
          value={avgResolution !== null ? `${avgResolution}h` : '—'}
          icon={<Target size={16}/>} color="purple" />
      </div>

      {/* SLA Compliance */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {slaRows.map(({ urgency, total, ok, pct }) => {
          const m = URGENCY_META[urgency]
          const scoreColor = pct !== null ? (pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600') : 'text-gray-300'
          return (
            <div key={urgency} className="bg-white rounded-2xl border border-gray-100 card-shadow p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${m.text}`}>{m.emoji} {isFr ? m.fr : m.en}</span>
                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{L.slaTarget(urgency)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2">{L.slaDesc}</p>
              <p className={`text-2xl font-bold mb-1.5 ${scoreColor}`}>
                {pct !== null ? `${pct}%` : L.noData}
              </p>
              {pct !== null ? (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div className={`h-1.5 rounded-full transition-all ${m.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{ok}/{total} {L.dossiers}</p>
                </>
              ) : (
                <p className="text-xs text-gray-300">{L.noData}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Alerts */}
      {(highUnattended.length > 0 || unassigned.length > 0 || unreadMsgs.length > 0) && (
        <div className="space-y-2 mb-5">
          {highUnattended.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-800 flex-1">{L.alert.high(highUnattended.length)}</p>
              <Link href={`/${locale}/agent/dashboard`} className="text-xs font-semibold text-red-600 hover:text-red-800 underline whitespace-nowrap">{L.alert.viewQ}</Link>
            </div>
          )}
          {unassigned.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <Users size={15} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-800 flex-1">{L.alert.unassign(unassigned.length)}</p>
              <Link href={`/${locale}/agent/dashboard`} className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline whitespace-nowrap">{L.alert.viewQ}</Link>
            </div>
          )}
          {unreadMsgs.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
              <Activity size={15} className="text-blue-500 flex-shrink-0" />
              <p className="text-sm font-medium text-blue-800 flex-1">{L.alert.unread(unreadMsgs.length)}</p>
              <Link href={`/${locale}/agent/dashboard`} className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline whitespace-nowrap">{L.alert.viewQ}</Link>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
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
        {hasFilter && (
          <button onClick={() => { setYearFilter([]); setMonthFilter([]); setDayFilter([]) }}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium">
            <X size={14} /> {L.clearAll}
          </button>
        )}
      </div>

      {/* Charts */}
      <OpsDashboardCharts
        volumeData={volumeData}
        perfData={perfData}
        statusData={statusData}
        categoryData={categoryData}
        locale={locale}
      />

      {/* Records par urgence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {(['HIGH', 'MEDIUM', 'LOW'] as const).map(urgency => {
          const found = records.find(r => r.urgency === urgency)
          const m = URGENCY_META[urgency]
          return (
            <div key={urgency} className="bg-white rounded-2xl border border-gray-100 card-shadow p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className={m.text} />
                <span className="text-sm font-semibold text-gray-900">{L.record(urgency)}</span>
              </div>
              {found ? (
                <>
                  <p className={`text-2xl font-bold ${m.text} mb-2`}>{fmtH(found.ticket.resH)}</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p className="font-mono font-bold text-gray-400">{found.ticket.ref}</p>
                    <p>{isFr ? 'par' : 'by'} <span className="font-semibold text-gray-800">{found.ticket.agent?.firstName} {found.ticket.agent?.lastName}</span></p>
                    <p>{found.ticket.category}{found.ticket.subcategory ? ` — ${found.ticket.subcategory}` : ''}</p>
                    <p className="text-gray-400">{isFr ? 'Reçu le' : 'Received'} {formatDate(found.ticket.createdAt, locale)}</p>
                  </div>
                  <Link href={`/${locale}/agent/dossiers/${found.ticket.id}`}
                    className={`mt-3 flex items-center gap-1 text-xs font-semibold ${m.text} hover:opacity-70`}>
                    {isFr ? 'Voir le dossier' : 'View ticket'} <ChevronRight size={12} />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-gray-400">{L.noRecord}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Urgent queue */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow mt-6 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-gray-900">{L.queueTitle}</h2>
            {urgentQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">{urgentQueue.length}</span>
            )}
          </div>
          <Link href={`/${locale}/agent/dashboard`}
            className="flex items-center gap-1 text-xs font-medium text-[#4A8FC4] hover:text-[#1B3A5C]">
            {L.viewAll} <ChevronRight size={12} />
          </Link>
        </div>
        {urgentQueue.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-emerald-500">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">{L.noUrgent}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="px-5 py-2.5 text-left">{L.col.ref}</th>
                  <th className="px-3 py-2.5 text-left">{L.col.client}</th>
                  <th className="px-3 py-2.5 text-left">{L.col.cat}</th>
                  <th className="px-3 py-2.5 text-left">{L.col.agent}</th>
                  <th className="px-3 py-2.5 text-left">{L.col.submitted}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {urgentQueue.map((ticket: any) => (
                  <tr key={ticket.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-red-500">{ticket.ref}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{ticket.client?.firstName} {ticket.client?.lastName}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      <p>{ticket.category}</p>
                      <p className="text-gray-400">{ticket.subcategory}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {ticket.agent
                        ? <span className="text-gray-600">{ticket.agent.firstName} {ticket.agent.lastName}</span>
                        : <span className="text-amber-600 font-semibold">{L.col.unassigned}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{timeAgo(ticket.createdAt, locale)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/${locale}/agent/dossiers/${ticket.id}`}
                        className="flex items-center gap-1 text-[#4A8FC4] text-xs font-semibold hover:text-[#1B3A5C] whitespace-nowrap">
                        {L.col.view} <ChevronRight size={12} />
                      </Link>
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
