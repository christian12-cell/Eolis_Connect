'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, apiUrl, getToken, getUser } from '@/lib/api-client'
import {
  Zap, Check, X, Clock, CheckCircle, XCircle, Loader2,
  ChevronDown, Users, FileText, ExternalLink, RefreshCw,
} from 'lucide-react'

// ── ProofViewer: fetch avec auth, affiche image ou PDF ─────────────────────────

function ProofViewer({ requestId, filename, isFr }: { requestId: string; filename?: string; isFr?: boolean }) {
  const [blobUrl, setBlobUrl]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [isPdf, setIsPdf]       = useState(false)
  const blobRef = useRef<string | null>(null)

  useEffect(() => {
    const token = getToken()
    fetch(apiUrl(`/api/credits/photo/${requestId}`), {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('not_found')
        const ct = r.headers.get('content-type') || ''
        setIsPdf(ct.includes('pdf'))
        return r.blob()
      })
      .then(b => {
        const url = URL.createObjectURL(b)
        blobRef.current = url
        setBlobUrl(url)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }
  }, [requestId])

  if (loading) return (
    <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl">
      <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
  )

  if (error || !blobUrl) return (
    <div className="flex items-center justify-center h-16 bg-gray-50 rounded-xl text-xs text-gray-400">
      {isFr ? 'Fichier introuvable' : 'File not found'}
    </div>
  )

  if (isPdf) return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
        <FileText size={13} className="text-red-400" />
        <span className="truncate">{filename || 'justificatif.pdf'}</span>
      </div>
      <iframe
        src={blobUrl}
        className="w-full rounded-xl border border-gray-100"
        style={{ height: '420px' }}
        title="Justificatif PDF"
      />
    </div>
  )

  return (
    <div className="relative">
      <img src={blobUrl} alt="justificatif"
        className="w-full max-h-64 object-contain rounded-xl border border-gray-100 bg-gray-50" />
      <a href={blobUrl} target="_blank" rel="noreferrer"
        className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
        <ExternalLink size={11} /> {isFr ? 'Agrandir' : 'Expand'}
      </a>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AdminCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]       = useState('fr')
  const [user, setUser]           = useState<any>(null)
  const [tab, setTab]             = useState<'requests' | 'balances'>('requests')
  const [requests, setRequests]   = useState<any[]>([])
  const [balances, setBalances]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'pending' | 'approved' | 'rejected' | ''>('pending')
  const [validating, setValidating] = useState<string | null>(null)
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({})
  const [proofOpen, setProofOpen]         = useState<string | null>(null)
  const [searchBalance, setSearchBalance] = useState('')
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [clientUsage, setClientUsage]     = useState<Record<string, any[]>>({})
  const [rejectingId, setRejectingId]     = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [refreshing, setRefreshing]       = useState(false)
  const [countdown, setCountdown]         = useState(30)
  const autoRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN' && u.role !== 'OPS_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const loadRequests = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const qs = filter ? `?status=${filter}` : ''
    apiFetch(`/api/credits/admin/requests${qs}`)
      .then(r => r.json())
      .then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false); setRefreshing(false) })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }, [filter])

  const loadBalances = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    apiFetch('/api/credits/admin/balances')
      .then(r => r.json())
      .then(d => { setBalances(Array.isArray(d) ? d : []); setLoading(false); setRefreshing(false) })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }, [])

  useEffect(() => {
    if (!user) return
    tab === 'requests' ? loadRequests() : loadBalances()
  }, [user, tab, loadRequests, loadBalances])

  // Auto-refresh 30s avec countdown ring (comme agent dashboard)
  useEffect(() => {
    if (!user || tab !== 'requests') return
    setCountdown(30)
    if (autoRef.current)  clearInterval(autoRef.current)
    if (countRef.current) clearInterval(countRef.current)
    autoRef.current = setInterval(() => { loadRequests(true); setCountdown(30) }, 30_000)
    countRef.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1_000)
    return () => {
      if (autoRef.current)  clearInterval(autoRef.current)
      if (countRef.current) clearInterval(countRef.current)
    }
  }, [user, tab, loadRequests])

  const isFr = locale === 'fr'
  const pendingCount = requests.filter(r => r.status === 'pending').length

  async function approve(id: string) {
    const amt = parseFloat(amountInputs[id] || '')
    if (!amt || amt < 500) return alert(isFr ? 'Montant minimum 500 FCFA' : 'Minimum 500 FCFA')
    setValidating(id)
    const fd = new FormData()
    fd.append('amount_received', String(amt))
    await apiFetch(`/api/credits/admin/requests/${id}/approve`, { method: 'POST', body: fd })
    setValidating(null)
    loadRequests(true)
  }

  async function loadClientUsage(cid: string) {
    if (clientUsage[cid]) { setExpandedClient(expandedClient === cid ? null : cid); return }
    const res = await apiFetch(`/api/ai-usage/admin?client_id=${cid}`)
    const d   = await res.json()
    setClientUsage(prev => ({ ...prev, [cid]: d.items ?? [] }))
    setExpandedClient(cid)
  }

  async function confirmReject(id: string) {
    const reason = rejectReasons[id] ?? ''
    setValidating(id)
    const fd = new FormData()
    fd.append('reason', reason)
    await apiFetch(`/api/credits/admin/requests/${id}/reject`, { method: 'POST', body: fd })
    setValidating(null)
    setRejectingId(null)
    loadRequests(true)
  }

  if (!user) return null

  const filteredBalances = balances.filter(b =>
    !searchBalance || b.clientName?.toLowerCase().includes(searchBalance.toLowerCase()) || b.username?.toLowerCase().includes(searchBalance.toLowerCase())
  )

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap size={22} className="text-amber-500" />
              {isFr ? 'Crédits Premium' : 'Premium Credits'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isFr ? 'Recharges et soldes des clients' : 'Top-ups and client balances'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-bold rounded-full animate-pulse">
                {pendingCount} {isFr ? 'en attente' : 'pending'}
              </span>
            )}
            {/* Countdown ring — visible uniquement sur l'onglet demandes */}
            {tab === 'requests' && (
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
            )}
            <button
              onClick={() => {
                setCountdown(30)
                tab === 'requests' ? loadRequests(true) : loadBalances(true)
              }}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {isFr ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === 'requests' ? 'bg-[#1B3A5C] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Clock size={15} />
            {isFr ? 'Demandes de recharge' : 'Top-up requests'}
            {pendingCount > 0 && (
              <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button onClick={() => setTab('balances')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === 'balances' ? 'bg-[#1B3A5C] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Users size={15} />
            {isFr ? 'Soldes clients' : 'Client balances'}
          </button>
        </div>

        {/* ── ONGLET DEMANDES ─────────────────────────────────────────── */}
        {tab === 'requests' && (
          <>
            <div className="flex gap-2 flex-wrap">
              {([
                { v: 'pending',  label: isFr ? 'En attente' : 'Pending' },
                { v: 'approved', label: isFr ? 'Approuvées' : 'Approved' },
                { v: 'rejected', label: isFr ? 'Refusées' : 'Rejected' },
                { v: '',         label: isFr ? 'Toutes' : 'All' },
              ] as { v: typeof filter; label: string }[]).map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    filter === f.v ? 'bg-[#1B3A5C] text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                <Zap size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{isFr ? 'Aucune demande.' : 'No requests.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r: any) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{r.clientName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">{r.amountDeclared} FCFA</p>
                        <p className="text-xs text-gray-400">{isFr ? 'déclaré' : 'declared'}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {r.status === 'pending'  && <Clock size={18} className="text-amber-500" />}
                        {r.status === 'approved' && <CheckCircle size={18} className="text-emerald-500" />}
                        {r.status === 'rejected' && <XCircle size={18} className="text-red-500" />}
                      </div>
                    </div>

                    {/* Justificatif */}
                    <div className="px-5 pb-3">
                      <button onClick={() => setProofOpen(proofOpen === r.id ? null : r.id)}
                        className="flex items-center gap-1.5 text-xs text-[#4A8FC4] font-medium mb-2">
                        {proofOpen === r.id ? '▲' : '▼'} {isFr ? 'Justificatif' : 'Proof'}
                        {r.status === 'pending' && proofOpen !== r.id && (
                          <span className="ml-1 text-[10px] text-amber-500 font-semibold">
                            {isFr ? '← ouvrir avant de valider' : '← open before approving'}
                          </span>
                        )}
                      </button>
                      {proofOpen === r.id && (
                        <ProofViewer requestId={r.id} filename={r.photoUrl?.split('/').pop()} isFr={isFr} />
                      )}
                    </div>

                    {/* Actions pending */}
                    {r.status === 'pending' && (
                      <div className="border-t border-gray-100 px-5 py-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            placeholder={isFr ? 'Montant reçu (FCFA)' : 'Amount received (FCFA)'}
                            defaultValue={r.amountDeclared}
                            onChange={e => setAmountInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1B3A5C]"
                          />
                          <button
                            onClick={() => approve(r.id)}
                            disabled={validating === r.id || proofOpen !== r.id}
                            title={proofOpen !== r.id ? (isFr ? 'Ouvrez d\'abord le justificatif' : 'Open proof first') : undefined}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                            {validating === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {isFr ? 'Valider' : 'Approve'}
                          </button>
                          <button
                            onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
                            disabled={validating === r.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-semibold disabled:opacity-50">
                            <X size={14} /> {isFr ? 'Refuser' : 'Reject'}
                          </button>
                        </div>
                        {rejectingId === r.id && (
                          <div className="flex gap-2 pt-1">
                            <textarea
                              rows={2}
                              placeholder={isFr ? 'Motif du refus (optionnel)...' : 'Rejection reason (optional)...'}
                              value={rejectReasons[r.id] ?? ''}
                              onChange={e => setRejectReasons(prev => ({ ...prev, [r.id]: e.target.value }))}
                              className="flex-1 px-3 py-2 rounded-xl border border-red-200 text-sm focus:outline-none focus:border-red-400 resize-none"
                            />
                            <div className="flex flex-col gap-1.5">
                              <button onClick={() => confirmReject(r.id)} disabled={validating === r.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-semibold disabled:opacity-50">
                                {validating === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                {isFr ? 'Confirmer' : 'Confirm'}
                              </button>
                              <button onClick={() => setRejectingId(null)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 text-xs font-semibold">
                                <X size={12} /> {isFr ? 'Annuler' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {r.status === 'approved' && (
                      <div className="border-t border-gray-100 px-5 py-3 bg-emerald-50">
                        <p className="text-xs text-emerald-700 font-semibold">
                          ✓ {r.creditsAdded} {isFr ? 'crédits ajoutés' : 'credits added'} · {r.amountValidated} FCFA {isFr ? 'validés' : 'validated'}
                        </p>
                      </div>
                    )}
                    {r.status === 'rejected' && (
                      <div className="border-t border-gray-100 px-5 py-3 bg-red-50">
                        <p className="text-xs text-red-600">{r.rejectionReason || (isFr ? 'Refusé' : 'Rejected')}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ONGLET SOLDES ───────────────────────────────────────────── */}
        {tab === 'balances' && (
          <>
            <input
              type="text" placeholder={isFr ? 'Rechercher un client...' : 'Search client...'}
              value={searchBalance} onChange={e => setSearchBalance(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1B3A5C]"
            />

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wide">
                  <span className="col-span-2">{isFr ? 'Client' : 'Client'}</span>
                  <span className="text-right">{isFr ? 'Achetés' : 'Purchased'}</span>
                  <span className="text-right">{isFr ? 'Restants' : 'Remaining'}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredBalances.map((b: any) => (
                    <div key={b.clientId}>
                      {/* Client row */}
                      <button
                        onClick={() => loadClientUsage(b.clientId)}
                        className="w-full grid grid-cols-4 gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors text-left">
                        <div className="col-span-2 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{b.clientName}</p>
                          <p className="text-xs text-gray-400">@{b.username}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-700 font-mono">{b.creditsTotal}</p>
                          <p className="text-[10px] text-gray-400">{isFr ? 'utilisés' : 'used'}: {b.creditsUsed}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold font-mono ${
                            b.creditsRemaining <= 0 ? 'text-red-500' :
                            b.creditsRemaining <= 50 ? 'text-amber-500' : 'text-emerald-600'
                          }`}>
                            {b.creditsRemaining}
                          </p>
                          <p className="text-[10px] text-gray-400">crédits</p>
                        </div>
                      </button>

                      {/* Expanded: usage detail in credits */}
                      {expandedClient === b.clientId && (
                        <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 space-y-1.5">
                          {!clientUsage[b.clientId] ? (
                            <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                          ) : clientUsage[b.clientId].length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">{isFr ? 'Aucune opération' : 'No operations'}</p>
                          ) : (
                            <>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                                {isFr ? 'Opérations (crédits consommés)' : 'Operations (credits consumed)'}
                              </p>
                              {clientUsage[b.clientId].map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 py-1">
                                  <span className="text-sm flex-shrink-0">
                                    {item.type === 'bl_extraction' ? '📄' : '🎙️'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-700">
                                      {item.ticketRef ?? (isFr ? 'Sans dossier' : 'No ticket')}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      {new Date(item.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                  </div>
                                  <p className="text-xs font-bold text-gray-800 font-mono flex-shrink-0">
                                    {item.creditsCost} crédits
                                  </p>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredBalances.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-400">
                      {isFr ? 'Aucun résultat.' : 'No results.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
