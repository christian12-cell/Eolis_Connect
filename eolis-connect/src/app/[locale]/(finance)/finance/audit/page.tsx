'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import {
  Shield, Loader2, CheckCircle, XCircle, Plus, Trash2, AlertCircle,
  ShieldAlert, ShieldCheck, Search, ChevronLeft, ChevronRight,
} from 'lucide-react'

const EUR = 655.957; const USD = 600
function f2(n: number | null) { return n != null ? n.toFixed(2) : '—' }
function toUsd(f: number) { return (f / USD).toFixed(2) }
function toEur(f: number) { return (f / EUR).toFixed(2) }

const ACTION_META: Record<string, { icon: React.ReactNode; color: string; label_fr: string; label_en: string }> = {
  CREDIT_APPROVE:              { icon: <CheckCircle size={14} />,  color: 'text-emerald-600 bg-emerald-50', label_fr: 'Recharge approuvée',   label_en: 'Credit approved'        },
  CREDIT_REJECT:               { icon: <XCircle size={14} />,      color: 'text-red-500 bg-red-50',         label_fr: 'Recharge refusée',     label_en: 'Credit rejected'        },
  INFRA_COST_ADD:              { icon: <Plus size={14} />,          color: 'text-amber-600 bg-amber-50',     label_fr: 'Charge ajoutée',       label_en: 'Cost added'             },
  INFRA_COST_DELETE:           { icon: <Trash2 size={14} />,        color: 'text-gray-500 bg-gray-100',      label_fr: 'Charge supprimée',     label_en: 'Cost deleted'           },
  CREDIT_PENDING_ADMIN:        { icon: <ShieldAlert size={14} />,   color: 'text-orange-600 bg-orange-50',   label_fr: 'En attente admin',     label_en: 'Pending admin'          },
  CREDIT_ADMIN_CONFIRM:        { icon: <ShieldCheck size={14} />,   color: 'text-emerald-600 bg-emerald-50', label_fr: 'Confirmé admin',       label_en: 'Admin confirmed'        },
  CREDIT_ADMIN_REJECT:         { icon: <ShieldAlert size={14} />,   color: 'text-red-500 bg-red-50',         label_fr: 'Annulé admin',         label_en: 'Admin cancelled'        },
  CREDIT_DIRECT_ADMIN_APPROVE: { icon: <ShieldCheck size={14} />,   color: 'text-emerald-600 bg-emerald-50', label_fr: 'Approuvé direct admin', label_en: 'Direct admin approval' },
  CREDIT_DIRECT_ADMIN_REJECT:  { icon: <ShieldAlert size={14} />,   color: 'text-red-500 bg-red-50',         label_fr: 'Refusé direct admin',  label_en: 'Direct admin rejection' },
}

type Period = 'all' | 'day' | 'week' | 'month' | 'year'

const PERIOD_LABELS: Record<Period, { fr: string; en: string }> = {
  all:   { fr: 'Tout',       en: 'All'    },
  day:   { fr: 'Aujourd\'hui', en: 'Today' },
  week:  { fr: 'Semaine',    en: 'Week'   },
  month: { fr: 'Mois',       en: 'Month'  },
  year:  { fr: 'Année',      en: 'Year'   },
}

