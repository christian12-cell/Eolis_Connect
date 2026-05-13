'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser, checkSessionAndRedirect } from '@/lib/api-client'
import { Wifi, WifiOff, Clock, LogIn, RefreshCw, Shield } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  SYSTEM_ADMIN: 'bg-red-100 text-red-700',
  OPS_ADMIN:    'bg-purple-100 text-purple-700',
  AGENT:        'bg-blue-100 text-blue-700',
  CLIENT:       'bg-gray-100 text-gray-600',
}

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'Sys Admin',
  OPS_ADMIN:    'Ops Admin',
  AGENT:        'Agent',
  CLIENT:       'Client',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function timeAgo(isoStr: string): string {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000
  if (diff < 60) return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  return `Il y a ${Math.floor(diff / 86400)}j`
}

export default function SessionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u || u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/login`); return }
    if (checkSessionAndRedirect(locale)) return
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [locale])

  async function load() {
    try {
      const res = await apiFetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
        setLastRefresh(new Date())
      }
    } catch {}
    setLoading(false)
  }

  const isFr = locale === 'fr'

  const online  = sessions.filter(s => s.isOnline)
  const active  = sessions.filter(s => s.isActive)
  const offline = sessions.filter(s => !s.isOnline && !s.isActive)

  return (
    <DashboardLayout locale={locale} role="SYSTEM_ADMIN">
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield size={20} className="text-[#1B3A5C]" />
              {isFr ? 'Sessions actives' : 'Active sessions'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isFr ? 'Surveillance en temps réel des connexions' : 'Real-time connection monitoring'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <p className="text-xs text-gray-400">
                {isFr ? 'Mis à jour' : 'Updated'} {timeAgo(lastRefresh.toISOString())}
              </p>
            )}
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B3A5C] text-white text-xs font-semibold hover:bg-[#152d47] transition-colors">
              <RefreshCw size={13} /> {isFr ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: isFr ? 'En ligne' : 'Online', count: online.length, color: 'emerald', icon: <Wifi size={18} /> },
            { label: isFr ? 'Récemment actifs' : 'Recently active', count: active.length, color: 'amber', icon: <Clock size={18} /> },
            { label: isFr ? 'Hors ligne' : 'Offline', count: offline.length, color: 'gray', icon: <WifiOff size={18} /> },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                s.color === 'amber'   ? 'bg-amber-100 text-amber-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {s.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sessions list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
            <p className="text-sm">{isFr ? 'Chargement...' : 'Loading...'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">{isFr ? 'Tous les utilisateurs actifs' : 'All active users'}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#1B3A5C] flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {s.firstName?.[0] ?? '?'}{s.lastName?.[0] ?? ''}
                      </span>
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      s.isOnline ? 'bg-emerald-500' : s.isActive ? 'bg-amber-400' : 'bg-gray-300'
                    }`} />
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">{s.firstName} {s.lastName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">@{s.username}</p>
                  </div>

                  {/* Status */}
                  <div className="text-center hidden sm:block min-w-[90px]">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      s.isOnline ? 'bg-emerald-100 text-emerald-700' :
                      s.isActive ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {s.isOnline
                        ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {isFr ? 'En ligne' : 'Online'}</>
                        : s.isActive
                        ? <><Clock size={10} /> {isFr ? 'Actif' : 'Active'}</>
                        : <>{isFr ? 'Hors ligne' : 'Offline'}</>
                      }
                    </span>
                  </div>

                  {/* Last active */}
                  <div className="text-right hidden md:block min-w-[110px]">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                      {isFr ? 'Vu' : 'Last seen'}
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {s.lastActiveAt ? timeAgo(s.lastActiveAt) : '—'}
                    </p>
                  </div>

                  {/* Last login */}
                  <div className="text-right hidden lg:block min-w-[110px]">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                      <LogIn size={9} className="inline mr-0.5" />{isFr ? 'Connexion' : 'Login'}
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {s.lastLoginAt ? timeAgo(s.lastLoginAt) : '—'}
                    </p>
                  </div>

                  {/* Token expiry */}
                  <div className="text-right min-w-[100px]">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                      {isFr ? 'Expire dans' : 'Expires in'}
                    </p>
                    {s.tokenExpired ? (
                      <span className="text-xs font-bold text-red-500">{isFr ? 'Expiré' : 'Expired'}</span>
                    ) : s.timeRemainingSeconds != null ? (
                      <p className={`text-xs font-bold ${
                        s.timeRemainingSeconds < 1800 ? 'text-red-500' :
                        s.timeRemainingSeconds < 3600 ? 'text-amber-600' : 'text-gray-700'
                      }`}>
                        {formatDuration(s.timeRemainingSeconds)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">
                  {isFr ? 'Aucune session trouvée' : 'No sessions found'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
