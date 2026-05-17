'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ScrollText, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-600',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-red-100 text-red-600',
  SUSPEND: 'bg-amber-100 text-amber-700',
  LOGIN: 'bg-gray-100 text-gray-600',
  TAKE: 'bg-blue-100 text-blue-700',
  CLOSE: 'bg-emerald-100 text-emerald-700',
  REGISTER: 'bg-purple-100 text-purple-700',
  RATING: 'bg-amber-100 text-amber-700',
}

function getActionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().includes(k))
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600'
}

export default function LogsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [countdown, setCountdown] = useState(30)
  const PAGE_SIZE = 20
  const autoRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pageRef   = useRef(1)
  const actionRef = useRef('')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { actionRef.current = actionFilter }, [actionFilter])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    fetchLogs(1, '')
  }, [locale])

  async function fetchLogs(p: number, action: string, silent = false) {
    if (!silent) setLoading(true)
    const qs = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
    if (action) qs.set('action', action)
    const data = await apiFetch(`/api/admin/logs?${qs.toString()}`).then(r => r.json())
    setLogs(data.items ?? [])
    setTotal(data.total ?? 0)
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    setCountdown(30)
    if (autoRef.current)  clearInterval(autoRef.current)
    if (countRef.current) clearInterval(countRef.current)
    autoRef.current  = setInterval(() => { fetchLogs(pageRef.current, actionRef.current, true); setCountdown(30) }, 30_000)
    countRef.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1_000)
    return () => {
      if (autoRef.current)  clearInterval(autoRef.current)
      if (countRef.current) clearInterval(countRef.current)
    }
  }, [user])

  function search(action: string) {
    setActionFilter(action)
    setPage(1)
    fetchLogs(1, action)
  }

  function goPage(p: number) {
    setPage(p)
    fetchLogs(p, actionFilter)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isFr = locale === 'fr'
  const t = {
    title: isFr ? 'Journaux système' : 'System logs',
    total: isFr ? 'entrée(s)' : 'entry(ies)',
    search: isFr ? 'Filtrer par action...' : 'Filter by action...',
    action: isFr ? 'Action' : 'Action',
    entity: isFr ? 'Entité' : 'Entity',
    user: isFr ? 'Utilisateur' : 'User',
    date: isFr ? 'Date' : 'Date',
    noLogs: isFr ? 'Aucun journal trouvé' : 'No logs found',
    system: isFr ? 'Système' : 'System',
  }

  if (!user) return null

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText size={22} className="text-[#1B3A5C]" />
            {t.title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{total} {t.total}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center"
            title={`${isFr ? 'Actualisation dans' : 'Refresh in'} ${countdown}s`}>
            <svg width="32" height="32" className="-rotate-90">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#4A8FC4" strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - countdown / 30)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
            </svg>
            <span className="absolute text-[9px] font-bold text-gray-500 tabular-nums">{countdown}</span>
          </div>
          <button onClick={() => { fetchLogs(pageRef.current, actionRef.current, true); setCountdown(30) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
            <RefreshCw size={13} /> {isFr ? 'Actualiser' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        <input value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(actionFilter)}
          placeholder={t.search}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
        <button onClick={() => search(actionFilter)}
          className="px-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#152d47] transition-colors">
          {isFr ? 'Filtrer' : 'Filter'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-[#1B3A5C] border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <ScrollText size={28} className="text-gray-300 mb-3" />
            <p className="text-gray-400">{t.noLogs}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="px-5 py-3 text-left">{t.action}</th>
                  <th className="px-3 py-3 text-left">{t.entity}</th>
                  <th className="px-3 py-3 text-left">{t.user}</th>
                  <th className="px-3 py-3 text-right">{t.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      <p className="text-xs font-medium">{log.entity}</p>
                      {log.entityId && <p className="text-[10px] text-gray-400 font-mono">{log.entityId.slice(0, 8)}...</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-700 text-xs">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : t.system}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString(isFr ? 'fr-CM' : 'en-GB', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <button onClick={() => goPage(page - 1)} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => (
            <button key={i} onClick={() => goPage(i + 1)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium ${page === i + 1 ? 'bg-[#1B3A5C] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {i + 1}
            </button>
          ))}
          {page < totalPages && (
            <button onClick={() => goPage(page + 1)} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