export default function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [logs, setLogs]     = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)

  const [searchInput, setSearchInput]   = useState('')
  const [searchQuery, setSearchQuery]   = useState('')
  const [period, setPeriod]             = useState<Period>('all')
  const [fromDate, setFromDate]         = useState('')
  const [toDate, setToDate]             = useState('')
  const [selected, setSelected]         = useState<Set<string>>(new Set())

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
    }, 500)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchLogs = useCallback(() => {
    setLoading(true)
    setSelected(new Set())
    const qs = new URLSearchParams()
    if (searchQuery)        qs.set('search', searchQuery)
    if (period !== 'all')   qs.set('period', period)
    if (fromDate)           qs.set('from', fromDate)
    if (toDate)             qs.set('to', toDate)
    qs.set('page', String(page))
    qs.set('page_size', '50')
    apiFetch(`/api/finance/audit-log?${qs}`)
      .then(r => r.json())
      .then(d => {
        setLogs(Array.isArray(d.items) ? d.items : [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [searchQuery, period, fromDate, toDate, page])

  useEffect(() => {
    if (!user) return
    fetchLogs()
  }, [user, fetchLogs])

  const isFr = locale === 'fr'

  const allSelected = logs.length > 0 && logs.every(l => selected.has(l.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(logs.map(l => l.id)))
  }
  function toggleOne(id: string) {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }

  function changePeriod(p: Period) {
    setPeriod(p)
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  function changeFromDate(v: string) {
    setFromDate(v)
    setPeriod('all')
    setPage(1)
  }

  function changeToDate(v: string) {
    setToDate(v)
    setPeriod('all')
    setPage(1)
  }

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-5 max-w-5xl">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-[#1B3A5C]" />
            {isFr ? 'Journal d\'audit financier' : 'Financial audit log'}
          </h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <AlertCircle size={12} />
            {isFr ? 'Journal immuable — toutes les actions financières sont enregistrées' : 'Immutable log — all financial actions are recorded'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={isFr ? 'Rechercher par action, détail, IP, utilisateur…' : 'Search by action, detail, IP, user…'}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
            />
          </div>

          {/* Period quick-filters */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'day', 'week', 'month', 'year'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => changePeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  period === p && !fromDate && !toDate
                    ? 'bg-[#1B3A5C] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isFr ? PERIOD_LABELS[p].fr : PERIOD_LABELS[p].en}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">{isFr ? 'Du' : 'From'}</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => changeFromDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">{isFr ? 'au' : 'to'}</span>
              <input
                type="date"
                value={toDate}
                onChange={e => changeToDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); setPage(1) }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                {isFr ? 'Effacer' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#1B3A5C]" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Shield size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucune action enregistrée pour ces critères.' : 'No actions match these criteria.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#4A8FC4] cursor-pointer"
                />
                <p className="font-bold text-gray-900 text-sm">
                  {total.toLocaleString()} {isFr ? 'action(s)' : 'action(s)'}
                  {someSelected && (
                    <span className="ml-2 text-xs font-normal text-[#4A8FC4]">
                      — {selected.size} {isFr ? 'sélectionné(s)' : 'selected'}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                {isFr ? `Page ${page} / ${pages}` : `Page ${page} / ${pages}`}
              </p>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {logs.map((l) => {
                const meta = ACTION_META[l.action]
                const isSelected = selected.has(l.id)
                return (
                  <div
                    key={l.id}
                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(l.id)}
                      className="w-4 h-4 mt-1 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#4A8FC4] cursor-pointer flex-shrink-0"
                    />

                    {/* Action badge */}
                    {meta && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5 ${meta.color}`}>
                        {meta.icon}
                        <span>{isFr ? meta.label_fr : meta.label_en}</span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{l.doneBy}</p>
                        {l.doneByUsername && (
                          <span className="text-[10px] text-[#4A8FC4] font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                            @{l.doneByUsername}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{l.role}</span>
                        {l.ipAddress && (
                          <span className="text-[10px] text-gray-400 font-mono">IP: {l.ipAddress}</span>
                        )}
                      </div>
                      {l.clientName && (
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                          <span className="text-gray-400">{isFr ? 'Client :' : 'Client:'}</span>
                          <span className="font-semibold">{l.clientName}</span>
                          {l.clientUsername && <span className="font-mono text-[#4A8FC4]">@{l.clientUsername}</span>}
                        </p>
                      )}
                      {l.details && <p className="text-xs text-gray-500 mt-0.5 truncate">{l.details}</p>}
                      {l.entityId && <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {l.entityId}</p>}
                    </div>

                    {/* Amount + date */}
                    <div className="text-right flex-shrink-0">
                      {l.amountFcfa != null && (
                        <>
                          <p className="text-sm font-bold text-gray-800">{f2(l.amountFcfa)} FCFA</p>
                          <p className="text-[10px] text-gray-400 font-mono">${toUsd(l.amountFcfa)} · €{toEur(l.amountFcfa)}</p>
                        </>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(l.createdAt).toLocaleString(isFr ? 'fr-FR' : 'en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> {isFr ? 'Précédent' : 'Previous'}
                </button>
                <span className="text-xs text-gray-500">
                  {page} / {pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isFr ? 'Suivant' : 'Next'} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
