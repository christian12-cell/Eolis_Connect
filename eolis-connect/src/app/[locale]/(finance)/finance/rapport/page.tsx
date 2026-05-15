'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import { PieChart, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

const EUR = 655.957; const USD = 600
function f2(n: number) { return n.toFixed(2) }
function toUsd(f: number) { return (f/USD).toFixed(2) }
function toEur(f: number) { return (f/EUR).toFixed(2) }

export default function FinanceRapportPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]   = useState('fr')
  const [user, setUser]       = useState<any>(null)
  const [rows, setRows]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT','SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback((r: DateRange | null) => {
    setLoading(true)
    const qs = r ? `?from=${r.from}&to=${r.to}` : ''
    apiFetch(`/api/finance/pnl${qs}`).then(res => res.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) load(null) }, [user]) // eslint-disable-line

  const isFr = locale === 'fr'
  const isReadOnly = user?.role === 'SYSTEM_ADMIN'

  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    aiCost: acc.aiCost + r.aiCost,
    infraCost: acc.infraCost + r.infraCost,
    netProfit: acc.netProfit + r.netProfit,
  }), { revenue: 0, aiCost: 0, infraCost: 0, netProfit: 0 })

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-6 max-w-5xl">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PieChart size={22} className="text-violet-600" />
              {isFr ? 'Rapport Profits & Pertes' : 'Profit & Loss Report'}
            </h1>
            {isReadOnly && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={12}/> {isFr ? 'Mode lecture seule' : 'Read-only mode'}</p>}
          </div>
          <PeriodFilter onChange={(r) => load(r)} isFr={isFr} />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <PieChart size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucune donnée pour cette période.' : 'No data for this period.'}</p>
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: isFr ? 'Revenus totaux' : 'Total revenue', val: totals.revenue, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <TrendingUp size={18} className="text-emerald-600" /> },
                { label: isFr ? 'Coûts IA totaux' : 'Total AI costs', val: totals.aiCost, color: 'text-red-500', bg: 'bg-red-50', icon: <TrendingDown size={18} className="text-red-500" /> },
                { label: isFr ? 'Charges infra' : 'Infra costs', val: totals.infraCost, color: 'text-amber-600', bg: 'bg-amber-50', icon: <TrendingDown size={18} className="text-amber-600" /> },
                { label: isFr ? 'Bénéfice net total' : 'Total net profit', val: totals.netProfit, color: totals.netProfit >= 0 ? 'text-violet-600' : 'text-red-500', bg: totals.netProfit >= 0 ? 'bg-violet-50' : 'bg-red-50', icon: <PieChart size={18} className={totals.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'} /> },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>{c.icon}</div>
                  <p className={`text-2xl font-bold ${c.color}`}>{f2(c.val)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                  <p className="text-[10px] text-gray-400 font-mono">${toUsd(c.val)} · €{toEur(c.val)}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Monthly table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-900">{isFr ? 'Détail mensuel' : 'Monthly breakdown'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1B3A5C] text-white text-xs">
                      <th className="px-5 py-3 text-left">{isFr ? 'Mois' : 'Month'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Revenus' : 'Revenue'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Coûts IA' : 'AI costs'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Charges infra' : 'Infra'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Bénéfice brut' : 'Gross profit'}</th>
                      <th className="px-3 py-3 text-right">{isFr ? 'Bénéfice net' : 'Net profit'}</th>
                      <th className="px-3 py-3 text-right">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-800">{r.month}</td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-emerald-600">{f2(r.revenue)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.revenue)} · €{toEur(r.revenue)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-red-500">{r.aiCost.toFixed(4)}</p>
                          <p className="text-[10px] text-gray-400">${(r.aiCost/USD).toFixed(4)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-amber-600">{f2(r.infraCost)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.infraCost)} · €{toEur(r.infraCost)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-blue-600">{f2(r.grossProfit)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.grossProfit)} · €{toEur(r.grossProfit)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className={`font-bold ${r.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{f2(r.netProfit)}</p>
                          <p className="text-[10px] text-gray-400">${toUsd(r.netProfit)} · €{toEur(r.netProfit)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.marginPct !== null ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.marginPct >= 50 ? 'bg-emerald-100 text-emerald-700' : r.marginPct >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                              {r.marginPct}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#EDF1F7] font-bold">
                      <td className="px-5 py-3 text-[#1B3A5C]">TOTAL</td>
                      <td className="px-3 py-3 text-right text-emerald-600">{f2(totals.revenue)}<br/><span className="text-[10px] font-normal text-gray-400">${toUsd(totals.revenue)}·€{toEur(totals.revenue)}</span></td>
                      <td className="px-3 py-3 text-right text-red-500">{totals.aiCost.toFixed(4)}</td>
                      <td className="px-3 py-3 text-right text-amber-600">{f2(totals.infraCost)}<br/><span className="text-[10px] font-normal text-gray-400">${toUsd(totals.infraCost)}·€{toEur(totals.infraCost)}</span></td>
                      <td className="px-3 py-3 text-right text-blue-600">{f2(totals.revenue - totals.aiCost)}</td>
                      <td className="px-3 py-3 text-right" style={{color: totals.netProfit >= 0 ? '#7c3aed' : '#ef4444'}}>{f2(totals.netProfit)}<br/><span className="text-[10px] font-normal text-gray-400">${toUsd(totals.netProfit)}·€{toEur(totals.netProfit)}</span></td>
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
