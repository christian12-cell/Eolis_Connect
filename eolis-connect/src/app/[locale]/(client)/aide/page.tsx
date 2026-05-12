'use client'

import { useEffect, useState } from 'react'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { BookOpen, Clock, Wrench } from 'lucide-react'
import { getUser } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export default function AideClientPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    setUser(u)
  }, [locale])

  const isFr = locale === 'fr'

  if (!user) return null

  return (
    <MobileLayout locale={locale} title={isFr ? 'Aide' : 'Help'} showBack>
      <div className="flex flex-col items-center text-center pt-10 pb-6 px-4">

        {/* Icône animée */}
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-30" />
          <div className="relative w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
            <BookOpen size={40} className="text-white" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {isFr ? 'Manuel d\'utilisation' : 'User Manual'}
        </h2>

        <div className="flex items-center gap-2 mb-4">
          <Wrench size={14} className="text-amber-300" />
          <span className="text-amber-300 text-sm font-semibold">
            {isFr ? 'En cours de préparation' : 'Under preparation'}
          </span>
        </div>

        <p className="text-blue-100 text-sm leading-relaxed max-w-xs mb-8">
          {isFr
            ? 'Le guide complet d\'utilisation de l\'application sera disponible très bientôt. Il expliquera comment créer une demande, suivre vos dossiers, communiquer avec les agents et bien plus encore.'
            : 'The complete application user guide will be available very soon. It will explain how to create a request, track your files, communicate with agents and much more.'}
        </p>

        <div className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <Clock size={20} className="text-blue-200 flex-shrink-0" />
          <p className="text-blue-100 text-sm text-left">
            {isFr
              ? 'En attendant, n\'hésitez pas à contacter le support si vous avez des questions.'
              : 'In the meantime, feel free to contact support if you have any questions.'}
          </p>
        </div>

      </div>
    </MobileLayout>
  )
}
