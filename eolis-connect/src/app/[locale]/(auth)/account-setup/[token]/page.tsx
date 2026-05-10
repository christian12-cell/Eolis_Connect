'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Copy, Check, AlertTriangle, LogIn, ShieldCheck } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'

interface PageProps {
  params: Promise<{ locale: string; token: string }>
}

type State = 'loading' | 'ok' | 'used' | 'expired' | 'error'

export default function AccountSetupPage({ params }: PageProps) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [state, setState]   = useState<State>('loading')
  const [data, setData]     = useState<{ username: string; tempPassword: string; firstName: string } | null>(null)
  const [copied, setCopied] = useState<'username' | 'password' | null>(null)

  useEffect(() => {
    params.then(async ({ locale: loc, token }) => {
      setLocale(loc)
      try {
        const res = await fetch(apiUrl(`/api/auth/account-setup/${token}`))
        if (res.ok) {
          const json = await res.json()
          setData(json)
          setState('ok')
        } else {
          const err = await res.json().catch(() => ({}))
          if (err.detail === 'already_used') setState('used')
          else if (err.detail === 'expired')  setState('expired')
          else setState('error')
        }
      } catch {
        setState('error')
      }
    })
  }, [params])

  const isFr = locale === 'fr'

  function copyText(text: string, field: 'username' | 'password') {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(field)
    setTimeout(() => setCopied(null), 2500)
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1F33]">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  // Invalid / used / expired states
  if (state !== 'ok') {
    const messages = {
      used: {
        title: isFr ? 'Lien déjà utilisé' : 'Link already used',
        body:  isFr
          ? 'Ce lien a déjà été ouvert et ne peut être consulté qu\'une seule fois. Contactez l\'administration si vous n\'avez pas pu noter vos identifiants.'
          : 'This link has already been opened and can only be viewed once. Contact your administrator if you didn\'t save your credentials.',
      },
      expired: {
        title: isFr ? 'Lien expiré' : 'Link expired',
        body:  isFr
          ? 'Ce lien a expiré (validité 48h). Contactez l\'administration pour en obtenir un nouveau.'
          : 'This link has expired (valid for 48h). Contact your administrator for a new one.',
      },
      error: {
        title: isFr ? 'Lien invalide' : 'Invalid link',
        body:  isFr ? 'Ce lien est invalide ou introuvable.' : 'This link is invalid or not found.',
      },
    }
    const m = messages[state as keyof typeof messages] ?? messages.error
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1F33] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">{m.title}</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">{m.body}</p>
          <button onClick={() => router.push(`/${locale}/login`)}
            className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] transition-colors">
            <LogIn size={15} /> {isFr ? 'Aller à la connexion' : 'Go to login'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1F33] p-4 relative">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover opacity-30" priority />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1B3A5C] to-[#2a5480] px-8 py-6 text-center">
          <Image src="/logo.png" alt="Eolis" width={44} height={44} className="mx-auto mb-3 object-contain" />
          <h1 className="text-white font-bold text-lg">Eolis Connect</h1>
          <p className="text-blue-200 text-xs mt-1">
            {isFr ? 'Vos identifiants de connexion' : 'Your login credentials'}
          </p>
        </div>

        <div className="px-8 py-6">

          {/* Welcome */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {isFr ? `Bienvenue, ${data!.firstName} !` : `Welcome, ${data!.firstName}!`}
              </p>
              <p className="text-xs text-gray-400">
                {isFr ? 'Notez vos identifiants ci-dessous' : 'Note down your credentials below'}
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs font-semibold text-amber-700 mb-1">
              ⚠️ {isFr ? 'Page à usage unique' : 'Single-use page'}
            </p>
            <p className="text-xs text-amber-600 leading-relaxed">
              {isFr
                ? 'Cette page ne s\'affichera plus une fois fermée. Copiez vos identifiants maintenant et conservez-les en sécurité.'
                : 'This page will not be shown again once closed. Copy your credentials now and keep them safe.'}
            </p>
          </div>

          {/* Username */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              {isFr ? 'Identifiant (login)' : 'Username (login)'}
            </label>
            <div className="flex items-center gap-2 p-3 bg-[#EFF6FF] rounded-xl border border-blue-100">
              <span className="flex-1 font-mono text-base font-bold text-[#1B3A5C] select-all">{data!.username}</span>
              <button onClick={() => copyText(data!.username, 'username')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3A5C] text-white text-xs font-semibold hover:bg-[#152d47] transition-colors flex-shrink-0">
                {copied === 'username' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'username' ? (isFr ? 'Copié !' : 'Copied!') : (isFr ? 'Copier' : 'Copy')}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              {isFr ? 'Mot de passe temporaire' : 'Temporary password'}
            </label>
            <div className="flex items-center gap-2 p-3 bg-[#F0FDF4] rounded-xl border border-emerald-100">
              <span className="flex-1 font-mono text-base font-bold text-emerald-700 select-all">{data!.tempPassword}</span>
              <button onClick={() => copyText(data!.tempPassword, 'password')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex-shrink-0">
                {copied === 'password' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'password' ? (isFr ? 'Copié !' : 'Copied!') : (isFr ? 'Copier' : 'Copy')}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">{isFr ? 'Prochaines étapes :' : 'Next steps:'}</p>
            {[
              isFr ? '1. Copiez votre identifiant et mot de passe ci-dessus' : '1. Copy your username and password above',
              isFr ? '2. Connectez-vous sur Eolis Connect' : '2. Log in to Eolis Connect',
              isFr ? '3. Allez dans Paramètres et changez votre mot de passe' : '3. Go to Settings and change your password',
            ].map((step, i) => (
              <p key={i} className="text-xs text-gray-500">{step}</p>
            ))}
          </div>

          <button onClick={() => router.push(`/${locale}/login`)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A5C] text-white text-sm font-bold hover:bg-[#152d47] transition-colors">
            <LogIn size={16} /> {isFr ? 'Aller à la connexion' : 'Go to login'}
          </button>
        </div>
      </div>
    </div>
  )
}
