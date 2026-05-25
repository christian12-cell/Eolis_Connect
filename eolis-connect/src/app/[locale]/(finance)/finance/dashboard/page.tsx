'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import {
  TrendingUp, TrendingDown, DollarSign, Building2, PieChart,
  Wallet, Clock, Loader2, AlertCircle, MessageSquare, Phone,
} from 'lucide-react'
import FinanceCharts from '../FinanceCharts'

const EUR = 655.957; const USD = 600
function f2(n: number) { return n.toFixed(2) }
function f4(n: number) { return n.toFixed(4) }
function toUsd(fcfa: number) { return (fcfa / USD).toFixed(2) }
function toEur(fcfa: number) { return (fcfa / EUR).toFixed(2) }

function KpiCard({ icon, label, fcfa, sub, color = '', precise = false }: {
  icon: React.ReactNode; label: string; fcfa: number; sub?: string; color?: string; precise?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color || 'bg-gray-100'}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{precise ? f4(fcfa) : f2(fcfa)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
      <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(fcfa)} · €{toEur(fcfa)}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function FinanceDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]   = useState('fr')
  const [user, setUser]       = useState<any>(null)
  const [data, setData]       = useState<any>(null)
  const [pnl, setPnl]         = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState<DateRange | null>(null)

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
    Promise.all([
      apiFetch(`/api/finance/dashboard${qs}`).then(res => res.json()),
      apiFetch(`/api/finance/pnl${qs}`).then(res => res.json()),
    ]).then(([d, p]) => {
      setData(d)
      setPnl(Array.isArray(p) ? p : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) load(null) }, [user]) // eslint-disable-line

  const isFr = locale === 'fr'
  const isReadOnly = user?.role === 'SYSTEM_ADMIN'

  // Financial alerts
  const alerts: { type: 'danger' | 'warn' | 'ok' | 'info'; msg: string }[] = []
  if (data) {
    if (data.pendingCount > 0) alerts.push({ type: 'info', msg: isFr ? `${data.pendingCount} demande(s) de recharge en attente — ${f2(data.pendingAmount)} FCFA à valider` : `${data.pendingCount} top-up request(s) pending — ${f2(data.pendingAmount)} FCFA to approve` })
    if (data.netProfit < 0) alerts.push({ type: 'danger', msg: isFr ? `Bénéfice net négatif : ${f2(data.netProfit)} FCFA` : `Negative net profit: ${f2(data.netProfit)} FCFA` })
    if (data.totalRevenue > 0 && data.totalInfraFcfa / data.totalRevenue > 0.3) alerts.push({ type: 'warn', msg: isFr ? `Charges infra élevées : ${((data.totalInfraFcfa/data.totalRevenue)*100).toFixed(1)}% des revenus` : `High infra costs: ${((data.totalInfraFcfa/data.totalRevenue)*100).toFixed(1)}% of revenue` })
    if (data.netProfit > 0 && data.totalRevenue > 0 && data.netProfit / data.totalRevenue > 0.5) alerts.push({ type: 'ok', msg: isFr ? `Excellente marge nette : ${((data.netProfit/data.totalRevenue)*100).toFixed(1)}%` : `Excellent net margin: ${((data.netProfit/data.totalRevenue)*100).toFixed(1)}%` })
  }

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-6 max-w-6xl">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PieChart size={22} className="text-violet-600" />
              {isFr ? 'Tableau de bord financier' : 'Financial Dashboard'}
            </h1>
            {isReadOnly && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {isFr ? 'Mode lecture seule — SYSTEM_ADMIN' : 'Read-only — SYSTEM_ADMIN'}
              </p>
            )}
          </div>
          <PeriodFilter onChange={(r) => { setRange(r); load(r) }} isFr={isFr} />
        </div>

        {/* Alerts */}
        {alerts.map((a, i) => (
          <div key={i} className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
            a.type === 'danger' ? 'bg-red-50 border border-red-200' :
            a.type === 'warn'   ? 'bg-amber-50 border border-amber-200' :
            a.type === 'ok'     ? 'bg-emerald-50 border border-emerald-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <span className="text-lg flex-shrink-0">{a.type === 'danger' ? '🚨' : a.type === 'warn' ? '⚠️' : a.type === 'ok' ? '✅' : '💬'}</span>
            <p className={`text-sm font-semibold ${a.type === 'danger' ? 'text-red-700' : a.type === 'warn' ? 'text-amber-700' : a.type === 'ok' ? 'text-emerald-700' : 'text-blue-700'}`}>{a.msg}</p>
            {a.type === 'info' && !isReadOnly && (
              <button onClick={() => router.push(`/${locale}/finance/credits`)}
                className="ml-auto px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600">
                {isFr ? 'Valider →' : 'Approve →'}
              </button>
            )}
          </div>
        ))}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>
        ) : !data ? null : (
          <>
            {/* KPI row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<TrendingUp size={18} className="text-emerald-600" />}  label={isFr ? 'Revenus recharges' : 'Top-up revenue'}         fcfa={data.totalRevenue}          sub={`${data.approvedCount} recharge(s)`}  color="bg-emerald-50" />
              <KpiCard icon={<DollarSign size={18} className="text-blue-600" />}     label={isFr ? 'Prix client (crédits)' : 'Client price (credits)'} fcfa={data.totalCreditsConsumed} sub={`${f2(data.totalCreditsConsumed)} cr.`} color="bg-blue-50" />
              <KpiCard icon={<TrendingDown size={18} className="text-red-500" />}    label={isFr ? 'Coûts IA (OpenAI)' : 'AI costs (OpenAI)'}          fcfa={data.totalAiCostFcfa}       sub={`$${data.totalAiCostUsd}`}            color="bg-red-50"    precise />
              <KpiCard icon={<Building2 size={18} className="text-amber-600" />}    label={isFr ? 'Charges infra' : 'Infra costs'}                   fcfa={data.totalInfraFcfa}        sub={`$${f2(data.totalInfraUsd)}`}         color="bg-amber-50" />
            </div>

            {/* SMS Premium block */}
            {(data.smsCount > 0 || data.otpCount > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* SMS Premium */}
                {data.smsCount > 0 && (
                  <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                        <MessageSquare size={18} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{isFr ? 'SMS Premium' : 'Premium SMS'}</p>
                        <p className="text-[10px] text-gray-400">{isFr ? 'Seven.io · automatique' : 'Seven.io · automatic'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{isFr ? 'SMS envoyés' : 'SMS sent'}</span>
                        <span className="text-sm font-bold text-gray-800">{data.smsCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{isFr ? 'Revenus crédits' : 'Credit revenue'}</span>
                        <span className="text-sm font-semibold text-emerald-600">{f2(data.smsRevenueFcfa)} FCFA</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{isFr ? 'Coût Seven.io' : 'Seven.io cost'}</span>
                        <span className="text-sm font-semibold text-red-500">{f2(data.smsCostFcfa)} FCFA</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-xs font-bold text-gray-700">{isFr ? 'Marge SMS' : 'SMS margin'}</span>
                        <span className={`text-sm font-bold ${data.smsProfitFcfa >= 0 ? 'text-purple-600' : 'text-red-500'}`}>
                          {f2(data.smsProfitFcfa)} FCFA
                          {data.smsMarginPct !== null && <span className="text-xs font-normal ml-1">({data.smsMarginPct}%)</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* OTP Twilio Verify */}
                {data.otpCount > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Phone size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{isFr ? 'OTP Twilio Verify' : 'Twilio Verify OTP'}</p>
                        <p className="text-[10px] text-gray-400">{isFr ? 'Charge infra — estimation automatique' : 'Infra cost — auto estimate'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{isFr ? 'Vérifications OTP' : 'OTP verifications'}</span>
                        <span className="text-sm font-bold text-gray-800">{data.otpCount}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-xs font-bold text-gray-700">{isFr ? 'Coût estimé' : 'Estimated cost'}</span>
                        <span className="text-sm font-bold text-slate-600">
                          ~{f2(data.otpEstimatedFcfa)} FCFA
                          <span className="text-xs font-normal text-gray-400 ml-1">(~${toUsd(data.otpEstimatedFcfa)})</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 italic">{isFr ? '≈ 30 FCFA/vérif. · à saisir manuellement dans les charges infra' : '≈ 30 FCFA/verif. · enter manually in infra costs'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nouveaux clients — info seulement */}
            {data.newClientsCount > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Wallet size={16} className="text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  <span className="font-bold">{data.newClientsCount}</span> {isFr ? 'nouveau(x) client(s) inscrit(s) sur la période — 100 crédits offerts chacun. Le coût de traitement est déjà inclus dans les Coûts traitement.' : 'new client(s) registered in period — 100 free credits each. The processing cost is already included in Processing costs.'}
                </p>
              </div>
            )}

            {/* KPI row 2 — profits */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><TrendingUp size={18} className="text-blue-600" /></div>
                <p className="text-2xl font-bold text-blue-600">{f2(data.usageProfit)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(data.usageProfit)} · €{toEur(data.usageProfit)}</p>
                <p className="text-xs text-gray-500 mt-1">{isFr ? 'Bénéfice sur usages' : 'Usage profit'}</p>
                <p className="text-[10px] text-gray-400">{isFr ? 'crédits − coûts IA − coûts SMS' : 'credits − AI costs − SMS costs'}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><TrendingUp size={18} className="text-emerald-600" /></div>
                <p className="text-2xl font-bold text-emerald-600">{f2(data.grossProfit)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(data.grossProfit)} · €{toEur(data.grossProfit)}</p>
                <p className="text-xs text-gray-500 mt-1">{isFr ? 'Bénéfice brut' : 'Gross profit'}</p>
                <p className="text-[10px] text-gray-400">{isFr ? 'revenus − coûts IA − coûts SMS' : 'revenue − AI costs − SMS costs'}</p>
              </div>
              <div className={`bg-white rounded-2xl border p-5 shadow-sm ${data.netProfit >= 0 ? 'border-violet-200' : 'border-red-200'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${data.netProfit >= 0 ? 'bg-violet-50' : 'bg-red-50'}`}>
                  <PieChart size={18} className={data.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'} />
                </div>
                <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{f2(data.netProfit)} <span className="text-sm font-normal text-gray-400">FCFA</span></p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">${toUsd(data.netProfit)} · €{toEur(data.netProfit)}</p>
                <p className="text-xs text-gray-500 mt-1">{isFr ? 'Bénéfice net (après toutes charges)' : 'Net profit (after all costs)'}</p>
                {data.marginPct !== null && (
                  <p className={`text-xs font-bold mt-0.5 ${data.netProfit >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{data.marginPct}% marge</p>
                )}
              </div>
            </div>

            {/* Charts P&L trend */}
            {pnl.length > 0 && <FinanceCharts rows={pnl} isFr={isFr} />}

            {/* Pending credits */}
            {data.pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-amber-600" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">{data.pendingCount} {isFr ? 'demande(s) en attente' : 'request(s) pending'}</p>
                    <p className="text-xs text-amber-600 font-mono">{f2(data.pendingAmount)} FCFA · ${toUsd(data.pendingAmount)} · €{toEur(data.pendingAmount)}</p>
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
                  <p className="font-bold text-gray-900">{isFr ? 'Charges infrastructure' : 'Infrastructure costs'}</p>
                  {!isReadOnly && (
                    <button onClick={() => router.push(`/${locale}/finance/depenses`)}
                      className="text-xs text-[#4A8FC4] font-medium hover:underline">{isFr ? 'Gérer →' : 'Manage →'}</button>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {data.infraBreakdown.slice(0,5).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                        <p className="text-xs text-gray-400">{c.category} · {c.period}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">{f2(c.amountFcfa)} FCFA</p>
                        <p className="text-[10px] text-gray-400 font-mono">${toUsd(c.amountFcfa)} · €{toEur(c.amountFcfa)}</p>
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
