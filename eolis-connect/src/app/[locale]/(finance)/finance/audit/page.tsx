'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { Shield, Loader2, CheckCircle, XCircle, Plus, Trash2, AlertCircle, ShieldAlert, ShieldCheck } from 'lucide-react'

const EUR = 655.957; const USD = 600
function f2(n: number | null) { return n != null ? n.toFixed(2) : '—' }
function toUsd(f: number) { return (f/USD).toFixed(2) }
function toEur(f: number) { return (f/EUR).toFixed(2) }

const ACTION_META: Record<string, { icon: React.ReactNode; color: string; label_fr: string; label_en: string }> = {
  CREDIT_APPROVE:  { icon: <CheckCircle size={14}/>, color: 'text-emerald-600 bg-emerald-50', label_fr: 'Recharge approuvée',    label_en: 'Credit approved'    },
  CREDIT_REJECT:   { icon: <XCircle size={14}/>,    color: 'text-red-500 bg-red-50',          label_fr: 'Recharge refusée',      label_en: 'Credit rejected'    },
  INFRA_COST_ADD:  { icon: <Plus size={14}/>,        color: 'text-amber-600 bg-amber-50',      label_fr: 'Charge ajoutée',        label_en: 'Cost added'         },
  INFRA_COST_DELETE:    { icon: <Trash2 size={14}/>,       color: 'text-gray-500 bg-gray-100',       label_fr: 'Charge supprimée',         label_en: 'Cost deleted'           },
  CREDIT_PENDING_ADMIN: { icon: <ShieldAlert size={14}/>,  color: 'text-orange-600 bg-orange-50',    label_fr: 'En attente admin',         label_en: 'Pending admin'          },
  CREDIT_ADMIN_CONFIRM: { icon: <ShieldCheck size={14}/>,  color: 'text-emerald-600 bg-emerald-50',  label_fr: 'Confirmé admin',           label_en: 'Admin confirmed'        },
  CREDIT_ADMIN_REJECT:  { icon: <ShieldAlert size={14}/>,  color: 'text-red-500 bg-red-50',          label_fr: 'Annulé admin',             label_en: 'Admin cancelled'        },
}

export default function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [logs, setLogs]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    setLoading(true)
    apiFetch('/api/finance/audit-log').then(r => r.json()).then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [locale])

  const isFr = locale === 'fr'

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-[#1B3A5C]" />
            {isFr ? 'Journal d\'audit financier' : 'Financial audit log'}
          </h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <AlertCircle size={12}/> {isFr ? 'Journal immuable — toutes les actions financières sont enregistrées' : 'Immutable log — all financial actions are recorded'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#1B3A5C]"/></div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Shield size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{isFr ? 'Aucune action enregistrée.' : 'No actions recorded yet.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-900">{logs.length} {isFr ? 'action(s) enregistrée(s)' : 'action(s) recorded'}</p>
              <span className="text-xs text-gray-400">{isFr ? '200 dernières' : 'last 200'}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {logs.map((l, i) => {
                const meta = ACTION_META[l.action]
                return (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    {meta && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5 ${meta.color}`}>
                        {meta.icon}
                        <span>{isFr ? meta.label_fr : meta.label_en}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{l.doneBy}</p>
                        {l.doneByUsername && <span className="text-[10px] text-[#4A8FC4] font-mono bg-blue-50 px-1.5 py-0.5 rounded">@{l.doneByUsername}</span>}
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{l.role}</span>
                        {l.ipAddress && <span className="text-[10px] text-gray-400 font-mono">IP: {l.ipAddress}</span>}
                      </div>
                      {l.clientName && (
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                          <span className="text-gray-400">{isFr ? 'Client :' : 'Client:'}</span>
                          <span className="font-semibold">{l.clientName}</span>
                          {l.clientUsername && <span className="font-mono text-[#4A8FC4]">@{l.clientUsername}</span>}
                        </p>
                      )}
                      {l.details && <p className="text-xs text-gray-500 mt-0.5 truncate">{l.details}</p>}
                      {l.entityId && <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {l.entityId}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {l.amountFcfa != null && (
                        <>
                          <p className="text-sm font-bold text-gray-800">{f2(l.amountFcfa)} FCFA</p>
                          <p className="text-[10px] text-gray-400 font-mono">${toUsd(l.amountFcfa)} · €{toEur(l.amountFcfa)}</p>
                        </>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(l.createdAt).toLocaleString(isFr ? 'fr-FR' : 'en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                    </div>
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
