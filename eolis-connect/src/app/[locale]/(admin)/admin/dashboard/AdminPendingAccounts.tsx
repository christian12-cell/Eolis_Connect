'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface PendingUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  createdAt: Date
}

interface Props {
  users: PendingUser[]
  locale: string
  onRefresh?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  AGENT: 'Agent',
  OPS_ADMIN: 'Admin Ops',
  SYSTEM_ADMIN: 'Admin Sys.',
}

export default function AdminPendingAccounts({ users: initialUsers, locale, onRefresh }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)

  const isFr = locale === 'fr'
  const t = {
    approve: isFr ? 'Approuver' : 'Approve',
    reject: isFr ? 'Refuser' : 'Reject',
  }

  async function handleAction(userId: string, action: 'approve' | 'reject') {
    setLoading(userId + action)
    const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED'
    await apiFetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    })
    setUsers(prev => prev.filter(u => u.id !== userId))
    setLoading(null)
    onRefresh?.()
  }

  return (
    <>
      {users.map(u => (
        <div key={u.id} className="bg-white rounded-xl border border-gray-100 card-shadow p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B3A5C] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {u.firstName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1B3A5C]/10 text-[#1B3A5C] font-medium">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleAction(u.id, 'approve')}
                disabled={!!loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {loading === u.id + 'approve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {t.approve}
              </button>
              <button
                onClick={() => handleAction(u.id, 'reject')}
                disabled={!!loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {loading === u.id + 'reject' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                {t.reject}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            {new Date(u.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CM' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      ))}
    </>
  )
}
