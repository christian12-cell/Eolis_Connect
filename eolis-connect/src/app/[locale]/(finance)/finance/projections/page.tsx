'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import {
  Target, Plus, Trash2, Loader2, ChevronDown,
  AlertCircle, CheckCircle, XCircle, Minus, CalendarRange,
} from 'lucide-react'
import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

const EUR = 655.957; const USD = 600
function f0(n: number) { return Math.round(n).toLocaleString('fr-FR') }
function toUsd(f: number) { return (f / USD).toFixed(2) }
function toEur(f: number) { return (f / EUR).toFixed(2) }

const STATUS_CONFIG: Record<string, { label_fr: string; label_en: string; color: string; icon: React.ReactNode }> = {
  exceeded:  { label_fr: 'Dépassé ⭐',          label_en: 'Exceeded ⭐',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: <CheckCircle size={13}/> },
  on_track:  { label_fr: 'Dans les clous',       label_en: 'On track',        color: 'text-blue-600 bg-blue-50 border-blue-200',          icon: <CheckCircle size={13}/> },
  behind:    { label_fr: 'En retard',            label_en: 'Behind',          color: 'text-amber-600 bg-amber-50 border-amber-200',       icon: <AlertCircle size={13}/> },
  far_behind:{ label_fr: 'Loin de l\'objectif',  label_en: 'Far behind',      color: 'text-red-600 bg-red-50 border-red-200',             icon: <XCircle size={13}/> },
  no_target: { label_fr: 'Sans objectif',        label_en: 'No target',       color: 'text-gray-400 bg-gray-50 border-gray-200',          icon: <Minus size={13}/> },
  no_data:   { label_fr: 'Pas de données',       label_en: 'No data',         color: 'text-gray-400 bg-gray-50 border-gray-200',          icon: <Minus size={13}/> },
}

function StatusBadge({ status, isFr }: { status: string; isFr: boolean }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.no_target
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
      {cfg.icon} {isFr ? cfg.label_fr : cfg.label_en}
    </span>
  )
}

function VarBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-300 text-xs">—</span>
  const color = pct >= 5 ? 'text-emerald-600' : pct >= -5 ? 'text-blue-600' : pct >= -20 ? 'text-amber-600' : 'text-red-600'
  return <span className={`text-xs font-bold ${color}`}>{pct > 0 ? '+' : ''}{pct}%</span>
}

function monthsBetween(from: string, to: string): string[] {
  const result: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return result
}

const CHART_STYLE = { fontSize: 11, fill: '#9ab0c4' }
const now = new Date()
const CUR_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const CUR_YEAR  = String(now.getFullYear())

