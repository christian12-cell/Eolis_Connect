'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser, getToken, apiUrl } from '@/lib/api-client'
import { PieChart, Loader2, TrendingUp, TrendingDown, AlertCircle, Download, ChevronDown, X } from 'lucide-react'
import FinanceCharts from '../FinanceCharts'

const EUR = 655.957; const USD = 600
function f2(n: number) { return n.toFixed(2) }
function toUsd(f: number) { return (f/USD).toFixed(2) }
function toEur(f: number) { return (f/EUR).toFixed(2) }

// MultiSelect urgence
function UrgencySelect({ selected, onToggle, onClear, isFr }: {
  selected: string[]; onToggle: (v: string) => void; onClear: () => void; isFr: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn)
  }, [])
  const opts = [
    { value: 'HIGH',   label: isFr ? '🔴 Élevée'  : '🔴 High'   },
    { value: 'MEDIUM', label: isFr ? '🟡 Moyenne' : '🟡 Medium' },
    { value: 'LOW',    label: isFr ? '🟢 Faible'  : '🟢 Low'    },
  ]
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium ${selected.length ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]' : 'bg-white border-gray-200 text-gray-700'}`}>
        {isFr ? 'Urgence' : 'Urgency'}{selected.length ? ` (${selected.length})` : ''}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] py-1.5">
          {selected.length > 0 && (
            <button onClick={() => { onClear(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100 mb-1">
              <X size={11} /> {isFr ? 'Effacer' : 'Clear'}
            </button>
          )}
          {opts.map(o => (
            <label key={o.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" className="rounded accent-[#1B3A5C]" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
              <span className="text-sm text-gray-700">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

async function exportXlsx(range: DateRange | null, urgency: string[]) {
  const qs = new URLSearchParams()
  if (range) { qs.set('from', range.from); qs.set('to', range.to) }
  if (urgency.length) qs.set('urgency', urgency.join(','))
  const token = getToken()
  const res = await fetch(apiUrl(`/api/finance/pnl/export-xlsx?${qs.toString()}`), {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eolis-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export default function FinanceRapportPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]         = useState('fr')
  const [user, setUser]             = useState<any>(null)
  const [rows, setRows]             = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [range, setRange]           = useState<DateRange | null>(null)
  const [urgencyFilter, setUrg]     = useState<string[]>([])
  const [showForecast, setForecast] = useState(false)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT','SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback((r: DateRange | null, urg: string[]) => {
    setLoading(true)
    const ps: string[] = []
    if (r) { ps.push(`from=${r.from}`, `to=${r.to}`) }
    if (urg.length) ps.push(`urgency=${urg.join(',')}`)
    const qs = ps.length ? `?${ps.join('&')}` : ''
    apiFetch(`/api/finance/pnl${qs}`).then(res => res.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) load(null, []) }, [user]) // eslint-disable-line

  function toggleUrg(v: string) { const next = urgencyFilter.includes(v) ? urgencyFilter.filter(x => x !== v) : [...urgencyFilter, v]; setUrg(next); load(range, next) }
  function clearUrg() { setUrg([]); load(range, []) }

  const isFr = locale === 'fr'
  const isReadOnly = user?.role === 'SYSTEM_ADMIN'

  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    aiCost: acc.aiCost + r.aiCost,
    infraCost: acc.infraCost + r.infraCost,
    acquisitionCost: acc.acquisitionCost + (r.acquisitionCost ?? 0),
    totalCost: acc.totalCost + r.totalCost,
    grossProfit: acc.grossProfit + r.grossProfit,
    netProfit: acc.netProfit + r.netProfit,
  }), { revenue: 0, aiCost: 0, infraCost: 0, acquisitionCost: 0, totalCost: 0, grossProfit: 0, netProfit: 0 })

  // Forecast: simple linear regression on netProfit
  const forecast = (() => {
    if (rows.length < 2) return null
    const n = rows.length
    const vals = rows.map(r => r.netProfit)
    const avgX = (n - 1) / 2
    const avgY = vals.reduce((s, v) => s + v, 0) / n
    const slope = vals.reduce((s, v, i) => s + (i - avgX) * (v - avgY), 0) / vals.reduce((s, _, i) => s + Math.pow(i - avgX, 2), 0)
    const intercept = avgY - slope * avgX
    const nextVal = slope * n + intercept
    const nextMonth = (() => {
      const last = rows[rows.length - 1].month
      const [y, m] = last.split('-').map(Number)
      const nm = m === 12 ? 1 : m + 1
      const ny = m === 12 ? y + 1 : y
      return `${ny}-${String(nm).padStart(2,'0')}`
    })()
    return { month: nextMonth, netProfit: +nextVal.toFixed(2), trend: slope > 0 ? 'up' : 'down' }
  })()

  // Financial alerts
  const alerts: { type: 'warn' | 'danger' | 'ok'; msg: string }[] = []
  if (totals.netProfit < 0) alerts.push({ type: 'danger', msg: isFr ? `Bénéfice net négatif sur la période : ${f2(totals.netProfit)} FCFA` : `Negative net profit for period: ${f2(totals.netProfit)} FCFA` })
  if (totals.revenue > 0 && totals.infraCost / totals.revenue > 0.3) alerts.push({ type: 'warn', msg: isFr ? `Charges infra élevées : ${((totals.infraCost/totals.revenue)*100).toFixed(1)}% des revenus` : `High infra costs: ${((totals.infraCost/totals.revenue)*100).toFixed(1)}% of revenue` })
  if (forecast && forecast.trend === 'down' && forecast.netProfit < 0) alerts.push({ type: 'warn', msg: isFr ? `Tendance baissière — bénéfice prévu ${f2(forecast.netProfit)} FCFA en ${forecast.month}` : `Downward trend — forecast ${f2(forecast.netProfit)} FCFA for ${forecast.month}` })
  if (totals.netProfit > 0 && totals.revenue > 0 && totals.netProfit / totals.revenue > 0.5) alerts.push({ type: 'ok', msg: isFr ? `Excellente marge : ${((totals.netProfit/totals.revenue)*100).toFixed(1)}% sur la période` : `Excellent margin: ${((totals.netProfit/totals.revenue)*100).toFixed(1)}% for period` })

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PieChart size={22} className="text-violet-600" />
              {isFr ? 'Rapport Profits & Pertes' : 'Profit & Loss Report'}
            </h1>
            {isReadOnly && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={12}/> {isFr ? 'Mode lecture seule' : 'Read-only'}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter onChange={(r) => { setRange(r); load(r, urgencyFilter) }} isFr={isFr} />
            <UrgencySelect selected={urgencyFilter} onToggle={toggleUrg} onClear={clearUrg} isFr={isFr} />
            {rows.length > 0 && (
              <button onClick={() => exportXlsx(range, urgencyFilter)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-300">
                <Download size={14} /> Excel
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {alerts.map((a, i) => (
          <div key={i} className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
            a.type === 'danger' ? 'bg-red-50 border border-red-200' :
            a.type === 'warn'   ? 'bg-amber-50 border border-amber-200' :
            'bg-emerald-50 border border-emerald-200'
          }`}>
            <span className="text-lg">{a.type === 'danger' ? '🚨' : a.type === 'warn' ? '⚠️' : '✅'}</span>
            <p className={`text-sm font-semibold ${a.type === 'danger' ? 'text-red-700' : a.type === 'warn' ? 'text-amber-700' : 'text-emerald-700'}`}>{a.msg}</p>
          </div>
        ))}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <PieChart size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucune donnée pour cette période.' : 'No data for this period.'}</p>
          </div>
        ) : (
          <>
            {/* KPI totaux */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: isFr ? 'Revenus totaux' : 'Total revenue', val: totals.revenue, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <TrendingUp size={18} className="text-emerald-600" /> },
                { label: isFr ? 'Coûts IA totaux' : 'Total AI costs', val: totals.aiCost, color: 'text-red-500', bg: 'bg-red-50', icon: <TrendingDown size={18} className="text-red-500" />, precise: true },
                { label: isFr ? 'Charges infra' : 'Infra costs', val: totals.infraCost, color: 'text-amber-600', bg: 'bg-amber-50', icon: <TrendingDown size={18} className="text-amber-600" /> },
                { label: isFr ? 'Bénéfice net total' : 'Total net profit', val: totals.netProfit, color: totals.netProfit >= 0 ? 'text-violet-600' : 'text-red-500', bg: totals.netProfit >= 0 ? 'bg-violet-50' : 'bg-red-50', icon: <PieChart size={18} className={totals.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'} /> },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>{c.icon}</div>
                  <p className={`text-2xl font-bold ${c.color}`}>{(c.precise ? c.val.toFixed(4) : f2(c.val))} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(c.val)} · €{toEur(c.val)}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Prévisionnel */}
            {forecast && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setForecast(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{forecast.trend === 'up' ? '📈' : '📉'}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {isFr ? 'Prévisionnel' : 'Forecast'} — {forecast.month}
                      </p>
                      <p className={`text-xs font-semibold ${forecast.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isFr ? 'Bénéfice net estimé :' : 'Estimated net profit:'} {f2(forecast.netProfit)} FCFA (${toUsd(forecast.netProfit)} · €{toEur(forecast.netProfit)})
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${showForecast ? 'rotate-180' : ''}`} />
                </button>
                {showForecast && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                      {isFr
                        ? `Projection basée sur la tendance linéaire des ${rows.length} derniers mois. La tendance est ${forecast.trend === 'up' ? 'haussière 📈' : 'baissière 📉'}. Ce chiffre est indicatif — il ne tient pas compte des charges non encore enregistrées.`
                        : `Projection based on linear trend of the last ${rows.length} months. Trend is ${forecast.trend === 'up' ? 'upward 📈' : 'downward 📉'}. This is indicative — unregistered costs are not accounted for.`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Charts */}
            <FinanceCharts rows={rows} isFr={isFr} />

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="font-bold text-gray-900">{isFr ? 'Détail mensuel' : 'Monthly breakdown'}</p>
                <button onClick={() => exportXlsx(range, urgencyFilter)} className="flex items-center gap-1.5 text-xs text-[#4A8FC4] font-medium hover:underline">
                  <Download size={13} /> {isFr ? 'Exporter Excel' : 'Export Excel'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1B3A5C] text-white text-xs">
                      <th className="px-4 py-3 text-left">{isFr ? 'Mois' : 'Month'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Revenus' : 'Revenue'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Coûts IA' : 'AI costs'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Infra' : 'Infra'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Acquisition' : 'Acquisition'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Bén. brut' : 'Gross'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Bén. net' : 'Net'}</th>
                      <th className="px-3 py-3 text-right">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">{r.month}</td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-emerald-600">{f2(r.revenue)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.revenue)}·€{toEur(r.revenue)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-red-500">{r.aiCost.toFixed(4)}</p>
                          <p className="text-[10px] text-gray-400">${(r.aiCost/USD).toFixed(4)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-amber-600">{f2(r.infraCost)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.infraCost)}·€{toEur(r.infraCost)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {(r.acquisitionCost ?? 0) > 0 ? (
                            <>
                              <p className="font-semibold text-purple-600">−{f2(r.acquisitionCost ?? 0)}</p>
                              <p className="text-[10px] text-gray-400">{(r.acquisitionCost ?? 0) / 100} client(s)</p>
                            </>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-blue-600">{f2(r.grossProfit)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.grossProfit)}·€{toEur(r.grossProfit)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className={`font-bold ${r.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{f2(r.netProfit)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.netProfit)}·€{toEur(r.netProfit)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.marginPct !== null ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.marginPct >= 70 ? 'bg-emerald-100 text-emerald-700' : r.marginPct >= 30 ? 'bg-amber-100 text-amber-700' : r.marginPct >= 0 ? 'bg-violet-100 text-violet-700' : 'bg-red-100 text-red-600'}`}>
                              {r.marginPct}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#EDF1F7] font-bold">
                      <td className="px-4 py-3 text-[#1B3A5C]">TOTAL</td>
                      <td className="px-3 py-3 text-right text-emerald-600">{f2(totals.revenue)}<br/><span className="text-[10px] font-normal text-gray-400">${toUsd(totals.revenue)}·€{toEur(totals.revenue)}</span></td>
                      <td className="px-3 py-3 text-right text-red-500">{totals.aiCost.toFixed(4)}</td>
                      <td className="px-3 py-3 text-right text-amber-600">{f2(totals.infraCost)}<br/><span className="text-[10px] font-normal text-gray-400">${toUsd(totals.infraCost)}·€{toEur(totals.infraCost)}</span></td>
                      <td className="px-3 py-3 text-right text-purple-600">−{f2(totals.acquisitionCost)}<br/><span className="text-[10px] font-normal text-gray-400">{totals.acquisitionCost / 100} client(s)</span></td>
                      <td className="px-3 py-3 text-right text-blue-600">{f2(totals.grossProfit)}</td>
                      <td className="px-3 py-3 text-right" style={{color: totals.netProfit >= 0 ? '#7c3aed' : '#ef4444'}}>
                        {f2(totals.netProfit)}<br/><span className="text-[10px] font-normal text-gray-400">${toUsd(totals.netProfit)}·€{toEur(totals.netProfit)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {totals.revenue > 0 && <span className="text-xs font-bold text-violet-600">{((totals.netProfit/totals.revenue)*100).toFixed(1)}%</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
