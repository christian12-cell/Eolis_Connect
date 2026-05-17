'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, LogIn, AlertCircle, UserX, KeyRound, ArrowLeft, WifiOff } from 'lucide-react'
import { apiUrl, saveSession } from '@/lib/api-client'

interface LoginPageProps {
  params: Promise<{ locale: string }>
}

export default function LoginPage({ params }: LoginPageProps) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [errorType, setErrorType] = useState<'username' | 'password' | 'blocked' | 'generic' | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  // 2FA state
  const [step, setStep]           = useState<'credentials' | '2fa'>('credentials')
  const [preToken, setPreToken]   = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [otpCode, setOtpCode]     = useState('')
  const [countdown, setCountdown] = useState(0)
  const [resending, setResending] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  function startCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(30)
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (step === '2fa') startCountdown()
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [step])

  useEffect(() => {
    fetch(apiUrl('/api/maintenance/status'))
      .then(r => r.json())
      .then(d => { if (d.active) router.replace(`/${locale}/maintenance`) })
      .catch(() => {})
  }, [locale])

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const on  = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const t = {
    fr: {
      title: 'Connexion',
      subtitle: 'Gérez vos demandes en toute simplicité',
      username: "Nom d'utilisateur",
      usernamePlaceholder: 'Debora.DENMEKO',
      password: 'Mot de passe',
      login: 'Se connecter',
      noAccount: "Pas encore de compte ?",
      registerHere: 'Créez-en un ici',
      forgotPassword: 'Mot de passe oublié ?',
      userNotFound: "Ce nom d'utilisateur n'existe pas dans notre système.",
      wrongPassword: 'Mot de passe incorrect. Vérifiez et réessayez.',
      blockedMessage: "Votre compte est suspendu ou refusé. Contactez l'administrateur.",
      genericError: 'Une erreur est survenue. Réessayez.',
      tagline: 'Ensemble, tissons des liens...',
    },
    en: {
      title: 'Sign in',
      subtitle: 'Manage your requests with ease',
      username: 'Username',
      usernamePlaceholder: 'Debora.DENMEKO',
      password: 'Password',
      login: 'Log in',
      noAccount: "Don't have an account?",
      registerHere: 'Create one here',
      forgotPassword: 'Forgot password?',
      userNotFound: 'This username does not exist in our system.',
      wrongPassword: 'Incorrect password. Please check and try again.',
      blockedMessage: 'Your account is suspended or rejected. Contact the administrator.',
      genericError: 'An error occurred. Please try again.',
      tagline: 'Together, weaving connections...',
    },
  }

  const text = t[locale as keyof typeof t] ?? t.fr

  const roleRoutes: Record<string, string> = {
    CLIENT:        `/${locale}/accueil`,
    AGENT:         `/${locale}/agent/dashboard`,
    OPS_ADMIN:     `/${locale}/ops/dashboard`,
    SYSTEM_ADMIN:  `/${locale}/admin/dashboard`,
    FINANCE_AGENT: `/${locale}/finance/dashboard`,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setErrorType(null)

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json()

        // 2FA required — switch to OTP step
        if (data.requires_2fa) {
          setPreToken(data.pre_token)
          setMaskedPhone(data.masked_phone ?? '')
          setStep('2fa')
          setLoading(false)
          return
        }

        const token = data.accessToken ?? data.access_token
        const user  = data.user
        if (!token || !user) {
          setError(text.genericError); setErrorType('generic'); setLoading(false); return
        }
        saveSession(token, user)
        let dest = roleRoutes[user.role] ?? `/${locale}/accueil`
        if (user.role === 'CLIENT') {
          const favPage = localStorage.getItem('eolis_fav_page') ?? 'accueil'
          dest = `/${locale}/${favPage}`
        }
        window.location.href = dest
        return
      }

      const err = await res.json().catch(() => ({}))
      const detail = err.detail ?? ''

      if (detail === 'not_found') {
        setError(text.userNotFound)
        setErrorType('username')
      } else if (detail === 'wrong_password') {
        setError(text.wrongPassword)
        setErrorType('password')
      } else if (detail === 'blocked') {
        setError(text.blockedMessage)
        setErrorType('blocked')
      } else {
        setError(text.genericError)
        setErrorType('generic')
      }
    } catch {
      if (!navigator.onLine) {
        setError(locale === 'fr'
          ? 'Vous êtes hors-ligne. La connexion nécessite internet.'
          : 'You are offline. Login requires an internet connection.')
      } else {
        setError(text.genericError)
      }
      setErrorType('generic')
    }

    setLoading(false)
  }

  async function handleResend2FA() {
    setResending(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/resend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_token: preToken }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreToken(data.pre_token)
        setOtpCode('')
        startCountdown()
      } else {
        const err = await res.json().catch(() => ({}))
        if (err.detail === 'too_soon')
          setError(locale === 'fr' ? 'Attendez avant de renvoyer un code.' : 'Please wait before requesting a new code.')
        else if (err.detail === 'invalid_pre_token')
          setError(locale === 'fr' ? 'Session expirée. Reconnectez-vous.' : 'Session expired. Please log in again.')
        else
          setError(locale === 'fr' ? 'Échec du renvoi. Réessayez.' : 'Failed to resend. Please try again.')
      }
    } catch {
      setError(locale === 'fr' ? 'Échec du renvoi. Réessayez.' : 'Failed to resend. Please try again.')
    }
    setResending(false)
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault()
    if (otpCode.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_token: preToken, code: otpCode }),
      })
      if (res.ok) {
        const data  = await res.json()
        const token = data.accessToken ?? data.access_token
        const user  = data.user
        saveSession(token, user)
        window.location.href = roleRoutes[user.role] ?? `/${locale}/accueil`
        return
      }
      const err    = await res.json().catch(() => ({}))
      const detail = err.detail ?? ''
      if (detail === 'wrong_code')         setError(locale === 'fr' ? 'Code incorrect. Réessayez.' : 'Incorrect code. Please try again.')
      else if (detail === 'otp_expired')   setError(locale === 'fr' ? 'Code expiré. Reconnectez-vous.' : 'Code expired. Please log in again.')
      else if (detail === 'too_many_attempts') setError(locale === 'fr' ? 'Trop de tentatives. Reconnectez-vous.' : 'Too many attempts. Please log in again.')
      else if (detail === 'invalid_pre_token') { setStep('credentials'); setError(locale === 'fr' ? 'Session expirée. Reconnectez-vous.' : 'Session expired. Please log in again.') }
      else setError(text.genericError)
    } catch {
      setError(text.genericError)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/70" />

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white rounded-full p-1 shadow-md border border-gray-200">
        <button onClick={() => router.push('/fr/login')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${locale === 'fr' ? 'bg-[#1B3A5C] text-white' : 'text-gray-500 hover:text-gray-700'}`}>FR</button>
        <button onClick={() => router.push('/en/login')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${locale === 'en' ? 'bg-[#1B3A5C] text-white' : 'text-gray-500 hover:text-gray-700'}`}>EN</button>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center">
            <Image src="/logo.png" alt="Eolis" width={28} height={28} className="object-contain" />
          </div>
          <div>
            <p className="font-bold text-[#1B3A5C] leading-tight">Eolis Connect</p>
            <p className="text-xs text-gray-400">Global Logistics Platform</p>
          </div>
        </div>

        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B3A5C] mb-5 transition-colors group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          {locale === 'fr' ? 'Choisir une autre langue' : 'Choose another language'}
        </Link>

        {/* ── STEP 2FA ── */}
        {step === '2fa' ? (
          <div>
            <div className="mb-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1B3A5C]/10 flex items-center justify-center mx-auto mb-3">
                <KeyRound size={26} className="text-[#1B3A5C]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {locale === 'fr' ? 'Vérification en 2 étapes' : 'Two-step verification'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {locale === 'fr'
                  ? `Un code a été envoyé par SMS au ${maskedPhone}`
                  : `A code was sent by SMS to ${maskedPhone}`}
              </p>
            </div>

            <form onSubmit={handle2FA} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1.5">
                  {locale === 'fr' ? 'Code à 6 chiffres' : '6-digit code'}
                </label>
                <input
                  type="text" inputMode="numeric" maxLength={6} value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                  placeholder="000000" autoFocus
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-[#1B3A5C]"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading || otpCode.length !== 6}
                className="w-full py-3.5 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {locale === 'fr' ? 'Vérification...' : 'Verifying...'}</>
                  : <>{locale === 'fr' ? 'Valider le code' : 'Verify code'}</>}
              </button>

              <button
                type="button"
                onClick={handleResend2FA}
                disabled={countdown > 0 || resending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resending ? (
                  <span className="w-3.5 h-3.5 border-2 border-gray-400/30 border-t-gray-500 rounded-full animate-spin" />
                ) : null}
                {countdown > 0
                  ? (locale === 'fr' ? `Renvoyer le code (${countdown}s)` : `Resend code (${countdown}s)`)
                  : (locale === 'fr' ? 'Renvoyer le code' : 'Resend code')}
              </button>

              {countdown === 0 && (
                <p className="text-center text-xs text-gray-400">
                  {locale === 'fr' ? 'Code non reçu ? ' : 'Code not received? '}
                  <a href="mailto:support@eolisconnect.online" className="text-[#4A8FC4] underline font-medium">
                    support@eolisconnect.online
                  </a>
                </p>
              )}

              <button type="button" onClick={() => { setStep('credentials'); setOtpCode(''); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 mt-1">
                ← {locale === 'fr' ? 'Retour à la connexion' : 'Back to login'}
              </button>
            </form>
          </div>
        ) : (
        <>

        <div className="mb-7">
          <h2 className="text-2xl font-bold text-gray-900">{text.title}</h2>
          <p className="text-gray-500 mt-1 text-sm">{text.subtitle}</p>
        </div>

        {isOffline && (
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <WifiOff size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              {locale === 'fr'
                ? 'Vous êtes hors-ligne. La connexion à votre compte nécessite internet.'
                : 'You are offline. Logging into your account requires an internet connection.'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">{text.username}</label>
            <input type="text" value={username}
              onChange={e => { setUsername(e.target.value); setError(''); setErrorType(null) }}
              placeholder={text.usernamePlaceholder} required autoComplete="username"
              className={`w-full px-4 py-3 rounded-xl border bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${errorType === 'username' ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[#4A8FC4]'}`}
            />
            {errorType === 'username' && (
              <div className="flex gap-2 items-start text-red-600">
                <UserX size={14} className="mt-0.5 flex-shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{text.password}</label>
              <Link href={`/${locale}/forgot-password`} className="text-xs text-[#4A8FC4] hover:text-[#1B3A5C] font-medium">{text.forgotPassword}</Link>
            </div>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); setErrorType(null) }}
                placeholder="••••••••" required autoComplete="current-password"
                className={`w-full px-4 py-3 pr-12 rounded-xl border bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${errorType === 'password' ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[#4A8FC4]'}`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errorType === 'password' && (
              <div className="flex gap-2 items-start text-red-600">
                <KeyRound size={14} className="mt-0.5 flex-shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            )}
          </div>

          {(errorType === 'generic' || errorType === 'blocked') && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || isOffline}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] active:bg-[#0f2035] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm">
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : <LogIn size={16} />}
            {text.login}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-gray-500">
          {text.noAccount}{' '}
          <Link href={`/${locale}/register`} className="text-[#4A8FC4] hover:text-[#1B3A5C] font-semibold">{text.registerHere}</Link>
        </p>

        <p className="mt-4 text-center text-xs text-gray-400 italic">&ldquo;{text.tagline}&rdquo;</p>
        </>
        )}
      </div>
    </div>
  )
}
