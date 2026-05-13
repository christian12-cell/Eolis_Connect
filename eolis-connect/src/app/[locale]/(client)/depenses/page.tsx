'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { Wallet, FileText, ChevronRight, Loader2, TrendingUp } from 'lucide-react'

type Period = 'today' | 'month' | 'year' | 'all'

const PERIOD_LABELS: Record<Period, { fr: string; en: string }> = {
  today: { fr: "Aujourd'hui", en: 'Today' },
  month: { fr: 'Ce mois',     en: 'This month' },
  year:  { fr: 'Cette année', en: 'This year' },
  all:   { fr: 'Tout',        en: 'All time' },
}

export default function DepensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/accueil`); return }
  }, [locale])

  useEffect(() => {
    setLoading(true)
    apiFetch(`/api/ai-usage/my?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const isFr = locale === 'fr'

  return (
    <MobileLayout locale={locale} title={isFr ? 'Mes dépenses IA' : 'My AI expenses'}>
      <div className="space-y-4">

        {/* Period filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p}
              onClick={() => setPeriod(p)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                period === p
                  ? 'bg-white text-[#1B3A5C] shadow'
                  : 'bg-white/15 text-white/70 border border-white/20'
              }`}>
              {PERIOD_LABELS[p][isFr ? 'fr' : 'en']}
            </button>
          ))}
        </div>

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
                  {data.totalFcfa.toFixed(2)} FCFA
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>${data.totalUsd.toFixed(6)}</span>
              <span>{data.count} {isFr ? 'extraction(s) IA' : 'AI extraction(s)'}</span>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-xs text-blue-100 leading-relaxed">
          ⚡ {isFr
            ? 'Ces dépenses correspondent aux extractions IA de vos Booking Confirmations Eagle. Le coût est calculé avec précision selon les tokens utilisés.'
            : 'These expenses correspond to AI extractions of your Eagle Booking Confirmations. Cost is calculated precisely from tokens used.'}
        </div>

        {/* Items list */}
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
                className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 cursor-pointer active:bg-gray-50"
                onClick={() => item.ticketId && router.push(`/${locale}/mes-demandes/${item.ticketId}`)}>
                <div className="w-9 h-9 rounded-xl bg-[#EDF1F7] flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-[#1B3A5C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 font-mono">
                    {item.ticketRef ?? (isFr ? 'Sans dossier' : 'No ticket')}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(item.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB')}
                    {' · '}{item.model}
                    {' · '}{item.inputTokens + item.outputTokens} tokens
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#1B3A5C]">{item.costFcfa.toFixed(2)} FCFA</p>
                  <p className="text-[10px] text-gray-400">${item.costUsd.toFixed(6)}</p>
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
