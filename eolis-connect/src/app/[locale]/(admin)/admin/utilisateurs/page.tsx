'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import UsersTable from './UsersTable'
import { getUser, apiFetch } from '@/lib/api-client'

export default function UtilisateursPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [unverifiedOnly, setUnverifiedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  function fetchUsers() {
    apiFetch('/api/users').then(r => r.json()).then(data => {
      setAllUsers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    fetchUsers()
  }, [locale])

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
  }

  if (loading || !user) return null

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{total} {t.total}</p>
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
        onRefresh={fetchUsers}
        onPageChange={setPage}
      />
    </DashboardLayout>
  )
}
