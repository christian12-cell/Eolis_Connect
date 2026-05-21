'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, UserPlus, CheckCircle, AlertCircle, ArrowLeft, Copy, Check, Phone, RefreshCw, WifiOff, Pencil } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { PhoneInput } from '@/components/ui/PhoneInput'

interface RegisterPageProps {
  params: Promise<{ locale: string }>
}

function PasswordStrength({ password, isFr }: { password: string; isFr: boolean }) {
  const checks = [
    { label: isFr ? '8+ caractères' : '8+ characters', ok: password.length >= 8 },
    { label: isFr ? 'Majuscule' : 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: isFr ? 'Chiffre' : 'Number', ok: /\d/.test(password) },
    { label: isFr ? 'Caractère spécial' : 'Special char', ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-emerald-500']
  const labels = isFr
    ? ['', 'Très faible', 'Faible', 'Moyen', 'Fort']
    : ['', 'Very weak', 'Weak', 'Medium', 'Strong']
  if (!password) return null
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {checks.map(c => (
          <span key={c.label} className={`text-xs flex items-center gap-1 ${c.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {c.label}
          </span>
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs font-medium ${score >= 4 ? 'text-emerald-600' : score >= 2 ? 'text-amber-600' : 'text-red-500'}`}>
          {labels[score]}
        </p>
      )}
    </div>
  )
}

export default function RegisterPage({ params }: RegisterPageProps) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '+237', password: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [createdUsername, setCreatedUsername] = useState('')
  const [createdUserId, setCreatedUserId] = useState('')
  const [copied, setCopied] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpResent, setOtpResent] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(30)
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phoneValid, setPhoneValid] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhoneValid, setNewPhoneValid] = useState(false)
  const [contactLoading, setContactLoading] = useState(false)
  const [contactError, setContactError] = useState('')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const on  = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const isFr = locale !== 'en'

  const t = {
    fr: {
      title: 'Créer votre compte client',
      subtitle: 'Accédez à Eolis Connect en quelques secondes',
      back: 'Choisir une autre langue',
      firstName: 'Prénom', lastName: 'Nom',
      email: 'Adresse email', phone: 'Téléphone',
      password: 'Mot de passe', confirmPassword: 'Confirmer le mot de passe',
      submit: 'Créer mon compte',
      haveAccount: 'Déjà un compte ?', loginHere: 'Connectez-vous ici',
      staffNote: 'Employé Eolis ? Votre compte est créé par votre administrateur système.',
      mismatch: 'Les mots de passe ne correspondent pas.',
      weak: 'Le mot de passe doit contenir au moins 8 caractères.',
      error: 'Une erreur est survenue. Réessayez.',
      emailTaken: 'Cette adresse email est déjà utilisée.',
      successTitle: 'Compte créé !',
      successSub: 'Notez votre nom d\'utilisateur et vérifiez votre téléphone pour accéder à votre compte.',
      warningOneTime: '⚠️ Cette page ne s\'affichera plus une fois que vous l\'aurez quittée.',
      yourUsername: 'Votre nom d\'utilisateur',
      usernameHint: 'Utilisez ce nom pour vous connecter à la place de votre email.',
      yourPassword: 'Votre mot de passe', passwordHint: 'C\'est le mot de passe que vous avez choisi lors de l\'inscription.',
      copy: 'Copier', copied: 'Copié !',
      goLogin: 'Me connecter maintenant',
      leftTitle: 'Espace client', leftDesc: 'Créez votre compte et soumettez vos demandes directement depuis chez vous.',
      leftFeats: ['Soumission rapide de demandes', 'Suivi en temps réel', 'Communication directe avec les agents'],
    },
    en: {
      title: 'Create your client account',
      subtitle: 'Access Eolis Connect in seconds',
      back: 'Choose another language',
      firstName: 'First name', lastName: 'Last name',
      email: 'Email address', phone: 'Phone number',
      password: 'Password', confirmPassword: 'Confirm password',
      submit: 'Create my account',
      haveAccount: 'Already have an account?', loginHere: 'Log in here',
      staffNote: 'Eolis employee? Your account is created by your system administrator.',
      mismatch: 'Passwords do not match.',
      weak: 'Password must contain at least 8 characters.',
      error: 'An error occurred. Please try again.',
      emailTaken: 'This email address is already in use.',
      successTitle: 'Account created!',
      successSub: 'Save your username and verify your phone to access your account.',
      warningOneTime: '⚠️ This page will not be shown again once you leave.',
      yourUsername: 'Your username',
      usernameHint: 'Use this name to log in instead of your email.',
      yourPassword: 'Your password', passwordHint: 'This is the password you chose during registration.',
      copy: 'Copy', copied: 'Copied!',
      goLogin: 'Log in now',
      leftTitle: 'Client portal', leftDesc: 'Create your account and submit your requests directly from home.',
      leftFeats: ['Quick request submission', 'Real-time tracking', 'Direct communication with agents'],
    },
  }
  const text = t[locale as keyof typeof t] ?? t.fr

  const formValid =
    form.firstName.trim() !== '' &&
    form.lastName.trim() !== '' &&
    form.email.trim() !== '' &&
    phoneValid &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword

  function update(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); setError('') }

  function startResendCountdown() {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    setResendCountdown(30)
    resendTimerRef.current = setInterval(() => {
      setResendCountdown(c => {
        if (c <= 1) { clearInterval(resendTimerRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function copyUsername() {
    await navigator.clipboard.writeText(createdUsername)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function verifyOtp(e?: React.FormEvent) {
    e?.preventDefault()
    setOtpLoading(true)
    setOtpError('')
    const res = await fetch(apiUrl('/api/auth/otp/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: form.phone, code: otpCode, userId: createdUserId }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.verified) {
      setOtpVerified(true)
    } else if (data.detail?.startsWith('otp_wrong:')) {
      const remaining = data.detail.split(':')[1]
      setOtpError(isFr ? `Code incorrect. ${remaining} tentative(s) restante(s).` : `Wrong code. ${remaining} attempt(s) left.`)
    } else if (data.detail === 'otp_max_attempts') {
      setOtpError(isFr ? 'Trop de tentatives. Renvoyez un nouveau code.' : 'Too many attempts. Resend a new code.')
    } else {
      setOtpError(isFr ? 'Code expiré ou invalide.' : 'Code expired or invalid.')
    }
    setOtpLoading(false)
  }

  async function updateContact(type: 'phone' | 'email') {
    setContactLoading(true)
    setContactError('')
    const payload: Record<string, string> = { userId: createdUserId }
    if (type === 'phone') payload.phone = newPhone
    if (type === 'email') payload.email = newEmail
    const res = await fetch(apiUrl('/api/auth/update-contact'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      if (type === 'phone') {
        setForm(f => ({ ...f, phone: newPhone }))
        setEditingPhone(false)
        setOtpVerified(false)
        setOtpCode('')
        setOtpError('')
        await fetch(apiUrl('/api/auth/otp/resend'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: newPhone, userId: createdUserId }),
        }).catch(() => {})
        setOtpResent(true)
        setTimeout(() => setOtpResent(false), 3000)
      } else {
        setForm(f => ({ ...f, email: newEmail }))
        setEditingEmail(false)
      }
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.detail === 'email_taken') setContactError(isFr ? 'Cet email est déjà utilisé.' : 'This email is already in use.')
      else if (data.detail === 'too_late') setContactError(isFr ? 'Délai de modification dépassé (1h).' : 'Edit window expired (1h).')
      else setContactError(isFr ? 'Erreur. Réessayez.' : 'Error. Please try again.')
    }
    setContactLoading(false)
  }

  async function resendOtp() {
    await fetch(apiUrl('/api/auth/otp/resend'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: form.phone, userId: createdUserId }),
    }).catch(() => {})
    setOtpError('')
    setOtpCode('')
    startResendCountdown()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phoneValid) {
      setError(isFr ? 'Numéro de téléphone invalide. Vérifiez le format pour votre pays.' : 'Invalid phone number. Please check the format for your country.')
      return
    }
    if (form.password !== form.confirmPassword) { setError(text.mismatch); return }
    if (form.password.length < 8) { setError(text.weak); return }
    setLoading(true)
    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, password: form.password, language: locale }),
    })
    if (res.ok) {
      const data = await res.json()
      setCreatedUsername(data.username ?? '')
      setCreatedUserId(data.userId ?? '')
      setSuccess(true)
      startResendCountdown()
      // Send OTP automatically right after account creation
      fetch(apiUrl('/api/auth/otp/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, userId: data.userId }),
      }).catch(() => {})
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.detail === 'email_taken' ? text.emailTaken : text.error)
    }
    setLoading(false)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen relative py-8 px-4">
        <Image src="/bg-auth.jpg" alt="" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0D1F33]/80" />
        <div className="relative z-10 w-full max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{text.successTitle}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{text.successSub}</p>
              </div>
            </div>
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              {text.warningOneTime}
            </div>
            <div className="mb-4 p-4 rounded-xl bg-[#1B3A5C]/5 border-2 border-[#1B3A5C]/25">
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">{text.yourUsername}</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl font-bold text-[#1B3A5C] font-mono tracking-wide truncate" title={createdUsername}>{createdUsername}</p>
                <button onClick={copyUsername}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-[#1B3A5C] text-white hover:bg-[#4A8FC4]'}`}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? text.copied : text.copy}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">{text.usernameHint}</p>
            </div>
            {/* Email edit */}
            <div className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{isFr ? 'Adresse email' : 'Email address'}</p>
                {!editingEmail && (
                  <button onClick={() => { setNewEmail(form.email); setEditingEmail(true); setContactError('') }}
                    className="flex items-center gap-1 text-xs text-[#4A8FC4] hover:underline">
                    <Pencil size={11} /> {isFr ? 'Modifier' : 'Edit'}
                  </button>
                )}
              </div>
              {!editingEmail ? (
                <p className="text-sm font-mono text-gray-700 break-all">{form.email}</p>
              ) : (
                <div className="space-y-2 mt-2">
                  <input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setContactError('') }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]" />
                  {contactError && <p className="text-xs text-red-500">{contactError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => updateContact('email')} disabled={!newEmail.includes('@') || !newEmail.includes('.') || contactLoading}
                      className="flex-1 py-1.5 rounded-lg bg-[#1B3A5C] text-white text-xs font-semibold disabled:opacity-50">
                      {contactLoading ? '...' : isFr ? 'Confirmer' : 'Confirm'}
                    </button>
                    <button onClick={() => { setEditingEmail(false); setContactError('') }}
                      className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
                      {isFr ? 'Annuler' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">{text.yourPassword}</p>
              <p className="text-lg font-mono font-bold text-[#1B3A5C] tracking-widest">
                {'•'.repeat(Math.max(4, form.password.length - 2))}{form.password.slice(-2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{text.passwordHint}</p>
            </div>

            {/* OTP verification section */}
            {form.phone && (
              <div className="mb-6 p-4 rounded-xl border border-[#4A8FC4]/30 bg-[#4A8FC4]/5">
                <div className="flex items-center gap-2 mb-3">
                  <Phone size={15} className="text-[#4A8FC4]" />
                  <p className="text-sm font-semibold text-[#1B3A5C]">
                    {isFr ? 'Vérifier votre numéro' : 'Verify your phone'}
                  </p>
                  {otpVerified && (
                    <span className="ml-auto flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                      <Check size={13} /> {isFr ? 'Vérifié' : 'Verified'}
                    </span>
                  )}
                </div>
                {!otpVerified ? (
                  <>
                    {!editingPhone ? (
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500">
                          {isFr ? `Un code à 6 chiffres a été envoyé au ${form.phone}` : `A 6-digit code was sent to ${form.phone}`}
                        </p>
                        <button onClick={() => { setNewPhone(form.phone); setEditingPhone(true); setContactError('') }}
                          className="flex-shrink-0 flex items-center gap-1 text-xs text-[#4A8FC4] hover:underline ml-2">
                          <Pencil size={11} /> {isFr ? 'Modifier' : 'Edit'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-3">
                        <PhoneInput value={newPhone} onChange={v => { setNewPhone(v); setContactError('') }} onValidChange={setNewPhoneValid} required />
                        {contactError && <p className="text-xs text-red-500">{contactError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => updateContact('phone')} disabled={!newPhoneValid || contactLoading}
                            className="flex-1 py-1.5 rounded-lg bg-[#1B3A5C] text-white text-xs font-semibold disabled:opacity-50">
                            {contactLoading ? '...' : isFr ? 'Confirmer & renvoyer' : 'Confirm & resend'}
                          </button>
                          <button onClick={() => { setEditingPhone(false); setContactError('') }}
                            className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
                            {isFr ? 'Annuler' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                    <input type="text" inputMode="numeric" maxLength={6} value={otpCode}
                      onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError('') }}
                      onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                      placeholder="_ _ _ _ _ _"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center font-mono text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                    />
                    {otpError && <p className="text-xs text-red-500 mt-1">{otpError}</p>}
                    <button type="button" onClick={resendOtp} disabled={resendCountdown > 0}
                      className="mt-1 flex items-center gap-1 text-xs text-[#4A8FC4] hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
                      <RefreshCw size={11} />
                      {resendCountdown > 0
                        ? (isFr ? `Renvoyer le code (${resendCountdown}s)` : `Resend code (${resendCountdown}s)`)
                        : (isFr ? 'Renvoyer le code' : 'Resend code')}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-emerald-600">
                    {isFr ? 'Téléphone vérifié avec succès.' : 'Phone verified successfully.'}
                  </p>
                )}
              </div>
            )}

            {otpVerified ? (
              <Link href={`/${locale}/login`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-[#1B3A5C] text-white hover:bg-[#152d47] transition-colors">
                {text.goLogin}
              </Link>
            ) : otpCode.length === 6 ? (
              <button type="button" onClick={() => verifyOtp()} disabled={otpLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-[#1B3A5C] text-white hover:bg-[#152d47] transition-colors disabled:opacity-60">
                {otpLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {isFr ? 'Vérification...' : 'Verifying...'}</>
                  : (isFr ? 'Vérifier mon numéro' : 'Verify my number')}
              </button>
            ) : (
              <button type="button" disabled
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-gray-200 text-gray-400 cursor-not-allowed">
                {isFr ? '✋ Vérifiez votre téléphone d\'abord' : '✋ Verify your phone first'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative flex items-start justify-center p-4 py-8">
      {/* Background */}
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/70" />

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white rounded-full p-1 shadow-md border border-gray-200">
        <button onClick={() => router.push('/fr/register')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${locale === 'fr' ? 'bg-[#1B3A5C] text-white' : 'text-gray-500 hover:text-gray-700'}`}>FR</button>
        <button onClick={() => router.push('/en/register')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${locale === 'en' ? 'bg-[#1B3A5C] text-white' : 'text-gray-500 hover:text-gray-700'}`}>EN</button>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 mt-10">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center">
            <Image src="/logo.png" alt="Eolis" width={28} height={28} className="object-contain" />
          </div>
          <div>
            <p className="font-bold text-[#1B3A5C] leading-tight">Eolis Connect</p>
            <p className="text-xs text-gray-400">Global Logistics Platform</p>
          </div>
        </div>

        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B3A5C] mb-5 transition-colors group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          {text.back}
        </Link>

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-gray-900">{text.title}</h2>
            <p className="text-gray-500 mt-1 text-sm">{text.subtitle}</p>
          </div>

          {/* Staff note */}
          <p className="mb-4 text-xs text-gray-400 text-center border-b border-gray-100 pb-4">{text.staffNote}</p>

          {isOffline && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <WifiOff size={16} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                {isFr
                  ? 'Vous êtes hors-ligne. La création de compte nécessite internet.'
                  : 'You are offline. Account creation requires an internet connection.'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">{text.firstName}</label>
                <input type="text" required value={form.firstName} onChange={e => update('firstName', e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">{text.lastName}</label>
                <input type="text" required value={form.lastName} onChange={e => update('lastName', e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">{text.email}</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">{text.phone}</label>
              <PhoneInput value={form.phone} onChange={v => { setForm(f => ({ ...f, phone: v })); setError('') }} onValidChange={setPhoneValid} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">{text.password}</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required value={form.password} onChange={e => update('password', e.target.value)}
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrength password={form.password} isFr={isFr} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">{text.confirmPassword}</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)}
                  className={`w-full px-4 py-2.5 pr-11 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[#4A8FC4]'}`} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
            <button type="submit" disabled={!formValid || loading || isOffline}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm">
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : <UserPlus size={16} />}
              {text.submit}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            {text.haveAccount}{' '}
            <Link href={`/${locale}/login`} className="text-[#4A8FC4] hover:text-[#1B3A5C] font-semibold">{text.loginHere}</Link>
          </p>
      </div>
    </div>
  )
}
