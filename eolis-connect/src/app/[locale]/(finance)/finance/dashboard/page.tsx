'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import {
  TrendingUp, TrendingDown, DollarSign, Building2, PieChart,
  Wallet, Clock, CheckCircle, Loader2, AlertCircle,
} from 'lucide-react'

const EUR = 655.957
const USD = 600
function f2(n: number) { return n.toFixed(2) }
function f4(n: number) { return n.toFixed(4) }
function toUsd(fcfa: number) { return (fcfa / USD).toFixed(2) }
function toEur(fcfa: number) { return (fcfa / EUR).toFixed(2) }

function KpiCard({ icon, label, fcfa, sub, color = '', precise = false }: {
  icon: React.ReactNode; label: string; fcfa: number; sub?: string; color?: string; precise?: boolean
}) {
  const fmt = precise ? f4 : f2
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color || 'bg-gray-100'}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{fmt(fcfa)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
      <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(fcfa)} · €{toEur(fcfa)}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function FinanceDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange]   = useState<DateRange | null>(null)
  const [label, setLabel]   = useState('')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback((r: DateRange | null) => {
    setLoading(true)
    const qs = r ? `?from=${r.from}&to=${r.to}` : ''
    apiFetch(`/api/finance/dashboard${qs}`).then(res => res.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) load(range) }, [user]) // eslint-disable-line

  const isFr = locale === 'fr'
  const isReadOnly = user?.role === 'SYSTEM_ADMIN'

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-6 max-w-6xl">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PieChart size={22} className="text-violet-600" />
              {isFr ? 'Tableau de bord financier' : 'Financial Dashboard'}
            </h1>
            {isReadOnly && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {isFr ? 'Mode lecture seule — SYSTEM_ADMIN' : 'Read-only mode — SYSTEM_ADMIN'}
              </p>
            )}
          </div>
          <PeriodFilter onChange={(r, l) => { setRange(r); setLabel(l); load(r) }} isFr={isFr} />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
        ) : !data ? null : (
          <>
            {/* KPI row 1 — revenus & coûts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<TrendingUp size={18} className="text-emerald-600" />} label={isFr ? 'Revenus recharges' : 'Top-up revenue'} fcfa={data.totalRevenue} sub={`${data.approvedCount} ${isFr ? 'recharge(s)' : 'top-up(s)'}`} color="bg-emerald-50" />
              <KpiCard icon={<DollarSign size={18} className="text-blue-600" />}   label={isFr ? 'Prix client (crédits)' : 'Client price (credits)'} fcfa={data.totalCreditsConsumed} sub={`${f2(data.totalCreditsConsumed)} crédits`} color="bg-blue-50" />
              <KpiCard icon={<TrendingDown size={18} className="text-red-500" />}  label={isFr ? 'Coûts IA (OpenAI)' : 'AI costs (OpenAI)'} fcfa={data.totalAiCostFcfa} sub={`$${data.totalAiCostUsd}`} color="bg-red-50" precise />
              <KpiCard icon={<Building2 size={18} className="text-amber-600" />}  label={isFr ? 'Charges infrastructure' : 'Infrastructure costs'} fcfa={data.totalInfraFcfa} sub={`$${f2(data.totalInfraUsd)}`} color="bg-amber-50" />
            </div>

            {/* KPI row 2 — bénéfices */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                  <TrendingUp size={18} className="text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">{f2(data.usageProfit)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(data.usageProfit)} · €{toEur(data.usageProfit)}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{isFr ? 'Bénéfice sur usages IA' : 'AI usage profit'}</p>
                <p className="text-[10px] text-gray-400">{isFr ? 'crédits − coûts OpenAI' : 'credits − OpenAI costs'}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">{f2(data.grossProfit)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(data.grossProfit)} · €{toEur(data.grossProfit)}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{isFr ? 'Bénéfice brut' : 'Gross profit'}</p>
                <p className="text-[10px] text-gray-400">{isFr ? 'revenus − coûts IA' : 'revenue − AI costs'}</p>
              </div>
              <div className={`bg-white rounded-2xl border p-5 shadow-sm ${data.netProfit >= 0 ? 'border-violet-200' : 'border-red-200'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${data.netProfit >= 0 ? 'bg-violet-50' : 'bg-red-50'}`}>
                  <PieChart size={18} className={data.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'} />
                </div>
                <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{f2(data.netProfit)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(data.netProfit)} · €{toEur(data.netProfit)}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{isFr ? 'Bénéfice net (après charges)' : 'Net profit (after all costs)'}</p>
                {data.marginPct !== null && (
                  <p className={`text-[10px] font-semibold mt-0.5 ${data.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{data.marginPct}% {isFr ? 'de marge' : 'margin'}</p>
                )}
              </div>
            </div>

            {/* Pending credits */}
            {data.pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-amber-600" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      {data.pendingCount} {isFr ? 'demande(s) de recharge en attente' : 'top-up request(s) pending'}
                    </p>
                    <p className="text-xs text-amber-600">{f2(data.pendingAmount)} FCFA · ${toUsd(data.pendingAmount)} · €{toEur(data.pendingAmount)}</p>
                  </div>
                </div>
                {!isReadOnly && (
                  <button onClick={() => router.push(`/${locale}/finance/credits`)}
                    className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600">
                    {isFr ? 'Valider →' : 'Approve →'}
                  </button>
                )}
              </div>
            )}

            {/* Infra breakdown */}
            {data.infraBreakdown?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-bold text-gray-900">{isFr ? 'Charges infrastructure (période)' : 'Infrastructure costs (period)'}</p>
                  {!isReadOnly && (
                    <button onClick={() => router.push(`/${locale}/finance/depenses`)}
                      className="text-xs text-[#4A8FC4] font-medium hover:underline">
                      {isFr ? 'Gérer →' : 'Manage →'}
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {data.infraBreakdown.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                        <p className="text-xs text-gray-400">{c.category} · {c.period}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">{f2(c.amountFcfa)} FCFA</p>
                        <p className="text-[10px] text-gray-400 font-mono">${c.amountUsd.toFixed(2)} · €{(c.amountFcfa / EUR).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
