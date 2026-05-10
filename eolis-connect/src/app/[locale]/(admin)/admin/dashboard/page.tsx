'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/ui/card'
import { Users, Shield, UserCheck, UserCog, Headphones } from 'lucide-react'
import { getUser, apiFetch } from '@/lib/api-client'

export default function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  function fetchData() {
    Promise.all([
      apiFetch('/api/users').then(r => r.json()),
      apiFetch('/api/admin/logs?page_size=15').then(r => r.json()),
    ]).then(([usrs, logsData]) => {
      setUsers(Array.isArray(usrs) ? usrs : [])
      setLogs(logsData.items ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    fetchData()
  }, [locale])

  if (loading || !user) return null

  const isFr = locale === 'fr'
  const activeUsers    = users.filter(u => u.status === 'ACTIVE')
  const suspendedUsers = users.filter(u => u.status === 'SUSPENDED')
  const clients        = users.filter(u => u.role === 'CLIENT')
  const agents         = users.filter(u => u.role === 'AGENT')
  const opsAdmins      = users.filter(u => u.role === 'OPS_ADMIN')

  const t = {
    title:      isFr ? 'Administration Système' : 'System Administration',
    total:      isFr ? 'Utilisateurs actifs' : 'Active users',
    suspended:  isFr ? 'Comptes suspendus' : 'Suspended accounts',
    clients:    'Clients',
    agents:     isFr ? 'Agents' : 'Agents',
    ops:        isFr ? 'Admins Ops' : 'Ops Admins',
    recentLogs: isFr ? 'Journaux récents' : 'Recent logs',
    noLogs:     isFr ? 'Aucun journal' : 'No logs',
  }

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title={t.total}     value={activeUsers.length}    icon={<Users size={20} />}     color="navy"    />
        <StatCard title={t.clients}   value={clients.length}        icon={<UserCheck size={20} />} color="blue"    />
        <StatCard title={t.agents}    value={agents.length}         icon={<Headphones size={20} />}color="success" />
        <StatCard title={t.ops}       value={opsAdmins.length}      icon={<UserCog size={20} />}   color="warning" />
        <StatCard title={t.suspended} value={suspendedUsers.length} icon={<Shield size={20} />}    color="warning" />
      </div>

      {/* Logs — full width */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.recentLogs}</h2>
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-400 text-sm">{t.noLogs}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log: any) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1B3A5C]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield size={14} className="text-[#1B3A5C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                      {log.entity ? ` · ${log.entity}` : ''}
                      {log.details ? ` · ${log.details}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(log.createdAt).toLocaleDateString(isFr ? 'fr-CM' : 'en-GB', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
