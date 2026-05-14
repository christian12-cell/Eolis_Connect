'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { PeriodFilter, DateRange } from '@/components/ui/PeriodFilter'
import { apiFetch, getUser } from '@/lib/api-client'
import { ChevronDown, ChevronRight, Loader2, TrendingUp, Zap, PlusCircle } from 'lucide-react'

interface UsageItem {
  id: string
  type: string
  ticketId: string | null
  ticketRef: string | null
  creditsCost: number
  createdAt: string
}

interface TicketGroup {
  ref: string | null
  ticketId: string | null
  items: UsageItem[]
  totalCredits: number
}

function groupByTicket(items: UsageItem[]): TicketGroup[] {
  const map = new Map<string, TicketGroup>()
  for (const item of items) {
    const key = item.ticketRef ?? '__no_ticket__'
    if (!map.has(key)) {
      map.set(key, { ref: item.ticketRef, ticketId: item.ticketId, items: [], totalCredits: 0 })
    }
    const g = map.get(key)!
    g.items.push(item)
    g.totalCredits = parseFloat((g.totalCredits + (item.creditsCost || 0)).toFixed(2))
  }
  return [...map.values()].sort((a, b) => (b.totalCredits - a.totalCredits))
}

export default function DepensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [balance, setBalance] = useState<any>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/accueil`); return }
    apiFetch('/api/credits/balance').then(r => r.json()).then(setBalance).catch(() => {})
  }, [locale])

  const load = useCallback((r: DateRange | null) => {
    setLoading(true)
    const qs = r ? `?from=${r.from}&to=${r.to}` : ''
    apiFetch(`/api/ai-usage/my${qs}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const isFr = locale === 'fr'
  const groups: TicketGroup[] = data?.items ? groupByTicket(data.items) : []

  const typeLabel = (type: string) => {
    if (type === 'bl_extraction') return isFr ? '📄 Extraction BL' : '📄 BL extraction'
    if (type === 'voice_transcription') return isFr ? '🎙️ Dictée vocale' : '🎙️ Voice dictation'
    return type
  }

  return (
    <MobileLayout locale={locale} title={isFr ? 'Mes dépenses IA' : 'My AI expenses'}>
      <div className="space-y-4">

        <PeriodFilter onChange={(r) => load(r)} isFr={isFr} dark />

        {/* Total credits banner */}
        {data && (
          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-100">
              {data.count ?? 0} {isFr ? 'opération(s) premium' : 'premium operation(s)'}
            </p>
            <p className="text-sm font-bold text-white font-mono">
              {(data.totalCredits ?? 0).toFixed(0)} crédits
            </p>
          </div>
        )}

        {/* Credit balance block */}
        {balance && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-amber-500" />
              <p className="text-sm font-bold text-gray-900">{isFr ? 'Crédits Premium' : 'Premium Credits'}</p>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: isFr ? 'Achetés' : 'Purchased',  value: Math.round(balance.creditsTotal) },
                { label: isFr ? 'Utilisés' : 'Used',      value: Math.round(balance.creditsUsed) },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-gray-600">
                  <span>{row.label}</span>
                  <span className="font-mono font-semibold">{row.value} crédits</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex justify-between text-[#1B3A5C] font-bold">
                <span>{isFr ? 'Restants' : 'Remaining'}</span>
                <span className="font-mono">{Math.round(balance.creditsRemaining)} crédits</span>
              </div>
            </div>
            <button onClick={() => router.push(`/${locale}/recharger`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold active:opacity-80 transition-opacity">
              <PlusCircle size={15} />
              {isFr ? 'Recharger mes crédits' : 'Top up credits'}
            </button>
          </div>
        )}

        <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-xs text-blue-100 leading-relaxed">
          <Zap size={12} className="inline mr-1" />
          {isFr
            ? 'Détail des opérations premium consommées.'
            : 'Detail of premium operations consumed.'}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-white animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white/10 rounded-2xl py-12 text-center text-blue-200 text-sm">
            {isFr ? 'Aucune dépense sur cette période.' : 'No expenses for this period.'}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g, gi) => {
              const key = g.ref ?? '__no_ticket__'
              const isOpen = expanded === key
              return (
                <div key={gi} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  {/* Group header */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : key)}>
                    <div className="w-9 h-9 rounded-xl bg-[#EDF1F7] flex items-center justify-center flex-shrink-0">
                      <Zap size={16} className="text-[#1B3A5C]" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-gray-900 font-mono">
                        {g.ref ?? (isFr ? 'Sans dossier' : 'No ticket')}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {g.items.length} {isFr ? 'opération(s)' : 'operation(s)'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-1">
                      <p className="text-sm font-bold text-[#1B3A5C] font-mono">{Math.round(g.totalCredits)} crédits</p>
                    </div>
                    {isOpen
                      ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                      : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {g.items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700">{typeLabel(item.type)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(item.createdAt).toLocaleDateString(
                                isFr ? 'fr-FR' : 'en-GB',
                                { day: '2-digit', month: 'short', year: 'numeric' }
                              )}
                            </p>
                          </div>
                          <p className="text-xs font-bold text-gray-800 font-mono flex-shrink-0">
                            {Math.round(item.creditsCost)} crédits
                          </p>
                        </div>
                      ))}
                      {/* Subtotal */}
                      <div className="flex justify-between px-4 py-2.5 bg-gray-50">
                        <p className="text-xs text-gray-500 font-medium">{isFr ? 'Total dossier' : 'File total'}</p>
                        <p className="text-xs font-bold text-[#1B3A5C] font-mono">{Math.round(g.totalCredits)} crédits</p>
                      </div>
                    </div>
                  )}

                  {/* Go to ticket */}
                  {g.ticketId && !isOpen && (
                    <div className="border-t border-gray-50">
                      <button
                        onClick={() => router.push(`/${locale}/mes-demandes/${g.ticketId}`)}
                        className="w-full text-center text-[10px] text-[#4A8FC4] font-medium py-2 active:bg-gray-50">
                        {isFr ? 'Voir le dossier →' : 'View ticket →'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  )
}
