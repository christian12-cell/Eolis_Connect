'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { BookOpen, Clock, Wrench } from 'lucide-react'
import { getUser } from '@/lib/api-client'

export default function AideStaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) {
      router.replace(`/${locale}/accueil`); return
    }
    setUser(u)
  }, [locale])

  const isFr = locale === 'fr'

  if (!user) return null

  const roleLabel = {
    AGENT:        isFr ? 'Agent'             : 'Agent',
    OPS_ADMIN:    isFr ? 'Admin Opérations'  : 'Operations Admin',
    SYSTEM_ADMIN: isFr ? 'Administrateur'    : 'Administrator',
  }[user.role] ?? user.role

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="max-w-lg mx-auto py-12 px-4 text-center">

        {/* Icône */}
        <div className="w-20 h-20 rounded-2xl bg-[#1B3A5C]/10 flex items-center justify-center mx-auto mb-6">
          <BookOpen size={36} className="text-[#1B3A5C]" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isFr ? 'Guide d\'utilisation' : 'User Guide'}
        </h1>

        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
          <Wrench size={14} className="text-amber-600" />
          <span className="text-amber-700 text-sm font-semibold">
            {isFr ? 'En cours de préparation' : 'Under preparation'}
          </span>
        </div>

        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          {isFr
            ? `Le manuel complet pour le rôle ${roleLabel} sera disponible très bientôt. Il détaillera toutes les fonctionnalités du tableau de bord, comment traiter les dossiers, interpréter les statistiques et gérer l'équipe.`
            : `The complete manual for the ${roleLabel} role will be available very soon. It will detail all dashboard features, how to handle tickets, interpret statistics and manage the team.`}
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex items-start gap-3 text-left">
          <Clock size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-gray-500 text-sm">
            {isFr
              ? 'En attendant, contactez l\'administrateur système si vous avez des questions sur le fonctionnement de la plateforme.'
              : 'In the meantime, contact the system administrator if you have questions about how the platform works.'}
          </p>
        </div>

      </div>
    </DashboardLayout>
  )
}
