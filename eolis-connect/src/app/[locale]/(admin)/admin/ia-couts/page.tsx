'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import { Zap, TrendingUp, Users, FileText, Mic, Loader2, ChevronDown, ChevronRight, X, TrendingDown } from 'lucide-react'

// ── MultiSelect (same pattern as other OPS pages) ─────────────────────────────
function MultiSelect({ label, options, selected, onToggle, onClear, isFr }: {
  label: string; options: { value: string; label: string }[]
  selected: string[]; onToggle: (v: string) => void
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

const EUR_RATE = 655.957
function fmt4(n: number) { return n.toFixed(4) }
function fmt2(n: number) { return n.toFixed(2) }
function toUsd(fcfa: number) { return (fcfa / 600).toFixed(2) }
function toEur(fcfa: number) { return (fcfa / EUR_RATE).toFixed(2) }
function toUsd4(fcfa: number) { return (fcfa / 600).toFixed(4) }
function toEur4(fcfa: number) { return (fcfa / EUR_RATE).toFixed(4) }
function FiatSub({ fcfa, precise }: { fcfa: number; precise?: boolean }) {
  const u = precise ? toUsd4(fcfa) : toUsd(fcfa)
  const e = precise ? toEur4(fcfa) : toEur(fcfa)
  return <p className="text-[10px] text-gray-400 font-mono">${u} · €{e}</p>
}

export default function IACoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]         = useState('fr')
  const [user, setUser]             = useState<any>(null)
  const [data, setData]             = useState<any>(null)
  const [benefits, setBenefits]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [loadingBenefits, setLoadingBenefits] = useState(false)
  const [tab, setTab]               = useState<'costs' | 'benefits'>('costs')
  const [view, setView]             = useState<'client' | 'ticket'>('ticket')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [periodLabel, setPeriodLabel] = useState('')
  const [currentRange, setCurrentRange] = useState<DateRange | null>(null)
  const [urgencyFilter, setUrgencyFilter] = useState<string[]>([])

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const buildQs = useCallback((range: DateRange | null, urg: string[]) => {
    const params: string[] = []
    if (range) { params.push(`from=${range.from}`, `to=${range.to}`) }
    if (urg.length) params.push(`urgency=${urg.join(',')}`)
    return params.length ? `?${params.join('&')}` : ''
  }, [])

  const loadCosts = useCallback((range: DateRange | null, urg: string[]) => {
    setLoading(true)
    apiFetch(`/api/ai-usage/admin${buildQs(range, urg)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [buildQs])

  const loadBenefits = useCallback((range: DateRange | null, urg: string[]) => {
    setLoadingBenefits(true)
    apiFetch(`/api/credits/admin/benefits${buildQs(range, urg)}`)
      .then(r => r.json())
      .then(d => { setBenefits(d); setLoadingBenefits(false) })
      .catch(() => setLoadingBenefits(false))
  }, [buildQs])

  useEffect(() => {
    if (!user) return
    loadCosts(currentRange, urgencyFilter)
    loadBenefits(currentRange, urgencyFilter)
  }, [user]) // eslint-disable-line

  function handleRange(range: DateRange | null, label: string) {
    setPeriodLabel(label)
    setCurrentRange(range)
    loadCosts(range, urgencyFilter)
    loadBenefits(range, urgencyFilter)
  }

  function handleUrgencyToggle(v: string) {
    const next = urgencyFilter.includes(v) ? urgencyFilter.filter(x => x !== v) : [...urgencyFilter, v]
    setUrgencyFilter(next)
    loadCosts(currentRange, next)
    loadBenefits(currentRange, next)
  }

  function handleUrgencyClear() {
    setUrgencyFilter([])
    loadCosts(currentRange, [])
    loadBenefits(currentRange, [])
  }

  if (!user) return null
  const isFr = locale === 'fr'

  const blCount    = data?.items?.filter((i: any) => i.type === 'bl_extraction').length ?? 0
  const voiceCount = data?.items?.filter((i: any) => i.type === 'voice_transcription').length ?? 0
  const smsCount   = data?.smsCount ?? 0

  const URGENCY_OPTIONS = [
    { value: 'HIGH',   label: isFr ? '🔴 Élevée'  : '🔴 High'   },
    { value: 'MEDIUM', label: isFr ? '🟡 Moyenne' : '🟡 Medium' },
    { value: 'LOW',    label: isFr ? '🟢 Faible'  : '🟢 Low'    },
  ]

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="space-y-6 max-w-5xl">

        {/* Header + filters */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap size={22} className="text-violet-600" />
            {isFr ? 'Coûts & Bénéfices Premium' : 'Premium Costs & Benefits'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter onChange={handleRange} isFr={isFr} />
            <MultiSelect
              label={isFr ? 'Urgence' : 'Urgency'} isFr={isFr}
              options={URGENCY_OPTIONS}
              selected={urgencyFilter}
              onToggle={handleUrgencyToggle}
              onClear={handleUrgencyClear}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { v: 'costs',    label: isFr ? 'Coûts & opérations' : 'Costs & operations' },
            { v: 'benefits', label: isFr ? 'Bénéfices' : 'Benefits' },
          ] as { v: typeof tab; label: string }[]).map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.v ? 'bg-[#1B3A5C] text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ONGLET BÉNÉFICES ──────────────────────────────────────── */}
        {tab === 'benefits' && (loadingBenefits ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
        ) : !benefits ? null : (
          <div className="space-y-4">
            {/* KPIs bénéfices — 4 cartes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: isFr ? 'Revenus recharges' : 'Top-up revenue',
                  fcfa: fmt2(benefits.totalRevenue),
                  usd: toUsd(benefits.totalRevenue), eur: toEur(benefits.totalRevenue),
                  sub: `${benefits.approvedRequestsCount} ${isFr ? 'recharge(s) validée(s)' : 'approved top-up(s)'}`,
                  color: 'bg-emerald-50 text-emerald-700',
                },
                {
                  label: isFr ? 'Crédits consommés (prix client)' : 'Credits consumed (client cost)',
                  fcfa: fmt2(benefits.totalClientFcfa ?? 0),
                  usd: toUsd(benefits.totalClientFcfa ?? 0), eur: toEur(benefits.totalClientFcfa ?? 0),
                  sub: `${fmt2(benefits.totalCreditsConsumed ?? 0)} cr · BL ${fmt2(benefits.blCreditsConsumed ?? 0)} + voix ${fmt2(benefits.voiceCreditsConsumed ?? 0)}${(benefits.openingCreditsConsumed ?? 0) > 0 ? ` + ouv. ${fmt2(benefits.openingCreditsConsumed)}` : ''}${(benefits.smsCreditsConsumed ?? 0) > 0 ? ` + SMS ${fmt2(benefits.smsCreditsConsumed)}` : ''}`,
                  color: 'bg-blue-50 text-blue-700',
                },
                {
                  label: isFr ? 'Coûts traitement réels' : 'Actual processing costs',
                  fcfa: fmt4(benefits.totalApiCost),
                  usd: toUsd4(benefits.totalApiCost), eur: toEur4(benefits.totalApiCost),
                  sub: benefits.smsCount > 0
                    ? `IA ${fmt4(benefits.aiCostFcfa ?? 0)} + SMS ${fmt4(benefits.smsCostFcfa ?? 0)} FCFA`
                    : isFr ? 'Coût réel des traitements' : 'Actual cost of processing',
                  color: 'bg-red-50 text-red-600',
                },
                {
                  label: isFr ? 'Bénéfice sur usages' : 'Usage profit',
                  fcfa: fmt2(benefits.usageProfit ?? 0),
                  usd: toUsd(benefits.usageProfit ?? 0), eur: toEur(benefits.usageProfit ?? 0),
                  sub: benefits.totalClientFcfa > 0
                    ? `${(((benefits.usageProfit ?? 0) / benefits.totalClientFcfa) * 100).toFixed(1)}% ${isFr ? 'de marge' : 'margin'}`
                    : isFr ? 'Aucune consommation' : 'No usage yet',
                  color: 'bg-violet-50 text-violet-700',
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xl font-bold text-gray-900">{card.fcfa} FCFA</p>
                  <p className="text-[10px] text-gray-400 font-mono">${card.usd} · €{card.eur}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{card.label}</p>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ${card.color}`}>
                    {card.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Explication du calcul */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 text-xs text-violet-700 space-y-1">
              <p className="font-bold text-sm text-violet-800">{isFr ? '🧮 Comment lire ces chiffres' : '🧮 How to read these numbers'}</p>
              <p>{isFr ? '• 1 crédit = 1 FCFA (côté client). Ex : extraction BL = 50 crédits = 50 FCFA payés par le client.' : '• 1 credit = 1 FCFA (client side). E.g. BL extraction = 50 credits = 50 FCFA paid by client.'}</p>
              <p>{isFr ? '• Coût réel OpenAI = variable selon les tokens / la durée audio. Beaucoup moins que 50 FCFA en général.' : '• Actual OpenAI cost = variable by tokens / audio duration. Much less than 50 FCFA typically.'}</p>
              <p>{isFr ? '• SMS Premium : 160 crédits facturés au client, 107 FCFA de coût réel Seven.io → 53 FCFA de marge.' : '• Premium SMS: 160 credits charged to client, 107 FCFA real cost (Seven.io) → 53 FCFA margin.'}</p>
              <p>{isFr ? '• Bénéfice sur usages = crédits consommés − coûts OpenAI − coûts SMS.' : '• Usage profit = credits consumed − OpenAI costs − SMS costs.'}</p>
              <p>{isFr ? '• Bénéfice net recharges = revenus recharges − coûts OpenAI − coûts SMS.' : '• Net top-up profit = top-up revenue − OpenAI costs − SMS costs.'}</p>
            </div>

            {/* Crédits offerts */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-amber-800">
                  🎁 {isFr ? 'Crédits de bienvenue offerts' : 'Welcome credits given'}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {isFr
                    ? `${benefits.freeCreditsGiven} crédits au total (100 × ${benefits.freeCreditsGiven / 100} clients)`
                    : `${benefits.freeCreditsGiven} credits total (100 × ${benefits.freeCreditsGiven / 100} clients)`}
                </p>
              </div>
              <p className="text-sm font-bold text-amber-700 font-mono">{benefits.freeCreditsGiven} FCFA</p>
            </div>

            {/* Détail recharges */}
            {benefits.revenueDetails?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="font-bold text-gray-900">{isFr ? 'Recharges validées' : 'Approved top-ups'}</p>
                  {periodLabel && <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>}
                </div>
                <div className="divide-y divide-gray-50">
                  {benefits.revenueDetails.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{r.clientName}</p>
                        <p className="text-xs text-gray-400">
                          {r.validatedAt ? new Date(r.validatedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB') : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{r.amountValidated} FCFA</p>
                        <p className="text-[10px] text-gray-400 font-mono">${toUsd(r.amountValidated)} · €{toEur(r.amountValidated)}</p>
                        <p className="text-xs text-emerald-600">+{r.creditsAdded} crédits</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {benefits.pendingRequestsCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
                ⏳ {benefits.pendingRequestsCount} {isFr ? 'demande(s) en attente de validation' : 'request(s) pending validation'}
              </div>
            )}
          </div>
        ))}

        {/* ── ONGLET COÛTS ─────────────────────────────────────────── */}
        {tab === 'costs' && (loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI cards — 4 métriques + 3 financières */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: isFr ? 'Coût traitement réel' : 'Actual processing cost',
                  value: `${fmt4(data.totalFcfa ?? 0)} FCFA`,
                  sub: `$${toUsd4(data.totalFcfa ?? 0)} · €${toEur4(data.totalFcfa ?? 0)}`,
                  icon: <TrendingUp size={18} className="text-violet-600" />,
                  bg: 'bg-violet-50',
                },
                {
                  label: isFr ? 'Crédits consommés' : 'Credits consumed',
                  value: `${fmt2(data.totalCredits ?? 0)} cr.`,
                  sub: `${fmt2(data.totalClientFcfa ?? 0)} FCFA · $${toUsd(data.totalClientFcfa ?? 0)} · €${toEur(data.totalClientFcfa ?? 0)}`,
                  icon: <Zap size={18} className="text-blue-600" />,
                  bg: 'bg-blue-50',
                },
                {
                  label: isFr ? 'Bénéfice sur usages' : 'Usage profit',
                  value: `${fmt2(data.totalProfitFcfa ?? 0)} FCFA`,
                  sub: data.totalClientFcfa > 0
                    ? `$${toUsd(data.totalProfitFcfa ?? 0)} · €${toEur(data.totalProfitFcfa ?? 0)} · ${(((data.totalProfitFcfa ?? 0) / (data.totalClientFcfa ?? 1)) * 100).toFixed(1)}% marge`
                    : '—',
                  icon: <TrendingDown size={18} className="text-emerald-600" />,
                  bg: 'bg-emerald-50',
                },
                {
                  label: isFr ? 'Clients actifs' : 'Active clients',
                  value: String(data.clientsSummary?.length ?? 0),
                  sub: isFr ? 'ayant utilisé les features' : 'who used features',
                  icon: <Users size={18} className="text-amber-600" />,
                  bg: 'bg-amber-50',
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                    {card.icon}
                  </div>
                  <p className="text-xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{card.label}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Compteurs BL / Voice / SMS */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
                <FileText size={20} className="text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900">{blCount}</p>
                  <p className="text-xs text-gray-400">{isFr ? 'Extractions BL' : 'BL Extractions'}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
                <Mic size={20} className="text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900">{voiceCount}</p>
                  <p className="text-xs text-gray-400">{isFr ? 'Dictées vocales' : 'Voice dictations'}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm flex items-center gap-3">
                <span className="text-xl">📱</span>
                <div>
                  <p className="text-lg font-bold text-gray-900">{smsCount}</p>
                  <p className="text-xs text-gray-400">{isFr ? 'SMS Premium' : 'Premium SMS'}</p>
                </div>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex gap-2">
              {(['ticket', 'client'] as const).map(v => (
                <button key={v} onClick={() => { setView(v); setExpanded(null) }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    view === v ? 'bg-[#1B3A5C] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {v === 'ticket' ? (isFr ? 'Par dossier' : 'By ticket') : (isFr ? 'Par client' : 'By client')}
                </button>
              ))}
            </div>

            {/* By ticket view */}
            {view === 'ticket' && (data.ticketsSummary?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="font-bold text-gray-900">{isFr ? 'Répartition par dossier' : 'Per-ticket breakdown'}</p>
                  {periodLabel && <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>}
                </div>
                {/* Header legend */}
                <div className="grid grid-cols-4 gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <span>{isFr ? 'Dossier' : 'Ticket'}</span>
                  <span className="text-right">{isFr ? 'Coût traitement' : 'Processing cost'}</span>
                  <span className="text-right">{isFr ? 'Prix client' : 'Client price'}</span>
                  <span className="text-right">{isFr ? 'Bénéfice' : 'Profit'}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.ticketsSummary.map((t: any, i: number) => {
                    const key = t.ref ?? `notkt-${i}`
                    const isExpanded = expanded === key
                    const ticketItems = data.items?.filter((item: any) =>
                      t.ticketId ? item.ticketId === t.ticketId : (!item.ticketId && item.clientId === t.clientId)
                    ) ?? []
                    const profitPct = t.clientFcfa > 0 ? ((t.profitFcfa / t.clientFcfa) * 100).toFixed(0) : null
                    return (
                      <div key={key}>
                        <button onClick={() => setExpanded(isExpanded ? null : key)}
                          className="w-full grid grid-cols-4 gap-2 items-center px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[#EDF1F7] flex items-center justify-center flex-shrink-0">
                              <Zap size={13} className="text-[#1B3A5C]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 font-mono truncate">
                                {t.ref ?? (isFr ? 'Sans dossier' : 'No ticket')}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {t.clientName}
                                {t.blCount > 0 && ` · 📄 ${t.blCount}`}
                                {t.voiceCount > 0 && ` · 🎙️ ${t.voiceCount}`}
                                {t.urgency && ` · ${t.urgency === 'HIGH' ? '🔴' : t.urgency === 'MEDIUM' ? '🟡' : '🟢'}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">{fmt4(t.totalFcfa ?? 0)} FCFA</p>
                            <FiatSub fcfa={t.totalFcfa ?? 0} precise />
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">{fmt2(t.clientFcfa ?? 0)} FCFA</p>
                            <p className="text-[10px] text-gray-400">{fmt2(t.totalCredits ?? 0)} cr.</p>
                            <FiatSub fcfa={t.clientFcfa ?? 0} />
                          </div>
                          <div className="text-right flex items-center justify-end gap-2">
                            <div>
                              <p className="text-sm font-bold text-emerald-600">{fmt2(t.profitFcfa ?? 0)} FCFA</p>
                              <FiatSub fcfa={t.profitFcfa ?? 0} />
                              {profitPct && <p className="text-[10px] text-gray-400">{profitPct}% marge</p>}
                            </div>
                            {isExpanded
                              ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                              : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
                          </div>
                        </button>

                        {isExpanded && ticketItems.length > 0 && (
                          <div className="bg-gray-50 px-5 py-3 space-y-2 border-t border-gray-100">
                            <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-200">
                              <span>{isFr ? 'Opération' : 'Operation'}</span>
                              <span className="text-right">{isFr ? 'Coût traitement' : 'Processing cost'}</span>
                              <span className="text-right">{isFr ? 'Prix client' : 'Client price'}</span>
                              <span className="text-right">{isFr ? 'Bénéfice' : 'Profit'}</span>
                            </div>
                            {ticketItems.map((item: any) => (
                              <div key={item.id} className="grid grid-cols-4 gap-2 items-center py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-base flex-shrink-0">
                                    {item.type === 'bl_extraction' ? '📄'
                                      : item.type === 'sms_notification' ? '📱'
                                      : item.type === 'info_premium_opening' ? '💼'
                                      : '🎙️'}
                                  </span>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-800">
                                      {item.type === 'bl_extraction'
                                        ? (isFr ? 'Extraction BL' : 'BL extraction')
                                        : item.type === 'sms_notification'
                                          ? 'SMS Premium'
                                          : item.type === 'info_premium_opening'
                                            ? (isFr ? 'Ouverture Info Premium' : 'Info Premium opening')
                                            : (isFr ? 'Dictée vocale' : 'Voice dictation')}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      {new Date(item.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short' })}
                                      {item.type === 'bl_extraction' && ` · ${(item.inputTokens ?? 0) + (item.outputTokens ?? 0)} tokens`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-red-500">{fmt4(item.costFcfa ?? 0)} FCFA</p>
                                  <FiatSub fcfa={item.costFcfa ?? 0} precise />
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-blue-600">{fmt2(item.creditsCost ?? 0)} cr.</p>
                                  <FiatSub fcfa={item.creditsCost ?? 0} />
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">{fmt2(item.profitFcfa ?? 0)} FCFA</p>
                                  <FiatSub fcfa={item.profitFcfa ?? 0} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* By client view */}
            {view === 'client' && (data.clientsSummary?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="font-bold text-gray-900">{isFr ? 'Répartition par client' : 'Per-client breakdown'}</p>
                  {periodLabel && <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>}
                </div>
                <div className="grid grid-cols-4 gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <span>{isFr ? 'Client' : 'Client'}</span>
                  <span className="text-right">{isFr ? 'Coût traitement' : 'Processing cost'}</span>
                  <span className="text-right">{isFr ? 'Prix client' : 'Client price'}</span>
                  <span className="text-right">{isFr ? 'Bénéfice' : 'Profit'}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.clientsSummary.map((c: any) => {
                    const isExpanded = expanded === c.clientId
                    const clientItems = data.items?.filter((i: any) => i.clientId === c.clientId) ?? []
                    const profitPct = c.clientFcfa > 0 ? ((c.profitFcfa / c.clientFcfa) * 100).toFixed(0) : null
                    return (
                      <div key={c.clientId}>
                        <button onClick={() => setExpanded(isExpanded ? null : c.clientId)}
                          className="w-full grid grid-cols-4 gap-2 items-center px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-white">{c.firstName?.[0]}{c.lastName?.[0]}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{c.firstName} {c.lastName}</p>
                              <p className="text-xs text-gray-400">{c.count} {isFr ? 'opération(s)' : 'operation(s)'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">{fmt4(c.totalFcfa ?? 0)} FCFA</p>
                            <FiatSub fcfa={c.totalFcfa ?? 0} precise />
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">{fmt2(c.clientFcfa ?? 0)} FCFA</p>
                            <FiatSub fcfa={c.clientFcfa ?? 0} />
                          </div>
                          <div className="text-right flex items-center justify-end gap-2">
                            <div>
                              <p className="text-sm font-bold text-emerald-600">{fmt2(c.profitFcfa ?? 0)} FCFA</p>
                              <FiatSub fcfa={c.profitFcfa ?? 0} />
                              {profitPct && <p className="text-[10px] text-gray-400">{profitPct}% marge</p>}
                            </div>
                            {isExpanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                          </div>
                        </button>
                        {isExpanded && clientItems.length > 0 && (
                          <div className="bg-gray-50 px-5 py-3 space-y-2 border-t border-gray-100">
                            <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-200">
                              <span>{isFr ? 'Opération' : 'Operation'}</span>
                              <span className="text-right">{isFr ? 'Coût traitement' : 'Processing cost'}</span>
                              <span className="text-right">{isFr ? 'Prix client' : 'Client price'}</span>
                              <span className="text-right">{isFr ? 'Bénéfice' : 'Profit'}</span>
                            </div>
                            {clientItems.map((item: any) => (
                              <div key={item.id} className="grid grid-cols-4 gap-2 items-center py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{item.type === 'bl_extraction' ? '📄' : '🎙️'}</span>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-800 font-mono">{item.ticketRef ?? (isFr ? 'Sans dossier' : 'No ticket')}</p>
                                    <p className="text-[10px] text-gray-400">
                                      {new Date(item.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short' })}
                                      {item.urgency && ` · ${item.urgency === 'HIGH' ? '🔴' : item.urgency === 'MEDIUM' ? '🟡' : '🟢'}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-red-500">{fmt4(item.costFcfa ?? 0)} FCFA</p>
                                  <FiatSub fcfa={item.costFcfa ?? 0} precise />
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-blue-600">{fmt2(item.creditsCost ?? 0)} cr.</p>
                                  <FiatSub fcfa={item.creditsCost ?? 0} />
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">{fmt2(item.profitFcfa ?? 0)} FCFA</p>
                                  <FiatSub fcfa={item.profitFcfa ?? 0} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(data.count ?? 0) === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                <Zap size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  {isFr ? 'Aucune opération sur cette période.' : 'No operations for this period.'}
                </p>
              </div>
            )}
          </>
        ))}
      </div>
    </DashboardLayout>
  )
}
