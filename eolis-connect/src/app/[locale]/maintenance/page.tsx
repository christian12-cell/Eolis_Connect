'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Wrench, Clock, ShieldCheck, LogIn, Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'

export default function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [status, setStatus] = useState<{ active: boolean; message: string | null; estimatedReturn: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    fetch(apiUrl('/api/maintenance/status'))
      .then(r => r.json())
      .then(d => {
        if (!d.active) {
          router.replace(`/${locale}/login`)
          return
        }
        setStatus(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [locale])

  const isFr = locale === 'fr'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1F33]">
        <Loader2 size={32} className="animate-spin text-white/40" />
      </div>
    )
  }

  if (!status) return null

  const eta = status.estimatedReturn
    ? new Date(status.estimatedReturn).toLocaleString(isFr ? 'fr-FR' : 'en-GB', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/85" />

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-4 shadow-2xl">
            <Image src="/logo.png" alt="Eolis Connect" width={56} height={56} className="object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Eolis Connect</h1>
        </div>

        {/* Card */}
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl space-y-6">

          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <Wrench size={26} className="text-amber-300" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {isFr ? 'Maintenance en cours' : 'Maintenance in progress'}
            </h2>
            <p className="text-white/60 text-sm">
              {isFr
                ? 'La plateforme est temporairement indisponible.'
                : 'The platform is temporarily unavailable.'}
            </p>
          </div>

          {/* Admin message */}
          {status.message && (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-left">
              <p className="text-white/90 text-sm leading-relaxed">{status.message}</p>
            </div>
          )}

          {/* ETA */}
          {eta && (
            <div className="flex items-center gap-3 bg-amber-500/15 border border-amber-400/30 rounded-xl px-4 py-3">
              <Clock size={16} className="text-amber-300 flex-shrink-0" />
              <div className="text-left">
                <p className="text-[10px] text-amber-300/70 font-semibold uppercase tracking-wide">
                  {isFr ? 'Retour estimé' : 'Estimated return'}
                </p>
                <p className="text-amber-200 text-sm font-semibold">{eta}</p>
              </div>
            </div>
          )}

          {/* Data safety */}
          <div className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-4 py-3">
            <ShieldCheck size={16} className="text-emerald-300 flex-shrink-0" />
            <p className="text-emerald-200 text-sm text-left">
              {isFr
                ? 'Vos données sont entièrement sécurisées. Aucune information ne sera perdue.'
                : 'Your data is fully secure. No information will be lost.'}
            </p>
          </div>

          {/* Back to login */}
          <button
            onClick={() => router.push(`/${locale}/login`)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-colors"
          >
            <LogIn size={15} />
            {isFr ? 'Retour à la connexion' : 'Back to login'}
          </button>
        </div>

        <p className="text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} Eolis Connect
        </p>
      </div>
    </div>
  )
}
