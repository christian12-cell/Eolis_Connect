'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import { Zap, TrendingUp, Users, FileText, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

export default function IACoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [periodLabel, setPeriodLabel] = useState('')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN' && u.role !== 'OPS_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback((range: DateRange | null) => {
    setLoading(true)
    const qs = range ? `?from=${range.from}&to=${range.to}` : ''
    apiFetch(`/api/ai-usage/admin${qs}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleRange(range: DateRange | null, label: string) {
    setPeriodLabel(label)
    load(range)
  }

  if (!user) return null
  const isFr = locale === 'fr'

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap size={22} className="text-violet-600" />
              {isFr ? 'Coûts IA — Extractions BL' : 'AI Costs — BL Extractions'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isFr ? 'Suivi des dépenses par extraction gpt-4o-mini' : 'Expense tracking per gpt-4o-mini extraction'}
            </p>
          </div>
          <PeriodFilter onChange={handleRange} isFr={isFr} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: isFr ? 'Total FCFA' : 'Total FCFA',
                  value: `${(data.totalFcfa ?? 0).toFixed(4)} FCFA`,
                  sub: `$${(data.totalUsd ?? 0).toFixed(8)}`,
                  icon: <TrendingUp size={18} className="text-violet-600" />,
                  bg: 'bg-violet-50',
                },
                {
                  label: isFr ? 'Extractions' : 'Extractions',
                  value: String(data.count ?? 0),
                  sub: 'gpt-4o-mini',
                  icon: <Zap size={18} className="text-blue-600" />,
                  bg: 'bg-blue-50',
                },
                {
                  label: isFr ? 'Clients actifs' : 'Active clients',
                  value: String(data.clientsSummary?.length ?? 0),
                  sub: isFr ? 'ayant utilisé le mode BL' : 'who used BL mode',
                  icon: <Users size={18} className="text-emerald-600" />,
                  bg: 'bg-emerald-50',
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                    {card.icon}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
                  <p className="text-[10px] text-gray-300 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Per-client breakdown */}
            {(data.clientsSummary?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="font-bold text-gray-900">{isFr ? 'Répartition par client' : 'Per-client breakdown'}</p>
                  {periodLabel && <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>}
                </div>
                <div className="divide-y divide-gray-50">
                  {data.clientsSummary.map((c: any) => {
                    const isExpanded = expandedClient === c.clientId
                    const clientItems = data.items?.filter((i: any) => i.clientId === c.clientId) ?? []
                    return (
                      <div key={c.clientId}>
                        {/* Client row */}
                        <button
                          onClick={() => setExpandedClient(isExpanded ? null : c.clientId)}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-white">
                              {c.firstName?.[0]}{c.lastName?.[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{c.firstName} {c.lastName}</p>
                            <p className="text-xs text-gray-400">{c.count} {isFr ? 'extraction(s)' : 'extraction(s)'}</p>
                          </div>
                          <div className="text-right mr-2">
                            <p className="text-sm font-bold text-[#1B3A5C]">{(c.totalFcfa ?? 0).toFixed(4)} FCFA</p>
                            <p className="text-[10px] text-gray-400">${(c.totalUsd ?? 0).toFixed(8)}</p>
                          </div>
                          {isExpanded
                            ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                            : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
                        </button>

                        {/* Expanded: detail per extraction */}
                        {isExpanded && clientItems.length > 0 && (
                          <div className="bg-gray-50 px-5 py-3 space-y-2 border-t border-gray-100">
                            {clientItems.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3 py-2">
                                <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <FileText size={12} className="text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 font-mono">
                                    {item.ticketRef ?? (isFr ? 'Sans dossier' : 'No ticket')}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(item.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {' · '}{(item.inputTokens ?? 0) + (item.outputTokens ?? 0)} tokens
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs font-bold text-gray-800">{(item.costFcfa ?? 0).toFixed(4)} FCFA</p>
                                  <p className="text-[10px] text-gray-400">${(item.costUsd ?? 0).toFixed(8)}</p>
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

            {/* Empty state */}
            {(data.count ?? 0) === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                <Zap size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  {isFr ? 'Aucune extraction IA sur cette période.' : 'No AI extractions for this period.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
