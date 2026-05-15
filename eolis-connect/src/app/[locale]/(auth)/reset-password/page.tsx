'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, KeyRound, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'

export default function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [locale, setLocale] = useState('fr')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenChecked, setTokenChecked] = useState(false)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    if (!token) { setTokenChecked(true); return }
    fetch(apiUrl(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`))
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data.detail === 'already_used') setError('already_used')
          else if (data.detail === 'expired') setError('expired')
          else setError('invalid_token')
        }
      })
      .catch(() => {})
      .finally(() => setTokenChecked(true))
  }, [token])

  const t = {
    fr: {
      title: 'Nouveau mot de passe',
      desc: 'Créez un nouveau mot de passe sécurisé pour votre compte.',
      newPass: 'Nouveau mot de passe',
      confirm: 'Confirmer le mot de passe',
      submit: 'Réinitialiser le mot de passe',
      successTitle: 'Mot de passe réinitialisé !',
      successMsg: 'Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.',
      goToLogin: 'Se connecter',
      mismatch: 'Les mots de passe ne correspondent pas.',
      weak: 'Le mot de passe doit contenir au moins 8 caractères.',
      invalidToken: 'Ce lien est invalide ou expiré.',
      alreadyUsed: 'Ce lien a déjà été utilisé. Faites une nouvelle demande.',
      expired: 'Ce lien a expiré (48h). Faites une nouvelle demande.',
      error: 'Une erreur est survenue.',
      backToLogin: 'Retour à la connexion',
    },
    en: {
      title: 'New password',
      desc: 'Create a new secure password for your account.',
      newPass: 'New password',
      confirm: 'Confirm password',
      submit: 'Reset password',
      successTitle: 'Password reset!',
      successMsg: 'Your password has been updated. You can now log in.',
      goToLogin: 'Log in',
      mismatch: 'Passwords do not match.',
      weak: 'Password must contain at least 8 characters.',
      invalidToken: 'This link is invalid or expired.',
      alreadyUsed: 'This link has already been used. Please request a new one.',
      expired: 'This link has expired (48h). Please request a new one.',
      error: 'An error occurred.',
      backToLogin: 'Back to login',
    },
  }
  const text = t[locale as keyof typeof t] ?? t.fr

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError(text.mismatch); return }
    if (password.length < 8) { setError(text.weak); return }
    if (!token) { setError(text.invalidToken); return }

    setLoading(true)
    setError('')

    const res = await fetch(apiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    if (res.ok) {
      setSuccess(true)
      setTimeout(() => router.push(`/${locale}/login`), 3000)
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.detail === 'already_used') setError((text as any).alreadyUsed)
      else if (data.detail === 'expired') setError((text as any).expired)
      else if (data.detail === 'invalid_token') setError(text.invalidToken)
      else setError(text.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/75" />
      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Image src="/logo.png" alt="Eolis" width={28} height={28} className="object-contain" />
          </div>
          <span className="font-bold text-white text-lg">Eolis Connect</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{text.successTitle}</h2>
              <p className="text-gray-500 text-sm mb-8">{text.successMsg}</p>
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] transition-colors"
              >
                {text.goToLogin}
              </Link>
            </div>
          ) : (
            <>
              {!token || (tokenChecked && error && ['already_used', 'expired', 'invalid_token'].includes(error)) ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-7 h-7 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">
                    {!token ? text.invalidToken
                      : error === 'already_used' ? (text as any).alreadyUsed
                      : error === 'expired' ? (text as any).expired
                      : text.invalidToken}
                  </h2>
                  <Link href={`/${locale}/forgot-password`} className="inline-flex items-center gap-2 text-[#4A8FC4] text-sm font-medium">
                    <ArrowLeft size={16} /> {locale === 'fr' ? 'Demander un nouveau lien' : 'Request a new link'}
                  </Link>
                </div>
              ) : !tokenChecked ? (
                <div className="flex justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-[#1B3A5C]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#1B3A5C]/10 flex items-center justify-center mb-5">
                    <KeyRound className="w-7 h-7 text-[#1B3A5C]" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{text.title}</h2>
                  <p className="text-gray-500 text-sm mb-6">{text.desc}</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">{text.newPass}</label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'} required value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                        />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">{text.confirm}</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'} required value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className={`w-full px-4 py-3 pr-11 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                            confirmPassword && password !== confirmPassword
                              ? 'border-red-400 focus:ring-red-300'
                              : 'border-gray-200 focus:ring-[#4A8FC4]'
                          }`}
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                        <p className="text-xs">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-60 transition-all"
                    >
                      {loading && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {text.submit}
                    </button>
                  </form>

                  <div className="mt-6 text-center">
                    <Link href={`/${locale}/login`} className="inline-flex items-center gap-2 text-[#4A8FC4] hover:text-[#1B3A5C] text-sm font-medium">
                      <ArrowLeft size={16} /> {text.backToLogin}
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
