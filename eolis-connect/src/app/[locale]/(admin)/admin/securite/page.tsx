'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { ShieldAlert, Loader2, Lock, Clock, RefreshCw, CheckCircle, AlertCircle, Unlock } from 'lucide-react'

const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  CLIENT:        { fr: 'Client',          en: 'Client'        },
  AGENT:         { fr: 'Agent',           en: 'Agent'         },
  OPS_ADMIN:     { fr: 'Admin Ops',       en: 'Ops Admin'     },
  FINANCE_AGENT: { fr: 'Agent Financier', en: 'Finance Agent' },
  SYSTEM_ADMIN:  { fr: 'Admin Sys.',      en: 'Sys Admin'     },
}

export default function SecuritePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]   = useState('fr')
  const [user, setUser]       = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [msg, setMsg]         = useState<{ id: string; ok: boolean } | null>(null)
  const [countdown, setCountdown] = useState(30)
  const autoRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    apiFetch('/api/users/admin/security')
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  useEffect(() => {
    if (!user) return
    setCountdown(30)
    if (autoRef.current)  clearInterval(autoRef.current)
    if (countRef.current) clearInterval(countRef.current)
    autoRef.current  = setInterval(() => { fetchData(true); setCountdown(30) }, 30_000)
    countRef.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1_000)
    return () => {
      if (autoRef.current)  clearInterval(autoRef.current)
      if (countRef.current) clearInterval(countRef.current)
    }
  }, [user, fetchData])

  const isFr = locale === 'fr'

  async function unlock(userId: string) {
    setUnlocking(userId)
    setMsg(null)
    try {
      const r = await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (r.ok) {
        setMsg({ id: userId, ok: true })
        fetchData()
      } else {
        setMsg({ id: userId, ok: false })
      }
    } catch {
      setMsg({ id: userId, ok: false })
    }
    setUnlocking(null)
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-5 max-w-4xl">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert size={22} className="text-[#1B3A5C]" />
              {isFr ? 'Sécurité — Comptes bloqués' : 'Security — Blocked accounts'}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {isFr ? 'Comptes avec tentatives échouées, verrouillages temporaires ou blocages définitifs' : 'Accounts with failed attempts, temp locks or permanent blocks'}
            </p>
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
            <button onClick={() => { fetchData(true); setCountdown(30) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
              <RefreshCw size={13} /> {isFr ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#1B3A5C]" /></div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <CheckCircle size={32} className="text-emerald-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucun compte avec tentatives suspectes.' : 'No accounts with suspicious activity.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="font-bold text-gray-900 text-sm">{entries.length} {isFr ? 'compte(s)' : 'account(s)'}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {entries.map(e => {
                const isLocked    = e.status === 'LOCKED'
                const isTempLock  = e.isTempLocked
                const needsAction = isLocked || isTempLock

                return (
                  <div key={e.id} className={`flex items-center gap-4 px-5 py-4 ${needsAction ? 'bg-red-50/30' : 'hover:bg-gray-50'} transition-colors`}>
                    {/* Status icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isLocked ? 'bg-red-100' : isTempLock ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      {isLocked   ? <Lock size={16} className="text-red-600" />
                      : isTempLock ? <Clock size={16} className="text-amber-600" />
                      : <AlertCircle size={16} className="text-gray-400" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{e.firstName} {e.lastName}</p>
                        <span className="text-[10px] text-[#4A8FC4] font-mono bg-blue-50 px-1.5 py-0.5 rounded">@{e.username}</span>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {ROLE_LABELS[e.role]?.[isFr ? 'fr' : 'en'] ?? e.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {e.loginFailedCount > 0 && (
                          <span className="text-xs text-orange-600">{e.loginFailedCount} {isFr ? 'tentative(s) échouée(s)' : 'failed attempt(s)'}</span>
                        )}
                        {isTempLock && (
                          <span className="text-xs text-amber-600">
                            {isFr ? 'Verrouillé jusqu\'à ' : 'Locked until '}
                            {new Date(e.loginLockedUntil).toLocaleTimeString(isFr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-xs font-semibold text-red-600">{isFr ? 'Bloqué définitivement' : 'Permanently blocked'}</span>
                        )}
                        {e.loginLastIp && (
                          <span className="text-[10px] text-gray-400 font-mono">IP: {e.loginLastIp}</span>
                        )}
                      </div>
                      {msg?.id === e.id && (
                        <p className={`text-xs mt-1 font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                          {msg.ok ? (isFr ? 'Compte débloqué !' : 'Account unlocked!') : (isFr ? 'Erreur.' : 'Error.')}
                        </p>
                      )}
                    </div>

                    {/* Unlock button */}
                    {(isLocked || isTempLock) && (
                      <button
                        onClick={() => unlock(e.id)}
                        disabled={unlocking === e.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {unlocking === e.id ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                        {isFr ? 'Débloquer' : 'Unlock'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
