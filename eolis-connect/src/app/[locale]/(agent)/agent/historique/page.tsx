'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { UrgencyBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { ChevronRight, Trophy, Search, ChevronDown, X, Star } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

function MultiSelect({ label, options, selected, onToggle, onClear, isFr }: {
  label: string
  options: { value: number | string; label: string }[]
  selected: (number | string)[]
  onToggle: (v: number | string) => void
  onClear: () => void
  isFr: boolean
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
    <div className="relative">
      <button ref={btnRef} onClick={handleToggle}
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
          className="bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] py-1.5 max-h-60 overflow-y-auto">
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

export default function AgentHistoriquePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter]       = useState<number[]>([])
  const [monthFilter, setMonthFilter]     = useState<number[]>([])
  const [dayFilter, setDayFilter]         = useState<number[]>([])
  const [urgencyFilter, setUrgencyFilter] = useState<string[]>([])

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    apiFetch('/api/tickets').then(r => r.json()).then((data: any[]) => {
      const isAdm = u.role === 'OPS_ADMIN' || u.role === 'SYSTEM_ADMIN'
      setTickets(data.filter(t =>
        (t.status === 'TREATED' || t.status === 'CLOSED') &&
        (isAdm || t.agentId === u.id)
      ))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [locale])

  const isFr = locale === 'fr'

  if (loading || !user) return null

  const isAdmin = user.role === 'OPS_ADMIN' || user.role === 'SYSTEM_ADMIN'

  const MONTHS = isFr ? MONTHS_FR : MONTHS_EN
  const availableYears = [...new Set(tickets.map(t => new Date(t.closedAt ?? t.updatedAt).getFullYear()))].sort((a, b) => b - a)
  const availableDays  = [...Array(31)].map((_, i) => i + 1)

  function toggleYear(v: number | string)    { setYearFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number]) }
  function toggleMonth(v: number | string)   { setMonthFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number]) }
  function toggleDay(v: number | string)     { setDayFilter(p => p.includes(v as number) ? p.filter(x => x !== v) : [...p, v as number]) }
  function toggleUrgency(v: number | string) { setUrgencyFilter(p => p.includes(v as string) ? p.filter(x => x !== v) : [...p, v as string]) }

  const filtered = tickets.filter(t => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = `${t.client?.firstName ?? ''} ${t.client?.lastName ?? ''}`.toLowerCase()
      if (!t.ref.toLowerCase().includes(q) && !name.includes(q)) return false
    }
    if (urgencyFilter.length > 0 && !urgencyFilter.includes(t.urgency)) return false
    const d = new Date(t.closedAt ?? t.updatedAt)
    if (yearFilter.length > 0  && !yearFilter.includes(d.getFullYear())) return false
    if (monthFilter.length > 0 && !monthFilter.includes(d.getMonth() + 1)) return false
    if (dayFilter.length > 0   && !dayFilter.includes(d.getDate())) return false
    return true
  })

  const hasFilter = !!(search || yearFilter.length || monthFilter.length || dayFilter.length || urgencyFilter.length)

  const t = {
    title:    isAdmin ? (isFr ? 'Dossiers traités' : 'Treated tickets') : (isFr ? 'Mon historique' : 'My history'),
    sub:      isAdmin ? (isFr ? 'Tous les dossiers clôturés dans le système' : 'All closed tickets in the system') : (isFr ? 'Tous vos dossiers traités' : 'All your treated tickets'),
    ref:      isFr ? 'Référence' : 'Reference',
    client:   'Client',
    category: isFr ? 'Catégorie' : 'Category',
    urgency:  isFr ? 'Urgence' : 'Urgency',
    agent:    isFr ? 'Agent' : 'Agent',
    closedAt: isFr ? 'Clôturé le' : 'Closed on',
    view:     isFr ? 'Voir' : 'View',
    noHistory:  isFr ? 'Aucun dossier trouvé' : 'No tickets found',
    total:    isFr ? 'dossier(s) traité(s)' : 'treated ticket(s)',
    search:   isFr ? 'Réf. ou client...' : 'Ref. or client...',
    year:     isFr ? 'Année' : 'Year',
    month:    isFr ? 'Mois' : 'Month',
    day:      isFr ? 'Jour' : 'Day',
    clearAll: isFr ? 'Effacer les filtres' : 'Clear filters',
    results:  isFr ? 'résultat(s)' : 'result(s)',
    rating:   isFr ? 'Satisfaction' : 'Satisfaction',
    noRating: isFr ? 'Non noté' : 'Not rated',
  }

  const urgencyOptions = [
    { value: 'HIGH',   label: isFr ? '🔴 Élevée' : '🔴 High' },
    { value: 'MEDIUM', label: isFr ? '🟡 Moyenne' : '🟡 Medium' },
    { value: 'LOW',    label: isFr ? '🟢 Faible' : '🟢 Low' },
  ]

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} {t.results} / {tickets.length} {t.total}</p>
        </div>
        {hasFilter && (
          <button onClick={() => { setSearch(''); setYearFilter([]); setMonthFilter([]); setDayFilter([]); setUrgencyFilter([]) }}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium">
            <X size={14} /> {t.clearAll}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
        </div>

        <MultiSelect label={t.urgency} options={urgencyOptions}                                                                    selected={urgencyFilter} onToggle={toggleUrgency} onClear={() => setUrgencyFilter([])} isFr={isFr} />
        <MultiSelect label={t.year}   options={availableYears.map(y => ({ value: y, label: String(y) }))}                        selected={yearFilter}    onToggle={toggleYear}    onClear={() => setYearFilter([])}    isFr={isFr} />
        <MultiSelect label={t.month}  options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}                               selected={monthFilter}   onToggle={toggleMonth}   onClear={() => setMonthFilter([])}   isFr={isFr} />
        <MultiSelect label={t.day}    options={availableDays.map(d => ({ value: d, label: String(d) }))}                         selected={dayFilter}     onToggle={toggleDay}     onClear={() => setDayFilter([])}     isFr={isFr} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow flex flex-col items-center py-16">
          <Trophy size={32} className="text-gray-300 mb-3" />
          <p className="text-gray-500">{t.noHistory}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">{t.ref}</th>
                  <th className="px-3 py-3 text-left">{t.client}</th>
                  <th className="px-3 py-3 text-left">{t.category}</th>
                  <th className="px-3 py-3 text-left">{t.urgency}</th>
                  {isAdmin && <th className="px-3 py-3 text-left">{t.agent}</th>}
                  <th className="px-3 py-3 text-left">{t.closedAt}</th>
                  <th className="px-3 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((ticket: any) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-gray-500">{ticket.ref}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">
                      {ticket.client?.firstName} {ticket.client?.lastName}
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      <p>{ticket.category}</p>
                      <p className="text-xs text-gray-400">{ticket.subcategory}</p>
                    </td>
                    <td className="px-3 py-3"><UrgencyBadge urgency={ticket.urgency} locale={locale} /></td>
                    {isAdmin && (
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {ticket.agent ? `${ticket.agent.firstName} ${ticket.agent.lastName}` : '—'}
                      </td>
                    )}
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(ticket.closedAt ?? ticket.updatedAt, locale)}
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/${locale}/agent/dossiers/${ticket.id}`}
                        className="flex items-center gap-1 text-[#4A8FC4] text-xs font-medium hover:text-[#1B3A5C]">
                        {t.view} <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
