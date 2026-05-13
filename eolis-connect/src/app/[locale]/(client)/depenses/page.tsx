'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import { FileText, ChevronRight, Loader2, TrendingUp, Zap } from 'lucide-react'

export default function DepensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [range, setRange]   = useState<DateRange | null>(null)
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/accueil`); return }
  }, [locale])

  const load = useCallback((r: DateRange | null) => {
    setLoading(true)
    const qs = r ? `?from=${r.from}&to=${r.to}` : ''
    apiFetch(`/api/ai-usage/my${qs}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleRangeChange(r: DateRange | null) {
    setRange(r)
    load(r)
  }

  const isFr = locale === 'fr'

  return (
    <MobileLayout locale={locale} title={isFr ? 'Mes dépenses IA' : 'My AI expenses'}>
      <div className="space-y-4">

        {/* Filter */}
        <PeriodFilter onChange={(r) => handleRangeChange(r)} isFr={isFr} dark />

        {/* Total banner */}
        {data && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B3A5C] flex items-center justify-center">
                <TrendingUp size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                  {isFr ? 'Total dépensé' : 'Total spent'}
                </p>
                <p className="text-xl font-bold text-[#1B3A5C]">
                  {(data.totalFcfa ?? 0).toFixed(4)} FCFA
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>${(data.totalUsd ?? 0).toFixed(8)}</span>
              <span>{data.count ?? 0} {isFr ? 'extraction(s) IA' : 'AI extraction(s)'}</span>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-xs text-blue-100 leading-relaxed">
          <Zap size={12} className="inline mr-1" />
          {isFr
            ? 'Coûts liés aux extractions IA de vos Booking Confirmations Eagle (gpt-4o-mini).'
            : 'Costs from AI extractions of your Eagle Booking Confirmations (gpt-4o-mini).'}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-white animate-spin" />
          </div>
        ) : data?.items?.length === 0 ? (
          <div className="bg-white/10 rounded-2xl py-12 text-center text-blue-200 text-sm">
            {isFr ? 'Aucune dépense sur cette période.' : 'No expenses for this period.'}
          </div>
        ) : (
          <div className="space-y-2">
            {data?.items?.map((item: any) => (
              <div key={item.id}
                className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 active:bg-gray-50"
                onClick={() => item.ticketId && router.push(`/${locale}/mes-demandes/${item.ticketId}`)}>
                <div className="w-9 h-9 rounded-xl bg-[#EDF1F7] flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-[#1B3A5C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 font-mono">
                    {item.ticketRef ?? (isFr ? 'Sans dossier' : 'No ticket')}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(item.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}{item.model}
                    {' · '}{(item.inputTokens ?? 0) + (item.outputTokens ?? 0)} tokens
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#1B3A5C]">{(item.costFcfa ?? 0).toFixed(4)} FCFA</p>
                  <p className="text-[10px] text-gray-400">${(item.costUsd ?? 0).toFixed(8)}</p>
                </div>
                {item.ticketId && <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  )
}
