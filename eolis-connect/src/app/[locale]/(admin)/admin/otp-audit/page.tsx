'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { KeyRound, Phone, Search, ChevronLeft, ChevronRight, Loader2, ShieldAlert, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'

const OWNER_USERNAME = 'Christian.DENMEKO'

function StatusBadge({ status, isFr }: { status: string; isFr: boolean }) {
  if (status === 'used')    return <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle size={9}/>{isFr ? 'Utilisé' : 'Used'}</span>
  if (status === 'expired') return <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"><AlertCircle size={9}/>{isFr ? 'Expiré' : 'Expired'}</span>
  return <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={9}/>{isFr ? 'Valide' : 'Active'}</span>
}

export default function OtpAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [items, setItems]   = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange]     = useState<DateRange | null>(null)
  const [countdown, setCountdown]     = useState(30)
  const autoRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchDataRef   = useRef<(silent?: boolean) => void>(() => {})

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.username !== OWNER_USERNAME) { router.replace(`/${locale}/admin/dashboard`); return }
    setUser(u)
  }, [locale])

  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const qs = new URLSearchParams()
    if (searchQuery)     qs.set('search', searchQuery)
    if (dateRange?.from) qs.set('from', dateRange.from)
    if (dateRange?.to)   qs.set('to', dateRange.to)
    qs.set('page', String(page))
    qs.set('page_size', '50')
    apiFetch(`/api/admin/otp-audit?${qs}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setTotal(d.total ?? 0); setPages(d.pages ?? 1); if (!silent) setLoading(false) })
      .catch(() => { if (!silent) setLoading(false) })
  }, [searchQuery, dateRange, page])

  // Keep ref fresh so the auto-refresh interval always uses the latest query/page
  useEffect(() => { fetchDataRef.current = fetchData }, [fetchData])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  useEffect(() => {
    if (!user) return
    setCountdown(30)
    if (autoRef.current)  clearInterval(autoRef.current)
    if (countRef.current) clearInterval(countRef.current)
    autoRef.current  = setInterval(() => { fetchDataRef.current(true); setCountdown(30) }, 30_000)
    countRef.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1_000)
    return () => {
      if (autoRef.current)  clearInterval(autoRef.current)
      if (countRef.current) clearInterval(countRef.current)
    }
  }, [user])

  const isFr = locale === 'fr'

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-5 max-w-5xl">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <KeyRound size={22} className="text-[#1B3A5C]" />
              {isFr ? 'Audit des codes OTP' : 'OTP code audit'}
            </h1>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <ShieldAlert size={12} />
              {isFr ? 'Codes générés par le système — accès propriétaire uniquement' : 'System-generated codes — owner access only'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center"
              title={`${isFr ? 'Actualisation dans' : 'Refresh in'} ${countdown}s`}>
              <svg width="32" height="32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                <circle cx="16" cy="16" r="12" fill="none" stroke="#4A8FC4" strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - countdown / 30)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
              </svg>
              <span className="absolute text-[9px] font-bold text-gray-500 tabular-nums">{countdown}</span>
            </div>
            <button onClick={() => { fetchDataRef.current(true); setCountdown(30) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
              <RefreshCw size={13} /> {isFr ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder={isFr ? 'Rechercher par utilisateur, code, numéro…' : 'Search by user, code, number…'}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
            />
          </div>
          <PeriodFilter onChange={r => { setDateRange(r); setPage(1) }} isFr={isFr} />
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#1B3A5C]" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <KeyRound size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucun code pour ces critères.' : 'No codes match these criteria.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-900 text-sm">{total.toLocaleString()} {isFr ? 'code(s)' : 'code(s)'}</p>
              <p className="text-xs text-gray-400">{page} / {pages}</p>
            </div>

            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">

                  {/* Type icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${item.type === '2fa' ? 'bg-[#1B3A5C]/10' : 'bg-violet-50'}`}>
                    {item.type === '2fa'
                      ? <KeyRound size={14} className="text-[#1B3A5C]" />
                      : <Phone size={14} className="text-violet-600" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.user ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900">{item.user.firstName} {item.user.lastName}</p>
                          <span className="text-[10px] text-[#4A8FC4] font-mono bg-blue-50 px-1.5 py-0.5 rounded">@{item.user.username}</span>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 italic">{isFr ? 'Utilisateur inconnu' : 'Unknown user'}</p>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.type === '2fa' ? 'bg-[#1B3A5C]/10 text-[#1B3A5C]' : 'bg-violet-100 text-violet-700'}`}>
                        {item.type === '2fa' ? '2FA connexion' : (isFr ? 'Vérif. numéro' : 'Phone verify')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.phone && <span className="text-xs text-gray-500 font-mono">{item.phone}</span>}
                      <span className="text-[10px] text-gray-400">
                        {isFr ? 'Généré' : 'Generated'} {new Date(item.createdAt).toLocaleString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {isFr ? 'Expire' : 'Expires'} {new Date(item.expiresAt).toLocaleString(isFr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {item.attempts > 0 && (
                        <span className="text-[10px] text-amber-600">{item.attempts} {isFr ? 'tentative(s)' : 'attempt(s)'}</span>
                      )}
                    </div>
                  </div>

                  {/* Code + status */}
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-xl font-mono font-bold text-[#1B3A5C] tracking-widest">{item.code}</p>
                    <StatusBadge status={item.status} isFr={isFr} />
                  </div>
                </div>
              ))}
            </div>

            {pages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={14} /> {isFr ? 'Précédent' : 'Previous'}
                </button>
                <span className="text-xs text-gray-500">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">
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
