'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, apiUrl, getToken, getUser } from '@/lib/api-client'
import { Zap, Check, X, Clock, CheckCircle, XCircle, Loader2, ChevronDown } from 'lucide-react'

export default function AdminCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading]  = useState(true)
  const [filter, setFilter]    = useState<'pending' | 'approved' | 'rejected' | ''>('pending')
  const [validating, setValidating] = useState<string | null>(null)
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({})
  const [photoOpen, setPhotoOpen] = useState<string | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN' && u.role !== 'OPS_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback(() => {
    setLoading(true)
    const qs = filter ? `?status=${filter}` : ''
    apiFetch(`/api/credits/admin/requests${qs}`)
      .then(r => r.json())
      .then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filter])

  useEffect(() => { if (user) load() }, [user, load])

  const isFr = locale === 'fr'

  async function approve(id: string) {
    const amt = parseFloat(amountInputs[id] || '')
    if (!amt || amt < 500) return alert(isFr ? 'Montant minimum 500 FCFA' : 'Minimum 500 FCFA')
    setValidating(id)
    const fd = new FormData()
    fd.append('amount_received', String(amt))
    await apiFetch(`/api/credits/admin/requests/${id}/approve`, { method: 'POST', body: fd })
    setValidating(null)
    load()
  }

  async function reject(id: string) {
    const reason = prompt(isFr ? 'Motif de refus (optionnel) :' : 'Rejection reason (optional):') ?? ''
    setValidating(id)
    const fd = new FormData()
    fd.append('reason', reason)
    await apiFetch(`/api/credits/admin/requests/${id}/reject`, { method: 'POST', body: fd })
    setValidating(null)
    load()
  }

  if (!user) return null

  const pendingCount = requests.filter(r => r.status === 'pending').length

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
              {isFr ? 'Validation des demandes de recharge' : 'Top-up request validation'}
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-bold rounded-full">
              {pendingCount} {isFr ? 'en attente' : 'pending'}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            { v: 'pending',  label: isFr ? 'En attente' : 'Pending' },
            { v: 'approved', label: isFr ? 'Approuvées' : 'Approved' },
            { v: 'rejected', label: isFr ? 'Refusées' : 'Rejected' },
            { v: '',         label: isFr ? 'Toutes' : 'All' },
          ] as { v: typeof filter; label: string }[]).map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filter === f.v ? 'bg-[#1B3A5C] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
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
                {/* Header row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{r.clientName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

                {/* Photo */}
                <div className="px-5 pb-3">
                  <button onClick={() => setPhotoOpen(photoOpen === r.id ? null : r.id)}
                    className="flex items-center gap-1.5 text-xs text-[#4A8FC4] font-medium">
                    {isFr ? 'Voir la capture' : 'View proof'}
                    <ChevronDown size={12} className={`transition-transform ${photoOpen === r.id ? 'rotate-180' : ''}`} />
                  </button>
                  {photoOpen === r.id && (
                    <img
                      src={r.photoUrl?.startsWith('s3://')
                        ? apiUrl(`/api/credits/photo/${r.id}`)
                        : apiUrl(`/static/${r.photoUrl}`)}
                      alt="proof"
                      className="mt-2 w-full max-h-64 object-contain rounded-xl border border-gray-100"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </div>

                {/* Actions for pending */}
                {r.status === 'pending' && (
                  <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-3">
                    <input
                      type="number"
                      placeholder={isFr ? 'Montant reçu (FCFA)' : 'Amount received (FCFA)'}
                      value={amountInputs[r.id] ?? r.amountDeclared}
                      onChange={e => setAmountInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1B3A5C]"
                    />
                    <button onClick={() => approve(r.id)} disabled={validating === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
                      <Check size={14} />
                      {isFr ? 'Valider' : 'Approve'}
                    </button>
                    <button onClick={() => reject(r.id)} disabled={validating === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-semibold disabled:opacity-50">
                      <X size={14} />
                      {isFr ? 'Refuser' : 'Reject'}
                    </button>
                  </div>
                )}

                {/* Result info for approved/rejected */}
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
      </div>
    </DashboardLayout>
  )
}
