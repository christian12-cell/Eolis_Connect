'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Send } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { PhoneInput } from '@/components/ui/PhoneInput'

export default function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('fr')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+237')
  const [phoneValid, setPhoneValid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  const isFr = locale !== 'en'

  const t = {
    fr: {
      title: 'Mot de passe oublié',
      desc: 'Entrez votre email et votre numéro de téléphone. Nous vous enverrons le lien de réinitialisation par email et par SMS.',
      email: 'Adresse email',
      phone: 'Numéro de téléphone',
      submit: 'Envoyer le lien',
      sentTitle: 'Lien envoyé !',
      sentMsg: 'Si un compte correspond à cet email, vous recevrez un lien de réinitialisation par email et par SMS dans les prochaines minutes.',
      sentWarn: '⚠️ Ce lien est à usage unique et expirera après 48h. Une fois utilisé, il ne pourra plus être réutilisé.',
      backToLogin: 'Retour à la connexion',
      error: 'Une erreur est survenue. Réessayez.',
    },
    en: {
      title: 'Forgot password',
      desc: 'Enter your email and phone number. We will send you a reset link by email and SMS.',
      email: 'Email address',
      phone: 'Phone number',
      submit: 'Send reset link',
      sentTitle: 'Link sent!',
      sentMsg: 'If an account matches this email, you will receive a reset link by email and SMS within the next few minutes.',
      sentWarn: '⚠️ This link is single-use and will expire after 48h. Once used, it cannot be reused.',
      backToLogin: 'Back to login',
      error: 'An error occurred. Please try again.',
    },
  }
  const text = t[locale as keyof typeof t] ?? t.fr

  const canSubmit = email.includes('@') && email.includes('.') && phoneValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone }),
      })
      setSent(true)
    } catch {
      setError(text.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/75" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Image src="/logo.png" alt="Eolis" width={28} height={28} className="object-contain" />
          </div>
          <span className="font-bold text-white text-lg">Eolis Connect</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{text.sentTitle}</h2>
              <p className="text-gray-500 text-sm mb-4 leading-relaxed">{text.sentMsg}</p>
              <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium text-left leading-relaxed">
                {text.sentWarn}
              </div>
              <Link href={`/${locale}/login`}
                className="inline-flex items-center gap-2 text-[#4A8FC4] hover:text-[#1B3A5C] text-sm font-medium">
                <ArrowLeft size={16} /> {text.backToLogin}
              </Link>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-[#1B3A5C]/10 flex items-center justify-center mb-5">
                <Mail className="w-7 h-7 text-[#1B3A5C]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{text.title}</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{text.desc}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">{text.email}</label>
                  <input type="email" required value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder={isFr ? 'vous@exemple.com' : 'you@example.com'}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">{text.phone}</label>
                  <PhoneInput value={phone} onChange={v => { setPhone(v); setError('') }} onValidChange={setPhoneValid} required />
                </div>

                {error && (
                  <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <p className="text-xs">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={!canSubmit || loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                  {loading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : <Send size={16} />}
                  {text.submit}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href={`/${locale}/login`}
                  className="inline-flex items-center gap-2 text-[#4A8FC4] hover:text-[#1B3A5C] text-sm font-medium">
                  <ArrowLeft size={16} /> {text.backToLogin}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