export default function ProjectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]   = useState('fr')
  const [user, setUser]       = useState<any>(null)
  const [rows, setRows]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMonth, setFromMonth] = useState(`${CUR_YEAR}-01`)
  const [toMonth, setToMonth]     = useState(CUR_MONTH)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [useInterval, setUseInterval] = useState(false)
  const [form, setForm] = useState({
    period: CUR_MONTH,
    intervalFrom: CUR_MONTH,
    intervalTo: CUR_MONTH,
    target_revenue: '',
    target_clients: '',
    target_net_profit: '',
    target_margin_pct: '',
    notes: '',
  })

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback(() => {
    setLoading(true)
    apiFetch(`/api/finance/projections/comparison?from=${fromMonth}&to=${toMonth}`)
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [fromMonth, toMonth])

  useEffect(() => { if (user) load() }, [user, load])

  const isFr  = locale === 'fr'
  const isReadOnly = user?.role === 'SYSTEM_ADMIN'

  const ytdRevenue       = rows.reduce((s, r) => s + r.actual.revenue, 0)
  const ytdTarget        = rows.reduce((s, r) => s + (r.target.revenue ?? 0), 0)
  const ytdNetProfit     = rows.reduce((s, r) => s + r.actual.netProfit, 0)
  const ytdNetTarget     = rows.reduce((s, r) => s + (r.target.netProfit ?? 0), 0)
  const ytdClients       = rows.reduce((s, r) => s + r.actual.newClients, 0)
  const ytdClientsTarget = rows.reduce((s, r) => s + (r.target.clients ?? 0), 0)
  const achievedPct      = ytdTarget > 0 ? Math.round(ytdRevenue / ytdTarget * 100) : null
  const netAchievedPct   = ytdNetTarget > 0 ? Math.round(ytdNetProfit / ytdNetTarget * 100) : null

  const chartData = rows.map(r => ({
    period:          r.period,
    actualRevenue:   r.actual.revenue,
    targetRevenue:   r.target.revenue,
    actualNetProfit: r.actual.netProfit,
    targetNetProfit: r.target.netProfit,
    actualMargin:    r.actual.marginPct,
    targetMargin:    r.target.marginPct,
    actualClients:   r.actual.newClients,
    targetClients:   r.target.clients,
    status:          r.variance.status,
  }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const periods = useInterval
      ? monthsBetween(form.intervalFrom, form.intervalTo)
      : [form.period]
    if (!periods.length || !form.target_revenue) return
    setSaving(true)
    for (const period of periods) {
      await apiFetch('/api/finance/projections', {
        method: 'POST',
        body: JSON.stringify({
          period,
          target_revenue:    parseFloat(form.target_revenue),
          target_clients:    parseInt(form.target_clients) || 0,
          target_net_profit: form.target_net_profit ? parseFloat(form.target_net_profit) : null,
          target_margin_pct: form.target_margin_pct ? parseFloat(form.target_margin_pct) : null,
          notes: form.notes || null,
        }),
      })
    }
    setSaving(false)
    setShowForm(false)
    setForm({ period: CUR_MONTH, intervalFrom: CUR_MONTH, intervalTo: CUR_MONTH, target_revenue: '', target_clients: '', target_net_profit: '', target_margin_pct: '', notes: '' })
    load()
  }

  async function deleteProjection(id: string) {
    if (!confirm(isFr ? 'Supprimer cet objectif ?' : 'Delete this target?')) return
    await apiFetch(`/api/finance/projections/${id}`, { method: 'DELETE' })
    load()
  }

  function editRow(r: any) {
    setUseInterval(false)
    setForm({
      period:           r.period,
      intervalFrom:     r.period,
      intervalTo:       r.period,
      target_revenue:   String(r.target.revenue ?? ''),
      target_clients:   String(r.target.clients ?? ''),
      target_net_profit:String(r.target.netProfit ?? ''),
      target_margin_pct:String(r.target.marginPct ?? ''),
      notes:            r.target.notes ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!user) return null

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Target size={22} className="text-violet-600" />
              {isFr ? 'Projections économiques' : 'Economic projections'}
            </h1>
            <p className="text-xs text-gray-400 mt-1">{isFr ? 'Objectifs vs réalité mois par mois' : 'Targets vs actuals month by month'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <CalendarRange size={14} className="text-gray-400 flex-shrink-0" />
              <input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)}
                className="text-sm font-semibold focus:outline-none w-32" />
              <span className="text-gray-300 text-xs">→</span>
              <input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)}
                className="text-sm font-semibold focus:outline-none w-32" />
            </div>
            {!isReadOnly && (
              <button onClick={() => setShowForm(s => !s)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700">
                <Plus size={15} /> {isFr ? 'Définir objectif' : 'Set target'}
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && !isReadOnly && (
          <div className="bg-white rounded-2xl border border-violet-200 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Target size={16} className="text-violet-600" />
              {isFr ? 'Définir un objectif' : 'Set a target'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{isFr ? 'Choisissez un mois précis ou un intervalle de mois.' : 'Choose a single month or a range of months.'}</p>
            <form onSubmit={submit} className="grid grid-cols-2 gap-4">

              {/* Toggle période / intervalle */}
              <div className="col-span-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setUseInterval(false)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${!useInterval ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {isFr ? 'Mois précis' : 'Single month'}
                  </button>
                  <button type="button" onClick={() => setUseInterval(true)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${useInterval ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {isFr ? 'Intervalle de mois' : 'Month range'}
                  </button>
                </div>
              </div>

              {!useInterval ? (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Période' : 'Period'}</label>
                  <input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" required />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Du mois' : 'From month'}</label>
                    <input type="month" value={form.intervalFrom} onChange={e => setForm(f => ({ ...f, intervalFrom: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Au mois' : 'To month'}</label>
                    <input type="month" value={form.intervalTo} onChange={e => setForm(f => ({ ...f, intervalTo: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" required />
                  </div>
                  {form.intervalFrom && form.intervalTo && form.intervalFrom <= form.intervalTo && (
                    <div className="col-span-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700">
                      {isFr ? 'Même objectif appliqué sur' : 'Same target applied to'} <strong>{monthsBetween(form.intervalFrom, form.intervalTo).length}</strong> {isFr ? 'mois' : 'months'} : {monthsBetween(form.intervalFrom, form.intervalTo).join(', ')}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Objectif revenus (FCFA)' : 'Revenue target (FCFA)'}</label>
                <input type="number" step="100" value={form.target_revenue} onChange={e => setForm(f => ({ ...f, target_revenue: e.target.value }))}
                  placeholder="50 000" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" required />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Objectif bénéfice net (FCFA)' : 'Net profit target (FCFA)'}</label>
                <input type="number" step="100" value={form.target_net_profit} onChange={e => setForm(f => ({ ...f, target_net_profit: e.target.value }))}
                  placeholder="40 000" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <p className="text-[10px] text-gray-400 mt-0.5">{isFr ? 'Revenus − Coûts IA − Charges infra' : 'Revenue − AI − Infra'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Objectif nouveaux clients' : 'New clients target'}</label>
                <input type="number" min="0" value={form.target_clients} onChange={e => setForm(f => ({ ...f, target_clients: e.target.value }))}
                  placeholder="5" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Objectif marge %' : 'Margin % target'}</label>
                <input type="number" step="0.1" min="0" max="100" value={form.target_margin_pct} onChange={e => setForm(f => ({ ...f, target_margin_pct: e.target.value }))}
                  placeholder="70" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Notes (optionnel)' : 'Notes (optional)'}</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={isFr ? 'Ex: Objectif Q3 — rentrée scolaire' : 'E.g. Q3 target — back to school'}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              </div>
              <div className="col-span-2 flex gap-3">
                <button type="submit" disabled={saving}
                  className="px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? (isFr ? 'Enregistrement...' : 'Saving...') : (isFr ? 'Enregistrer' : 'Save')}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl">
                  {isFr ? 'Annuler' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Target size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucune donnée pour cette période.' : 'No data for this period.'}</p>
            {!isReadOnly && <p className="text-xs text-violet-400 mt-1">{isFr ? 'Commencez par définir un objectif ↑' : 'Start by setting a target ↑'}</p>}
          </div>
        ) : (
          <>
            {/* KPI totaux */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs text-gray-400 font-semibold mb-2">{isFr ? 'Revenus réels' : 'Actual revenue'}</p>
                <p className="text-xl font-bold text-emerald-600">{f0(ytdRevenue)} <span className="text-xs font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(ytdRevenue)} · €{toEur(ytdRevenue)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs text-gray-400 font-semibold mb-2">{isFr ? 'Objectif revenus' : 'Revenue target'}</p>
                <p className="text-xl font-bold text-violet-600">{f0(ytdTarget)} <span className="text-xs font-normal text-gray-400">FCFA</span></p>
                {achievedPct !== null && (
                  <p className={`text-xs font-bold mt-1 ${achievedPct >= 100 ? 'text-emerald-600' : achievedPct >= 80 ? 'text-amber-600' : 'text-red-500'}`}>
                    {achievedPct}% {isFr ? 'atteint' : 'achieved'}
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs text-gray-400 font-semibold mb-2">{isFr ? 'Bén. net réel' : 'Actual net profit'}</p>
                <p className={`text-xl font-bold ${ytdNetProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{f0(ytdNetProfit)} <span className="text-xs font-normal text-gray-400">FCFA</span></p>
                {ytdNetTarget > 0 && netAchievedPct !== null && (
                  <p className={`text-xs font-bold mt-1 ${netAchievedPct >= 100 ? 'text-emerald-600' : netAchievedPct >= 80 ? 'text-amber-600' : 'text-red-500'}`}>
                    {netAchievedPct}% {isFr ? 'de l\'obj.' : 'of target'}
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs text-gray-400 font-semibold mb-2">{isFr ? 'Nouveaux clients' : 'New clients'}</p>
                <p className="text-xl font-bold text-blue-600">{ytdClients}</p>
                {ytdClientsTarget > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{isFr ? 'Obj :' : 'Target:'} {ytdClientsTarget} · <VarBadge pct={Math.round((ytdClients / ytdClientsTarget - 1) * 100)} /></p>
                )}
              </div>
            </div>

            {/* Chart 1 — Revenus */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-900 mb-4">{isFr ? 'Revenus — Objectif vs Réalité' : 'Revenue — Target vs Actual'}</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis dataKey="period" tick={CHART_STYLE} />
                  <YAxis tick={CHART_STYLE} width={65} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: any, name: string) => [`${f0(v)} FCFA`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="actualRevenue" name={isFr ? 'Réel' : 'Actual'}
                    stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="targetRevenue" name={isFr ? 'Objectif' : 'Target'}
                    stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#8b5cf6' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2 — Bénéfice net */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-900 mb-4">{isFr ? 'Bénéfice net — Objectif vs Réalité' : 'Net profit — Target vs Actual'}</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis dataKey="period" tick={CHART_STYLE} />
                  <YAxis tick={CHART_STYLE} width={65} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: any, name: string) => v != null ? [`${f0(v)} FCFA`, name] : ['—', name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#e2e8f0" />
                  <Bar dataKey="actualNetProfit" name={isFr ? 'Bén. net réel' : 'Actual net'} radius={[3,3,0,0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.actualNetProfit >= 0 ? '#22c55e' : '#ef4444'} />)}
                  </Bar>
                  <Line type="monotone" dataKey="targetNetProfit" name={isFr ? 'Objectif bén. net' : 'Net profit target'}
                    stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#8b5cf6' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Charts 3 & 4 — Clients + Marge */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-900 mb-4">{isFr ? 'Nouveaux clients' : 'New clients'}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                    <XAxis dataKey="period" tick={CHART_STYLE} />
                    <YAxis tick={CHART_STYLE} width={30} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="targetClients" name={isFr ? 'Objectif' : 'Target'} fill="#ddd6fe" radius={[3,3,0,0]} />
                    <Bar dataKey="actualClients" name={isFr ? 'Réel' : 'Actual'} radius={[3,3,0,0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.actualClients >= (d.targetClients ?? 0) ? '#3b82f6' : '#f59e0b'} />)}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-900 mb-4">{isFr ? 'Marge %' : 'Margin %'}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                    <XAxis dataKey="period" tick={CHART_STYLE} />
                    <YAxis tick={CHART_STYLE} unit="%" width={40} />
                    <Tooltip formatter={(v: any) => v != null ? [`${v}%`, ''] : ['—', '']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#e2e8f0" />
                    <Line type="monotone" dataKey="actualMargin" name={isFr ? 'Réelle' : 'Actual'} stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="targetMargin" name={isFr ? 'Objectif' : 'Target'} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#8b5cf6' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table accordion */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setTableOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <p className="font-bold text-gray-900">{isFr ? 'Détail mensuel' : 'Monthly breakdown'}</p>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
              </button>
              {tableOpen && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1B3A5C] text-white text-xs">
                        <th className="px-4 py-3 text-left">{isFr ? 'Mois' : 'Month'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Rev. obj.' : 'Rev. target'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Rev. réel' : 'Actual rev.'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Écart rev.' : 'Rev. var.'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Bén. net obj.' : 'Net tgt'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Bén. net réel' : 'Actual net'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Écart net' : 'Net var.'}</th>
                        <th className="px-3 py-3 text-right">{isFr ? 'Clients' : 'Clients'}</th>
                        <th className="px-3 py-3 text-center">{isFr ? 'Statut' : 'Status'}</th>
                        {!isReadOnly && <th className="px-3 py-3"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            {r.period}
                            {r.target.notes && <p className="text-[10px] text-violet-400 font-normal">{r.target.notes}</p>}
                          </td>
                          <td className="px-3 py-3 text-right text-violet-600 text-xs font-semibold">
                            {r.target.revenue != null ? f0(r.target.revenue) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="font-semibold text-emerald-600">{f0(r.actual.revenue)}</p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {r.variance.revenue != null ? (
                              <>
                                <p className={`text-xs font-semibold ${r.variance.revenue >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {r.variance.revenue >= 0 ? '+' : ''}{f0(r.variance.revenue)}
                                </p>
                                <VarBadge pct={r.variance.revenuePct} />
                              </>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-violet-600 text-xs font-semibold">
                            {r.target.netProfit != null ? f0(r.target.netProfit) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className={`font-semibold ${r.actual.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{f0(r.actual.netProfit)}</p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {r.variance.netProfitPct != null ? <VarBadge pct={r.variance.netProfitPct} /> : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-xs">
                            <span className={`font-bold ${r.target.clients && r.actual.newClients >= r.target.clients ? 'text-blue-600' : 'text-gray-600'}`}>{r.actual.newClients}</span>
                            {r.target.clients != null && <span className="text-gray-400"> / {r.target.clients}</span>}
                          </td>
                          <td className="px-3 py-3 text-center"><StatusBadge status={r.variance.status} isFr={isFr} /></td>
                          {!isReadOnly && (
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <button onClick={() => editRow(r)} className="text-xs text-violet-500 hover:text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-50">
                                  {isFr ? 'Modifier' : 'Edit'}
                                </button>
                                {r.target.projectionId && (
                                  <button onClick={() => deleteProjection(r.target.projectionId)}
                                    className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
