'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { PlusCircle, Inbox, ChevronRight, Search, ChevronDown, X, RefreshCw } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  PENDING:     'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  TREATED:     'bg-emerald-100 text-emerald-700',
  CLOSED:      'bg-emerald-100 text-emerald-700',
}
const STATUS_DOT: Record<string, string> = {
  PENDING:     'bg-amber-400',
  IN_PROGRESS: 'bg-blue-400',
  TREATED:     'bg-emerald-400',
  CLOSED:      'bg-emerald-400',
}

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function DropdownFilter({ label, options, selected, onToggle, onClear, active }: {
  label: string; options: { value: string | number; label: string }[]
  selected: (string | number)[]; onToggle: (v: string | number) => void
  onClear: () => void; active: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="flex-shrink-0">
      <button ref={btnRef} onClick={handleToggle}
        className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
          active ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]' : 'bg-white border-gray-200 text-gray-600'
        }`}>
        {label}{selected.length > 0 && ` (${selected.length})`}
        <ChevronDown size={11} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-2xl shadow-xl min-w-[150px] py-1.5 max-h-56 overflow-y-auto">
          {selected.length > 0 && (
            <button onClick={() => { onClear(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 border-b border-gray-100 mb-1">
              <X size={10} /> Effacer
            </button>
          )}
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" className="rounded accent-[#1B3A5C] w-3.5 h-3.5"
                checked={selected.includes(opt.value)} onChange={() => onToggle(opt.value)} />
              <span className="text-xs text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MesDemandesPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [allTickets, setAllTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [countdown, setCountdown] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [yearFilter, setYearFilter]   = useState<number[]>([])
  const [monthFilter, setMonthFilter] = useState<number[]>([])
  const [dayFilter, setDayFilter]     = useState<number[]>([])

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  const loadData = useCallback((silent = false) => {
    if (!silent) setRefreshing(true)
    Promise.all([
      apiFetch('/api/tickets').then(r => r.json()),
      apiFetch('/api/notifications').then(r => r.json()),
    ]).then(([tks, notifs]) => {
      setAllTickets(Array.isArray(tks) ? tks : [])
      setUnreadCount(Array.isArray(notifs) ? notifs.filter((n: any) => !n.isRead).length : 0)
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
  const MONTHS = isFr ? MONTHS_FR : MONTHS_EN

  const availableYears = [...new Set(allTickets.map(t => new Date(t.createdAt).getFullYear()))].sort((a, b) => b - a)

  function toggleStatus(v: string)  { setStatusFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) }
  function toggleYear(v: number | string)  { setYearFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number]) }
  function toggleMonth(v: number | string) { setMonthFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number]) }
  function toggleDay(v: number | string)   { setDayFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number]) }

  const filtered = allTickets.filter(t => {
    if (search.trim() && !t.ref.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter.length > 0) {
      const matched = statusFilter.some(s => s === 'TREATED' ? (t.status === 'TREATED' || t.status === 'CLOSED') : t.status === s)
      if (!matched) return false
    }
    const d = new Date(t.createdAt)
    if (yearFilter.length > 0  && !yearFilter.includes(d.getFullYear())) return false
    if (monthFilter.length > 0 && !monthFilter.includes(d.getMonth() + 1)) return false
    if (dayFilter.length > 0   && !dayFilter.includes(d.getDate())) return false
    return true
  })

  const hasFilter = !!(search || statusFilter.length || yearFilter.length || monthFilter.length || dayFilter.length)

  const statusLabel: Record<string, string> = {
    PENDING:    isFr ? 'En attente' : 'Pending',
    IN_PROGRESS: isFr ? 'En cours' : 'In progress',
    TREATED:    isFr ? 'Traité' : 'Treated',
    CLOSED:     isFr ? 'Traité' : 'Treated',
  }

  const statusOptions = [
    { value: 'PENDING',     label: isFr ? 'En attente' : 'Pending' },
    { value: 'IN_PROGRESS', label: isFr ? 'En cours' : 'In progress' },
    { value: 'TREATED',     label: isFr ? 'Traités' : 'Treated' },
  ]

  const t = {
    title:      isFr ? 'Mes demandes' : 'My requests',
    newRequest: isFr ? 'Nouvelle' : 'New',
    empty:      isFr ? 'Aucune demande' : 'No requests',
    emptySub:   isFr ? 'Créez votre première demande' : 'Create your first request',
    results:    isFr ? 'résultat(s)' : 'result(s)',
    searchPh:   isFr ? 'Rechercher par réf...' : 'Search by ref...',
    status:     isFr ? 'Statut' : 'Status',
    year:       isFr ? 'Année' : 'Year',
    month:      isFr ? 'Mois' : 'Month',
    day:        isFr ? 'Jour' : 'Day',
    clearAll:   isFr ? 'Effacer' : 'Clear',
  }

  const circumference = 2 * Math.PI * 12

  return (
    <MobileLayout locale={locale} title={t.title} unreadCount={unreadCount}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 font-medium">{filtered.length} {t.results}</p>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="24" className="-rotate-90">
              <circle cx="12" cy="12" r="10" fill="none" stroke="#e5e7eb" strokeWidth="2" />
              <circle cx="12" cy="12" r="10" fill="none" stroke="#4A8FC4" strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - countdown / 30)} />
            </svg>
            <button onClick={() => { loadData(); setCountdown(30) }}
              className="text-gray-400 active:text-[#1B3A5C] transition-colors">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <Link href={`/${locale}/nouvelle-demande`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B3A5C] text-white text-xs font-semibold">
          <PlusCircle size={13} /> {t.newRequest}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t.searchPh}
          className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]" />
      </div>

      {/* Filters row */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        <DropdownFilter label={t.status}  options={statusOptions}                                                           selected={statusFilter} onToggle={toggleStatus} onClear={() => setStatusFilter([])} active={statusFilter.length > 0} />
        <DropdownFilter label={t.year}    options={availableYears.map(y => ({ value: y, label: String(y) }))}               selected={yearFilter}   onToggle={toggleYear}   onClear={() => setYearFilter([])}   active={yearFilter.length > 0} />
        <DropdownFilter label={t.month}   options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}                     selected={monthFilter}  onToggle={toggleMonth}  onClear={() => setMonthFilter([])}  active={monthFilter.length > 0} />
        <DropdownFilter label={t.day}     options={[...Array(31)].map((_, i) => ({ value: i + 1, label: String(i + 1) }))} selected={dayFilter}    onToggle={toggleDay}    onClear={() => setDayFilter([])}    active={dayFilter.length > 0} />
        {hasFilter && (
          <button onClick={() => { setSearch(''); setStatusFilter([]); setYearFilter([]); setMonthFilter([]); setDayFilter([]) }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
            <X size={11} /> {t.clearAll}
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t.empty}</p>
          <p className="text-xs text-gray-400 mb-5">{t.emptySub}</p>
          <Link href={`/${locale}/nouvelle-demande`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold">
            <PlusCircle size={15} /> {t.newRequest}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket: any) => (
            <Link key={ticket.id} href={`/${locale}/mes-demandes/${ticket.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-gray-100 active:scale-[0.99] transition-transform">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[ticket.status] ?? 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-gray-400">{ticket.ref}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[ticket.status] ?? ticket.status}
                  </span>
                  {(ticket.ticketMode === 'BL_PREMIUM' || ticket.ticketMode === 'INFO_PREMIUM') && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">⚡ Premium</span>
                  )}
                  {(ticket.ticketMode === 'INFO_SIMPLE' || ticket.ticketMode === 'INFO_PREMIUM') && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">💬 Info</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {(() => {
                    if (ticket.subject) return ticket.subject
                    if (ticket.ticketMode === 'INFO_SIMPLE' || ticket.ticketMode === 'INFO_PREMIUM') {
                      const desc = (ticket.description || '').replace(/^(bonjour|bonsoir|svp|s\.v\.p\.|salut|hello|hi|j['']aimerais|je voudrais|pouvez-vous|pourriez-vous)[,\s]*/i, '').trim()
                      return desc ? desc.slice(0, 80) + (desc.length > 80 ? '…' : '') : ticket.category
                    }
                    return ticket.category + (ticket.subcategory ? ` — ${ticket.subcategory}` : '')
                  })()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(ticket.createdAt, locale)}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </MobileLayout>
  )
}
