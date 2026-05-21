'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import UsersTable from './UsersTable'
import { RefreshCw } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'

const REFRESH_INTERVAL = 30

export default function UtilisateursPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [unverifiedOnly, setUnverifiedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await apiFetch('/api/users').then(r => r.json())
      if (Array.isArray(data)) setAllUsers(data)
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    fetchUsers(false)

    intervalRef.current = setInterval(() => {
      fetchUsers(true)
      setCountdown(REFRESH_INTERVAL)
    }, REFRESH_INTERVAL * 1000)

    setCountdown(REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1))
    }, 1000)

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [locale, fetchUsers])

  const unverifiedCount = allUsers.filter(u => u.role === 'CLIENT' && !u.phoneVerified).length

  const filtered = allUsers
    .filter(u => !roleFilter || u.role === roleFilter)
    .filter(u => !unverifiedOnly || (u.role === 'CLIENT' && !u.phoneVerified))
    .filter(u => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        u.username?.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      )
    })

  const total = filtered.length
  const pagedUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isFr = locale === 'fr'
  const t = {
    title: isFr ? 'Gestion des utilisateurs' : 'User management',
    total: isFr ? 'utilisateur(s)' : 'user(s)',
    search: isFr ? 'Rechercher...' : 'Search...',
    refresh: isFr ? 'Actualiser' : 'Refresh',
  }

  if (loading || !user) return null

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{total} {t.total}</p>
        </div>

        {/* Countdown ring + refresh button */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center"
            title={`${isFr ? 'Actualisation dans' : 'Refresh in'} ${countdown}s`}>
            <svg width="32" height="32" className="-rotate-90">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#4A8FC4" strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - countdown / REFRESH_INTERVAL)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
            </svg>
            <span className="absolute text-[9px] font-bold text-gray-500 tabular-nums">{countdown}</span>
          </div>
          <button
            onClick={() => { fetchUsers(true); setCountdown(REFRESH_INTERVAL) }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {t.refresh}
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder={t.search}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
        <button
          onClick={() => { setUnverifiedOnly(v => !v); setPage(1) }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            unverifiedOnly
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-amber-400'
          }`}>
          📱 {isFr ? 'Tél. non vérifié' : 'Unverified phone'}
          {unverifiedCount > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${unverifiedOnly ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'}`}>
              {unverifiedCount}
            </span>
          )}
        </button>
      </div>

      <UsersTable
        users={pagedUsers}
        locale={locale}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        currentQ={search}
        currentRole={roleFilter}
        onRefresh={() => { fetchUsers(true); setCountdown(REFRESH_INTERVAL) }}
        onPageChange={setPage}
      />
    </DashboardLayout>
  )
}
